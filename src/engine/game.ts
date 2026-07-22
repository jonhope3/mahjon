// ============================================================
// Main Game Controller
// ============================================================

import {
  GameState, Player, Tile, GameAction, ActionType,
  SeatWind, PlayerType, Difficulty, ExposedSet,
} from './types';
import { createTileSet, shuffleTiles, buildWall, drawFromWall, sortTiles, isJoker, tilesMatch } from './tiles';
import { checkWin, calculateScore } from './scoring';
import { nextCharlestonPhase, getCharlestonRound } from './charleston';
import {
  canKong,
  canPung,
  canQuint,
  claimPriority,
  countPlayerJokers,
  getClaimOptions,
  isClaimWindowOpen,
} from './actions';

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

/** Deal tiles to all players. Dealer gets 14, others get 13. */
export function dealTiles(state: GameState): GameState {
  let newState = { ...state, wall: { ...state.wall, tiles: [...state.wall.tiles] } };
  const newPlayers = newState.players.map(p => ({ ...p, hand: [...p.hand] }));
  const dealer = newState.dealerIndex;

  // Deal 13 tiles to each player (4 rounds of 3, then 1 round of 1)
  for (let round = 0; round < 4; round++) {
    const count = round < 3 ? 3 : 1;
    for (let p = 0; p < 4; p++) {
      for (let c = 0; c < count + (round === 3 && p === dealer ? 1 : 0); c++) {
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
  newState.currentPlayerIndex = dealer;
  newState.phase = 'charleston_first_right';

  addLog(newState, 'system', 'draw', 'Tiles dealt. Charleston begins.');

  return newState;
}

/** Next round: keep scores/players, rotate dealer, redeal. */
export function startNextRound(prev: GameState): GameState {
  const nextDealer = (prev.dealerIndex + 1) % 4;
  const fresh = createGame({
    players: prev.players.map(p => ({
      name: p.name,
      type: p.type,
      difficulty: p.difficulty,
    })),
  });
  fresh.dealerIndex = nextDealer;
  fresh.currentPlayerIndex = nextDealer;
  fresh.roundNumber = prev.roundNumber + 1;
  // Rotate seat winds so the dealer is East
  for (let i = 0; i < 4; i++) {
    fresh.players[i]!.seatWind = SEAT_WINDS[(i - nextDealer + 4) % 4]!;
  }
  const dealt = dealTiles(fresh);
  for (let i = 0; i < 4; i++) {
    dealt.players[i]!.score = prev.players[i]!.score;
  }
  return dealt;
}

/** Skip charleston and go straight to playing (optional 2nd / courtesy only) */
export function skipCharleston(state: GameState): GameState {
  const round = getCharlestonRound(state.phase);
  if (round !== 'second' && round !== 'courtesy') return state;
  return {
    ...state,
    phase: 'playing',
    hasDrawn: state.currentPlayerIndex === state.dealerIndex, // dealer already has 14
  };
}

/** Advance one Charleston step with no tile exchange (optional pass skip) */
export function advanceCharlestonWithoutPass(state: GameState): GameState {
  const round = getCharlestonRound(state.phase);
  if (round !== 'second' && round !== 'courtesy') return state;
  const nextPhase = nextCharlestonPhase(state.phase);
  if (nextPhase === 'playing') return skipCharleston(state);
  return { ...state, phase: nextPhase };
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
  if (state.phase !== 'playing') return state;
  if (isClaimWindowOpen(state)) return state;
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
  if (state.phase !== 'playing') return state;
  if (isClaimWindowOpen(state)) return state;
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

/** Record a claim intent; applied later by resolveClaimWindow */
function handleClaim(state: GameState, action: GameAction): GameState {
  if (state.phase !== 'playing') return state;
  if (!isClaimWindowOpen(state) || !state.lastDiscard) return state;
  if (isJoker(state.lastDiscard)) return state;
  if (action.playerId === state.lastDiscardBy) return state;
  if (state.claimWindow!.claims.has(action.playerId)) return state;

  const playerIdx = state.players.findIndex(p => p.id === action.playerId);
  if (playerIdx === -1) return state;
  const player = state.players[playerIdx]!;

  const ok =
    (action.type === 'pung' && canPung(player, state.lastDiscard)) ||
    (action.type === 'kong' && canKong(player, state.lastDiscard)) ||
    (action.type === 'quint' && canQuint(player, state.lastDiscard));
  if (!ok) return state;

  state.claimWindow!.claims.set(action.playerId, action.type);
  addLog(state, action.playerId, action.type, `Called ${action.type} on ${state.lastDiscard.label}.`);
  return state;
}

function handleMahjong(state: GameState, action: GameAction): GameState {
  if (state.phase !== 'playing') return state;
  const playerIdx = state.players.findIndex(p => p.id === action.playerId);
  if (playerIdx === -1) return state;
  const player = state.players[playerIdx]!;

  // Claim-window mahjong: record intent for arbitration
  if (isClaimWindowOpen(state) && state.lastDiscard && state.lastDiscardBy !== player.id) {
    if (state.claimWindow!.claims.has(action.playerId)) return state;
    if (!getClaimOptions(state, playerIdx).includes('mahjong')) return state;
    state.claimWindow!.claims.set(action.playerId, 'mahjong');
    addLog(state, action.playerId, 'mahjong', `Called Mahjong on ${state.lastDiscard.label}.`);
    return state;
  }

  // Self-drawn mahjong (not during a claim window)
  if (isClaimWindowOpen(state)) return state;
  if (playerIdx !== state.currentPlayerIndex || !state.hasDrawn) return state;

  return declareMahjongWin(state, playerIdx, /*claimedFromDiscard*/ false);
}

function declareMahjongWin(
  state: GameState,
  playerIdx: number,
  claimedFromDiscard: boolean,
): GameState {
  const player = state.players[playerIdx]!;

  if (claimedFromDiscard && state.lastDiscard && state.lastDiscardBy !== player.id) {
    player.hand.push(state.lastDiscard);
  }

  const winPattern = checkWin(player);
  if (!winPattern) {
    if (claimedFromDiscard && state.lastDiscard && state.lastDiscardBy !== player.id) {
      player.hand.pop();
    }
    return state;
  }

  const selfDrawn = !claimedFromDiscard;
  const jokerCount = countPlayerJokers(player);
  const score = calculateScore(winPattern, selfDrawn, jokerCount);

  if (claimedFromDiscard && state.lastDiscard && state.lastDiscardBy) {
    const discarderIdx = state.players.findIndex(p => p.id === state.lastDiscardBy);
    if (discarderIdx !== -1) {
      const discards = state.players[discarderIdx]!.discards;
      const discardIdx = discards.findIndex(t => t.id === state.lastDiscard!.id);
      if (discardIdx !== -1) discards.splice(discardIdx, 1);
    }
  }

  player.score += score;
  state.winner = player.id;
  state.winningHand = winPattern;
  state.phase = 'round_end';
  state.claimWindow = null;
  state.lastDiscard = null;
  state.lastDiscardBy = null;

  addLog(state, player.id, 'mahjong',
    `Mahjong! ${winPattern.description} (${winPattern.category}) for ${score} points!`);

  return state;
}

function handlePass(state: GameState, action: GameAction): GameState {
  if (state.phase !== 'playing') return state;
  if (!isClaimWindowOpen(state)) return state;
  if (action.playerId === state.lastDiscardBy) return state;
  if (state.claimWindow!.claims.has(action.playerId)) return state;

  const playerIdx = state.players.findIndex(p => p.id === action.playerId);
  if (playerIdx === -1) return state;
  // Only seats that could claim are allowed to pass (keeps window resolution clean)
  if (getClaimOptions(state, playerIdx).length === 0) return state;

  state.claimWindow!.claims.set(action.playerId, 'pass');
  addLog(state, action.playerId, 'pass', 'Passed on the discard.');
  return state;
}

/**
 * After all eligible seats respond, award the highest-priority claim
 * (Mahjong > Quint > Kong > Pung). Ties break by seat order after the discarder.
 */
export function resolveClaimWindow(state: GameState): GameState {
  const newState = deepCopyState(state);
  if (!isClaimWindowOpen(newState) || !newState.lastDiscard || !newState.lastDiscardBy) {
    return advanceTurn(newState);
  }

  const discarderIdx = newState.players.findIndex(p => p.id === newState.lastDiscardBy);
  type Candidate = { playerIdx: number; action: ActionType; priority: number; seatDist: number };
  const candidates: Candidate[] = [];

  for (const [playerId, actionType] of newState.claimWindow!.claims) {
    if (actionType === 'pass') continue;
    if (!['pung', 'kong', 'quint', 'mahjong'].includes(actionType)) continue;
    const playerIdx = newState.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1) continue;
    const rawDist = (playerIdx - discarderIdx + 4) % 4;
    candidates.push({
      playerIdx,
      action: actionType,
      priority: claimPriority(actionType),
      seatDist: rawDist === 0 ? 4 : rawDist,
    });
  }

  if (candidates.length === 0) {
    return advanceTurn(newState);
  }

  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.seatDist - b.seatDist;
  });

  const winner = candidates[0]!;
  const winnerName = newState.players[winner.playerIdx]!.name;
  const claimLabel =
    winner.action === 'mahjong'
      ? 'Mahjong'
      : winner.action[0]!.toUpperCase() + winner.action.slice(1);

  const beaten = candidates.slice(1).filter(c => c.priority < winner.priority);
  if (beaten.length > 0) {
    const beatenBits = beaten.map(c => {
      const name = newState.players[c.playerIdx]!.name;
      const label = c.action === 'mahjong' ? 'Mahjong' : c.action;
      return `${name}'s ${label}`;
    });
    addLog(
      newState,
      newState.players[winner.playerIdx]!.id,
      winner.action,
      `${winnerName}'s ${claimLabel} takes the discard (${beatenBits.join(', ')} yield to higher priority).`,
    );
  } else if (candidates.length > 1) {
    addLog(
      newState,
      newState.players[winner.playerIdx]!.id,
      winner.action,
      `${winnerName}'s ${claimLabel} wins the tie (next seat after the discard).`,
    );
  }

  if (winner.action === 'mahjong') {
    return declareMahjongWin(newState, winner.playerIdx, true);
  }
  return applyExposedClaim(newState, winner.playerIdx, winner.action);
}

/** Apply a winning pung/kong/quint after claim arbitration */
function applyExposedClaim(
  state: GameState,
  playerIdx: number,
  actionType: ActionType,
): GameState {
  const player = state.players[playerIdx]!;
  const claimedTile = state.lastDiscard!;
  const setSize = actionType === 'pung' ? 3 : actionType === 'kong' ? 4 : 5;

  const matching: Tile[] = [];
  const jokers: Tile[] = [];

  for (const t of player.hand) {
    if (isJoker(t)) {
      jokers.push(t);
    } else if (tilesMatch(t.kind, claimedTile.kind)) {
      matching.push(t);
    }
  }

  const needed = setSize - 1;
  const fromMatching = Math.min(matching.length, needed);
  const fromJokers = Math.min(needed - fromMatching, jokers.length);
  if (fromMatching + fromJokers < needed) {
    // Claim became illegal somehow — treat as pass for the table
    return advanceTurn(state);
  }

  const setTiles: Tile[] = [];
  for (let i = 0; i < fromMatching; i++) setTiles.push(matching[i]!);
  for (let i = 0; i < fromJokers; i++) setTiles.push(jokers[i]!);
  setTiles.push(claimedTile);

  const usedIds = new Set(setTiles.map(t => t.id));
  usedIds.delete(claimedTile.id);
  player.hand = player.hand.filter(t => !usedIds.has(t.id));

  player.exposedSets.push({
    tiles: setTiles,
    setType: actionType === 'pung' ? 'pung' : actionType === 'kong' ? 'kong' : 'quint',
    claimedTile,
  });

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
  state.hasDrawn = true;

  addLog(state, player.id, actionType, `Claimed ${claimedTile.label} for a ${actionType}.`);
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
  if (state.phase !== 'playing') return state;
  if (isClaimWindowOpen(state)) return state;
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

  // 3. Verify the exposed tile is actually a joker (not the client payload)
  const jokerSetIdx = targetSet.tiles.findIndex(t => t.id === jokerTile.id);
  if (jokerSetIdx === -1) return state;
  const exposedJoker = targetSet.tiles[jokerSetIdx]!;
  if (!isJoker(exposedJoker)) return state;

  // 4. Verify handTile matches the natural tiles of targetSet
  const naturalTile = targetSet.tiles.find(t => !isJoker(t));
  if (!naturalTile) return state; // Can't swap if set contains only jokers

  // Verify match: same type, and details
  if (!tilesMatch(handTile.kind, naturalTile.kind)) return state;
  if (isJoker(handTile)) return state;

  // 5. Perform the swap!
  targetSet.tiles[jokerSetIdx] = handTile;
  player.hand[handTileIdx] = exposedJoker;

  // Sort player's hand
  player.hand = sortTiles(player.hand);

  addLog(state, action.playerId, 'swap_joker',
    `Swapped ${handTile.label} for an exposed Joker in ${targetPlayer.name}'s set.`);

  return state;
}
