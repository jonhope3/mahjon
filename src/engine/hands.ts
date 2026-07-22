// ============================================================
// 2026 Hand Patterns
// Source: docs/2026-hand-card.md
// ============================================================
//
// Notation guide:
//   suitConstraint 'a','b','c' = must be different suits
//   Same letter = same suit. Different letters = different suits.
//   'any' = any suit
//   Numbers = rank for suited tiles
//   For "year" hands, 0 is the White Dragon (Pearl Dragon / Soap) → d(n, 'white')
//   Dragon 'any' inherits color from the nearest suited group (Matching Dragons):
//     red↔crak, green↔bam, white↔dot
//   Dragon 'opposite' = NOT the matching color for the neighboring suit
//
// concealed = true means hand marked with "C" on the card
// value = the multiplier shown (e.g., X25 = 25, C30 = 30 concealed)
//
// runShiftMax: for "any N consecutive" / "any like number" lines, the engine
//   tries adding 0..runShiftMax to every suited rank (skipping shifts that push
//   a rank outside 1–9). Example: FFF 1111 234 5555 uses ranks 1..5, so
//   runShiftMax = 4 (top rank 5 → 9). All-same-rank "like number" lines use 8.
//
// Every pattern's groups sum to exactly 14 tiles (validated below).

import { HandPattern, HandCategory } from './types';

/** Helper to build a suited group */
function s(rank: number, count: number, suit: 'a' | 'b' | 'c' | 'any' = 'a') {
  return { type: 'suited' as const, rank, count, suitConstraint: suit };
}

/** Flower group */
function f(count: number) {
  return { type: 'flower' as const, count };
}

/**
 * Dragon group.
 *   'any'      → Matching Dragon (inherits suit-color from neighboring number groups)
 *   'opposite' → not the matching color for the neighboring suit
 *   'white'    → White Dragon / year "0"
 */
function d(
  count: number,
  dragon: 'any' | 'opposite' | 'red' | 'green' | 'white' = 'any',
  suit?: 'a' | 'b' | 'c' | 'any',
) {
  return {
    type: 'dragon' as const,
    count,
    dragon,
    ...(suit ? { suitConstraint: suit } : {}),
  };
}

/** Wind group */
function w(count: number, wind: 'any' | 'north' | 'east' | 'south' | 'west' = 'any') {
  return { type: 'wind' as const, count, wind };
}

/** NEWS = one of each wind */
function news() {
  return { type: 'news' as const, count: 4 };
}

// ============================================================
// Category: 2026
// ============================================================
const cat2026: HandPattern[] = [
  {
    id: '2026-1',
    category: '2026',
    description: '222 000 2222 6666 (Any 2 Suits; 0 = White Dragon)',
    groups: [s(2, 3, 'a'), d(3, 'white'), s(2, 4, 'b'), s(6, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: '2026-2-k2',
    category: '2026',
    description: '2026 DDD 2222 DDD (Any 2 Suits, Matching Dragons; Kong is 2)',
    groups: [s(2, 1, 'a'), d(1, 'white'), s(2, 1, 'a'), s(6, 1, 'a'), d(3, 'any'), s(2, 4, 'b'), d(3, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '2026-2-k6',
    category: '2026',
    description: '2026 DDD 6666 DDD (Any 2 Suits, Matching Dragons; Kong is 6)',
    groups: [s(2, 1, 'a'), d(1, 'white'), s(2, 1, 'a'), s(6, 1, 'a'), d(3, 'any'), s(6, 4, 'b'), d(3, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '2026-3',
    category: '2026',
    description: 'FFF 2026 222 6666 (Any 3 Suits)',
    groups: [f(3), s(2, 1, 'a'), d(1, 'white'), s(2, 1, 'a'), s(6, 1, 'a'), s(2, 3, 'b'), s(6, 4, 'c')],
    value: 25, concealed: false,
  },
  {
    id: '2026-4',
    category: '2026',
    description: '22 00 222 666 NEWS (Any 2 Suits)',
    groups: [s(2, 2, 'a'), d(2, 'white'), s(2, 3, 'b'), s(6, 3, 'b'), news()],
    value: 30, concealed: false,
  },
];

// ============================================================
// Category: 2468
// ============================================================
const cat2468: HandPattern[] = [
  {
    id: '2468-1',
    category: '2468',
    description: '222 444 6666 8888 (Any 1 Suit)',
    groups: [s(2, 3, 'a'), s(4, 3, 'a'), s(6, 4, 'a'), s(8, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: '2468-2',
    category: '2468',
    description: '222 444 6666 8888 (Any 2 Suits)',
    groups: [s(2, 3, 'a'), s(4, 3, 'b'), s(6, 4, 'a'), s(8, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '2468-3',
    category: '2468',
    description: 'FF 2222 44 66 8888 (Any 2 Suits)',
    groups: [f(2), s(2, 4, 'a'), s(4, 2, 'b'), s(6, 2, 'b'), s(8, 4, 'a')],
    value: 30, concealed: false,
  },
  {
    id: '2468-4',
    category: '2468',
    description: 'EE 22 444 666 88 WW (Any 1 Suit; East & West only)',
    groups: [w(2, 'east'), s(2, 2, 'a'), s(4, 3, 'a'), s(6, 3, 'a'), s(8, 2, 'a'), w(2, 'west')],
    value: 30, concealed: false,
  },
  {
    id: '2468-5',
    category: '2468',
    description: '2222 DDD 8888 DDD (Any 2 Suits, Matching Dragons)',
    groups: [s(2, 4, 'a'), d(3, 'any'), s(8, 4, 'b'), d(3, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '2468-6',
    category: '2468',
    description: 'FFF 22 44 666 8888 (Any 1 Suit)',
    groups: [f(3), s(2, 2, 'a'), s(4, 2, 'a'), s(6, 3, 'a'), s(8, 4, 'a')],
    value: 25, concealed: false,
  },
  // 2468-7: like Kongs of 2/4/6/8 with Matching Dragons (Any 3 Suits) — one entry per number
  {
    id: '2468-7-r2',
    category: '2468',
    description: '2468 2222 D 2222 D (Any 3 Suits; like Kongs of 2, Matching Dragons)',
    groups: [s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 1, 'a'), s(2, 4, 'b'), d(1, 'any'), s(2, 4, 'c'), d(1, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '2468-7-r4',
    category: '2468',
    description: '2468 4444 D 4444 D (Any 3 Suits; like Kongs of 4, Matching Dragons)',
    groups: [s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 1, 'a'), s(4, 4, 'b'), d(1, 'any'), s(4, 4, 'c'), d(1, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '2468-7-r6',
    category: '2468',
    description: '2468 6666 D 6666 D (Any 3 Suits; like Kongs of 6, Matching Dragons)',
    groups: [s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 1, 'a'), s(6, 4, 'b'), d(1, 'any'), s(6, 4, 'c'), d(1, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '2468-7-r8',
    category: '2468',
    description: '2468 8888 D 8888 D (Any 3 Suits; like Kongs of 8, Matching Dragons)',
    groups: [s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 1, 'a'), s(8, 4, 'b'), d(1, 'any'), s(8, 4, 'c'), d(1, 'any')],
    value: 25, concealed: false,
  },
  // 2468-8: FFF 2468 FFF 2222 — Kong is 2, 4, 6, or 8 (Any 2 Suits)
  {
    id: '2468-8-r2',
    category: '2468',
    description: 'FFF 2468 FFF 2222 (Any 2 Suits; Kong is 2)',
    groups: [f(3), s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 1, 'a'), f(3), s(2, 4, 'b')],
    value: 30, concealed: false,
  },
  {
    id: '2468-8-r4',
    category: '2468',
    description: 'FFF 2468 FFF 4444 (Any 2 Suits; Kong is 4)',
    groups: [f(3), s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 1, 'a'), f(3), s(4, 4, 'b')],
    value: 30, concealed: false,
  },
  {
    id: '2468-8-r6',
    category: '2468',
    description: 'FFF 2468 FFF 6666 (Any 2 Suits; Kong is 6)',
    groups: [f(3), s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 1, 'a'), f(3), s(6, 4, 'b')],
    value: 30, concealed: false,
  },
  {
    id: '2468-8-r8',
    category: '2468',
    description: 'FFF 2468 FFF 8888 (Any 2 Suits; Kong is 8)',
    groups: [f(3), s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 1, 'a'), f(3), s(8, 4, 'b')],
    value: 30, concealed: false,
  },
  {
    id: '2468-9',
    category: '2468',
    description: 'FF 246 888 246 888 (Any 2 Suits)',
    groups: [f(2), s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 3, 'a'), s(2, 1, 'b'), s(4, 1, 'b'), s(6, 1, 'b'), s(8, 3, 'b')],
    value: 30, concealed: true,
  },
];

// ============================================================
// Category: Any Like Numbers  (all-same-rank → runShiftMax 8)
// ============================================================
const catAnyLike: HandPattern[] = [
  {
    id: 'any-1',
    category: 'Any Like Numbers',
    description: '1111 FFFFFF 1111 (Any 2 Suits; sextet of flowers)',
    groups: [s(1, 4, 'a'), f(6), s(1, 4, 'b')],
    value: 30, concealed: false, runShiftMax: 8,
  },
  {
    id: 'any-2',
    category: 'Any Like Numbers',
    description: '1111 D 111 D 1111 D (Any 3 Suits, Matching Dragons)',
    groups: [s(1, 4, 'a'), d(1, 'any'), s(1, 3, 'b'), d(1, 'any'), s(1, 4, 'c'), d(1, 'any')],
    value: 25, concealed: false, runShiftMax: 8,
  },
  {
    id: 'any-3',
    category: 'Any Like Numbers',
    description: 'FF 1111 11 1111 DD (Any 3 Suits with any Dragon pair)',
    groups: [f(2), s(1, 4, 'a'), s(1, 2, 'b'), s(1, 4, 'c'), d(2, 'any')],
    value: 25, concealed: false, runShiftMax: 8,
  },
];

// ============================================================
// Category: Quints
// ============================================================
const catQuints: HandPattern[] = [
  {
    id: 'quint-1',
    category: 'Quints',
    description: '11111 1111 11111 (Any 3 Suits; any like numbers)',
    groups: [s(1, 5, 'a'), s(1, 4, 'b'), s(1, 5, 'c')],
    value: 40, concealed: false, runShiftMax: 8,
  },
  {
    id: 'quint-2',
    category: 'Quints',
    description: 'FF 11111 22 33333 (Any 1 Suit; any 3 consecutive)',
    groups: [f(2), s(1, 5, 'a'), s(2, 2, 'a'), s(3, 5, 'a')],
    value: 45, concealed: false, runShiftMax: 6,
  },
  // Quint line 3: any two distinct numbers in one suit + opposite dragon
  ...(() => {
    const out: HandPattern[] = [];
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 9; b++) {
        if (a === b) continue;
        out.push({
          id: `quint-3-r${a}-${b}`,
          category: 'Quints',
          description: `${a}×5 ${b}×5 DDDD (Opposite Dragon)`,
          groups: [s(a, 5, 'a'), s(b, 5, 'a'), d(4, 'opposite')],
          value: 40, concealed: false,
        });
      }
    }
    return out;
  })(),
];

// ============================================================
// Category: Consecutive Run
// ============================================================
const catConsecutive: HandPattern[] = [
  {
    id: 'con-1',
    category: 'Consecutive Run',
    description: '11 222 33 444 5555 (Any 1 Suit; these numbers only)',
    groups: [s(1, 2, 'a'), s(2, 3, 'a'), s(3, 2, 'a'), s(4, 3, 'a'), s(5, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: 'con-2',
    category: 'Consecutive Run',
    description: '55 666 77 888 9999 (Any 1 Suit; these numbers only)',
    groups: [s(5, 2, 'a'), s(6, 3, 'a'), s(7, 2, 'a'), s(8, 3, 'a'), s(9, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: 'con-3',
    category: 'Consecutive Run',
    description: 'FFF 1111 234 5555 (Any 1 Suit; any 5 consecutive)',
    groups: [f(3), s(1, 4, 'a'), s(2, 1, 'a'), s(3, 1, 'a'), s(4, 1, 'a'), s(5, 4, 'a')],
    value: 25, concealed: false, runShiftMax: 4,
  },
  {
    id: 'con-4',
    category: 'Consecutive Run',
    description: 'FFF 1111 234 5555 (Any 2 Suits; any 5 consecutive)',
    groups: [f(3), s(1, 4, 'a'), s(2, 1, 'a'), s(3, 1, 'a'), s(4, 1, 'a'), s(5, 4, 'b')],
    value: 25, concealed: false, runShiftMax: 4,
  },
  {
    id: 'con-5',
    category: 'Consecutive Run',
    description: '11 22 111 222 3333 (Any 2 Suits; any 3 consecutive)',
    groups: [s(1, 2, 'a'), s(2, 2, 'a'), s(1, 3, 'b'), s(2, 3, 'b'), s(3, 4, 'b')],
    value: 25, concealed: false, runShiftMax: 6,
  },
  {
    id: 'con-6',
    category: 'Consecutive Run',
    description: '111 222 3333 4444 (Any 1 Suit; any 4 consecutive)',
    groups: [s(1, 3, 'a'), s(2, 3, 'a'), s(3, 4, 'a'), s(4, 4, 'a')],
    value: 25, concealed: false, runShiftMax: 5,
  },
  {
    id: 'con-7',
    category: 'Consecutive Run',
    description: '111 222 3333 4444 (Any 2 Suits; any 4 consecutive)',
    groups: [s(1, 3, 'a'), s(2, 3, 'a'), s(3, 4, 'b'), s(4, 4, 'b')],
    value: 25, concealed: false, runShiftMax: 5,
  },
  {
    id: 'con-8',
    category: 'Consecutive Run',
    description: 'FFF 11 22 333 DDDD (1 Suit; any run of 3; Matching Dragons)',
    groups: [f(3), s(1, 2, 'a'), s(2, 2, 'a'), s(3, 3, 'a'), d(4, 'any')],
    value: 25, concealed: false, runShiftMax: 6,
  },
  {
    id: 'con-9',
    category: 'Consecutive Run',
    description: 'FFF 11 22 333 DDDD (2 Suits; any run of 3; Matching Dragons)',
    groups: [f(3), s(1, 2, 'a'), s(2, 2, 'a'), s(3, 3, 'b'), d(4, 'any')],
    value: 25, concealed: false, runShiftMax: 6,
  },
  {
    id: 'con-10',
    category: 'Consecutive Run',
    description: '1111 FFFFFF 2222 (Any 1 Suit; any 2 consecutive)',
    groups: [s(1, 4, 'a'), f(6), s(2, 4, 'a')],
    value: 30, concealed: false, runShiftMax: 7,
  },
  {
    id: 'con-11',
    category: 'Consecutive Run',
    description: 'FF 1111 2222 3333 (Any 1 Suit; any 3 consecutive)',
    groups: [f(2), s(1, 4, 'a'), s(2, 4, 'a'), s(3, 4, 'a')],
    value: 25, concealed: false, runShiftMax: 6,
  },
  {
    id: 'con-12',
    category: 'Consecutive Run',
    description: 'FF 1111 2222 3333 (Any 3 Suits; any 3 consecutive)',
    groups: [f(2), s(1, 4, 'a'), s(2, 4, 'b'), s(3, 4, 'c')],
    value: 25, concealed: false, runShiftMax: 6,
  },
  {
    id: 'con-13',
    category: 'Consecutive Run',
    description: '1 22 333 1 22 333 44 (Any 3 Suits; any 4 consecutive)',
    groups: [s(1, 1, 'a'), s(2, 2, 'a'), s(3, 3, 'a'), s(1, 1, 'b'), s(2, 2, 'b'), s(3, 3, 'b'), s(4, 2, 'c')],
    value: 35, concealed: true, runShiftMax: 5,
  },
];

// ============================================================
// Category: 13579
// ============================================================
const cat13579: HandPattern[] = [
  {
    id: '13579-1',
    category: '13579',
    description: '11 333 55 777 9999 (Any 1 Suit)',
    groups: [s(1, 2, 'a'), s(3, 3, 'a'), s(5, 2, 'a'), s(7, 3, 'a'), s(9, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: '13579-2',
    category: '13579',
    description: '11 333 55 777 9999 (Any 3 Suits)',
    groups: [s(1, 2, 'a'), s(3, 3, 'b'), s(5, 2, 'c'), s(7, 3, 'a'), s(9, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '13579-3',
    category: '13579',
    description: '111 333 3333 5555 (Any 2 Suits)',
    groups: [s(1, 3, 'a'), s(3, 3, 'a'), s(3, 4, 'b'), s(5, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '13579-4',
    category: '13579',
    description: '555 777 7777 9999 (Any 2 Suits)',
    groups: [s(5, 3, 'a'), s(7, 3, 'a'), s(7, 4, 'b'), s(9, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '13579-5',
    category: '13579',
    description: 'NN 1111 33 5555 SS (Any 1 Suit; North & South only)',
    groups: [w(2, 'north'), s(1, 4, 'a'), s(3, 2, 'a'), s(5, 4, 'a'), w(2, 'south')],
    value: 30, concealed: false,
  },
  {
    id: '13579-6',
    category: '13579',
    description: 'NN 5555 77 9999 SS (Any 1 Suit; North & South only)',
    groups: [w(2, 'north'), s(5, 4, 'a'), s(7, 2, 'a'), s(9, 4, 'a'), w(2, 'south')],
    value: 30, concealed: false,
  },
  // Pair any odd number; other odds singles in suit A; Kongs of that pair in B & C
  ...([1, 3, 5, 7, 9] as const).map(pair => {
    const odds = [1, 3, 5, 7, 9] as const;
    const singles = odds.filter(n => n !== pair);
    return {
      id: `13579-7-r${pair}`,
      category: '13579',
      description: `Odds with pair ${pair} + matching Kongs (Any 3 Suits)`,
      groups: [
        s(pair, 2, 'a'),
        ...singles.map(n => s(n, 1, 'a')),
        s(pair, 4, 'b'),
        s(pair, 4, 'c'),
      ],
      value: 25,
      concealed: false,
    } satisfies HandPattern;
  }),
  {
    id: '13579-8',
    category: '13579',
    description: 'FFF 11 33 555 DDDD (Any 1 Suit, Matching Dragon)',
    groups: [f(3), s(1, 2, 'a'), s(3, 2, 'a'), s(5, 3, 'a'), d(4, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '13579-9',
    category: '13579',
    description: 'FFF 55 77 999 DDDD (Any 1 Suit, Matching Dragon)',
    groups: [f(3), s(5, 2, 'a'), s(7, 2, 'a'), s(9, 3, 'a'), d(4, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '13579-10',
    category: '13579',
    description: '11 33 111 333 5555 (Any 2 Suits)',
    groups: [s(1, 2, 'a'), s(3, 2, 'a'), s(1, 3, 'b'), s(3, 3, 'b'), s(5, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '13579-11',
    category: '13579',
    description: '55 77 555 777 9999 (Any 2 Suits)',
    groups: [s(5, 2, 'a'), s(7, 2, 'a'), s(5, 3, 'b'), s(7, 3, 'b'), s(9, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '13579-12',
    category: '13579',
    description: '1111 33 55 77 9999 (Any 2 Suits)',
    groups: [s(1, 4, 'a'), s(3, 2, 'a'), s(5, 2, 'b'), s(7, 2, 'b'), s(9, 4, 'b')],
    value: 30, concealed: false,
  },
  {
    id: '13579-13',
    category: '13579',
    description: '1111 33 55 77 9999 (Any 3 Suits)',
    groups: [s(1, 4, 'a'), s(3, 2, 'b'), s(5, 2, 'c'), s(7, 2, 'a'), s(9, 4, 'b')],
    value: 30, concealed: false,
  },
  {
    id: '13579-14',
    category: '13579',
    description: 'FF 11 33 55 111 111 (Any 3 Suits; these numbers only)',
    groups: [f(2), s(1, 2, 'a'), s(3, 2, 'a'), s(5, 2, 'a'), s(1, 3, 'b'), s(1, 3, 'c')],
    value: 35, concealed: true,
  },
  {
    id: '13579-15',
    category: '13579',
    description: 'FF 55 77 99 555 555 (Any 3 Suits; these numbers only)',
    groups: [f(2), s(5, 2, 'a'), s(7, 2, 'a'), s(9, 2, 'a'), s(5, 3, 'b'), s(5, 3, 'c')],
    value: 35, concealed: true,
  },
  {
    id: '13579-16',
    category: '13579',
    description: 'FF 135 777 999 DDD (Any 1 Suit with Opposite Dragon)',
    groups: [f(2), s(1, 1, 'a'), s(3, 1, 'a'), s(5, 1, 'a'), s(7, 3, 'a'), s(9, 3, 'a'), d(3, 'opposite')],
    value: 30, concealed: true,
  },
];

// ============================================================
// Category: Winds + Dragons
// ============================================================
const catWindsDragons: HandPattern[] = [
  {
    id: 'wd-1',
    category: 'Winds + Dragons',
    description: 'NNNN EEE WWW SSSS',
    groups: [w(4, 'north'), w(3, 'east'), w(3, 'west'), w(4, 'south')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-2',
    category: 'Winds + Dragons',
    description: 'NNN EEEE WWWW SSS',
    groups: [w(3, 'north'), w(4, 'east'), w(4, 'west'), w(3, 'south')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-3',
    category: 'Winds + Dragons',
    description: '1234 DDD DDD DDDD (Any 4 consecutive in 1 suit; three dragon colors)',
    groups: [s(1, 1, 'a'), s(2, 1, 'a'), s(3, 1, 'a'), s(4, 1, 'a'), d(3, 'red'), d(3, 'green'), d(4, 'white')],
    value: 25, concealed: false, runShiftMax: 5,
  },
  // wd-4: NNN 1111 1111 SSS — any like ODD number in any 2 suits (one entry per odd rank)
  {
    id: 'wd-4-r1',
    category: 'Winds + Dragons',
    description: 'NNN 1111 1111 SSS (like 1s in any 2 suits)',
    groups: [w(3, 'north'), s(1, 4, 'a'), s(1, 4, 'b'), w(3, 'south')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-4-r3',
    category: 'Winds + Dragons',
    description: 'NNN 3333 3333 SSS (like 3s in any 2 suits)',
    groups: [w(3, 'north'), s(3, 4, 'a'), s(3, 4, 'b'), w(3, 'south')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-4-r5',
    category: 'Winds + Dragons',
    description: 'NNN 5555 5555 SSS (like 5s in any 2 suits)',
    groups: [w(3, 'north'), s(5, 4, 'a'), s(5, 4, 'b'), w(3, 'south')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-4-r7',
    category: 'Winds + Dragons',
    description: 'NNN 7777 7777 SSS (like 7s in any 2 suits)',
    groups: [w(3, 'north'), s(7, 4, 'a'), s(7, 4, 'b'), w(3, 'south')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-4-r9',
    category: 'Winds + Dragons',
    description: 'NNN 9999 9999 SSS (like 9s in any 2 suits)',
    groups: [w(3, 'north'), s(9, 4, 'a'), s(9, 4, 'b'), w(3, 'south')],
    value: 25, concealed: false,
  },
  // wd-5: EEE 2222 2222 WWW — any like EVEN number in any 2 suits (one entry per even rank)
  {
    id: 'wd-5-r2',
    category: 'Winds + Dragons',
    description: 'EEE 2222 2222 WWW (like 2s in any 2 suits)',
    groups: [w(3, 'east'), s(2, 4, 'a'), s(2, 4, 'b'), w(3, 'west')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-5-r4',
    category: 'Winds + Dragons',
    description: 'EEE 4444 4444 WWW (like 4s in any 2 suits)',
    groups: [w(3, 'east'), s(4, 4, 'a'), s(4, 4, 'b'), w(3, 'west')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-5-r6',
    category: 'Winds + Dragons',
    description: 'EEE 6666 6666 WWW (like 6s in any 2 suits)',
    groups: [w(3, 'east'), s(6, 4, 'a'), s(6, 4, 'b'), w(3, 'west')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-5-r8',
    category: 'Winds + Dragons',
    description: 'EEE 8888 8888 WWW (like 8s in any 2 suits)',
    groups: [w(3, 'east'), s(8, 4, 'a'), s(8, 4, 'b'), w(3, 'west')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-6',
    category: 'Winds + Dragons',
    description: 'FFF NNNN FFF DDDD (Any wind; any dragon)',
    groups: [f(3), w(4, 'any'), f(3), d(4, 'any')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-7',
    category: 'Winds + Dragons',
    description: '1 N 2 EE 3 WWW 4 SSSS (Any 1 Suit; these numbers only)',
    groups: [
      s(1, 1, 'a'), w(1, 'north'),
      s(2, 1, 'a'), w(2, 'east'),
      s(3, 1, 'a'), w(3, 'west'),
      s(4, 1, 'a'), w(4, 'south'),
    ],
    value: 25, concealed: false,
  },
  {
    id: 'wd-8',
    category: 'Winds + Dragons',
    description: 'FF NNNN SSSS DD DD (Any 2 different dragons)',
    groups: [f(2), w(4, 'north'), w(4, 'south'), d(2, 'any'), d(2, 'any')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-9',
    category: 'Winds + Dragons',
    description: 'FF EEEE WWWW DD DD (Any 2 different dragons)',
    groups: [f(2), w(4, 'east'), w(4, 'west'), d(2, 'any'), d(2, 'any')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-10',
    category: 'Winds + Dragons',
    description: 'NN EEE 2026 WWW SS (2026 in any 1 suit)',
    groups: [w(2, 'north'), w(3, 'east'), s(2, 1, 'a'), d(1, 'white'), s(2, 1, 'a'), s(6, 1, 'a'), w(3, 'west'), w(2, 'south')],
    value: 30, concealed: true,
  },
];

// ============================================================
// Category: 369
// ============================================================
const cat369: HandPattern[] = [
  {
    id: '369-1',
    category: '369',
    description: '333 666 6666 9999 (Any 2 Suits)',
    groups: [s(3, 3, 'a'), s(6, 3, 'a'), s(6, 4, 'b'), s(9, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '369-2',
    category: '369',
    description: '333 666 6666 9999 (Any 3 Suits)',
    groups: [s(3, 3, 'a'), s(6, 3, 'b'), s(6, 4, 'c'), s(9, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: '369-3',
    category: '369',
    description: '33 66 333 666 9999 (Any 3 Suits)',
    groups: [s(3, 2, 'a'), s(6, 2, 'a'), s(3, 3, 'b'), s(6, 3, 'b'), s(9, 4, 'c')],
    value: 25, concealed: false,
  },
  {
    id: '369-4',
    category: '369',
    description: 'FFF 33 666 99 DDDD (1 Suit with Matching Dragon)',
    groups: [f(3), s(3, 2, 'a'), s(6, 3, 'a'), s(9, 2, 'a'), d(4, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '369-5',
    category: '369',
    description: 'FFF 33 666 99 DDDD (1 Suit with Opposite Dragon)',
    groups: [f(3), s(3, 2, 'a'), s(6, 3, 'a'), s(9, 2, 'a'), d(4, 'opposite')],
    value: 25, concealed: false,
  },
  {
    id: '369-6',
    category: '369',
    description: '33 66 666 999 NEWS (Any 2 Suits)',
    groups: [s(3, 2, 'a'), s(6, 2, 'a'), s(6, 3, 'b'), s(9, 3, 'b'), news()],
    value: 30, concealed: false,
  },
  ...([3, 6, 9] as const).map(pair => {
    const others = ([3, 6, 9] as const).filter(n => n !== pair);
    return {
      id: `369-7-r${pair}`,
      category: '369',
      description: `FF pair-${pair} + ${others.join(',')} + matching Kongs (Any 3 Suits)`,
      groups: [
        f(2),
        s(pair, 2, 'a'),
        s(others[0]!, 1, 'a'),
        s(others[1]!, 1, 'a'),
        s(pair, 4, 'b'),
        s(pair, 4, 'c'),
      ],
      value: 25,
      concealed: false,
    } satisfies HandPattern;
  }),
  {
    id: '369-8',
    category: '369',
    description: 'FF 333 666 999 369 (Any 2 Suits)',
    groups: [f(2), s(3, 3, 'a'), s(6, 3, 'a'), s(9, 3, 'a'), s(3, 1, 'b'), s(6, 1, 'b'), s(9, 1, 'b')],
    value: 30, concealed: true,
  },
];

// ============================================================
// Category: Singles + Pairs  (all concealed, no jokers)
// ============================================================
const catSinglesPairs: HandPattern[] = [
  {
    id: 'sp-1',
    category: 'Singles + Pairs',
    description: 'NN EE WW SS 1D 1D 1D (Any like number with Matching Dragons)',
    groups: [w(2, 'north'), w(2, 'east'), w(2, 'west'), w(2, 'south'), s(1, 1, 'a'), d(1, 'any'), s(1, 1, 'b'), d(1, 'any'), s(1, 1, 'c'), d(1, 'any')],
    value: 50, concealed: true, runShiftMax: 8,
  },
  {
    id: 'sp-2',
    category: 'Singles + Pairs',
    description: '2 4 66 88 2 4 66 88 88 (Any 3 Suits; these numbers only)',
    groups: [s(2, 1, 'a'), s(4, 1, 'a'), s(6, 2, 'a'), s(8, 2, 'a'), s(2, 1, 'b'), s(4, 1, 'b'), s(6, 2, 'b'), s(8, 2, 'b'), s(8, 2, 'c')],
    value: 50, concealed: true,
  },
  {
    id: 'sp-3',
    category: 'Singles + Pairs',
    description: 'FF 3369 3669 3699 (Any 3 Suits)',
    groups: [f(2), s(3, 2, 'a'), s(6, 1, 'a'), s(9, 1, 'a'), s(3, 1, 'b'), s(6, 2, 'b'), s(9, 1, 'b'), s(3, 1, 'c'), s(6, 1, 'c'), s(9, 2, 'c')],
    value: 50, concealed: true,
  },
  {
    id: 'sp-4',
    category: 'Singles + Pairs',
    description: '11 22 33 44 55 66 77 (Any 1 Suit; any 7 consecutive)',
    groups: [s(1, 2, 'a'), s(2, 2, 'a'), s(3, 2, 'a'), s(4, 2, 'a'), s(5, 2, 'a'), s(6, 2, 'a'), s(7, 2, 'a')],
    value: 50, concealed: true, runShiftMax: 2,
  },
  {
    id: 'sp-5',
    category: 'Singles + Pairs',
    description: '11 357 99 11 357 99 (Any 2 Suits)',
    groups: [s(1, 2, 'a'), s(3, 1, 'a'), s(5, 1, 'a'), s(7, 1, 'a'), s(9, 2, 'a'), s(1, 2, 'b'), s(3, 1, 'b'), s(5, 1, 'b'), s(7, 1, 'b'), s(9, 2, 'b')],
    value: 50, concealed: true,
  },
  {
    id: 'sp-6',
    category: 'Singles + Pairs',
    description: 'FF 2026 2026 2026 (Any 3 Suits)',
    groups: [f(2), s(2, 1, 'a'), d(1, 'white'), s(2, 1, 'a'), s(6, 1, 'a'), s(2, 1, 'b'), d(1, 'white'), s(2, 1, 'b'), s(6, 1, 'b'), s(2, 1, 'c'), d(1, 'white'), s(2, 1, 'c'), s(6, 1, 'c')],
    value: 75, concealed: true,
  },
];

// ============================================================
// Export all categories
// ============================================================

export const ALL_HAND_CATEGORIES: HandCategory[] = [
  { name: '2026', hands: cat2026 },
  { name: '2468', hands: cat2468 },
  { name: 'Any Like Numbers', hands: catAnyLike },
  { name: 'Quints', hands: catQuints },
  { name: 'Consecutive Run', hands: catConsecutive },
  { name: '13579', hands: cat13579 },
  { name: 'Winds + Dragons', hands: catWindsDragons },
  { name: '369', hands: cat369 },
  { name: 'Singles + Pairs', hands: catSinglesPairs },
];

export const ALL_HANDS: HandPattern[] = ALL_HAND_CATEGORIES.flatMap(c => c.hands);

// ============================================================
// Validation: every pattern's groups must sum to exactly 14 tiles.
// Throws at module load if a pattern is malformed.
// ============================================================
for (const p of ALL_HANDS) {
  const total = p.groups.reduce((n, g) => n + g.count, 0);
  if (total !== 14) {
    throw new Error(`Hand ${p.id} (${p.category}) has ${total} tiles, expected 14`);
  }
}
