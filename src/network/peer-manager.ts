// ============================================================
// PeerManager — WebRTC connection management via PeerJS
// ============================================================

import Peer, { DataConnection } from 'peerjs';
import {
  NetworkMessage, LobbyState, LobbySlot,
  generateRoomCode, createLobby,
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
  onGameAction: (action: NetworkMessage & { type: 'game_action' }) => void;
  onCharlestonTiles: (playerIndex: number, tileIds: number[]) => void;
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
  private lobby: LobbyState | null = null;
  private hostConnection: DataConnection | null = null;

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

  /** Join an existing room as client */
  async joinRoom(roomCode: string, playerName: string): Promise<void> {
    this._isHost = false;
    this._roomCode = roomCode;

    const hostPeerId = `mahjon-${roomCode}`;

    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', () => {
        this.callbacks.onStatusChange('connecting');

        const conn = this.peer!.connect(hostPeerId, { reliable: true });

        conn.on('open', () => {
          this.hostConnection = conn;
          this.connections.set(hostPeerId, conn);

          // Send join request
          this.send(conn, { type: 'join_request', payload: { playerName } });
        });

        conn.on('data', (data) => {
          this.handleMessage(data as NetworkMessage, conn);
        });

        conn.on('close', () => {
          this.callbacks.onStatusChange('disconnected');
          this.callbacks.onError('Connection to host lost');
        });

        conn.on('error', (err) => {
          this.callbacks.onError(`Connection error: ${err.message}`);
          reject(err);
        });

        // Resolve after a timeout if connection doesn't fail
        setTimeout(() => resolve(), 500);
      });

      this.peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
          this.callbacks.onError(`Room "${roomCode}" not found. Check the code and try again.`);
        } else {
          this.callbacks.onError(`Connection error: ${err.message}`);
        }
        this.callbacks.onStatusChange('error');
        reject(err);
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
      // Mark player as disconnected in lobby
      if (this.lobby) {
        const slot = this.lobby.slots.find(s => s.peerId === conn.peer);
        if (slot) {
          slot.connected = false;
          slot.type = 'ai'; // Replace with AI
          slot.playerName = `AI (was ${slot.playerName})`;
          this.broadcastLobbyUpdate();
        }
      }
    });
  }

  /** Handle incoming message */
  private handleMessage(msg: NetworkMessage, conn: DataConnection) {
    switch (msg.type) {
      case 'join_request':
        this.handleJoinRequest(msg.payload.playerName, conn);
        break;

      case 'join_accepted':
        this._playerIndex = msg.payload.playerIndex;
        this.lobby = msg.payload.lobbyState;
        this.callbacks.onStatusChange('connected');
        this.callbacks.onLobbyUpdate(this.lobby);
        break;

      case 'join_rejected':
        this.callbacks.onError(msg.payload.reason);
        break;

      case 'lobby_update':
        this.lobby = msg.payload;
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

      case 'chat':
        this.callbacks.onChat(msg.payload.playerName, msg.payload.message);
        break;

      case 'ping':
        this.send(conn, { type: 'pong', payload: {} });
        break;
    }
  }

  /** Handle join request (host only) */
  private handleJoinRequest(playerName: string, conn: DataConnection) {
    if (!this.lobby || !this._isHost) return;

    // Find first AI slot to replace
    const aiSlot = this.lobby.slots.find(s => s.type === 'ai');
    if (!aiSlot) {
      this.send(conn, {
        type: 'join_rejected',
        payload: { reason: 'Room is full' },
      });
      return;
    }

    // Assign the slot to the new player
    aiSlot.type = 'human';
    aiSlot.playerName = playerName;
    aiSlot.peerId = conn.peer;
    aiSlot.connected = true;
    aiSlot.ready = true;

    this.send(conn, {
      type: 'join_accepted',
      payload: { playerIndex: aiSlot.index, lobbyState: this.lobby },
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
    const serialized = serializeGameState(gameState);
    this.broadcast({
      type: 'game_start',
      payload: { gameState: serialized },
    });
  }

  /** Sync game state to all clients (host only) */
  syncGameState(gameState: GameState) {
    if (!this._isHost) return;
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
    this.callbacks.onStatusChange('disconnected');
  }

  /** Get current lobby */
  getLobby(): LobbyState | null {
    return this.lobby;
  }
}
