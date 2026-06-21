// ============================================================
// Network Protocol — Message types for WebRTC communication
// ============================================================

import { GameState, GameAction, PlayerType, Difficulty } from '../engine/types';

/** All message types exchanged between peers */
export type NetworkMessage =
  | { type: 'join_request'; payload: { playerName: string } }
  | { type: 'join_accepted'; payload: { playerIndex: number; lobbyState: LobbyState } }
  | { type: 'join_rejected'; payload: { reason: string } }
  | { type: 'lobby_update'; payload: LobbyState }
  | { type: 'game_start'; payload: { gameState: SerializableGameState } }
  | { type: 'game_action'; payload: { action: SerializableAction } }
  | { type: 'game_state_sync'; payload: { gameState: SerializableGameState } }
  | { type: 'charleston_tiles'; payload: { playerIndex: number; tileIds: number[] } }
  | { type: 'chat'; payload: { playerName: string; message: string } }
  | { type: 'ping'; payload: Record<string, never> }
  | { type: 'pong'; payload: Record<string, never> };

/** Lobby state shared between all peers */
export interface LobbyState {
  roomCode: string;
  hostName: string;
  slots: LobbySlot[];
  maxPlayers: 4;
}

export interface LobbySlot {
  index: number;
  playerName: string;
  type: PlayerType;
  difficulty?: Difficulty;
  peerId?: string;    // PeerJS peer id (empty for AI/host)
  connected: boolean;
  ready: boolean;
}

/** Serializable version of GameState (Maps -> objects) */
export type SerializableGameState = Omit<GameState, 'claimWindow' | 'log'> & {
  claimWindow: {
    discardedTile: GameState['lastDiscard'];
    discardedBy: string;
    claims: Record<string, string>;
    resolved: boolean;
  } | null;
  log: GameState['log'];
};

export type SerializableAction = Omit<GameAction, 'targetTile'> & {
  targetTileId?: number;
};

/** Convert GameState to serializable form */
export function serializeGameState(state: GameState): SerializableGameState {
  return {
    ...state,
    claimWindow: state.claimWindow ? {
      discardedTile: state.claimWindow.discardedTile,
      discardedBy: state.claimWindow.discardedBy,
      claims: Object.fromEntries(state.claimWindow.claims),
      resolved: state.claimWindow.resolved,
    } : null,
  };
}

/** Convert serializable form back to GameState */
export function deserializeGameState(data: SerializableGameState): GameState {
  return {
    ...data,
    claimWindow: data.claimWindow ? {
      ...data.claimWindow,
      claims: new Map(Object.entries(data.claimWindow.claims)),
    } : null,
  } as GameState;
}

/** Serialize a game action */
export function serializeAction(action: GameAction): SerializableAction {
  return {
    type: action.type,
    playerId: action.playerId,
    tiles: action.tiles,
    targetTileId: action.targetTile?.id,
  };
}

/** Create an empty lobby */
export function createLobby(roomCode: string, hostName: string): LobbyState {
  return {
    roomCode,
    hostName,
    maxPlayers: 4,
    slots: [
      { index: 0, playerName: hostName, type: 'human', connected: true, ready: true },
      { index: 1, playerName: 'AI Player 2', type: 'ai', difficulty: 'medium', connected: true, ready: true },
      { index: 2, playerName: 'AI Player 3', type: 'ai', difficulty: 'medium', connected: true, ready: true },
      { index: 3, playerName: 'AI Player 4', type: 'ai', difficulty: 'medium', connected: true, ready: true },
    ],
  };
}

/** Generate a short room code */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
