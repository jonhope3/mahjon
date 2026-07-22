// ============================================================
// Scoring & Win Detection
// ============================================================
//
// In American Mahjong, a win is matching your 14 tiles (hand + exposed)
// to exactly one pattern on the card. Jokers act as wildcards for
// groups of 3+ (Pung, Kong, Quint) but NOT for singles or pairs.
//
// Exposed sets must map to whole card groups (no splitting a pung
// across unrelated pattern slots). Dragon "D" groups must be one
// color; when next to a suited group they follow suit color
// (red↔crak, green↔bam, white↔dot).

import { Tile, Player, HandPattern, Suit, Dragon, PatternGroup, ExposedSet } from './types';
import { ALL_HANDS } from './hands';
import { isJoker } from './tiles';

const SUIT_TO_DRAGON: Record<Suit, Dragon> = {
  crak: 'red',
  bam: 'green',
  dot: 'white',
};

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
  if (allTiles.length !== 14) return null;

  const hasExposed = player.exposedSets.length > 0;

  for (const pattern of ALL_HANDS) {
    if (pattern.concealed && hasExposed) continue;
    if (matchesPlayerToPattern(player, pattern)) {
      return pattern;
    }
  }
  return null;
}

function matchesPlayerToPattern(player: Player, pattern: HandPattern): boolean {
  const totalNeeded = pattern.groups.reduce((sum, g) => sum + g.count, 0);
  if (totalNeeded !== 14) return false;

  const maxShift = pattern.runShiftMax ?? 0;
  for (let shift = 0; shift <= maxShift; shift++) {
    const shifted = shift === 0 ? pattern : shiftPatternRanks(pattern, shift);
    if (!shifted) continue;

    const suits: Suit[] = ['bam', 'crak', 'dot'];
    for (const perm of generateSuitPermutations(suits)) {
      const suitMap: Record<string, Suit> = {
        a: perm[0]!,
        b: perm[1]!,
        c: perm[2]!,
      };
      if (tryMatchPlayer(player, shifted, suitMap)) return true;
    }
  }
  return false;
}

/** Add `shift` to every suited rank; return null if any rank leaves 1–9. */
function shiftPatternRanks(pattern: HandPattern, shift: number): HandPattern | null {
  if (shift === 0) return pattern;
  const groups: PatternGroup[] = [];
  for (const g of pattern.groups) {
    if (g.type === 'suited' && g.rank != null) {
      const rank = g.rank + shift;
      if (rank < 1 || rank > 9) return null;
      groups.push({ ...g, rank });
    } else {
      groups.push(g);
    }
  }
  return { ...pattern, groups };
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
 * Matching suit color for a dragon group (red↔crak, green↔bam, white↔dot).
 */
function matchingDragonForGroup(
  pattern: HandPattern,
  groupIndex: number,
  suitMap: Record<string, Suit>,
): Dragon | null {
  const group = pattern.groups[groupIndex]!;
  if (group.suitConstraint && group.suitConstraint !== 'any') {
    return SUIT_TO_DRAGON[suitMap[group.suitConstraint]!];
  }
  for (let i = groupIndex - 1; i >= 0; i--) {
    const g = pattern.groups[i]!;
    if (g.type === 'suited' && g.suitConstraint && g.suitConstraint !== 'any') {
      return SUIT_TO_DRAGON[suitMap[g.suitConstraint]!];
    }
  }
  for (let i = groupIndex + 1; i < pattern.groups.length; i++) {
    const g = pattern.groups[i]!;
    if (g.type === 'suited' && g.suitConstraint && g.suitConstraint !== 'any') {
      return SUIT_TO_DRAGON[suitMap[g.suitConstraint]!];
    }
  }
  return null;
}

/**
 * Prefer an explicit dragon color; otherwise inherit matching suit color.
 * `opposite` means any dragon except the matching suit color.
 */
function resolveDragonColor(
  pattern: HandPattern,
  groupIndex: number,
  suitMap: Record<string, Suit>,
): Dragon | 'any' | 'opposite' {
  const group = pattern.groups[groupIndex]!;
  if (group.dragon === 'red' || group.dragon === 'green' || group.dragon === 'white') {
    return group.dragon;
  }
  if (group.dragon === 'opposite') return 'opposite';
  return matchingDragonForGroup(pattern, groupIndex, suitMap) ?? 'any';
}

function dragonTileOk(
  tileDragon: Dragon,
  want: Dragon | 'any' | 'opposite',
  pattern: HandPattern,
  groupIndex: number,
  suitMap: Record<string, Suit>,
): boolean {
  if (want === 'any') return true;
  if (want === 'opposite') {
    const match = matchingDragonForGroup(pattern, groupIndex, suitMap);
    return match != null && tileDragon !== match;
  }
  return tileDragon === want;
}

function tileFitsGroup(
  tile: Tile,
  group: PatternGroup,
  groupIndex: number,
  pattern: HandPattern,
  suitMap: Record<string, Suit>,
): boolean {
  if (isJoker(tile)) return false;

  switch (group.type) {
    case 'flower':
      return tile.kind.type === 'flower';
    case 'wind':
      return (
        tile.kind.type === 'wind' &&
        (group.wind === 'any' || tile.kind.wind === group.wind)
      );
    case 'dragon': {
      if (tile.kind.type !== 'dragon') return false;
      const want = resolveDragonColor(pattern, groupIndex, suitMap);
      return dragonTileOk(tile.kind.dragon, want, pattern, groupIndex, suitMap);
    }
    case 'suited': {
      if (tile.kind.type !== 'suited') return false;
      if (tile.kind.rank !== group.rank) return false;
      if (!group.suitConstraint || group.suitConstraint === 'any') return true;
      return tile.kind.suit === suitMap[group.suitConstraint];
    }
    case 'news':
      return tile.kind.type === 'wind';
    default:
      return false;
  }
}

/** Can this exposed pung/kong/quint fill this entire pattern group? */
function exposedSetFitsGroup(
  set: ExposedSet,
  group: PatternGroup,
  groupIndex: number,
  pattern: HandPattern,
  suitMap: Record<string, Suit>,
): boolean {
  // Exposures are always 3+ identical (plus jokers); singles/pairs/NEWS stay concealed
  if (group.count < 3) return false;
  if (group.type === 'news') return false;
  if (set.tiles.length !== group.count) return false;

  const naturals = set.tiles.filter(t => !isJoker(t));
  const jokers = set.tiles.length - naturals.length;
  if (naturals.length + jokers < group.count) return false;

  // Every natural must fit; jokers fill the rest (only legal in 3+ groups)
  if (naturals.length === 0) {
    // All-joker exposure: only legal for 3+ wild groups — allow
    return group.count >= 3;
  }

  // Same identity among naturals
  const first = naturals[0]!;
  for (const t of naturals) {
    if (!tileFitsGroup(t, group, groupIndex, pattern, suitMap)) return false;
    if (first.kind.type !== t.kind.type) return false;
    if (first.kind.type === 'suited' && t.kind.type === 'suited') {
      if (first.kind.suit !== t.kind.suit || first.kind.rank !== t.kind.rank) return false;
    }
    if (first.kind.type === 'wind' && t.kind.type === 'wind' && first.kind.wind !== t.kind.wind) {
      return false;
    }
    if (first.kind.type === 'dragon' && t.kind.type === 'dragon' && first.kind.dragon !== t.kind.dragon) {
      return false;
    }
  }

  // If group wants a specific dragon color, naturals already checked via tileFitsGroup
  return true;
}

function tryMatchPlayer(
  player: Player,
  pattern: HandPattern,
  suitMap: Record<string, Suit>,
): boolean {
  const exposed = player.exposedSets;
  const groupIndexes = pattern.groups.map((_, i) => i);

  // Assign each exposed set to a distinct pattern group, then match the hand
  const assign = (setIdx: number, usedGroups: Set<number>): boolean => {
    if (setIdx >= exposed.length) {
      return tryMatchConcealed(player.hand, pattern, suitMap, usedGroups);
    }
    const set = exposed[setIdx]!;
    for (const gi of groupIndexes) {
      if (usedGroups.has(gi)) continue;
      const group = pattern.groups[gi]!;
      if (!exposedSetFitsGroup(set, group, gi, pattern, suitMap)) continue;
      usedGroups.add(gi);
      if (assign(setIdx + 1, usedGroups)) return true;
      usedGroups.delete(gi);
    }
    return false;
  };

  return assign(0, new Set());
}

/**
 * Match concealed tiles to pattern groups not already filled by exposures.
 * Dragon groups must be a single color (and suit-linked when applicable).
 */
function tryMatchConcealed(
  hand: Tile[],
  pattern: HandPattern,
  suitMap: Record<string, Suit>,
  usedGroups: Set<number>,
): boolean {
  const available = new Set(hand.map(t => t.id));
  const jokerIds = hand.filter(t => isJoker(t)).map(t => t.id);
  let jokersAvailable = jokerIds.length;
  for (const jid of jokerIds) available.delete(jid);

  for (let gi = 0; gi < pattern.groups.length; gi++) {
    if (usedGroups.has(gi)) continue;
    const group = pattern.groups[gi]!;

    if (group.type === 'news') {
      const winds = ['north', 'east', 'west', 'south'] as const;
      for (const wind of winds) {
        let found = false;
        for (const tile of hand) {
          if (available.has(tile.id) && tile.kind.type === 'wind' && tile.kind.wind === wind) {
            available.delete(tile.id);
            found = true;
            break;
          }
        }
        if (!found) return false;
      }
      continue;
    }

    const needed = group.count;
    let matched = 0;
    let lockedDragon: Dragon | null = null;
    const wantDragon =
      group.type === 'dragon' ? resolveDragonColor(pattern, gi, suitMap) : null;

    for (const tile of hand) {
      if (!available.has(tile.id)) continue;
      if (!tileFitsGroup(tile, group, gi, pattern, suitMap)) continue;

      if (group.type === 'dragon' && tile.kind.type === 'dragon') {
        if (
          wantDragon !== null &&
          !dragonTileOk(tile.kind.dragon, wantDragon, pattern, gi, suitMap)
        ) {
          continue;
        }
        if (lockedDragon && tile.kind.dragon !== lockedDragon) continue;
        lockedDragon = tile.kind.dragon;
      }

      available.delete(tile.id);
      matched++;
      if (matched >= needed) break;
    }

    if (matched < needed) {
      if (needed >= 3) {
        const jokerUse = Math.min(needed - matched, jokersAvailable);
        jokersAvailable -= jokerUse;
        matched += jokerUse;
      }
      if (matched < needed) return false;
    }
  }

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
 * How close a player is to each card hand (for AI + gentle coaching).
 * Distance 0 means the matcher thinks the hand is complete — callers
 * that coach humans should not spoil that as "you can win."
 */
export function evaluateHandDistance(player: Player): { pattern: HandPattern; distance: number }[] {
  const results: { pattern: HandPattern; distance: number }[] = [];
  const hasExposed = player.exposedSets.length > 0;

  for (const pattern of ALL_HANDS) {
    if (pattern.concealed && hasExposed) continue;
    // Prefer exact win check when complete so coaching distance stays honest
    if (matchesPlayerToPattern(player, pattern)) {
      results.push({ pattern, distance: 0 });
      continue;
    }
    const distance = calculateDistance(player, pattern);
    results.push({ pattern, distance });
  }

  return results.sort((a, b) => a.distance - b.distance);
}

function calculateDistance(player: Player, pattern: HandPattern): number {
  const suits: Suit[] = ['bam', 'crak', 'dot'];
  let minDistance = Infinity;
  const maxShift = pattern.runShiftMax ?? 0;

  for (let shift = 0; shift <= maxShift; shift++) {
    const shifted = shift === 0 ? pattern : shiftPatternRanks(pattern, shift);
    if (!shifted) continue;
    for (const perm of generateSuitPermutations(suits)) {
      const suitMap: Record<string, Suit> = {
        a: perm[0]!,
        b: perm[1]!,
        c: perm[2]!,
      };
      const dist = calculateDistanceForMapping(player, shifted, suitMap);
      minDistance = Math.min(minDistance, dist);
    }
  }

  return minDistance;
}

/**
 * Approximate tiles still needed. Exposed sets that don't fit any group
 * add a large penalty so coaching won't push illegal exposures.
 */
function calculateDistanceForMapping(
  player: Player,
  pattern: HandPattern,
  suitMap: Record<string, Suit>,
): number {
  const usedGroups = new Set<number>();
  let penalty = 0;

  // Greedily bind exposures to fitting groups (same rules as win check)
  for (const set of player.exposedSets) {
    let bound = false;
    for (let gi = 0; gi < pattern.groups.length; gi++) {
      if (usedGroups.has(gi)) continue;
      if (exposedSetFitsGroup(set, pattern.groups[gi]!, gi, pattern, suitMap)) {
        usedGroups.add(gi);
        bound = true;
        break;
      }
    }
    if (!bound) penalty += set.tiles.length; // exposure doesn't belong on this card line
  }

  const tiles = player.hand;
  let totalMissing = penalty;
  const used = new Set<number>();
  const jokerIds = tiles.filter(t => isJoker(t)).map(t => t.id);
  let jokersAvailable = jokerIds.length;
  for (const jid of jokerIds) used.add(jid);

  for (let gi = 0; gi < pattern.groups.length; gi++) {
    if (usedGroups.has(gi)) continue;
    const group = pattern.groups[gi]!;
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
    let lockedDragon: Dragon | null = null;
    const wantDragon =
      group.type === 'dragon' ? resolveDragonColor(pattern, gi, suitMap) : null;

    for (const tile of tiles) {
      if (used.has(tile.id)) continue;
      if (!tileFitsGroup(tile, group, gi, pattern, suitMap)) continue;
      if (group.type === 'dragon' && tile.kind.type === 'dragon') {
        if (
          wantDragon !== null &&
          !dragonTileOk(tile.kind.dragon, wantDragon, pattern, gi, suitMap)
        ) {
          continue;
        }
        if (lockedDragon && tile.kind.dragon !== lockedDragon) continue;
        lockedDragon = tile.kind.dragon;
      }
      used.add(tile.id);
      matched++;
      if (matched >= needed) break;
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
