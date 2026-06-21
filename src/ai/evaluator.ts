// ============================================================
// AI Hand Evaluator — Heuristic tile scoring
// ============================================================

import { Tile, Player, HandPattern } from '../engine/types';
import { evaluateHandDistance } from '../engine/scoring';
import { isJoker, isFlower } from '../engine/tiles';

export interface TileEvaluation {
  tile: Tile;
  /** How useful this tile is to keep (higher = more useful) */
  usefulness: number;
  /** Reasons for the score */
  reasons: string[];
}

/**
 * Evaluate each tile in a player's hand for discard priority.
 * Lower usefulness = better discard candidate.
 */
export function evaluateHand(player: Player): TileEvaluation[] {
  const distances = evaluateHandDistance(player);
  const topPatterns = distances.slice(0, 5); // Consider top 5 closest patterns

  return player.hand.map(tile => {
    const reasons: string[] = [];
    let usefulness = 0;

    // Jokers are always useful
    if (isJoker(tile)) {
      usefulness += 100;
      reasons.push('Joker: always valuable');
      return { tile, usefulness, reasons };
    }

    // Check how many of the top patterns this tile contributes to
    for (const { pattern, distance } of topPatterns) {
      const relevance = tileRelevanceToPattern(tile, pattern);
      if (relevance > 0) {
        const bonus = relevance * (10 - Math.min(distance, 9));
        usefulness += bonus;
        reasons.push(`Fits ${pattern.id} (dist=${distance}): +${bonus.toFixed(0)}`);
      }
    }

    // Count duplicates in hand (more copies = less need for extras)
    const dupes = player.hand.filter(t =>
      !isJoker(t) &&
      t.kind.type === tile.kind.type &&
      JSON.stringify(t.kind) === JSON.stringify(tile.kind)
    ).length;
    if (dupes >= 3) {
      usefulness += 15;
      reasons.push(`Has ${dupes} copies`);
    } else if (dupes >= 2) {
      usefulness += 5;
    }

    // Flowers are moderately useful (many patterns use them)
    if (isFlower(tile)) {
      usefulness += 8;
      reasons.push('Flower: commonly needed');
    }

    return { tile, usefulness, reasons };
  });
}

/**
 * How relevant is a specific tile to a pattern?
 * Returns 0-1 relevance score.
 */
function tileRelevanceToPattern(tile: Tile, pattern: HandPattern): number {
  for (const group of pattern.groups) {
    if (group.type === 'flower' && tile.kind.type === 'flower') return 0.8;
    if (group.type === 'dragon' && tile.kind.type === 'dragon') {
      if (group.dragon === 'any' || tile.kind.dragon === group.dragon) return 0.7;
    }
    if (group.type === 'wind' && tile.kind.type === 'wind') {
      if (group.wind === 'any' || tile.kind.wind === group.wind) return 0.7;
    }
    if (group.type === 'news' && tile.kind.type === 'wind') return 0.5;
    if (group.type === 'suited' && tile.kind.type === 'suited') {
      if (tile.kind.rank === group.rank) return 0.9;
    }
  }
  return 0;
}

/**
 * Get the best tile to discard from hand.
 * Returns the tile with the lowest usefulness score.
 */
export function getBestDiscard(player: Player): Tile {
  const evaluations = evaluateHand(player);
  evaluations.sort((a, b) => a.usefulness - b.usefulness);
  // Never discard a joker if possible
  const nonJoker = evaluations.find(e => !isJoker(e.tile));
  return nonJoker?.tile ?? evaluations[0]!.tile;
}
