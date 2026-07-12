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
 * Get all valid actions for a player given the current game state.
 */
export function getValidActions(state: GameState, playerIndex: number): ActionType[] {
  const player = state.players[playerIndex];
  if (!player) return [];
  const actions: ActionType[] = [];

  const isCurrentPlayer = playerIndex === state.currentPlayerIndex;

  if (state.phase !== 'playing') return [];

  // If there's a discard to claim
  if (state.lastDiscard && state.lastDiscardBy !== player.id) {
    if (canPung(player, state.lastDiscard)) actions.push('pung');
    if (canKong(player, state.lastDiscard)) actions.push('kong');
    if (canQuint(player, state.lastDiscard)) actions.push('quint');
    
    // Check if adding the discard to hand makes it a winning hand
    const tempPlayer = {
      ...player,
      hand: [...player.hand, state.lastDiscard]
    };
    if (checkWin(tempPlayer)) {
      actions.push('mahjong');
    }
    
    // Only show pass if the player has at least one active claim action
    if (actions.length > 0) {
      actions.push('pass');
    }
  }

  // Current player's turn actions
  if (isCurrentPlayer) {
    if (!state.hasDrawn) {
      actions.push('draw');
    } else {
      actions.push('discard');
      // Can declare mahjong after drawing if hand is winning
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
