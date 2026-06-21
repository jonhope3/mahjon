// ============================================================
// Scoring & Win Detection
// ============================================================
//
// In American Mahjong, a win is matching your 14 tiles (hand + exposed)
// to exactly one pattern on the card. Jokers act as wildcards for
// groups of 3+ (Pung, Kong, Quint) but NOT for singles or pairs.
//
// This module checks if a player's tiles match any defined hand pattern.

import { Tile, Player, HandPattern, Suit, ExposedSet } from './types';
import { ALL_HANDS } from './hands';
import { isJoker } from './tiles';

/** All tiles a player has (hand + exposed sets) */
function getAllPlayerTiles(player: Player): Tile[] {
  const exposedTiles = player.exposedSets.flatMap(s => s.tiles);
  return [...player.hand, ...exposedTiles];
}

/**
 * Check if a player's tiles match a hand pattern.
 * Returns the matched pattern or null.
 */
export function checkWin(player: Player): HandPattern | null {
  const allTiles = getAllPlayerTiles(player);

  // Must have exactly 14 tiles
  if (allTiles.length !== 14) return null;

  // If player has exposed sets, they can't win with a concealed hand
  const hasExposed = player.exposedSets.length > 0;

  for (const pattern of ALL_HANDS) {
    if (pattern.concealed && hasExposed) continue;
    if (matchesPattern(allTiles, pattern)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Check if tiles match a specific pattern.
 * Uses a constraint-satisfaction approach with backtracking.
 */
function matchesPattern(tiles: Tile[], pattern: HandPattern): boolean {
  // Calculate total tiles needed by the pattern
  const totalNeeded = pattern.groups.reduce((sum, g) => sum + g.count, 0);
  if (totalNeeded !== 14) return false;

  // Try all possible suit assignments for constraint labels
  const suits: Suit[] = ['bam', 'crak', 'dot'];
  const permutations = generateSuitPermutations(suits);

  for (const perm of permutations) {
    const suitMap: Record<string, Suit> = {
      a: perm[0]!,
      b: perm[1]!,
      c: perm[2]!,
    };
    if (tryMatch(tiles, pattern, suitMap)) return true;
  }

  return false;
}

/** Generate all permutations of 3 suits */
function generateSuitPermutations(suits: Suit[]): Suit[][] {
  const result: Suit[][] = [];
  for (let i = 0; i < suits.length; i++) {
    for (let j = 0; j < suits.length; j++) {
      if (j === i) continue;
      for (let k = 0; k < suits.length; k++) {
        if (k === i || k === j) continue;
        result.push([suits[i]!, suits[j]!, suits[k]!]);
      }
    }
  }
  return result;
}

/**
 * Try to match tiles to a pattern with a specific suit assignment.
 * Uses greedy matching with joker allocation.
 */
function tryMatch(tiles: Tile[], pattern: HandPattern, suitMap: Record<string, Suit>): boolean {
  // Create a pool of available tiles (by id)
  const available = new Set(tiles.map(t => t.id));
  const jokerIds = tiles.filter(t => isJoker(t)).map(t => t.id);
  let jokersAvailable = jokerIds.length;

  // For each joker, mark it as available but track separately
  for (const jid of jokerIds) {
    available.delete(jid);
  }

  // Try to satisfy each group in the pattern
  for (const group of pattern.groups) {
    let needed = group.count;

    if (group.type === 'news') {
      // Need one of each wind: N, E, W, S
      const winds = ['north', 'east', 'west', 'south'] as const;
      for (const wind of winds) {
        let found = false;
        for (const tile of tiles) {
          if (available.has(tile.id) && tile.kind.type === 'wind' && tile.kind.wind === wind) {
            available.delete(tile.id);
            found = true;
            break;
          }
        }
        if (!found) {
          // Can't use joker for NEWS (it's singles)
          return false;
        }
      }
      continue;
    }

    if (group.type === 'flower') {
      // Match flower tiles
      let matched = 0;
      for (const tile of tiles) {
        if (available.has(tile.id) && tile.kind.type === 'flower') {
          available.delete(tile.id);
          matched++;
          if (matched >= needed) break;
        }
      }
      // Flowers can be supplemented with jokers only in groups of 3+
      if (matched < needed) {
        if (needed >= 3) {
          const jokerUse = Math.min(needed - matched, jokersAvailable);
          jokersAvailable -= jokerUse;
          matched += jokerUse;
        }
        if (matched < needed) return false;
      }
      continue;
    }

    if (group.type === 'dragon') {
      // Match dragon tiles
      let matched = 0;
      for (const tile of tiles) {
        if (available.has(tile.id) && tile.kind.type === 'dragon') {
          if (group.dragon === 'any' || tile.kind.dragon === group.dragon) {
            available.delete(tile.id);
            matched++;
            if (matched >= needed) break;
          }
        }
      }
      if (matched < needed) {
        // Jokers can fill in for groups of 3+
        if (needed >= 3) {
          const jokerUse = Math.min(needed - matched, jokersAvailable);
          jokersAvailable -= jokerUse;
          matched += jokerUse;
        }
        if (matched < needed) return false;
      }
      continue;
    }

    if (group.type === 'wind') {
      let matched = 0;
      for (const tile of tiles) {
        if (available.has(tile.id) && tile.kind.type === 'wind') {
          if (group.wind === 'any' || tile.kind.wind === group.wind) {
            available.delete(tile.id);
            matched++;
            if (matched >= needed) break;
          }
        }
      }
      if (matched < needed) {
        if (needed >= 3) {
          const jokerUse = Math.min(needed - matched, jokersAvailable);
          jokersAvailable -= jokerUse;
          matched += jokerUse;
        }
        if (matched < needed) return false;
      }
      continue;
    }

    if (group.type === 'suited') {
      const suit = group.suitConstraint === 'any'
        ? undefined
        : suitMap[group.suitConstraint!];
      const rank = group.rank!;

      let matched = 0;
      for (const tile of tiles) {
        if (available.has(tile.id) && tile.kind.type === 'suited') {
          if (tile.kind.rank === rank && (suit === undefined || tile.kind.suit === suit)) {
            available.delete(tile.id);
            matched++;
            if (matched >= needed) break;
          }
        }
      }
      if (matched < needed) {
        if (needed >= 3) {
          const jokerUse = Math.min(needed - matched, jokersAvailable);
          jokersAvailable -= jokerUse;
          matched += jokerUse;
        }
        if (matched < needed) return false;
      }
      continue;
    }
  }

  // All groups satisfied and no tiles left over
  return available.size === 0 && jokersAvailable === 0;
}

/**
 * Calculate the score for a winning hand.
 * In American Mahjong, score = base value.
 * Extra points for: self-drawn win, no jokers, etc.
 */
export function calculateScore(pattern: HandPattern, selfDrawn: boolean, jokerCount: number): number {
  let score = pattern.value;
  if (selfDrawn) score += 2;
  if (jokerCount === 0) score += 10; // jokerless bonus
  return score;
}

/**
 * Get how "close" a player is to each possible winning hand.
 * Returns patterns sorted by distance (fewest tiles needed).
 * Used by AI for hand evaluation.
 */
export function evaluateHandDistance(player: Player): { pattern: HandPattern; distance: number }[] {
  const allTiles = getAllPlayerTiles(player);
  const results: { pattern: HandPattern; distance: number }[] = [];
  const hasExposed = player.exposedSets.length > 0;

  for (const pattern of ALL_HANDS) {
    if (pattern.concealed && hasExposed) continue;
    const distance = calculateDistance(allTiles, pattern);
    results.push({ pattern, distance });
  }

  return results.sort((a, b) => a.distance - b.distance);
}

/**
 * Calculate the minimum number of tile changes needed to complete a pattern.
 * Lower = closer to winning.
 */
function calculateDistance(tiles: Tile[], pattern: HandPattern): number {
  const suits: Suit[] = ['bam', 'crak', 'dot'];
  const permutations = generateSuitPermutations(suits);
  let minDistance = Infinity;

  for (const perm of permutations) {
    const suitMap: Record<string, Suit> = {
      a: perm[0]!,
      b: perm[1]!,
      c: perm[2]!,
    };
    const dist = calculateDistanceForMapping(tiles, pattern, suitMap);
    minDistance = Math.min(minDistance, dist);
  }

  return minDistance;
}

function calculateDistanceForMapping(
  tiles: Tile[],
  pattern: HandPattern,
  suitMap: Record<string, Suit>
): number {
  let totalMissing = 0;
  const used = new Set<number>();
  const jokerIds = tiles.filter(t => isJoker(t)).map(t => t.id);
  let jokersAvailable = jokerIds.length;
  for (const jid of jokerIds) used.add(jid);

  for (const group of pattern.groups) {
    let needed = group.count;

    if (group.type === 'news') {
      const winds = ['north', 'east', 'west', 'south'] as const;
      for (const wind of winds) {
        let found = false;
        for (const tile of tiles) {
          if (!used.has(tile.id) && tile.kind.type === 'wind' && tile.kind.wind === wind) {
            used.add(tile.id);
            found = true;
            break;
          }
        }
        if (!found) totalMissing++;
      }
      continue;
    }

    let matched = 0;

    if (group.type === 'flower') {
      for (const tile of tiles) {
        if (!used.has(tile.id) && tile.kind.type === 'flower') {
          used.add(tile.id);
          matched++;
          if (matched >= needed) break;
        }
      }
    } else if (group.type === 'dragon') {
      for (const tile of tiles) {
        if (!used.has(tile.id) && tile.kind.type === 'dragon') {
          if (group.dragon === 'any' || tile.kind.dragon === group.dragon) {
            used.add(tile.id);
            matched++;
            if (matched >= needed) break;
          }
        }
      }
    } else if (group.type === 'wind') {
      for (const tile of tiles) {
        if (!used.has(tile.id) && tile.kind.type === 'wind') {
          if (group.wind === 'any' || tile.kind.wind === group.wind) {
            used.add(tile.id);
            matched++;
            if (matched >= needed) break;
          }
        }
      }
    } else if (group.type === 'suited') {
      const suit = group.suitConstraint === 'any'
        ? undefined
        : suitMap[group.suitConstraint!];
      for (const tile of tiles) {
        if (!used.has(tile.id) && tile.kind.type === 'suited') {
          if (tile.kind.rank === group.rank && (suit === undefined || tile.kind.suit === suit)) {
            used.add(tile.id);
            matched++;
            if (matched >= needed) break;
          }
        }
      }
    }

    if (matched < needed) {
      const deficit = needed - matched;
      if (needed >= 3 && jokersAvailable > 0) {
        const jokerUse = Math.min(deficit, jokersAvailable);
        jokersAvailable -= jokerUse;
        totalMissing += deficit - jokerUse;
      } else {
        totalMissing += deficit;
      }
    }
  }

  return totalMissing;
}
