// ============================================================
// AI Player — Decision-making for computer opponents
// ============================================================

import { GameState, Tile, GameAction, Player, Difficulty } from '../engine/types';
import { getValidActions, canPung, canKong, canQuint } from '../engine/actions';
import { checkWin, evaluateHandDistance } from '../engine/scoring';
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

    // Self-kong when available (helps quint/kong hands)
    if (validActions.includes('kong')) {
      return { type: 'kong', playerId: player.id };
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
 * Prefer claims that improve distance to a card hand — don't auto-grab every quint.
 */
function evaluateClaim(
  state: GameState,
  playerIndex: number,
  difficulty: Difficulty
): GameAction | null {
  const player = state.players[playerIndex]!;
  const discard = state.lastDiscard;
  if (!discard) return null;

  const claimThreshold = difficulty === 'easy' ? 0.25 : difficulty === 'medium' ? 0.4 : 0.55;
  const before = evaluateHandDistance(player)[0]?.distance ?? 99;

  const simulate = (type: 'quint' | 'kong' | 'pung'): number | null => {
    const setSize = type === 'pung' ? 3 : type === 'kong' ? 4 : 5;
    const matching = player.hand.filter(
      t => !isJoker(t) && JSON.stringify(t.kind) === JSON.stringify(discard.kind),
    );
    const jokers = player.hand.filter(t => isJoker(t));
    const need = setSize - 1;
    if (matching.length + jokers.length < need) return null;

    const fromMatch = Math.min(matching.length, need);
    const fromJok = need - fromMatch;
    const remove = new Set([
      ...matching.slice(0, fromMatch).map(t => t.id),
      ...jokers.slice(0, fromJok).map(t => t.id),
    ]);
    const afterPlayer: Player = {
      ...player,
      hand: player.hand.filter(t => !remove.has(t.id)),
      exposedSets: [
        ...player.exposedSets,
        {
          tiles: [...matching.slice(0, fromMatch), ...jokers.slice(0, fromJok), discard],
          setType: type,
          claimedTile: discard,
        },
      ],
    };
    return evaluateHandDistance(afterPlayer)[0]?.distance ?? 99;
  };

  const accept = (type: 'quint' | 'kong' | 'pung'): GameAction | null => {
    const after = simulate(type);
    if (after === null) return null;
    if (after < before) return { type, playerId: player.id, targetTile: discard };
    if (after <= before && before <= 4) return { type, playerId: player.id, targetTile: discard };
    if (difficulty === 'hard' && after <= before + 1 && before <= 6) {
      return { type, playerId: player.id, targetTile: discard };
    }
    return null;
  };

  if (canQuint(player, discard)) {
    const q = accept('quint');
    if (q) return q;
  }
  if (canKong(player, discard)) {
    const k = accept('kong');
    if (k) return k;
  }
  if (canPung(player, discard)) {
    const p = accept('pung');
    if (p) return p;
  }

  // Fallback: natural copies already valued in hand
  const handEvals = evaluateHand(player);
  const discardRelevance = handEvals
    .filter(e => !isJoker(e.tile) && JSON.stringify(e.tile.kind) === JSON.stringify(discard.kind))
    .reduce((sum, e) => sum + e.usefulness, 0);
  const avgUsefulness =
    handEvals.reduce((sum, e) => sum + e.usefulness, 0) / Math.max(handEvals.length, 1);
  const relativeValue = discardRelevance / Math.max(avgUsefulness, 1);

  if (canKong(player, discard) && relativeValue > claimThreshold * 0.85) {
    return { type: 'kong', playerId: player.id, targetTile: discard };
  }
  if (canPung(player, discard) && relativeValue > claimThreshold) {
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
export function getAICharlestonTiles(player: Player, count = 3): Tile[] {
  if (count <= 0) return [];
  const evals = evaluateHand(player)
    .filter(e => !isJoker(e.tile))
    .sort((a, b) => a.usefulness - b.usefulness);

  return evals.slice(0, count).map(e => e.tile);
}
