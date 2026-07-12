// ============================================================
// charleston-flow — assemble AI + human picks, run one pass
// ============================================================

import type { GameState, Tile } from '../engine/types';
import { getAICharlestonTiles } from '../ai/ai-player';
import { executeCharlestonPass, nextCharlestonPhase } from '../engine/charleston';

/** Build tile selections for every seat (AI fills its own). Returns null if a human is still pending. */
export function resolveCharlestonSelections(
  state: GameState,
  humanIds: Map<number, number[]>,
): Map<number, Tile[]> | null {
  const out = new Map<number, Tile[]>();

  for (let i = 0; i < 4; i++) {
    const p = state.players[i]!;
    if (p.type === 'ai') {
      out.set(i, getAICharlestonTiles(p));
      continue;
    }
    const ids = humanIds.get(i);
    if (!ids || ids.length !== 3) return null;
    const tiles = ids.map(id => p.hand.find(t => t.id === id)!).filter(Boolean);
    if (tiles.length !== 3) return null;
    out.set(i, tiles);
  }

  return out;
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
  const selections = new Map<number, Tile[]>();
  selections.set(humanIdx, tiles);
  for (let i = 0; i < 4; i++) {
    if (i === humanIdx) continue;
    selections.set(i, getAICharlestonTiles(state.players[i]!));
  }
  return applyCharlestonPass(state, selections);
}
