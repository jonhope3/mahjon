// ============================================================
// Tile face icons — one clear look per category (+ rank number)
// ============================================================

import type { Dragon, Suit, Wind } from './types';

/**
 * Suited tiles share one icon per suit; the rank digit is the identity.
 * Labels use NMJL card names (Crak / Bam / Dot); icons stay ocean-themed.
 */
export const SUIT_FACES: Record<Suit, { icon: string; name: string; cls: string }> = {
  crak: { icon: '🐚', name: 'Crak', cls: 'crak' },
  bam: { icon: '🌿', name: 'Bam', cls: 'bam' },
  dot: { icon: '🫧', name: 'Dot', cls: 'dot' },
};

/** Winds — four directions, four icons */
export const WIND_FACES: Record<Wind, { icon: string; label: string }> = {
  east: { icon: '🌅', label: 'EAST' },
  south: { icon: '☀️', label: 'SOUTH' },
  west: { icon: '🌇', label: 'WEST' },
  north: { icon: '❄️', label: 'NORTH' },
};

/** Dragons — three kinds (icons ocean-themed; labels match the card) */
export const DRAGON_FACES: Record<Dragon, { icon: string; label: string; cls: string }> = {
  red: { icon: '🪸', label: 'Red', cls: 'dragon-red' },
  green: { icon: '🌊', label: 'Green', cls: 'dragon-green' },
  white: { icon: '🦪', label: 'Soap', cls: 'dragon-white' },
};

/**
 * American Mahjong “like colors”: dragon ↔ matching suit for many card hands.
 *   Red  ↔ Crak
 *   Green ↔ Bam
 *   Soap / White ↔ Dot
 */
export const DRAGON_MATCHING_SUIT: Record<Dragon, Suit> = {
  red: 'crak',
  green: 'bam',
  white: 'dot',
};

export const SUIT_MATCHING_DRAGON: Record<Suit, Dragon> = {
  crak: 'red',
  bam: 'green',
  dot: 'white',
};

/** Suit icon shown in the corner of a dragon tile */
export function dragonPairIcon(dragon: Dragon): string {
  return SUIT_FACES[DRAGON_MATCHING_SUIT[dragon]].icon;
}

/** Dragon icon shown in the corner of a suited tile */
export function suitPairIcon(suit: Suit): string {
  return DRAGON_FACES[SUIT_MATCHING_DRAGON[suit]].icon;
}

/** Flower — card letter F (icon stays ocean anemone) */
export const FLOWER_FACE = { icon: '🌺', label: 'Flower' } as const;

/** Joker — all eight copies look the same */
export const JOKER_FACE = { icon: '🪼', label: 'Joker' } as const;

export function suitFace(suit: Suit): { icon: string; name: string; cls: string } {
  return SUIT_FACES[suit];
}

/** Category icons only (suited share one each) — must stay unique across types */
export function allCategoryIcons(): string[] {
  return [
    ...Object.values(SUIT_FACES).map(f => f.icon),
    ...Object.values(WIND_FACES).map(f => f.icon),
    ...Object.values(DRAGON_FACES).map(f => f.icon),
    FLOWER_FACE.icon,
    JOKER_FACE.icon,
  ];
}

export function assertUniqueCategoryIcons(): void {
  const icons = allCategoryIcons();
  const seen = new Map<string, number>();
  for (const icon of icons) {
    seen.set(icon, (seen.get(icon) ?? 0) + 1);
  }
  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([icon]) => icon);
  if (dupes.length > 0) {
    throw new Error(`Duplicate category tile icons: ${dupes.join(' ')}`);
  }
  // 3 suits + 4 winds + 3 dragons + flower + joker = 12 category looks
  if (icons.length !== 12) {
    throw new Error(`Expected 12 category icons, got ${icons.length}`);
  }
}

assertUniqueCategoryIcons();
