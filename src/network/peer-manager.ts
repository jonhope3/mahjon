// ============================================================
// PeerManager — WebRTC connection management via PeerJS
// ============================================================

import Peer, { DataConnection } from 'peerjs';
import {
  NetworkMessage, LobbyState, LobbySlot,
  generateRoomCode, createLobby, generateResumeKey,
  serializeGameStateForViewer,
  deserializeGameState,
  SerializableGameState,
} from './protocol';
import { GameState, Difficulty } from '../engine/types';

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

  /** Create a new room as host */
  async createRoom(playerName: string): Promise<string> {
    this._isHost = true;
    this._playerIndex = 0;
    this._roomCode = generateRoomCode();

    // PeerJS peer id = room code prefix for discoverability
    const peerId = `mahjon-${this._roomCode}`;

    return new Promise((resolve, reject) => {
      this.peer = new Peer(peerId);

      this.peer.on('open', () => {
        this.callbacks.onStatusChange('connected');
        this.lobby = createLobby(this._roomCode, playerName);
        this._resumeKey = this.lobby.slots[0]?.resumeKey ?? '';
        this.callbacks.onLobbyUpdate(this.lobby);
        resolve(this._roomCode);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        this.callbacks.onError(`Host error: ${err.message}`);
        this.callbacks.onStatusChange('error');
        reject(err);
      });
    });
  }

  /** Join an existing room as client (optional seat key to reclaim a disconnected hand) */
  async joinRoom(roomCode: string, playerName: string, resumeKey?: string): Promise<void> {
    this._isHost = false;
    this._roomCode = roomCode;

    const hostPeerId = `mahjon-${roomCode}`;

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };
      const timer = setTimeout(() => {
        settle(() => reject(new Error('Join timed out — check the room code and try again.')));
      }, 10000);

      this.peer = new Peer();

      this.peer.on('open', () => {
        this.callbacks.onStatusChange('connecting');

        const conn = this.peer!.connect(hostPeerId, { reliable: true });

        conn.on('open', () => {
          this.hostConnection = conn;
          this.connections.set(hostPeerId, conn);

          this.send(conn, {
            type: 'join_request',
            payload: {
              playerName,
              resumeKey: resumeKey?.trim().toUpperCase() || undefined,
            },
          });
        });

        conn.on('data', (data) => {
          const msg = data as NetworkMessage;
          this.handleMessage(msg, conn);
          if (msg.type === 'join_accepted') {
            settle(() => resolve());
          } else if (msg.type === 'join_rejected') {
            settle(() => {
              this.disconnect();
              reject(new Error(msg.payload.reason));
            });
          }
        });

        conn.on('close', () => {
          this.callbacks.onStatusChange('disconnected');
          this.callbacks.onError('Connection to host lost');
          settle(() => reject(new Error('Connection to host lost')));
        });

        conn.on('error', (err) => {
          this.callbacks.onError(`Connection error: ${err.message}`);
          settle(() => reject(err));
        });
      });

      this.peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
          this.callbacks.onError(`Room "${roomCode}" not found. Check the code and try again.`);
          settle(() => reject(new Error(`Room "${roomCode}" not found.`)));
        } else {
          this.callbacks.onError(`Connection error: ${err.message}`);
          settle(() => reject(err));
        }
        this.callbacks.onStatusChange('error');
      });
    });
  }

  /** Handle incoming connection (host only) */
  private handleIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data) => {
      this.handleMessage(data as NetworkMessage, conn);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.lobby) {
        const slot = this.lobby.slots.find(s => s.peerId === conn.peer);
        if (slot) {
          slot.connected = false;
          if (slot.type === 'human') {
            // Keep the seat (and name) so family can reconnect or host can sit AI
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
  }

  /** Handle incoming message */
  private handleMessage(msg: NetworkMessage, conn: DataConnection) {
    switch (msg.type) {
      case 'join_request':
        this.handleJoinRequest(msg.payload.playerName, conn, msg.payload.resumeKey);
        break;

      case 'join_accepted':
        this._playerIndex = msg.payload.playerIndex;
        this.lobby = msg.payload.lobbyState;
        if (msg.payload.resumeKey) this._resumeKey = msg.payload.resumeKey;
        this.callbacks.onStatusChange('connected');
        this.callbacks.onLobbyUpdate(this.lobby);
        break;

      case 'join_rejected':
        this.callbacks.onError(msg.payload.reason);
        break;

      case 'lobby_update':
        this.lobby = msg.payload;
        {
          const mine = this.lobby.slots[this._playerIndex];
          if (mine?.resumeKey) this._resumeKey = mine.resumeKey;
        }
        this.callbacks.onLobbyUpdate(this.lobby);
        break;

      case 'game_start':
        this.callbacks.onGameStart(
          deserializeGameState(msg.payload.gameState),
          this._playerIndex
        );
        break;

      case 'game_state_sync':
        this.callbacks.onGameStateSync(
          deserializeGameState(msg.payload.gameState)
        );
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
        // Ignore client-supplied playerIndex — seat comes from the connection
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
        // Only auto-match when the name uniquely identifies one dropped seat
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

    // Find first AI slot to replace
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

  /** Broadcast lobby state to all peers */
  private broadcastLobbyUpdate() {
    if (!this.lobby) return;
    this.callbacks.onLobbyUpdate(this.lobby);
    this.broadcast({ type: 'lobby_update', payload: this.lobby });
  }

  /** Start the game (host only) */
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

  /** Table-wide Charleston skip (optional phases) — host applies after auth */
  sendCharlestonControl(kind: 'skip_pass' | 'skip_rest') {
    const msg: NetworkMessage = { type: 'charleston_control', payload: { kind } };
    if (this._isHost) {
      this.callbacks.onCharlestonControl?.(kind, this._playerIndex);
    } else if (this.hostConnection) {
      this.send(this.hostConnection, msg);
    }
  }

  /** Sync game state to all clients (host only) — per-seat fog of war */
  syncGameState(gameState: GameState) {
    if (!this._isHost) return;
    this.lastGameState = gameState;
    this.sendViewToAll(gameState, 'game_state_sync');
  }

  private sendViewToAll(gameState: GameState, type: 'game_start' | 'game_state_sync') {
    // Host keeps full state locally; each peer gets a filtered view
    if (this.lobby) {
      for (const slot of this.lobby.slots) {
        if (slot.type !== 'human' || !slot.peerId || !slot.connected) continue;
        if (slot.index === this._playerIndex) continue; // host is local
        const conn = this.connections.get(slot.peerId);
        if (!conn) continue;
        const view = serializeGameStateForViewer(gameState, slot.index);
        this.send(conn, { type, payload: { gameState: view } });
      }
    }
  }

  /** Seat index for a peer connection (host only) */
  seatIndexForPeer(peerId: string): number | null {
    if (!this.lobby) return null;
    const slot = this.lobby.slots.find(s => s.peerId === peerId && s.connected);
    return slot ? slot.index : null;
  }

  /** Send a game action (client → host, or host local) */
  sendAction(action: NetworkMessage & { type: 'game_action' }) {
    if (this._isHost) {
      // Host actions are handled locally in App — no broadcast of raw actions
    } else if (this.hostConnection) {
      this.send(this.hostConnection, action);
    }
  }

  /** Send charleston tile selections */
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

  /** Send chat message */
  sendChat(playerName: string, message: string) {
    const msg: NetworkMessage = { type: 'chat', payload: { playerName, message } };
    if (this._isHost) {
      this.broadcast(msg);
      this.callbacks.onChat(playerName, message);
    } else if (this.hostConnection) {
      this.send(this.hostConnection, msg);
    }
  }

  /** Send to a specific connection */
  private send(conn: DataConnection, msg: NetworkMessage) {
    if (conn.open) {
      conn.send(msg);
    }
  }

  /** Broadcast to all connections */
  private broadcast(msg: NetworkMessage) {
    for (const conn of this.connections.values()) {
      this.send(conn, msg);
    }
  }

  /** Disconnect and clean up */
  disconnect() {
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
    this.hostConnection = null;
    this.lobby = null;
    this._isHost = false;
    this._roomCode = '';
    this._resumeKey = '';
    this.gameInProgress = false;
    this.lastGameState = null;
    this.callbacks.onStatusChange('disconnected');
  }

  /** Get current lobby */
  getLobby(): LobbyState | null {
    return this.lobby;
  }
}
