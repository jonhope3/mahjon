// ============================================================
// Tile Creation, Shuffling, and Wall Building
// American Mahjong: 152 tiles
// ============================================================

import { Tile, TileKind, Suit, Wind, Dragon, Wall } from './types';

const SUITS: Suit[] = ['bam', 'crak', 'dot'];
const WINDS: Wind[] = ['east', 'south', 'west', 'north'];
const DRAGONS: Dragon[] = ['red', 'green', 'white'];

/** Create the label for a tile kind */
export function tileLabel(kind: TileKind): string {
  switch (kind.type) {
    case 'suited':
      return `${kind.rank}${kind.suit[0]!.toUpperCase()}`;
    case 'wind':
      return kind.wind[0]!.toUpperCase();
    case 'dragon':
      return kind.dragon === 'red' ? 'Dr' : kind.dragon === 'green' ? 'Dg' : 'Dw';
    case 'flower':
      return 'F';
    case 'joker':
      return 'J';
  }
}

const SHELL_CREATURES: Record<number, string> = {
  1: 'Conch',
  2: 'Oyster',
  3: 'Coral',
  4: 'Crab',
  5: 'Pufferfish',
  6: 'Octopus',
  7: 'Dolphin',
  8: 'Whale',
  9: 'Shark',
};

const SEA_SUIT = { bam: 'Kelp', crak: 'Shell', dot: 'Pearl' } as const;
const TRAD_SUIT = { bam: 'Bam', crak: 'Crak', dot: 'Dot' } as const;

/**
 * Full identity string for hover / long-press tooltips.
 * Includes sea theme + traditional mahjong name so learners can map both.
 */
export function tileTooltip(kind: TileKind): string {
  switch (kind.type) {
    case 'suited': {
      const sea = SEA_SUIT[kind.suit];
      const trad = TRAD_SUIT[kind.suit];
      if (kind.suit === 'crak') {
        const creature = SHELL_CREATURES[kind.rank] ?? 'Shell';
        return `${kind.rank} ${sea} — ${creature} (traditionally ${trad})`;
      }
      if (kind.suit === 'bam') {
        return `${kind.rank} ${sea} — seaweed suit (traditionally ${trad})`;
      }
      return `${kind.rank} ${sea} — pearl bubbles (traditionally ${trad})`;
    }
    case 'wind':
      return `${kind.wind.charAt(0).toUpperCase() + kind.wind.slice(1)} Wind`;
    case 'dragon': {
      const names = {
        red: 'Coral Dragon (Red Dragon)',
        green: 'Wave Dragon (Green Dragon)',
        white: 'Pearl Dragon (White Dragon / Soap)',
      };
      return names[kind.dragon];
    }
    case 'flower':
      return 'Sea Anemone — Flower tile (F on the card)';
    case 'joker':
      return 'Joker — wild in groups of 3+, never in pairs or singles';
  }
}

/** Create the full 152-tile set for American Mahjong */
export function createTileSet(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;

  // Suited tiles: 3 suits × 9 ranks × 4 copies = 108
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let copy = 0; copy < 4; copy++) {
        const kind: TileKind = { type: 'suited', suit, rank };
        tiles.push({ id: id++, kind, label: tileLabel(kind) });
      }
    }
  }

  // Wind tiles: 4 winds × 4 copies = 16
  for (const wind of WINDS) {
    for (let copy = 0; copy < 4; copy++) {
      const kind: TileKind = { type: 'wind', wind };
      tiles.push({ id: id++, kind, label: tileLabel(kind) });
    }
  }

  // Dragon tiles: 3 dragons × 4 copies = 12
  for (const dragon of DRAGONS) {
    for (let copy = 0; copy < 4; copy++) {
      const kind: TileKind = { type: 'dragon', dragon };
      tiles.push({ id: id++, kind, label: tileLabel(kind) });
    }
  }

  // Flower tiles: 8
  for (let copy = 0; copy < 8; copy++) {
    const kind: TileKind = { type: 'flower' };
    tiles.push({ id: id++, kind, label: tileLabel(kind) });
  }

  // Joker tiles: 8
  for (let copy = 0; copy < 8; copy++) {
    const kind: TileKind = { type: 'joker' };
    tiles.push({ id: id++, kind, label: tileLabel(kind) });
  }

  return tiles;
}

/** Fisher-Yates shuffle */
export function shuffleTiles(tiles: Tile[]): Tile[] {
  const shuffled = [...tiles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

/** Build the wall from a shuffled tile set */
export function buildWall(tiles: Tile[]): Wall {
  return {
    tiles: [...tiles],
    deadWallTiles: [],
  };
}

/** Draw a tile from the wall. Returns [drawnTile, updatedWall] or null if empty. */
export function drawFromWall(wall: Wall): [Tile, Wall] | null {
  if (wall.tiles.length === 0) return null;
  const drawn = wall.tiles[0]!;
  const remaining = wall.tiles.slice(1);
  return [drawn, { ...wall, tiles: remaining }];
}

/** Check if two tiles have the same kind (match for sets) */
export function tilesMatch(a: TileKind, b: TileKind): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'suited':
      return a.suit === (b as typeof a).suit && a.rank === (b as typeof a).rank;
    case 'wind':
      return a.wind === (b as typeof a).wind;
    case 'dragon':
      return a.dragon === (b as typeof a).dragon;
    case 'flower':
      return true;
    case 'joker':
      return true;
  }
}

/** Check if a tile is a joker */
export function isJoker(tile: Tile): boolean {
  return tile.kind.type === 'joker';
}

/** Check if a tile is a flower */
export function isFlower(tile: Tile): boolean {
  return tile.kind.type === 'flower';
}

/** Sort tiles for display: flowers, jokers, then by suit/rank, winds, dragons */
export function sortTiles(tiles: Tile[]): Tile[] {
  const order: Record<string, number> = {
    suited: 0,
    wind: 1,
    dragon: 2,
    flower: 3,
    joker: 4,
  };
  const suitOrder: Record<Suit, number> = { crak: 0, bam: 1, dot: 2 };
  const windOrder: Record<Wind, number> = { east: 0, south: 1, west: 2, north: 3 };
  const dragonOrder: Record<Dragon, number> = { red: 0, green: 1, white: 2 };

  return [...tiles].sort((a, b) => {
    const aOrd = order[a.kind.type] ?? 99;
    const bOrd = order[b.kind.type] ?? 99;
    if (aOrd !== bOrd) return aOrd - bOrd;

    if (a.kind.type === 'suited' && b.kind.type === 'suited') {
      const suitDiff = suitOrder[a.kind.suit] - suitOrder[b.kind.suit];
      if (suitDiff !== 0) return suitDiff;
      return a.kind.rank - b.kind.rank;
    }
    if (a.kind.type === 'wind' && b.kind.type === 'wind') {
      return windOrder[a.kind.wind] - windOrder[b.kind.wind];
    }
    if (a.kind.type === 'dragon' && b.kind.type === 'dragon') {
      return dragonOrder[a.kind.dragon] - dragonOrder[b.kind.dragon];
    }
    return 0;
  });
}

/** Count how many tiles remain in the wall */
export function wallRemaining(wall: Wall): number {
  return wall.tiles.length;
}
