// ============================================================
// PeerManager — WebRTC via PeerJS (custom transport, no pooling)
// ============================================================

import Peer, { DataConnection } from 'peerjs';
import {
  NetworkMessage, LobbyState, LobbySlot,
  generateRoomCode, createLobby, generateResumeKey,
  serializeGameStateForViewer,
  deserializeGameState,
} from './protocol';
import { GameState, Difficulty } from '../engine/types';
import {
  buildPeerOptions,
  hostPeerId,
  peerErrorMessage,
  peerErrorType,
  sleep,
} from './peer-transport';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PeerManagerCallbacks {
  onStatusChange: (status: ConnectionStatus) => void;
  onLobbyUpdate: (lobby: LobbyState) => void;
  onGameStart: (state: GameState, playerIndex: number) => void;
  onGameStateSync: (state: GameState) => void;
  /** Fired when a player reclaims a seat mid-game */
  onPlayerRejoined?: (playerIndex: number, playerName: string) => void;
  /** Fired when a human disconnects mid-game (host may AI-drive after a grace period) */
  onPlayerDisconnected?: (playerIndex: number) => void;
  /** Host only — playerIndex is the authenticated seat for this connection */
  onGameAction: (
    action: NetworkMessage & { type: 'game_action' },
    playerIndex: number,
  ) => void;
  onCharlestonTiles: (playerIndex: number, tileIds: number[]) => void;
  onCharlestonControl?: (kind: 'skip_pass' | 'skip_rest', playerIndex: number) => void;
  onChat: (playerName: string, message: string) => void;
  onError: (error: string) => void;
}

const JOIN_ATTEMPTS = 3;
const HOST_ID_ATTEMPTS = 5;
const JOIN_TIMEOUT_MS = 28000;
const HOST_OPEN_TIMEOUT_MS = 20000;
const KEEPALIVE_MS = 8000;

export class PeerManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private callbacks: PeerManagerCallbacks;
  private _isHost = false;
  private _roomCode = '';
  private _playerIndex = 0;
  private _resumeKey = '';
  private lobby: LobbyState | null = null;
  private hostConnection: DataConnection | null = null;
  private gameInProgress = false;
  private lastGameState: GameState | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;

  constructor(callbacks: PeerManagerCallbacks) {
    this.callbacks = callbacks;
  }

  updateCallbacks(callbacks: Partial<PeerManagerCallbacks>) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  get isHost() { return this._isHost; }
  get roomCode() { return this._roomCode; }
  get playerIndex() { return this._playerIndex; }
  get peerId() { return this.peer?.id ?? ''; }
  get resumeKey() { return this._resumeKey; }
  get isGameInProgress() { return this.gameInProgress; }

  /** Immutable lobby snapshot so React always sees a new reference */
  private snapshotLobby(): LobbyState | null {
    if (!this.lobby) return null;
    return {
      roomCode: this.lobby.roomCode,
      hostName: this.lobby.hostName,
      maxPlayers: this.lobby.maxPlayers,
      slots: this.lobby.slots.map(s => ({ ...s })),
    };
  }

  /** Replace lobby with a cloned copy after in-place edits */
  private commitLobby(): LobbyState | null {
    const snap = this.snapshotLobby();
    this.lobby = snap;
    return snap;
  }

  /** Create a new room as host */
  async createRoom(playerName: string): Promise<string> {
    await this.hardReset();
    this._isHost = true;
    this._playerIndex = 0;
    this._roomCode = generateRoomCode();
    this.callbacks.onStatusChange('connecting');

    const peerId = hostPeerId(this._roomCode);
    let lastErr: unknown;

    for (let attempt = 1; attempt <= HOST_ID_ATTEMPTS; attempt++) {
      try {
        await this.openHostPeer(peerId);
        this.lobby = createLobby(this._roomCode, playerName);
        this._resumeKey = this.lobby.slots[0]?.resumeKey ?? '';
        this.callbacks.onStatusChange('connected');
        this.callbacks.onLobbyUpdate(this.commitLobby() ?? this.lobby);
        this.startKeepalive();
        return this._roomCode;
      } catch (err) {
        lastErr = err;
        const type = peerErrorType(err);
        // PeerJS cloud holds IDs briefly — destroy + wait clears that pool
        await this.destroyPeerOnly();
        if (type === 'unavailable-id' || type === 'network' || type === 'server-error') {
          await sleep(600 * attempt);
          continue;
        }
        break;
      }
    }

    this.callbacks.onStatusChange('error');
    const msg = peerErrorMessage(lastErr) || 'Could not open a table. Try again.';
    this.callbacks.onError(`Host error: ${msg}`);
    throw lastErr instanceof Error ? lastErr : new Error(msg);
  }

  private openHostPeer(peerId: string): Promise<void> {
    const gen = ++this.generation;
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled || gen !== this.generation) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(() => {
        settle(() => reject(new Error('Host signaling timed out — check your connection.')));
      }, HOST_OPEN_TIMEOUT_MS);

      const peer = new Peer(peerId, buildPeerOptions());
      this.peer = peer;

      peer.on('open', () => {
        settle(() => resolve());
      });

      peer.on('connection', conn => {
        if (gen !== this.generation) {
          conn.close();
          return;
        }
        this.handleIncomingConnection(conn);
      });

      peer.on('disconnected', () => {
        // Try to reattach to signaling without dropping data channels
        if (gen === this.generation && peer && !peer.destroyed) {
          try {
            peer.reconnect();
          } catch {
            /* ignore */
          }
        }
      });

      peer.on('error', err => {
        // Only fail createRoom if we never opened; later errors are soft
        if (!settled) {
          settle(() => reject(err));
        } else if (peerErrorType(err) !== 'peer-unavailable') {
          this.callbacks.onError(`Host warning: ${peerErrorMessage(err)}`);
        }
      });
    });
  }

  /** Join an existing room as client (optional seat key to reclaim a disconnected hand) */
  async joinRoom(roomCode: string, playerName: string, resumeKey?: string): Promise<void> {
    await this.hardReset();
    this._isHost = false;
    this._roomCode = roomCode.trim().toUpperCase();
    this.callbacks.onStatusChange('connecting');

    let lastErr: unknown;
    for (let attempt = 1; attempt <= JOIN_ATTEMPTS; attempt++) {
      try {
        await this.joinOnce(this._roomCode, playerName, resumeKey);
        this.startKeepalive();
        return;
      } catch (err) {
        lastErr = err;
        await this.destroyPeerOnly();
        // PeerJS holds connection offers ~5s; wait past that pool before retry
        if (attempt < JOIN_ATTEMPTS) {
          await sleep(1600 * attempt);
        }
      }
    }

    this.callbacks.onStatusChange('error');
    const msg =
      lastErr instanceof Error
        ? lastErr.message
        : peerErrorMessage(lastErr) || 'Could not join — check the code and try again.';
    this.callbacks.onError(msg);
    throw lastErr instanceof Error ? lastErr : new Error(msg);
  }

  private joinOnce(
    roomCode: string,
    playerName: string,
    resumeKey?: string,
  ): Promise<void> {
    const gen = ++this.generation;
    const hostId = hostPeerId(roomCode);

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled || gen !== this.generation) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(() => {
        settle(() =>
          reject(new Error('Join timed out — check the room code and that the host is still online.')),
        );
      }, JOIN_TIMEOUT_MS);

      const peer = new Peer(buildPeerOptions());
      this.peer = peer;

      peer.on('open', () => {
        if (gen !== this.generation) return;

        // Never reuse a pooled DataConnection — always a fresh reliable channel
        const conn = peer.connect(hostId, {
          reliable: true,
          serialization: 'json',
        });

        conn.on('open', () => {
          if (gen !== this.generation) {
            conn.close();
            return;
          }
          this.hostConnection = conn;
          this.connections.set(hostId, conn);
          this.wireClientConnection(conn, settle, resolve, reject, playerName, resumeKey);
        });

        conn.on('error', err => {
          settle(() => reject(err instanceof Error ? err : new Error(peerErrorMessage(err))));
        });
      });

      peer.on('disconnected', () => {
        if (gen === this.generation && peer && !peer.destroyed) {
          try {
            peer.reconnect();
          } catch {
            /* ignore */
          }
        }
      });

      peer.on('error', err => {
        const type = peerErrorType(err);
        if (type === 'peer-unavailable') {
          settle(() =>
            reject(new Error(`Room "${roomCode}" not found. Check the code and try again.`)),
          );
        } else if (!settled) {
          settle(() => reject(err instanceof Error ? err : new Error(peerErrorMessage(err))));
        }
      });
    });
  }

  private wireClientConnection(
    conn: DataConnection,
    settle: (fn: () => void) => void,
    resolve: () => void,
    reject: (err: Error) => void,
    playerName: string,
    resumeKey?: string,
  ) {
    this.send(conn, {
      type: 'join_request',
      payload: {
        playerName,
        resumeKey: resumeKey?.trim().toUpperCase() || undefined,
      },
    });

    conn.on('data', data => {
      const msg = data as NetworkMessage;
      this.handleMessage(msg, conn);
      if (msg.type === 'join_accepted') {
        settle(() => resolve());
      } else if (msg.type === 'join_rejected') {
        settle(() => reject(new Error(msg.payload.reason)));
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.hostConnection === conn) this.hostConnection = null;
      this.callbacks.onStatusChange('disconnected');
      this.callbacks.onError('Connection to host lost');
      settle(() => reject(new Error('Connection to host lost')));
    });
  }

  /** Handle incoming connection (host only) */
  private handleIncomingConnection(conn: DataConnection) {
    // Accept immediately — do not wait on PeerJS connection pooling
    this.connections.set(conn.peer, conn);

    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', data => {
      this.handleMessage(data as NetworkMessage, conn);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.lobby) {
        const slot = this.lobby.slots.find(s => s.peerId === conn.peer);
        if (slot) {
          slot.connected = false;
          if (slot.type === 'human') {
            this.broadcastLobbyUpdate();
            if (this.gameInProgress) {
              this.callbacks.onPlayerDisconnected?.(slot.index);
            }
          } else {
            this.broadcastLobbyUpdate();
          }
        }
      }
    });

    conn.on('error', () => {
      /* close handler cleans up */
    });
  }

  /** Handle incoming message */
  private handleMessage(msg: NetworkMessage, conn: DataConnection) {
    switch (msg.type) {
      case 'join_request':
        this.handleJoinRequest(msg.payload.playerName, conn, msg.payload.resumeKey);
        break;

      case 'join_accepted':
        this._playerIndex = msg.payload.playerIndex;
        this.lobby = {
          ...msg.payload.lobbyState,
          slots: msg.payload.lobbyState.slots.map(s => ({ ...s })),
        };
        if (msg.payload.resumeKey) this._resumeKey = msg.payload.resumeKey;
        this.callbacks.onStatusChange('connected');
        this.callbacks.onLobbyUpdate(this.lobby);
        break;

      case 'join_rejected':
        this.callbacks.onError(msg.payload.reason);
        break;

      case 'lobby_update':
        this.lobby = {
          ...msg.payload,
          slots: msg.payload.slots.map(s => ({ ...s })),
        };
        {
          const mine = this.lobby.slots[this._playerIndex];
          if (mine?.resumeKey) this._resumeKey = mine.resumeKey;
        }
        this.callbacks.onLobbyUpdate(this.lobby);
        break;

      case 'game_start':
        this.callbacks.onGameStart(
          deserializeGameState(msg.payload.gameState),
          this._playerIndex,
        );
        break;

      case 'game_state_sync':
        this.callbacks.onGameStateSync(deserializeGameState(msg.payload.gameState));
        break;

      case 'game_action': {
        const seat = this.seatIndexForPeer(conn.peer);
        if (seat === null) break;
        this.callbacks.onGameAction(msg, seat);
        break;
      }

      case 'charleston_tiles': {
        const seat = this.seatIndexForPeer(conn.peer);
        if (seat === null) break;
        this.callbacks.onCharlestonTiles(seat, msg.payload.tileIds);
        break;
      }

      case 'charleston_control': {
        const seat = this.seatIndexForPeer(conn.peer);
        if (seat === null) break;
        this.callbacks.onCharlestonControl?.(msg.payload.kind, seat);
        break;
      }

      case 'chat':
        this.callbacks.onChat(msg.payload.playerName, msg.payload.message);
        break;

      case 'ping':
        this.send(conn, { type: 'pong', payload: {} });
        break;

      case 'pong':
        break;
    }
  }

  /** Handle join request (host only) */
  private handleJoinRequest(playerName: string, conn: DataConnection, resumeKey?: string) {
    if (!this.lobby || !this._isHost) return;

    // Mid-game rejoin: seat key preferred; unique name match as family-friendly fallback
    if (this.gameInProgress) {
      const key = resumeKey?.trim().toUpperCase();
      const name = playerName.trim().toLowerCase();

      let reclaim = key
        ? this.lobby.slots.find(
            s =>
              s.type === 'human' &&
              !s.connected &&
              s.resumeKey?.toUpperCase() === key,
          )
        : undefined;

      if (!reclaim && name) {
        const nameMatches = this.lobby.slots.filter(
          s =>
            s.type === 'human' &&
            !s.connected &&
            s.playerName.trim().toLowerCase() === name,
        );
        if (nameMatches.length === 1) reclaim = nameMatches[0];
      }

      if (reclaim) {
        reclaim.connected = true;
        reclaim.peerId = conn.peer;
        if (playerName.trim()) reclaim.playerName = playerName.trim();
        this.send(conn, {
          type: 'join_accepted',
          payload: {
            playerIndex: reclaim.index,
            lobbyState: this.lobby,
            resumeKey: reclaim.resumeKey,
          },
        });
        this.broadcastLobbyUpdate();
        if (this.lastGameState) {
          const view = serializeGameStateForViewer(this.lastGameState, reclaim.index);
          this.send(conn, {
            type: 'game_state_sync',
            payload: { gameState: view },
          });
          this.send(conn, {
            type: 'game_start',
            payload: { gameState: view },
          });
        }
        this.callbacks.onPlayerRejoined?.(reclaim.index, reclaim.playerName);
        return;
      }

      this.send(conn, {
        type: 'join_rejected',
        payload: {
          reason: key
            ? 'Could not find that seat. Check the room code and seat key, or ask the host.'
            : 'Game already started. Enter the same name you used, or your seat key from the board / Settings.',
        },
      });
      return;
    }

    // Lobby rejoin: reclaim a dropped human seat before taking an AI seat
    {
      const key = resumeKey?.trim().toUpperCase();
      const name = playerName.trim().toLowerCase();
      let reclaim = key
        ? this.lobby.slots.find(
            s =>
              s.type === 'human' &&
              !s.connected &&
              s.resumeKey?.toUpperCase() === key,
          )
        : undefined;
      if (!reclaim && name) {
        const nameMatches = this.lobby.slots.filter(
          s =>
            s.type === 'human' &&
            !s.connected &&
            s.playerName.trim().toLowerCase() === name,
        );
        if (nameMatches.length === 1) reclaim = nameMatches[0];
      }
      if (reclaim) {
        reclaim.connected = true;
        reclaim.peerId = conn.peer;
        if (playerName.trim()) reclaim.playerName = playerName.trim();
        if (!reclaim.resumeKey) reclaim.resumeKey = generateResumeKey();
        this.send(conn, {
          type: 'join_accepted',
          payload: {
            playerIndex: reclaim.index,
            lobbyState: this.lobby,
            resumeKey: reclaim.resumeKey,
          },
        });
        this.broadcastLobbyUpdate();
        return;
      }
    }

    const aiSlot = this.lobby.slots.find(s => s.type === 'ai');
    if (!aiSlot) {
      const waiting = this.lobby.slots.some(s => s.type === 'human' && !s.connected);
      this.send(conn, {
        type: 'join_rejected',
        payload: {
          reason: waiting
            ? 'Table is full, but someone is reconnecting. Use the same name you used before, or ask the host.'
            : 'Room is full — ask the host to free a seat.',
        },
      });
      return;
    }

    aiSlot.type = 'human';
    aiSlot.playerName = playerName;
    aiSlot.peerId = conn.peer;
    aiSlot.connected = true;
    aiSlot.ready = true;
    aiSlot.resumeKey = generateResumeKey();

    this.send(conn, {
      type: 'join_accepted',
      payload: {
        playerIndex: aiSlot.index,
        lobbyState: this.lobby,
        resumeKey: aiSlot.resumeKey,
      },
    });

    this.broadcastLobbyUpdate();
  }

  /** Update a lobby slot (host only) */
  updateSlot(index: number, updates: Partial<LobbySlot>) {
    if (!this.lobby || !this._isHost) return;
    const slot = this.lobby.slots[index];
    if (slot) {
      Object.assign(slot, updates);
      this.broadcastLobbyUpdate();
    }
  }

  /**
   * Host: turn an offline / open seat into AI so the family can start.
   */
  fillSeatWithAI(index: number, difficulty: Difficulty = 'medium') {
    if (!this.lobby || !this._isHost) return;
    const slot = this.lobby.slots[index];
    if (!slot || slot.index === 0) return;
    const prior = slot.playerName?.trim() || `Player ${index + 1}`;
    slot.type = 'ai';
    slot.difficulty = difficulty;
    slot.connected = true;
    slot.ready = true;
    slot.peerId = undefined;
    slot.resumeKey = undefined;
    slot.playerName = prior.toLowerCase().startsWith('ai') ? prior : `AI for ${prior}`;
    this.broadcastLobbyUpdate();
  }

  private broadcastLobbyUpdate() {
    if (!this.lobby) return;
    const snap = this.commitLobby();
    if (!snap) return;
    this.callbacks.onLobbyUpdate(snap);
    this.broadcast({ type: 'lobby_update', payload: snap });
  }

  startGame(gameState: GameState) {
    if (!this._isHost) return;
    this.gameInProgress = true;
    this.lastGameState = gameState;
    if (this.lobby) {
      for (const slot of this.lobby.slots) {
        if (slot.type === 'human' && !slot.resumeKey) {
          slot.resumeKey = generateResumeKey();
        }
      }
      this._resumeKey = this.lobby.slots[this._playerIndex]?.resumeKey ?? this._resumeKey;
      this.broadcastLobbyUpdate();
    }
    this.sendViewToAll(gameState, 'game_start');
  }

  sendCharlestonControl(kind: 'skip_pass' | 'skip_rest') {
    const msg: NetworkMessage = { type: 'charleston_control', payload: { kind } };
    if (this._isHost) {
      this.callbacks.onCharlestonControl?.(kind, this._playerIndex);
    } else if (this.hostConnection) {
      this.send(this.hostConnection, msg);
    }
  }

  syncGameState(gameState: GameState) {
    if (!this._isHost) return;
    this.lastGameState = gameState;
    this.sendViewToAll(gameState, 'game_state_sync');
  }

  private sendViewToAll(gameState: GameState, type: 'game_start' | 'game_state_sync') {
    if (this.lobby) {
      for (const slot of this.lobby.slots) {
        if (slot.type !== 'human' || !slot.peerId || !slot.connected) continue;
        if (slot.index === this._playerIndex) continue;
        const conn = this.connections.get(slot.peerId);
        if (!conn) continue;
        const view = serializeGameStateForViewer(gameState, slot.index);
        this.send(conn, { type, payload: { gameState: view } });
      }
    }
  }

  seatIndexForPeer(peerId: string): number | null {
    if (!this.lobby) return null;
    const slot = this.lobby.slots.find(s => s.peerId === peerId && s.connected);
    return slot ? slot.index : null;
  }

  sendAction(action: NetworkMessage & { type: 'game_action' }) {
    if (this._isHost) {
      // Host actions are handled locally in App
    } else if (this.hostConnection) {
      this.send(this.hostConnection, action);
    }
  }

  sendCharlestonTiles(playerIndex: number, tileIds: number[]) {
    const msg: NetworkMessage = {
      type: 'charleston_tiles',
      payload: { playerIndex, tileIds },
    };
    if (this._isHost) {
      this.callbacks.onCharlestonTiles(playerIndex, tileIds);
    } else if (this.hostConnection) {
      this.send(this.hostConnection, msg);
    }
  }

  sendChat(playerName: string, message: string) {
    const msg: NetworkMessage = { type: 'chat', payload: { playerName, message } };
    if (this._isHost) {
      this.broadcast(msg);
      this.callbacks.onChat(playerName, message);
    } else if (this.hostConnection) {
      this.send(this.hostConnection, msg);
    }
  }

  private send(conn: DataConnection, msg: NetworkMessage) {
    if (conn.open) {
      try {
        conn.send(msg);
      } catch {
        /* channel may be mid-close */
      }
    }
  }

  private broadcast(msg: NetworkMessage) {
    for (const conn of this.connections.values()) {
      this.send(conn, msg);
    }
  }

  private startKeepalive() {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      const ping: NetworkMessage = { type: 'ping', payload: {} };
      for (const conn of this.connections.values()) {
        this.send(conn, ping);
      }
      if (this.hostConnection) this.send(this.hostConnection, ping);
    }, KEEPALIVE_MS);
  }

  private stopKeepalive() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private async destroyPeerOnly() {
    this.stopKeepalive();
    for (const conn of this.connections.values()) {
      try {
        conn.close();
      } catch {
        /* ignore */
      }
    }
    this.connections.clear();
    this.hostConnection = null;
    const peer = this.peer;
    this.peer = null;
    if (peer) {
      try {
        peer.destroy();
      } catch {
        /* ignore */
      }
      // Let PeerJS cloud release the id / offer slot
      await sleep(350);
    }
  }

  private async hardReset() {
    this.generation += 1;
    this.stopKeepalive();
    await this.destroyPeerOnly();
    this.lobby = null;
    this._isHost = false;
    this._roomCode = '';
    this._resumeKey = '';
    this._playerIndex = 0;
    this.gameInProgress = false;
    this.lastGameState = null;
  }

  /** Disconnect and clean up */
  disconnect() {
    void this.hardReset().then(() => {
      this.callbacks.onStatusChange('disconnected');
    });
    this.callbacks.onStatusChange('disconnected');
  }

  getLobby(): LobbyState | null {
    return this.lobby;
  }
}
