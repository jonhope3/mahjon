// ============================================================
// Main Game Controller
// ============================================================

import {
  GameState, Player, Tile, GameAction, GameLogEntry,
  SeatWind, PlayerType, Difficulty, GamePhase, ExposedSet,
} from './types';
import { createTileSet, shuffleTiles, buildWall, drawFromWall, sortTiles } from './tiles';
import { checkWin, calculateScore } from './scoring';
import { claimPriority } from './actions';
import { isJoker } from './tiles';

const SEAT_WINDS: SeatWind[] = ['east', 'south', 'west', 'north'];

export interface GameConfig {
  players: {
    name: string;
    type: PlayerType;
    difficulty?: Difficulty;
  }[];
}

/** Create a fresh game state */
export function createGame(config: GameConfig): GameState {
  if (config.players.length !== 4) {
    throw new Error('American Mahjong requires exactly 4 players');
  }

  const tiles = shuffleTiles(createTileSet());
  const wall = buildWall(tiles);

  const players: Player[] = config.players.map((p, i) => ({
    id: `player-${i}`,
    name: p.name,
    type: p.type,
    difficulty: p.difficulty,
    seatWind: SEAT_WINDS[i]!,
    hand: [],
    exposedSets: [],
    discards: [],
    score: 0,
  }));

  const state: GameState = {
    players,
    wall,
    currentPlayerIndex: 0, // East starts
    dealerIndex: 0,
    phase: 'setup',
    roundNumber: 1,
    roundWind: 'east',
    turnNumber: 0,
    lastDiscard: null,
    lastDiscardBy: null,
    claimWindow: null,
    hasDrawn: false,
    winner: null,
    winningHand: null,
    log: [],
  };

  return state;
}

/** Deal tiles to all players. East gets 14, others get 13. */
export function dealTiles(state: GameState): GameState {
  let newState = { ...state, wall: { ...state.wall, tiles: [...state.wall.tiles] } };
  const newPlayers = newState.players.map(p => ({ ...p, hand: [...p.hand] }));

  // Deal 13 tiles to each player (4 rounds of 3, then 1 round of 1)
  for (let round = 0; round < 4; round++) {
    const count = round < 3 ? 3 : 1;
    for (let p = 0; p < 4; p++) {
      for (let c = 0; c < count + (round === 3 && p === 0 ? 1 : 0); c++) {
        const result = drawFromWall(newState.wall);
        if (!result) throw new Error('Not enough tiles to deal');
        const [tile, updatedWall] = result;
        newPlayers[p]!.hand.push(tile);
        newState.wall = updatedWall;
      }
    }
  }

  // Sort each player's hand
  for (const player of newPlayers) {
    player.hand = sortTiles(player.hand);
  }

  newState.players = newPlayers;
  newState.phase = 'charleston_first_right';

  addLog(newState, 'system', 'draw', 'Tiles dealt. Charleston begins.');

  return newState;
}

/** Skip charleston and go straight to playing */
export function skipCharleston(state: GameState): GameState {
  return {
    ...state,
    phase: 'playing',
    hasDrawn: state.currentPlayerIndex === state.dealerIndex, // dealer already has 14
  };
}

/** Process a game action */
export function processAction(state: GameState, action: GameAction): GameState {
  let newState = deepCopyState(state);

  switch (action.type) {
    case 'draw':
      return handleDraw(newState, action);
    case 'discard':
      return handleDiscard(newState, action);
    case 'pung':
    case 'kong':
    case 'quint':
      return handleClaim(newState, action);
    case 'mahjong':
      return handleMahjong(newState, action);
    case 'pass':
      return handlePass(newState, action);
    case 'swap_joker':
      return handleSwapJoker(newState, action);
    default:
      return newState;
  }
}

function handleDraw(state: GameState, action: GameAction): GameState {
  const playerIdx = state.players.findIndex(p => p.id === action.playerId);
  if (playerIdx !== state.currentPlayerIndex) return state;
  if (state.hasDrawn) return state;

  const result = drawFromWall(state.wall);
  if (!result) {
    // Wall empty — draw game
    state.phase = 'round_end';
    addLog(state, action.playerId, 'draw', 'Wall is empty. Draw game.');
    return state;
  }

  const [tile, newWall] = result;
  state.wall = newWall;
  state.players[playerIdx]!.hand.push(tile);
  state.hasDrawn = true;
  state.lastDiscard = null;
  state.lastDiscardBy = null;

  addLog(state, action.playerId, 'draw', `Drew a tile.`);

  return state;
}

function handleDiscard(state: GameState, action: GameAction): GameState {
  const playerIdx = state.players.findIndex(p => p.id === action.playerId);
  if (playerIdx !== state.currentPlayerIndex) return state;
  if (!state.hasDrawn) return state;
  if (!action.tiles || action.tiles.length !== 1) return state;

  const discardTile = action.tiles[0]!;
  const player = state.players[playerIdx]!;

  // Remove tile from hand
  const tileIdx = player.hand.findIndex(t => t.id === discardTile.id);
  if (tileIdx === -1) return state;

  player.hand.splice(tileIdx, 1);
  player.discards.push(discardTile);

  state.lastDiscard = discardTile;
  state.lastDiscardBy = player.id;
  state.hasDrawn = false;

  addLog(state, action.playerId, 'discard', `Discarded ${discardTile.label}.`);

  // Open claim window (will be resolved by game loop)
  state.claimWindow = {
    discardedTile: discardTile,
    discardedBy: player.id,
    claims: new Map(),
    resolved: false,
  };

  return state;
}

function handleClaim(state: GameState, action: GameAction): GameState {
  const playerIdx = state.players.findIndex(p => p.id === action.playerId);
  const player = state.players[playerIdx]!;

  if (!state.lastDiscard) return state;

  const claimedTile = state.lastDiscard;
  const setSize = action.type === 'pung' ? 3 : action.type === 'kong' ? 4 : 5;

  // Find matching tiles in hand (including jokers)
  const matching: Tile[] = [];
  const jokers: Tile[] = [];

  for (const t of player.hand) {
    if (isJoker(t)) {
      jokers.push(t);
    } else if (
      t.kind.type === claimedTile.kind.type &&
      (t.kind.type !== 'suited' || (
        (t.kind as any).suit === (claimedTile.kind as any).suit &&
        (t.kind as any).rank === (claimedTile.kind as any).rank
      )) &&
      (t.kind.type !== 'wind' || (t.kind as any).wind === (claimedTile.kind as any).wind) &&
      (t.kind.type !== 'dragon' || (t.kind as any).dragon === (claimedTile.kind as any).dragon)
    ) {
      matching.push(t);
    }
  }

  // Need setSize - 1 tiles (the claimed tile is the last one)
  const needed = setSize - 1;
  const fromMatching = Math.min(matching.length, needed);
  const fromJokers = Math.min(needed - fromMatching, jokers.length);

  if (fromMatching + fromJokers < needed) return state;

  // Build the exposed set
  const setTiles: Tile[] = [];
  for (let i = 0; i < fromMatching; i++) setTiles.push(matching[i]!);
  for (let i = 0; i < fromJokers; i++) setTiles.push(jokers[i]!);
  setTiles.push(claimedTile);

  // Remove used tiles from hand
  const usedIds = new Set(setTiles.map(t => t.id));
  usedIds.delete(claimedTile.id); // discard wasn't in hand
  player.hand = player.hand.filter(t => !usedIds.has(t.id));

  // Add exposed set
  player.exposedSets.push({
    tiles: setTiles,
    setType: action.type === 'pung' ? 'pung' : action.type === 'kong' ? 'kong' : 'quint',
    claimedTile,
  });

  // Remove discard from the discarder's discard pile
  const discarderIdx = state.players.findIndex(p => p.id === state.lastDiscardBy);
  if (discarderIdx !== -1) {
    const discards = state.players[discarderIdx]!.discards;
    const discardIdx = discards.findIndex(t => t.id === claimedTile.id);
    if (discardIdx !== -1) discards.splice(discardIdx, 1);
  }

  state.lastDiscard = null;
  state.lastDiscardBy = null;
  state.claimWindow = null;
  state.currentPlayerIndex = playerIdx;
  state.hasDrawn = true; // claiming counts as "drawing"

  addLog(state, action.playerId, action.type, `Claimed ${claimedTile.label} for a ${action.type}.`);

  return state;
}

function handleMahjong(state: GameState, action: GameAction): GameState {
  const playerIdx = state.players.findIndex(p => p.id === action.playerId);
  const player = state.players[playerIdx]!;

  // If claiming from discard, add it to hand temporarily for checking
  if (state.lastDiscard && state.lastDiscardBy !== player.id) {
    player.hand.push(state.lastDiscard);
  }

  const winPattern = checkWin(player);
  if (!winPattern) {
    // Invalid mahjong declaration — remove the discard if we added it
    if (state.lastDiscard && state.lastDiscardBy !== player.id) {
      player.hand.pop();
    }
    return state;
  }

  const selfDrawn = !state.lastDiscard || state.lastDiscardBy === player.id;
  const jokerCount = player.hand.filter(t => isJoker(t)).length;
  const score = calculateScore(winPattern, selfDrawn, jokerCount);

  player.score += score;
  state.winner = player.id;
  state.winningHand = winPattern;
  state.phase = 'round_end';
  state.claimWindow = null;

  addLog(state, action.playerId, 'mahjong',
    `Mahjong! ${winPattern.description} (${winPattern.category}) for ${score} points!`);

  return state;
}

function handlePass(state: GameState, _action: GameAction): GameState {
  // If all non-discarders have passed, advance turn
  if (state.claimWindow) {
    state.claimWindow.resolved = true;
  }
  return state;
}

/** Resolve claim window and advance to next turn */
export function resolveClaimWindow(state: GameState): GameState {
  if (!state.claimWindow?.resolved) return state;

  // No one claimed — advance to next player
  state.claimWindow = null;
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % 4;
  state.hasDrawn = false;
  state.turnNumber++;

  return state;
}

/** Advance turn to next player (called when no claims) */
export function advanceTurn(state: GameState): GameState {
  const newState = deepCopyState(state);
  newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % 4;
  newState.hasDrawn = false;
  newState.turnNumber++;
  newState.lastDiscard = null;
  newState.lastDiscardBy = null;
  newState.claimWindow = null;
  return newState;
}

/** Add a log entry */
function addLog(state: GameState, playerId: string, action: GameAction['type'], message: string) {
  state.log.push({
    timestamp: Date.now(),
    playerId,
    action,
    message,
  });
}

/** Deep copy game state (shallow-safe for most operations) */
function deepCopyState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map(p => ({
      ...p,
      hand: [...p.hand],
      exposedSets: p.exposedSets.map(s => ({ ...s, tiles: [...s.tiles] })),
      discards: [...p.discards],
    })),
    wall: { ...state.wall, tiles: [...state.wall.tiles] },
    log: [...state.log],
    claimWindow: state.claimWindow ? { ...state.claimWindow, claims: new Map(state.claimWindow.claims) } : null,
  };
}

function handleSwapJoker(state: GameState, action: GameAction): GameState {
  const playerIdx = state.players.findIndex(p => p.id === action.playerId);
  if (playerIdx !== state.currentPlayerIndex) return state;
  if (!state.hasDrawn) return state;

  if (!action.tiles || action.tiles.length !== 2) return state;
  const handTile = action.tiles[0];
  const jokerTile = action.tiles[1];
  if (!handTile || !jokerTile) return state;

  const player = state.players[playerIdx]!;

  // 1. Verify handTile is in player's hand
  const handTileIdx = player.hand.findIndex(t => t.id === handTile.id);
  if (handTileIdx === -1) return state;

  // 2. Find the exposed set containing the jokerTile
  let targetSet: ExposedSet | undefined;
  let targetPlayer: Player | undefined;

  for (const p of state.players) {
    for (const set of p.exposedSets) {
      if (set.tiles.some(t => t.id === jokerTile.id)) {
        targetSet = set;
        targetPlayer = p;
        break;
      }
    }
    if (targetSet) break;
  }

  if (!targetSet || !targetPlayer) return state;

  // 3. Verify jokerTile is actually a joker
  if (!isJoker(jokerTile)) return state;

  // 4. Verify handTile matches the natural tiles of targetSet
  const naturalTile = targetSet.tiles.find(t => !isJoker(t));
  if (!naturalTile) return state; // Can't swap if set contains only jokers

  // Verify match: same type, and details
  const match = (
    handTile.kind.type === naturalTile.kind.type &&
    (handTile.kind.type !== 'suited' || (
      (handTile.kind as any).suit === (naturalTile.kind as any).suit &&
      (handTile.kind as any).rank === (naturalTile.kind as any).rank
    )) &&
    (handTile.kind.type !== 'wind' || (handTile.kind as any).wind === (naturalTile.kind as any).wind) &&
    (handTile.kind.type !== 'dragon' || (handTile.kind as any).dragon === (naturalTile.kind as any).dragon)
  );

  if (!match) return state;

  // 5. Perform the swap!
  const jokerSetIdx = targetSet.tiles.findIndex(t => t.id === jokerTile.id);
  targetSet.tiles[jokerSetIdx] = handTile;
  player.hand[handTileIdx] = jokerTile;

  // Sort player's hand
  player.hand = sortTiles(player.hand);

  addLog(state, action.playerId, 'swap_joker',
    `Swapped ${handTile.label} for an exposed Joker in ${targetPlayer.name}'s set.`);

  return state;
}
