// ============================================================
// AI Player — Decision-making for computer opponents
// ============================================================

import { GameState, Tile, GameAction, Player, Difficulty } from '../engine/types';
import { getValidActions, canPung, canKong, canQuint } from '../engine/actions';
import { checkWin } from '../engine/scoring';
import { getBestDiscard, evaluateHand } from './evaluator';
import { isJoker } from '../engine/tiles';

/**
 * Get the AI's next action for the given game state.
 * Returns a GameAction or null if no action needed.
 */
export function getAIAction(state: GameState, playerIndex: number): GameAction | null {
  const player = state.players[playerIndex];
  if (!player || player.type !== 'ai') return null;

  const difficulty = player.difficulty || 'medium';

  // During Charleston phase, auto-select tiles to pass
  if (state.phase.startsWith('charleston')) {
    return getCharlestonAction(state, playerIndex, difficulty);
  }

  if (state.phase !== 'playing') return null;

  const validActions = getValidActions(state, playerIndex);
  if (validActions.length === 0) return null;

  // Check if we can declare Mahjong
  if (validActions.includes('mahjong')) {
    // If we just drew, check if hand is complete
    if (state.currentPlayerIndex === playerIndex && state.hasDrawn) {
      const win = checkWin(player);
      if (win) {
        return { type: 'mahjong', playerId: player.id };
      }
    }
    // If claiming from discard
    if (state.lastDiscard && state.lastDiscardBy !== player.id) {
      const tempHand = [...player.hand, state.lastDiscard];
      const tempPlayer = { ...player, hand: tempHand };
      const win = checkWin(tempPlayer);
      if (win) {
        return { type: 'mahjong', playerId: player.id };
      }
    }
  }

  // Should we claim the discard?
  if (state.lastDiscard && state.lastDiscardBy !== player.id) {
    const claimAction = evaluateClaim(state, playerIndex, difficulty);
    if (claimAction) return claimAction;
    return { type: 'pass', playerId: player.id };
  }

  // Our turn — draw if we haven't
  if (state.currentPlayerIndex === playerIndex) {
    if (!state.hasDrawn) {
      return { type: 'draw', playerId: player.id };
    }

    // Discard
    const discard = chooseDiscard(player, difficulty);
    return {
      type: 'discard',
      playerId: player.id,
      tiles: [discard],
    };
  }

  return null;
}

/**
 * Evaluate whether to claim a discarded tile.
 */
function evaluateClaim(
  state: GameState,
  playerIndex: number,
  difficulty: Difficulty
): GameAction | null {
  const player = state.players[playerIndex]!;
  const discard = state.lastDiscard;
  if (!discard) return null;

  // Difficulty affects claim aggressiveness
  const claimThreshold = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.5 : 0.7;

  // Check what claims are possible
  const canDoQuint = canQuint(player, discard);
  const canDoKong = canKong(player, discard);
  const canDoPung = canPung(player, discard);

  // Quints are always worth claiming
  if (canDoQuint) {
    return { type: 'quint', playerId: player.id, targetTile: discard };
  }

  // Evaluate if claiming helps our hand
  const handEvals = evaluateHand(player);
  const discardRelevance = handEvals
    .filter(e => !isJoker(e.tile) && JSON.stringify(e.tile.kind) === JSON.stringify(discard.kind))
    .reduce((sum, e) => sum + e.usefulness, 0);

  const avgUsefulness = handEvals.reduce((sum, e) => sum + e.usefulness, 0) / handEvals.length;
  const relativeValue = discardRelevance / Math.max(avgUsefulness, 1);

  if (canDoKong && relativeValue > claimThreshold * 0.8) {
    return { type: 'kong', playerId: player.id, targetTile: discard };
  }

  if (canDoPung && relativeValue > claimThreshold) {
    return { type: 'pung', playerId: player.id, targetTile: discard };
  }

  return null;
}

/**
 * Choose which tile to discard.
 */
function chooseDiscard(player: Player, difficulty: Difficulty): Tile {
  if (difficulty === 'easy') {
    // Easy AI: mostly random but avoid jokers
    const nonJokers = player.hand.filter(t => !isJoker(t));
    if (nonJokers.length > 0) {
      return nonJokers[Math.floor(Math.random() * nonJokers.length)]!;
    }
    return player.hand[0]!;
  }

  // Medium/Hard: use evaluator
  const discard = getBestDiscard(player);

  if (difficulty === 'medium') {
    // Medium: 20% chance of making a suboptimal choice
    if (Math.random() < 0.2) {
      const nonJokers = player.hand.filter(t => !isJoker(t));
      if (nonJokers.length > 0) {
        return nonJokers[Math.floor(Math.random() * nonJokers.length)]!;
      }
    }
  }

  return discard;
}

/**
 * AI Charleston: select the 3 least useful tiles to pass.
 */
function getCharlestonAction(
  state: GameState,
  playerIndex: number,
  difficulty: Difficulty
): GameAction | null {
  const player = state.players[playerIndex]!;

  if (difficulty === 'easy') {
    // Easy: pick 3 random non-joker tiles
    const candidates = player.hand.filter(t => !isJoker(t));
    const selected: Tile[] = [];
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 3 && i < shuffled.length; i++) {
      selected.push(shuffled[i]!);
    }
    return {
      type: 'charleston',
      playerId: player.id,
      tiles: selected,
    };
  }

  // Medium/Hard: pass the 3 least useful tiles
  const evals = evaluateHand(player)
    .filter(e => !isJoker(e.tile))
    .sort((a, b) => a.usefulness - b.usefulness);

  const selected = evals.slice(0, 3).map(e => e.tile);
  return {
    type: 'charleston',
    playerId: player.id,
    tiles: selected,
  };
}

/**
 * Get AI's selected tiles for Charleston (used by the game loop).
 */
export function getAICharlestonTiles(player: Player): Tile[] {
  const evals = evaluateHand(player)
    .filter(e => !isJoker(e.tile))
    .sort((a, b) => a.usefulness - b.usefulness);

  return evals.slice(0, 3).map(e => e.tile);
}
