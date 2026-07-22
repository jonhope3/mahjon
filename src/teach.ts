// ============================================================
// Teaching helpers — turn coaching + gentle hand progress
// ============================================================

import type { ActionType, GameState, Player } from './engine/types';
import { evaluateHandDistance } from './engine/scoring';
import type { TeachMode } from './game-settings';

export function showTurnCoaching(mode: TeachMode): boolean {
  return mode !== 'expert';
}

export function showHandProgress(mode: TeachMode): boolean {
  return mode === 'coach';
}

/** One-liner for the current decision point. */
export function turnHint(
  state: GameState,
  humanIndex: number,
  validActions: ActionType[],
  hasSelectedTile: boolean,
): string | null {
  if (state.phase === 'round_end') return null;

  const isClaim = validActions.includes('pass');
  if (isClaim) {
    const claims = validActions.filter(a =>
      ['pung', 'kong', 'quint', 'mahjong'].includes(a),
    );
    if (claims.length === 0) return 'Nothing to claim — tap Pass to continue.';
    const labels = claims.map(a =>
      a === 'mahjong' ? 'Mahjong' : a[0]!.toUpperCase() + a.slice(1),
    );
    return `Claim with ${labels.join(' / ')}, or Pass.`;
  }

  const isMyTurn = state.currentPlayerIndex === humanIndex;
  if (!isMyTurn) {
    const name = state.players[state.currentPlayerIndex]?.name ?? 'Opponent';
    return `Waiting on ${name}…`;
  }

  // After Charleston, East (dealer) already has 14 and discards first
  if (!state.hasDrawn && validActions.includes('discard') && !validActions.includes('draw')) {
    return 'You are East — discard one tile to start (no draw this turn).';
  }

  if (validActions.includes('draw') && !state.hasDrawn) {
    return 'Your turn — Draw a tile.';
  }

  if (validActions.includes('discard')) {
    if (!hasSelectedTile) return 'Select a tile, then Discard.';
    return 'Discard the selected tile.';
  }

  return null;
}

/** Gentle closest-hand line for Coach mode — never spoils a ready win. */
export function handProgressHint(player: Player): string | null {
  try {
    const ranked = evaluateHandDistance(player);
    const top = ranked[0];
    if (!top) return null;
    const { pattern, distance } = top;
    // distance 0 = matcher thinks it's complete. Stay quiet; player must notice.
    if (distance <= 0) return null;
    if (distance === 1) return `Close to “${pattern.description}”.`;
    if (distance === 2) return `Building toward “${pattern.description}”.`;
    if (distance <= 4) return `Nearest card shape: “${pattern.description}”.`;
    return null;
  } catch {
    return null;
  }
}

const SEEN_KEY = 'mahjon-coach-seen';

type SeenFlags = {
  charlestonIntro?: boolean;
  jokerSwap?: boolean;
};

function loadSeen(): SeenFlags {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') as SeenFlags;
  } catch {
    return {};
  }
}

function saveSeen(flags: SeenFlags) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(flags));
}

export function shouldShowCharlestonIntro(mode: TeachMode): boolean {
  if (!showTurnCoaching(mode)) return false;
  return !loadSeen().charlestonIntro;
}

export function markCharlestonIntroSeen() {
  saveSeen({ ...loadSeen(), charlestonIntro: true });
}

export function shouldShowJokerSwapTip(mode: TeachMode): boolean {
  if (!showTurnCoaching(mode)) return false;
  return !loadSeen().jokerSwap;
}

export function markJokerSwapTipSeen() {
  saveSeen({ ...loadSeen(), jokerSwap: true });
}
