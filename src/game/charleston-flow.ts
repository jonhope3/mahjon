// ============================================================
// charleston-flow — assemble AI + human picks, run one pass
// ============================================================

import type { GameState, Tile } from '../engine/types';
import {
  executeCharlestonPass,
  getCharlestonRound,
  getPassTarget,
  nextCharlestonPhase,
} from '../engine/charleston';
import { getAICharlestonTiles } from '../ai/ai-player';
import { isJoker } from '../engine/tiles';

function assertNoJokers(tiles: Tile[]): boolean {
  return tiles.every(t => !isJoker(t));
}

/**
 * Build tile selections for every seat (AI fills its own).
 * First/second Charleston: exactly 3 non-joker tiles each.
 * Courtesy: 0–3 non-joker tiles; opposite seats pass the smaller count.
 */
export function resolveCharlestonSelections(
  state: GameState,
  humanIds: Map<number, number[]>,
): Map<number, Tile[]> | null {
  const round = getCharlestonRound(state.phase);
  const courtesy = round === 'courtesy';
  const out = new Map<number, Tile[]>();

  for (let i = 0; i < 4; i++) {
    const p = state.players[i]!;
    if (p.type === 'ai') {
      const n = courtesy ? Math.min(3, getAICharlestonTiles(p, 3).length) : 3;
      // Courtesy AI: often pass 1–3 weak tiles (never jokers)
      const aiCount = courtesy ? (Math.random() < 0.15 ? 0 : n >= 2 ? 2 : n) : 3;
      const tiles = getAICharlestonTiles(p, courtesy ? aiCount : 3);
      if (!assertNoJokers(tiles)) return null;
      out.set(i, tiles);
      continue;
    }
    const ids = humanIds.get(i);
    if (!ids) return null;
    if (courtesy) {
      if (ids.length > 3) return null;
    } else if (ids.length !== 3) {
      return null;
    }
    if (new Set(ids).size !== ids.length) return null;
    const tiles = ids.map(id => p.hand.find(t => t.id === id)).filter((t): t is Tile => !!t);
    if (tiles.length !== ids.length) return null;
    if (!assertNoJokers(tiles)) return null;
    out.set(i, tiles);
  }

  if (courtesy) {
    normalizeCourtesyPairs(out, state.phase);
  }

  return out;
}

/** Opposite seats pass the same count = min of what each offered */
function normalizeCourtesyPairs(selections: Map<number, Tile[]>, phase: GameState['phase']) {
  const seen = new Set<number>();
  for (let i = 0; i < 4; i++) {
    if (seen.has(i)) continue;
    const j = getPassTarget(i, phase);
    seen.add(i);
    seen.add(j);
    const a = selections.get(i) ?? [];
    const b = selections.get(j) ?? [];
    const n = Math.min(a.length, b.length);
    selections.set(i, a.slice(0, n));
    selections.set(j, b.slice(0, n));
  }
}

export function applyCharlestonPass(
  state: GameState,
  selections: Map<number, Tile[]>,
): GameState {
  const nextPhase = nextCharlestonPhase(state.phase);
  return {
    ...state,
    players: executeCharlestonPass(state.players, selections, state.phase),
    phase: nextPhase,
    hasDrawn:
      nextPhase === 'playing'
        ? state.currentPlayerIndex === state.dealerIndex
        : state.hasDrawn,
  };
}

/** Single-player: human picks + AI fills the rest. */
export function runSoloCharleston(state: GameState, humanIdx: number, tiles: Tile[]): GameState {
  if (!assertNoJokers(tiles)) return state;
  const round = getCharlestonRound(state.phase);
  const courtesy = round === 'courtesy';
  if (!courtesy && tiles.length !== 3) return state;
  if (courtesy && tiles.length > 3) return state;

  const humanIds = new Map<number, number[]>();
  humanIds.set(humanIdx, tiles.map(t => t.id));
  // Mark other humans as empty for courtesy-only solo (only one human)
  const selections = resolveCharlestonSelections(state, humanIds);
  if (!selections) {
    // Fallback: build manually for solo (one human, three AI)
    const manual = new Map<number, Tile[]>();
    manual.set(humanIdx, tiles);
    for (let i = 0; i < 4; i++) {
      if (i === humanIdx) continue;
      const count = courtesy ? Math.min(tiles.length, 3) : 3;
      // AI matches courtesy willingness roughly
      const aiN = courtesy ? (tiles.length === 0 ? 0 : Math.min(3, Math.max(1, tiles.length))) : 3;
      manual.set(i, getAICharlestonTiles(state.players[i]!, courtesy ? aiN : count));
    }
    if (courtesy) normalizeCourtesyPairs(manual, state.phase);
    return applyCharlestonPass(state, manual);
  }
  return applyCharlestonPass(state, selections);
}
