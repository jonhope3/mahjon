// ============================================================
// PeerManager — WebRTC connection management via PeerJS
// ============================================================

import Peer, { DataConnection } from 'peerjs';
import {
  NetworkMessage, LobbyState, LobbySlot,
  generateRoomCode, createLobby, generateResumeKey,
  serializeGameState, deserializeGameState,
  SerializableGameState,
} from './protocol';
import { GameState } from '../engine/types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PeerManagerCallbacks {
  onStatusChange: (status: ConnectionStatus) => void;
  onLobbyUpdate: (lobby: LobbyState) => void;
  onGameStart: (state: GameState, playerIndex: number) => void;
  onGameStateSync: (state: GameState) => void;
  /** Fired when a player reclaims a seat mid-game */
  onPlayerRejoined?: (playerIndex: number, playerName: string) => void;
  /** Fired when a human disconnects mid-game (host should AI-drive the seat) */
  onPlayerDisconnected?: (playerIndex: number) => void;
  onGameAction: (action: NetworkMessage & { type: 'game_action' }) => void;
  onCharlestonTiles: (playerIndex: number, tileIds: number[]) => void;
  onCharlestonControl?: (kind: 'skip_pass' | 'skip_rest') => void;
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
            settle(() => reject(new Error(msg.payload.reason)));
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
          if (this.gameInProgress && slot.type === 'human') {
            // Keep seat + resumeKey so they can rejoin; host drives seat with AI until then
            this.broadcastLobbyUpdate();
            this.callbacks.onPlayerDisconnected?.(slot.index);
          } else {
            slot.type = 'ai';
            slot.playerName = `AI (was ${slot.playerName})`;
            slot.resumeKey = undefined;
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

      case 'game_action':
        this.callbacks.onGameAction(msg);
        break;

      case 'charleston_tiles':
        this.callbacks.onCharlestonTiles(msg.payload.playerIndex, msg.payload.tileIds);
        break;

      case 'charleston_control':
        this.callbacks.onCharlestonControl?.(msg.payload.kind);
        break;

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

    // Mid-game rejoin: match seat key or disconnected name
    if (this.gameInProgress) {
      const key = resumeKey?.trim().toUpperCase();
      const reclaim =
        this.lobby.slots.find(
          s =>
            s.type === 'human' &&
            !s.connected &&
            key &&
            s.resumeKey?.toUpperCase() === key,
        ) ||
        this.lobby.slots.find(
          s =>
            s.type === 'human' &&
            !s.connected &&
            s.playerName.toLowerCase() === playerName.trim().toLowerCase(),
        );

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
          this.send(conn, {
            type: 'game_state_sync',
            payload: { gameState: serializeGameState(this.lastGameState) },
          });
          this.send(conn, {
            type: 'game_start',
            payload: { gameState: serializeGameState(this.lastGameState) },
          });
        }
        this.callbacks.onPlayerRejoined?.(reclaim.index, reclaim.playerName);
        return;
      }

      this.send(conn, {
        type: 'join_rejected',
        payload: {
          reason:
            'Game already in progress. Use your Room code + Seat key from Settings to rejoin your hand.',
        },
      });
      return;
    }

    // Find first AI slot to replace
    const aiSlot = this.lobby.slots.find(s => s.type === 'ai');
    if (!aiSlot) {
      this.send(conn, {
        type: 'join_rejected',
        payload: { reason: 'Room is full' },
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
    const serialized = serializeGameState(gameState);
    this.broadcast({
      type: 'game_start',
      payload: { gameState: serialized },
    });
  }

  /** Table-wide Charleston skip (optional phases) */
  sendCharlestonControl(kind: 'skip_pass' | 'skip_rest') {
    const msg: NetworkMessage = { type: 'charleston_control', payload: { kind } };
    if (this._isHost) {
      this.callbacks.onCharlestonControl?.(kind);
    } else if (this.hostConnection) {
      this.send(this.hostConnection, msg);
    }
  }

  /** Sync game state to all clients (host only) */
  syncGameState(gameState: GameState) {
    if (!this._isHost) return;
    this.lastGameState = gameState;
    this.broadcast({
      type: 'game_state_sync',
      payload: { gameState: serializeGameState(gameState) },
    });
  }

  /** Send a game action (client → host, or host broadcasts) */
  sendAction(action: NetworkMessage & { type: 'game_action' }) {
    if (this._isHost) {
      this.broadcast(action);
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
      this.broadcast(msg);
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
