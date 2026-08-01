// ============================================================
// Pattern display helpers - example tiles + readable group labels
// ============================================================
//
// Turns a HandPattern into something a human can scan: concrete example
// tiles (for category previews) and short suit-colored group chips.

import type { Dragon, HandPattern, PatternGroup, Suit, Tile, TileKind, Wind } from './types';
import { SUIT_MATCHING_DRAGON } from './tile-faces';

const SUIT_FOR_LETTER: Record<string, Suit> = {
  a: 'crak',
  b: 'bam',
  c: 'dot',
  any: 'crak',
};

/** CSS modifier for suit-colored chips in the hand card. */
export type SuitTone = 'crak' | 'bam' | 'dot' | 'dragon' | 'wind' | 'flower' | 'neutral';

export interface DisplayGroup {
  /** Card-style label, e.g. "222", "DDD", "NEWS", "FFF". */
  label: string;
  tone: SuitTone;
}

function suitForConstraint(c: PatternGroup['suitConstraint']): Suit {
  return SUIT_FOR_LETTER[c ?? 'a'] ?? 'crak';
}

function nearestSuitedSuit(groups: PatternGroup[], index: number): Suit {
  for (let d = 1; d < groups.length; d++) {
    const left = groups[index - d];
    if (left?.type === 'suited') return suitForConstraint(left.suitConstraint);
    const right = groups[index + d];
    if (right?.type === 'suited') return suitForConstraint(right.suitConstraint);
  }
  return 'crak';
}

function resolveDragon(group: PatternGroup, groups: PatternGroup[], index: number): Dragon {
  const spec = group.dragon;
  if (spec === 'red' || spec === 'green' || spec === 'white') return spec;
  const suit = group.suitConstraint
    ? suitForConstraint(group.suitConstraint)
    : nearestSuitedSuit(groups, index);
  const matching = SUIT_MATCHING_DRAGON[suit];
  if (spec === 'opposite') {
    return matching === 'red' ? 'green' : matching === 'green' ? 'white' : 'red';
  }
  // 'any' / undefined → Matching Dragon for display
  return matching;
}

function windCycle(i: number): Wind {
  return (['east', 'south', 'west', 'north'] as const)[i % 4]!;
}

function toneForGroup(group: PatternGroup, groups: PatternGroup[], index: number): SuitTone {
  switch (group.type) {
    case 'suited':
      return suitForConstraint(group.suitConstraint);
    case 'dragon': {
      const d = resolveDragon(group, groups, index);
      if (d === 'red') return 'crak';
      if (d === 'green') return 'bam';
      return 'dot';
    }
    case 'wind':
    case 'news':
      return 'wind';
    case 'flower':
      return 'flower';
    default:
      return 'neutral';
  }
}

/** Split "PATTERN (notes)" descriptions into code + notes. */
export function splitHandDescription(description: string): { pattern: string; notes: string } {
  const open = description.indexOf(' (');
  if (open === -1 || !description.endsWith(')')) {
    return { pattern: description, notes: '' };
  }
  return {
    pattern: description.slice(0, open).trim(),
    notes: description.slice(open + 2, -1).trim(),
  };
}

/** Card-style group chips for one hand (suit-colored). */
export function displayGroupsForPattern(pattern: HandPattern): DisplayGroup[] {
  return pattern.groups.map((group, index) => {
    const tone = toneForGroup(group, pattern.groups, index);
    let label: string;
    switch (group.type) {
      case 'suited':
        label = String(group.rank ?? 1).repeat(group.count);
        break;
      case 'dragon': {
        const d = resolveDragon(group, pattern.groups, index);
        const ch = d === 'white' ? '0' : 'D';
        label = ch.repeat(group.count);
        break;
      }
      case 'wind': {
        const w =
          group.wind && group.wind !== 'any'
            ? { east: 'E', south: 'S', west: 'W', north: 'N' }[group.wind]
            : 'E';
        label = w.repeat(group.count);
        break;
      }
      case 'news':
        label = 'NEWS';
        break;
      case 'flower':
        label = 'F'.repeat(group.count);
        break;
      case 'joker':
        label = 'J'.repeat(group.count);
        break;
      default:
        label = '?'.repeat(group.count);
    }
    return { label, tone };
  });
}

/** Concrete example tiles for a pattern (used as the category preview). */
export function exampleTilesForPattern(pattern: HandPattern): Tile[] {
  let nextId = 1;
  const tiles: Tile[] = [];

  const push = (kind: TileKind, label: string) => {
    tiles.push({ id: nextId++, kind, label });
  };

  pattern.groups.forEach((group, index) => {
    switch (group.type) {
      case 'suited': {
        const suit = suitForConstraint(group.suitConstraint);
        const rank = group.rank ?? 1;
        for (let i = 0; i < group.count; i++) {
          push({ type: 'suited', suit, rank }, `${rank} ${suit}`);
        }
        break;
      }
      case 'dragon': {
        const dragon = resolveDragon(group, pattern.groups, index);
        for (let i = 0; i < group.count; i++) {
          push({ type: 'dragon', dragon }, `${dragon} dragon`);
        }
        break;
      }
      case 'wind': {
        const wind =
          group.wind && group.wind !== 'any' ? group.wind : windCycle(0);
        for (let i = 0; i < group.count; i++) {
          push({ type: 'wind', wind }, wind);
        }
        break;
      }
      case 'news': {
        (['north', 'east', 'west', 'south'] as const).forEach(wind => {
          push({ type: 'wind', wind }, wind);
        });
        break;
      }
      case 'flower':
        for (let i = 0; i < group.count; i++) push({ type: 'flower' }, 'flower');
        break;
      case 'joker':
        for (let i = 0; i < group.count; i++) push({ type: 'joker' }, 'joker');
        break;
    }
  });

  return tiles;
}
