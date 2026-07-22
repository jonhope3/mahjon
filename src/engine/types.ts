// ============================================================
// Mahjong Game Engine — Type Definitions
// American Mahjong (2026) style
// ============================================================

/** The three suited tile families */
export type Suit = 'bam' | 'crak' | 'dot';

/** Wind directions */
export type Wind = 'north' | 'east' | 'south' | 'west';

/** Dragon colors */
export type Dragon = 'red' | 'green' | 'white';

/** All possible tile kinds */
export type TileKind =
  | { type: 'suited'; suit: Suit; rank: number }   // rank 1-9
  | { type: 'wind'; wind: Wind }
  | { type: 'dragon'; dragon: Dragon }
  | { type: 'flower' }
  | { type: 'joker' };

/** A unique tile instance in the game */
export interface Tile {
  id: number;           // unique id (0-151)
  kind: TileKind;
  /** Display label for quick reference */
  label: string;
}

/** Seat positions at the table */
export type SeatWind = 'east' | 'south' | 'west' | 'north';

/** Player type */
export type PlayerType = 'human' | 'ai';

/** AI difficulty */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** A player at the table */
export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  difficulty?: Difficulty;
  seatWind: SeatWind;
  hand: Tile[];              // tiles in hand (concealed)
  exposedSets: ExposedSet[]; // melded sets (face-up on table)
  discards: Tile[];          // tiles this player has discarded
  score: number;
}

/** A melded (exposed) set of tiles */
export interface ExposedSet {
  tiles: Tile[];
  setType: 'pair' | 'pung' | 'kong' | 'quint' | 'sextet';
  claimedTile?: Tile;   // the tile that was claimed from a discard
}

/** Game phases */
export type GamePhase =
  | 'setup'
  | 'charleston_first_right'
  | 'charleston_first_across'
  | 'charleston_first_left'
  | 'charleston_second_left'
  | 'charleston_second_across'
  | 'charleston_second_right'
  | 'charleston_courtesy'
  | 'playing'
  | 'round_end'
  | 'game_over';

/** Actions a player can take */
export type ActionType =
  | 'draw'          // draw from wall
  | 'discard'       // discard a tile
  | 'pung'          // claim discard for a pung (3 of a kind)
  | 'kong'          // claim discard for a kong (4 of a kind)
  | 'quint'         // claim discard for a quint (5 of a kind)
  | 'mahjong'       // declare win
  | 'pass'          // pass on claiming a discard
  | 'charleston'    // pass tiles during charleston
  | 'swap_joker';   // swap matching tile for exposed joker

/** A game action */
export interface GameAction {
  type: ActionType;
  playerId: string;
  tiles?: Tile[];      // tiles involved (e.g., which tile to discard, or tiles passed in charleston)
  targetTile?: Tile;   // the discard tile being claimed
}

/** The wall of tiles to draw from */
export interface Wall {
  tiles: Tile[];
  deadWallTiles: Tile[];  // reserved tiles (not used in American, but kept for extensibility)
}

/** Waiting for claim resolution */
export interface ClaimWindow {
  discardedTile: Tile;
  discardedBy: string;       // player id
  claims: Map<string, ActionType>;  // playerId -> claimed action
  resolved: boolean;
}

/** Full game state */
export interface GameState {
  players: Player[];
  wall: Wall;
  currentPlayerIndex: number;   // index into players array
  dealerIndex: number;
  phase: GamePhase;
  roundNumber: number;
  roundWind: SeatWind;
  turnNumber: number;
  lastDiscard: Tile | null;
  lastDiscardBy: string | null;
  claimWindow: ClaimWindow | null;
  hasDrawn: boolean;            // whether current player has drawn this turn
  winner: string | null;        // player id of winner
  winningHand: HandPattern | null;
  log: GameLogEntry[];
}

/** Game log entry for replay / display */
export interface GameLogEntry {
  timestamp: number;
  playerId: string;
  action: ActionType;
  tiles?: Tile[];
  message: string;
}

// ============================================================
// Hand Pattern Definitions
// ============================================================

/**
 * Color constraints for groups within a hand pattern.
 * Tiles of the same color must be in the same suit,
 * and different colors must be in different suits.
 * We represent this with color labels: 'a', 'b', 'c' (mapped to actual suits at eval time).
 */
export type SuitConstraint = 'a' | 'b' | 'c' | 'any';

/** A group of tiles within a hand pattern */
export interface PatternGroup {
  type: 'suited' | 'wind' | 'dragon' | 'flower' | 'joker' | 'news';
  count: number;
  /** For suited tiles: the rank (1-9), or 0 for "same as another group" */
  rank?: number;
  /** Suit constraint label for color matching */
  suitConstraint?: SuitConstraint;
  /** For winds: which specific wind, or 'any' */
  wind?: Wind | 'any';
  /** For dragons: which specific dragon, or 'any' / 'opposite' (vs matching suit color) */
  dragon?: Dragon | 'any' | 'opposite';
}

/** A complete winning hand pattern from the card */
export interface HandPattern {
  id: string;
  category: string;
  groups: PatternGroup[];
  /** Total points/multiplier */
  value: number;
  /** Whether the hand must be concealed (C) or exposed (X) */
  concealed: boolean;
  /** Human-readable description */
  description: string;
  /**
   * For “any consecutive” card lines: try adding 0..runShiftMax to every suited rank.
   * Skips shifts that push any rank outside 1–9.
   */
  runShiftMax?: number;
  /**
   * Dragon resolution: matching = suit color; opposite = not suit color; any = unrestricted.
   * Stored on dragon groups via PatternGroup.dragon === 'any' plus this flag on the pattern,
   * or per-group via dragonOpposite.
   */
}

/** Category on the hand card */
export interface HandCategory {
  name: string;
  hands: HandPattern[];
}

// ============================================================
// Network / Multiplayer Types
// ============================================================

export type NetworkRole = 'host' | 'client' | 'local';

export interface NetworkMessage {
  type: 'game_state' | 'action' | 'player_join' | 'player_leave' | 'chat' | 'sync_request';
  payload: unknown;
  senderId: string;
  timestamp: number;
}

export interface LobbyState {
  roomCode: string;
  hostId: string;
  players: LobbyPlayer[];
  maxPlayers: 4;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  type: PlayerType;
  ready: boolean;
  connected: boolean;
}
