// ============================================================
// 2026 Hand Patterns
// Transcribed from the 2026 Mahjong Hand Tracker card
// ============================================================
//
// Notation guide:
//   suitConstraint 'a','b','c' = must be different suits
//   Same letter = same suit. Different letters = different suits.
//   'any' = any suit
//   Numbers = rank for suited tiles
//   For "year" hands, 0 is represented by Pearl Dragon (Oyster)
//   Dragon 'any' inherits color from the nearest suited group
//     (red↔crak, green↔bam, white↔dot); optional 3rd arg locks a suit letter
//
// concealed = true means hand marked with "C" on card
// value = the multiplier shown (e.g., X25 = 25, C30 = 30 concealed)

import { HandPattern, HandCategory } from './types';

/** Helper to build a suited group */
function s(rank: number, count: number, suit: 'a' | 'b' | 'c' | 'any' = 'a') {
  return { type: 'suited' as const, rank, count, suitConstraint: suit };
}

/** Flower group */
function f(count: number) {
  return { type: 'flower' as const, count };
}

/** Dragon group - 'any' inherits suit-color from neighboring number groups */
function d(
  count: number,
  dragon: 'any' | 'red' | 'green' | 'white' = 'any',
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
    description: '222 000 2222 6666 (0=Pearl Dragon/Oyster)',
    groups: [s(2, 3, 'a'), d(3, 'white'), s(2, 4, 'b'), s(6, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: '2026-2',
    category: '2026',
    description: '2026 DDD 2222 DDD',
    groups: [s(2, 1, 'a'), d(1, 'white'), s(2, 1, 'a'), s(6, 1, 'a'), d(3, 'any'), s(2, 4, 'b'), d(3, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '2026-3',
    category: '2026',
    description: 'FFF 2026 222 6666',
    groups: [f(3), s(2, 1, 'a'), d(1, 'white'), s(2, 1, 'a'), s(6, 1, 'a'), s(2, 3, 'b'), s(6, 4, 'c')],
    value: 25, concealed: false,
  },
  {
    id: '2026-4',
    category: '2026',
    description: '22 00 222 666 NEWS',
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
    description: '222 444 6666 8888 (two suits)',
    groups: [s(2, 3, 'a'), s(4, 3, 'b'), s(6, 4, 'a'), s(8, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '2468-3',
    category: '2468',
    description: 'FF 2222 44 66 8888',
    groups: [f(2), s(2, 4, 'a'), s(4, 2, 'b'), s(6, 2, 'b'), s(8, 4, 'a')],
    value: 30, concealed: false,
  },
  {
    id: '2468-4',
    category: '2468',
    description: 'EE 22 444 666 88 WW',
    groups: [w(2, 'east'), s(2, 2, 'a'), s(4, 3, 'b'), s(6, 3, 'c'), s(8, 2, 'a'), w(2, 'west')],
    value: 30, concealed: false,
  },
  {
    id: '2468-5',
    category: '2468',
    description: '2222 DDD 8888 DDD',
    groups: [s(2, 4, 'a'), d(3, 'any'), s(8, 4, 'b'), d(3, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '2468-6',
    category: '2468',
    description: 'FFF 22 44 666 8888',
    groups: [f(3), s(2, 2, 'a'), s(4, 2, 'b'), s(6, 3, 'c'), s(8, 4, 'c')],
    value: 25, concealed: false,
  },
  {
    id: '2468-7',
    category: '2468',
    description: '2468 2222 D 2222 D',
    groups: [s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 1, 'a'), s(2, 4, 'b'), d(1, 'any'), s(2, 4, 'c'), d(1, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '2468-8',
    category: '2468',
    description: 'FFF 2468 FFF 2222',
    groups: [f(3), s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 1, 'a'), f(3), s(2, 4, 'b')],
    value: 30, concealed: false,
  },
  {
    id: '2468-9',
    category: '2468',
    description: 'FF 246 888 246 888',
    groups: [f(2), s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 3, 'b'), s(2, 1, 'a'), s(4, 1, 'a'), s(6, 1, 'a'), s(8, 3, 'b')],
    value: 30, concealed: true,
  },
];

// ============================================================
// Category: Any Like Numbers
// ============================================================
const catAnyLike: HandPattern[] = [
  {
    id: 'any-1',
    category: 'Any Like Numbers',
    description: '1111 FFFFFFF 1111',
    groups: [s(1, 4, 'a'), f(7), s(1, 4, 'b')],
    value: 30, concealed: false,
  },
  {
    id: 'any-2',
    category: 'Any Like Numbers',
    description: '1111 D 111 D 1111 D',
    groups: [s(1, 4, 'a'), d(1, 'any'), s(1, 3, 'b'), d(1, 'any'), s(1, 4, 'c'), d(1, 'any')],
    value: 25, concealed: false,
  },
  {
    id: 'any-3',
    category: 'Any Like Numbers',
    description: 'FF 1111 11 1111 DD',
    groups: [f(2), s(1, 4, 'a'), s(1, 2, 'b'), s(1, 4, 'c'), d(2, 'any')],
    value: 25, concealed: false,
  },
];

// ============================================================
// Category: Quints
// ============================================================
const catQuints: HandPattern[] = [
  {
    id: 'quint-1',
    category: 'Quints',
    description: '11111 11111 1111',
    groups: [s(1, 5, 'a'), s(1, 5, 'b'), s(1, 4, 'c')],
    value: 40, concealed: false,
  },
  {
    id: 'quint-2',
    category: 'Quints',
    description: 'FF 11111 22 33333',
    groups: [f(2), s(1, 5, 'a'), s(2, 2, 'a'), s(3, 5, 'a')],
    value: 45, concealed: false,
  },
  {
    id: 'quint-3',
    category: 'Quints',
    description: '11111 44444 DDDD',
    groups: [s(1, 5, 'a'), s(4, 5, 'a'), d(4, 'any')],
    value: 40, concealed: false,
  },
];

// ============================================================
// Category: Consecutive Run
// ============================================================
const catConsecutive: HandPattern[] = [
  {
    id: 'con-1',
    category: 'Consecutive Run',
    description: '11 222 33 444 5555',
    groups: [s(1, 2, 'a'), s(2, 3, 'a'), s(3, 2, 'a'), s(4, 3, 'a'), s(5, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: 'con-2',
    category: 'Consecutive Run',
    description: '55 666 77 888 9999',
    groups: [s(5, 2, 'a'), s(6, 3, 'a'), s(7, 2, 'a'), s(8, 3, 'a'), s(9, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: 'con-3',
    category: 'Consecutive Run',
    description: 'FFF 1111 234 5555',
    groups: [f(3), s(1, 4, 'a'), s(2, 1, 'a'), s(3, 1, 'a'), s(4, 1, 'a'), s(5, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: 'con-5',
    category: 'Consecutive Run',
    description: '11 22 111 222 3333',
    groups: [s(1, 2, 'a'), s(2, 2, 'a'), s(1, 3, 'b'), s(2, 3, 'b'), s(3, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: 'con-6',
    category: 'Consecutive Run',
    description: '111 222 3333 4444',
    groups: [s(1, 3, 'a'), s(2, 3, 'a'), s(3, 4, 'a'), s(4, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: 'con-8',
    category: 'Consecutive Run',
    description: 'FFF 11 22 333 DDDD',
    groups: [f(3), s(1, 2, 'a'), s(2, 2, 'a'), s(3, 3, 'a'), d(4, 'any')],
    value: 25, concealed: false,
  },
  {
    id: 'con-10',
    category: 'Consecutive Run',
    description: '1111 FFFFFFF 2222',
    groups: [s(1, 4, 'a'), f(7), s(2, 4, 'a')],
    value: 30, concealed: false,
  },
  {
    id: 'con-11',
    category: 'Consecutive Run',
    description: 'FF 1111 2222 3333',
    groups: [f(2), s(1, 4, 'a'), s(2, 4, 'a'), s(3, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: 'con-12',
    category: 'Consecutive Run',
    description: 'FF 1111 2222 3333 (alt suits)',
    groups: [f(2), s(1, 4, 'a'), s(2, 4, 'b'), s(3, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: 'con-13',
    category: 'Consecutive Run',
    description: 'FF 1111 2222 3333 (three suits)',
    groups: [f(2), s(1, 4, 'a'), s(2, 4, 'b'), s(3, 4, 'c')],
    value: 25, concealed: false,
  },
  {
    id: 'con-14',
    category: 'Consecutive Run',
    description: '11 22 333 444 555',
    groups: [s(1, 2, 'a'), s(2, 2, 'a'), s(3, 3, 'a'), s(4, 3, 'a'), s(5, 3, 'a')],
    value: 25, concealed: false,
  },
  {
    id: 'con-15',
    category: 'Consecutive Run',
    description: '11 22 333 444 555 (concealed)',
    groups: [s(1, 2, 'a'), s(2, 2, 'a'), s(3, 3, 'a'), s(4, 3, 'a'), s(5, 3, 'a')],
    value: 35, concealed: true,
  },
];

// ============================================================
// Category: 13579
// ============================================================
const cat13579: HandPattern[] = [
  {
    id: '13579-1',
    category: '13579',
    description: '11 333 55 777 9999',
    groups: [s(1, 2, 'a'), s(3, 3, 'a'), s(5, 2, 'a'), s(7, 3, 'a'), s(9, 4, 'a')],
    value: 25, concealed: false,
  },
  {
    id: '13579-3',
    category: '13579',
    description: '111 333 3333 5555',
    groups: [s(1, 3, 'a'), s(3, 3, 'a'), s(3, 4, 'b'), s(5, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '13579-4',
    category: '13579',
    description: '555 777 7777 9999',
    groups: [s(5, 3, 'a'), s(7, 3, 'a'), s(7, 4, 'b'), s(9, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '13579-5',
    category: '13579',
    description: 'NN 1111 33 5555 SS',
    groups: [w(2, 'north'), s(1, 4, 'a'), s(3, 2, 'a'), s(5, 4, 'a'), w(2, 'south')],
    value: 30, concealed: false,
  },
  {
    id: '13579-6',
    category: '13579',
    description: 'NN 5555 77 9999 SS',
    groups: [w(2, 'north'), s(5, 4, 'a'), s(7, 2, 'a'), s(9, 4, 'a'), w(2, 'south')],
    value: 30, concealed: false,
  },
  {
    id: '13579-7',
    category: '13579',
    description: '113579 1111 1111',
    groups: [s(1, 1, 'a'), s(1, 1, 'a'), s(3, 1, 'a'), s(5, 1, 'a'), s(7, 1, 'a'), s(9, 1, 'a'), s(1, 4, 'b'), s(1, 4, 'c')],
    value: 25, concealed: false,
  },
  {
    id: '13579-8',
    category: '13579',
    description: 'FFF 11 33 555 DDDD',
    groups: [f(3), s(1, 2, 'a'), s(3, 2, 'a'), s(5, 3, 'a'), d(4, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '13579-9',
    category: '13579',
    description: 'FFF 55 77 999 DDDD',
    groups: [f(3), s(5, 2, 'a'), s(7, 2, 'a'), s(9, 3, 'a'), d(4, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '13579-10',
    category: '13579',
    description: '11 33 111 333 5555',
    groups: [s(1, 2, 'a'), s(3, 2, 'a'), s(1, 3, 'b'), s(3, 3, 'b'), s(5, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '13579-11',
    category: '13579',
    description: '55 77 555 777 9999',
    groups: [s(5, 2, 'a'), s(7, 2, 'a'), s(5, 3, 'b'), s(7, 3, 'b'), s(9, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '13579-12',
    category: '13579',
    description: '1111 33 55 77 9999',
    groups: [s(1, 4, 'a'), s(3, 2, 'a'), s(5, 2, 'a'), s(7, 2, 'a'), s(9, 4, 'a')],
    value: 30, concealed: false,
  },
  {
    id: '13579-13',
    category: '13579',
    description: 'FF 11 33 55 1111',
    groups: [f(2), s(1, 2, 'a'), s(3, 2, 'a'), s(5, 2, 'a'), s(1, 4, 'b')],
    value: 35, concealed: true,
  },
  {
    id: '13579-14',
    category: '13579',
    description: 'FF 55 77 99 555 555',
    groups: [f(2), s(5, 2, 'a'), s(7, 2, 'a'), s(9, 2, 'a'), s(5, 3, 'b'), s(5, 3, 'c')],
    value: 35, concealed: true,
  },
  {
    id: '13579-15',
    category: '13579',
    description: 'FF 135 777 999 DDD',
    groups: [f(2), s(1, 1, 'a'), s(3, 1, 'a'), s(5, 1, 'a'), s(7, 3, 'a'), s(9, 3, 'a'), d(3, 'any')],
    value: 30, concealed: true,
  },
];

// ============================================================
// Category: Winds - Sea Dragons
// ============================================================
const catWindsDragons: HandPattern[] = [
  {
    id: 'wd-1',
    category: 'Winds - Sea Dragons',
    description: 'NNNN EEE WWW SSSS',
    groups: [w(4, 'north'), w(3, 'east'), w(3, 'west'), w(4, 'south')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-2',
    category: 'Winds - Sea Dragons',
    description: 'NNN EEEE WWWW SSS',
    groups: [w(3, 'north'), w(4, 'east'), w(4, 'west'), w(3, 'south')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-3',
    category: 'Winds - Sea Dragons',
    description: '1234 DDD DDDD',
    groups: [s(1, 1, 'a'), s(2, 1, 'a'), s(3, 1, 'a'), s(4, 1, 'a'), d(3, 'any'), d(4, 'any')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-4',
    category: 'Winds - Sea Dragons',
    description: 'NNN 1111 1111 SSS',
    groups: [w(3, 'north'), s(1, 4, 'a'), s(1, 4, 'b'), w(3, 'south')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-5',
    category: 'Winds - Sea Dragons',
    description: 'EEE 2222 2222 WWW',
    groups: [w(3, 'east'), s(2, 4, 'a'), s(2, 4, 'b'), w(3, 'west')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-6',
    category: 'Winds - Sea Dragons',
    description: 'FFF NNNN FFF DDDD',
    groups: [f(3), w(4, 'north'), f(3), d(4, 'any')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-7',
    category: 'Winds - Sea Dragons',
    description: '1 N 2 EE 3 WWW 4 SSSS',
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
    category: 'Winds - Sea Dragons',
    description: 'FF NNNN SSSS DD DD',
    groups: [f(2), w(4, 'north'), w(4, 'south'), d(2, 'any'), d(2, 'any')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-9',
    category: 'Winds - Sea Dragons',
    description: 'FF EEEE WWWW DD DD',
    groups: [f(2), w(4, 'east'), w(4, 'west'), d(2, 'any'), d(2, 'any')],
    value: 25, concealed: false,
  },
  {
    id: 'wd-10',
    category: 'Winds - Sea Dragons',
    description: 'NN EEE 2026 WWW SS',
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
    description: '333 666 6666 9999',
    groups: [s(3, 3, 'a'), s(6, 3, 'a'), s(6, 4, 'b'), s(9, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '369-3',
    category: '369',
    description: '33 66 333 666 9999',
    groups: [s(3, 2, 'a'), s(6, 2, 'a'), s(3, 3, 'b'), s(6, 3, 'b'), s(9, 4, 'b')],
    value: 25, concealed: false,
  },
  {
    id: '369-4',
    category: '369',
    description: 'FFF 33 666 99 DDDD',
    groups: [f(3), s(3, 2, 'a'), s(6, 3, 'a'), s(9, 2, 'a'), d(4, 'any')],
    value: 25, concealed: false,
  },
  {
    id: '369-6',
    category: '369',
    description: '33 66 666 999 NEWS',
    groups: [s(3, 2, 'a'), s(6, 2, 'a'), s(6, 3, 'b'), s(9, 3, 'b'), news()],
    value: 30, concealed: false,
  },
  {
    id: '369-7',
    category: '369',
    description: 'FF 3369 3333 3333',
    groups: [f(2), s(3, 1, 'a'), s(3, 1, 'a'), s(6, 1, 'a'), s(9, 1, 'a'), s(3, 4, 'b'), s(3, 4, 'c')],
    value: 25, concealed: false,
  },
  {
    id: '369-8',
    category: '369',
    description: 'FF 333 666 999 369',
    groups: [f(2), s(3, 3, 'a'), s(6, 3, 'a'), s(9, 3, 'a'), s(3, 1, 'b'), s(6, 1, 'b'), s(9, 1, 'b')],
    value: 30, concealed: true,
  },
];

// ============================================================
// Category: Singles & Pairs
// ============================================================
const catSinglesPairs: HandPattern[] = [
  {
    id: 'sp-1',
    category: 'Singles & Pairs',
    description: 'NN EE WW SS 1D 1D 1D',
    groups: [w(2, 'north'), w(2, 'east'), w(2, 'west'), w(2, 'south'), s(1, 1, 'a'), d(1, 'any'), s(1, 1, 'b'), d(1, 'any'), s(1, 1, 'c'), d(1, 'any')],
    value: 50, concealed: true,
  },
  {
    id: 'sp-2',
    category: 'Singles & Pairs',
    description: '2 4 66 88 2 4 66 88',
    groups: [s(2, 1, 'a'), s(4, 1, 'a'), s(6, 2, 'a'), s(8, 2, 'a'), s(2, 1, 'b'), s(4, 1, 'b'), s(6, 2, 'b'), s(8, 2, 'b')],
    value: 50, concealed: true,
  },
  {
    id: 'sp-3',
    category: 'Singles & Pairs',
    description: 'FF 3369 3699 3699',
    groups: [f(2), s(3, 1, 'a'), s(3, 1, 'a'), s(6, 1, 'a'), s(9, 1, 'a'), s(3, 1, 'b'), s(6, 1, 'b'), s(9, 2, 'b'), s(3, 1, 'c'), s(6, 1, 'c'), s(9, 1, 'c')],
    value: 50, concealed: true,
  },
  {
    id: 'sp-4',
    category: 'Singles & Pairs',
    description: '11 22 33 44 55 66 77',
    groups: [s(1, 2, 'a'), s(2, 2, 'a'), s(3, 2, 'a'), s(4, 2, 'a'), s(5, 2, 'a'), s(6, 2, 'a'), s(7, 2, 'a')],
    value: 50, concealed: true,
  },
  {
    id: 'sp-5',
    category: 'Singles & Pairs',
    description: '11 357 99 11 357 99',
    groups: [s(1, 2, 'a'), s(3, 1, 'a'), s(5, 1, 'a'), s(7, 1, 'a'), s(9, 2, 'a'), s(1, 1, 'b'), s(1, 1, 'b'), s(3, 1, 'b'), s(5, 1, 'b'), s(7, 1, 'b'), s(9, 2, 'b')],
    value: 50, concealed: true,
  },
  {
    id: 'sp-6',
    category: 'Singles & Pairs',
    description: 'FF 2026 2026 2026',
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
  { name: 'Winds - Sea Dragons', hands: catWindsDragons },
  { name: '369', hands: cat369 },
  { name: 'Singles & Pairs', hands: catSinglesPairs },
];

export const ALL_HANDS: HandPattern[] = ALL_HAND_CATEGORIES.flatMap(c => c.hands);
