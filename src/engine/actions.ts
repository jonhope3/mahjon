// ============================================================
// Action Validation — Can a player take a given action?
// ============================================================

import { Tile, Player, GameState, ActionType } from './types';
import { isJoker, tilesMatch } from './tiles';
import { checkWin } from './scoring';

/**
 * Count how many tiles in a player's hand match a given tile kind.
 * Jokers are NOT counted as matches here (they're wild but counted separately).
 */
export function countMatching(hand: Tile[], target: Tile): number {
  return hand.filter(t => !isJoker(t) && tilesMatch(t.kind, target.kind)).length;
}

/** Count jokers in hand */
export function countJokers(hand: Tile[]): number {
  return hand.filter(t => isJoker(t)).length;
}

/** Count jokers across concealed hand + exposed sets */
export function countPlayerJokers(player: Player): number {
  const exposed = player.exposedSets.reduce(
    (n, set) => n + set.tiles.filter(t => isJoker(t)).length,
    0,
  );
  return countJokers(player.hand) + exposed;
}

/**
 * Check if a player can claim a discard for a Pung (3 of a kind).
 * Needs 2 matching + discard, or 1 matching + 1 joker + discard, etc.
 */
export function canPung(player: Player, discard: Tile): boolean {
  // Can't pung a joker
  if (isJoker(discard)) return false;
  // Jokers can't be used in pairs/singles, but CAN be used in Pung/Kong/Quint
  const matching = countMatching(player.hand, discard);
  const jokers = countJokers(player.hand);
  return matching + jokers >= 2;
}

/**
 * Check if a player can claim a discard for a Kong (4 of a kind).
 * Needs 3 matching + discard, or fewer matching + jokers
 */
export function canKong(player: Player, discard: Tile): boolean {
  if (isJoker(discard)) return false;
  const matching = countMatching(player.hand, discard);
  const jokers = countJokers(player.hand);
  return matching + jokers >= 3;
}

/**
 * Check if a player can claim a discard for a Quint (5 of a kind).
 * Needs 4 matching + discard, using jokers as needed.
 */
export function canQuint(player: Player, discard: Tile): boolean {
  if (isJoker(discard)) return false;
  const matching = countMatching(player.hand, discard);
  const jokers = countJokers(player.hand);
  return matching + jokers >= 4;
}

/**
 * Check if a player can declare a Kong on their own turn (after drawing):
 * - 4 of a kind in hand (jokers OK), or
 * - promote an exposed pung with one more matching tile from hand
 */
export function canSelfKong(player: Player): boolean {
  if (findConcealedKongTiles(player)) return true;
  if (findPungPromotion(player)) return true;
  return false;
}

/** Tiles in hand that form a concealed kong (4), or null */
export function findConcealedKongTiles(player: Player): Tile[] | null {
  const groups = new Map<string, Tile[]>();
  const jokers = player.hand.filter(t => isJoker(t));
  for (const t of player.hand) {
    if (isJoker(t)) continue;
    const key = t.label;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  for (const tiles of groups.values()) {
    const need = 4 - tiles.length;
    if (need <= 0) return tiles.slice(0, 4);
    if (need <= jokers.length) return [...tiles, ...jokers.slice(0, need)];
  }
  // All-joker kong is legal as a 3+ wild group
  if (jokers.length >= 4) return jokers.slice(0, 4);
  return null;
}

/** Exposed pung index + hand tile(s) to promote to kong, or null */
export function findPungPromotion(
  player: Player,
): { setIndex: number; tilesFromHand: Tile[] } | null {
  for (let i = 0; i < player.exposedSets.length; i++) {
    const set = player.exposedSets[i]!;
    if (set.setType !== 'pung') continue;
    const natural = set.tiles.find(t => !isJoker(t));
    if (!natural) {
      // All-joker pung: any tile? Prefer a joker from hand
      const jok = player.hand.find(t => isJoker(t));
      if (jok) return { setIndex: i, tilesFromHand: [jok] };
      continue;
    }
    const match = player.hand.find(t => !isJoker(t) && tilesMatch(t.kind, natural.kind));
    if (match) return { setIndex: i, tilesFromHand: [match] };
    const jok = player.hand.find(t => isJoker(t));
    if (jok) return { setIndex: i, tilesFromHand: [jok] };
  }
  return null;
}

/** True while a discard is waiting for claim responses */
export function isClaimWindowOpen(state: GameState): boolean {
  return !!(state.lastDiscard && state.claimWindow && !state.claimWindow.resolved);
}

/** Claim actions available for a discard (ignores whether the player already responded). */
export function getClaimOptions(state: GameState, playerIndex: number): ActionType[] {
  const player = state.players[playerIndex];
  if (!player || !state.lastDiscard) return [];
  if (state.lastDiscardBy === player.id) return [];

  const actions: ActionType[] = [];
  if (canPung(player, state.lastDiscard)) actions.push('pung');
  if (canKong(player, state.lastDiscard)) actions.push('kong');
  if (canQuint(player, state.lastDiscard)) actions.push('quint');

  const tempPlayer = {
    ...player,
    hand: [...player.hand, state.lastDiscard],
  };
  if (checkWin(tempPlayer)) {
    actions.push('mahjong');
  }

  return actions;
}

/**
 * Get all valid actions for a player given the current game state.
 */
export function getValidActions(state: GameState, playerIndex: number): ActionType[] {
  const player = state.players[playerIndex];
  if (!player) return [];

  if (state.phase !== 'playing') return [];

  // Already answered this claim window — wait for resolution
  if (state.claimWindow?.claims.has(player.id)) return [];

  // ---- Claim window: only claim/pass, never draw ----
  if (isClaimWindowOpen(state)) {
    if (state.lastDiscardBy === player.id) return [];
    const claims = getClaimOptions(state, playerIndex);
    if (claims.length === 0) return [];
    return [...claims, 'pass'];
  }

  // ---- Normal turn ----
  const actions: ActionType[] = [];
  const isCurrentPlayer = playerIndex === state.currentPlayerIndex;

  if (isCurrentPlayer) {
    if (!state.hasDrawn) {
      actions.push('draw');
    } else {
      actions.push('discard');
      if (canSelfKong(player)) actions.push('kong');
      if (checkWin(player)) {
        actions.push('mahjong');
      }
    }
  }

  return actions;
}

/**
 * Priority of claims — higher priority wins the claim window.
 * Mahjong > Quint > Kong > Pung
 */
export function claimPriority(action: ActionType): number {
  switch (action) {
    case 'mahjong': return 100;
    case 'quint': return 4;
    case 'kong': return 3;
    case 'pung': return 2;
    case 'pass': return 0;
    default: return 0;
  }
}

/** True if every seat that could claim has recorded a response */
export function allEligibleClaimsResolved(state: GameState): boolean {
  if (!isClaimWindowOpen(state)) return true;
  for (let i = 0; i < 4; i++) {
    const p = state.players[i]!;
    if (p.id === state.lastDiscardBy) continue;
    if (state.claimWindow!.claims.has(p.id)) continue;
    if (getClaimOptions(state, i).length > 0) return false;
  }
  return true;
}
