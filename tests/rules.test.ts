// ============================================================
// Rules regression tests - American Mahjong (NMJL 2026 card)
// ============================================================
//
// These lock in the rules behaviours that a real player would notice if
// they broke. Run with: npm test
//
// Deliberately focused on rules fidelity rather than coverage percentage:
// scoring, joker restrictions, claim priority, the Charleston, and the
// 14-tile invariant are the things that silently regress.

import { describe, expect, it } from 'vitest';
import { createTileSet, isJoker, tilesMatch } from '../src/engine/tiles';
import { ALL_HANDS } from '../src/engine/hands';
import {
  OFFICIAL_SCORING,
  calculateScore,
  checkWin,
  scoreHand,
} from '../src/engine/scoring';
import { canPung, canKong, canQuint, claimPriority } from '../src/engine/actions';
import {
  getPassTarget,
  nextCharlestonPhase,
} from '../src/engine/charleston';
import type { GamePhase, Player, Tile, TileKind } from '../src/engine/types';

// ---------- helpers ----------

let nextId = 1000;
function tile(kind: TileKind): Tile {
  return { id: nextId++, kind, label: 'x' };
}
const suited = (suit: 'bam' | 'crak' | 'dot', rank: number) =>
  tile({ type: 'suited', suit, rank });
const flower = () => tile({ type: 'flower' });
const joker = () => tile({ type: 'joker' });
const dragon = (d: 'red' | 'green' | 'white') => tile({ type: 'dragon', dragon: d });

function player(hand: Tile[], exposedSets: Player['exposedSets'] = []): Player {
  return {
    id: 'p0',
    name: 'Test',
    type: 'human',
    seatWind: 'east',
    hand,
    exposedSets,
    discards: [],
    score: 0,
  };
}

// ---------- tile set ----------

describe('tile set', () => {
  it('is the American 152-tile set', () => {
    const tiles = createTileSet();
    expect(tiles).toHaveLength(152);

    const count = (pred: (t: Tile) => boolean) => tiles.filter(pred).length;
    expect(count(t => t.kind.type === 'suited')).toBe(108); // 3 suits x 9 x 4
    expect(count(t => t.kind.type === 'wind')).toBe(16);
    expect(count(t => t.kind.type === 'dragon')).toBe(12);
    expect(count(t => t.kind.type === 'flower')).toBe(8);
    expect(count(t => t.kind.type === 'joker')).toBe(8);
  });

  it('gives every tile a unique id', () => {
    const tiles = createTileSet();
    expect(new Set(tiles.map(t => t.id)).size).toBe(152);
  });
});

// ---------- card integrity ----------

describe('2026 hand card', () => {
  it('every printed hand is exactly 14 tiles (kongs included)', () => {
    // American hands are exactly the 14 tiles on the card - a kong occupies
    // 4 of those 14, it is NOT a bonus set with a replacement draw.
    for (const hand of ALL_HANDS) {
      const total = hand.groups.reduce((n, g) => n + g.count, 0);
      expect(total, `${hand.id} (${hand.category})`).toBe(14);
    }
  });

  it('has unique hand ids', () => {
    expect(new Set(ALL_HANDS.map(h => h.id)).size).toBe(ALL_HANDS.length);
  });

  it('marks concealed hands and gives every hand a positive value', () => {
    for (const hand of ALL_HANDS) {
      expect(typeof hand.concealed).toBe('boolean');
      expect(hand.value).toBeGreaterThan(0);
    }
  });
});

// ---------- jokers ----------

describe('joker rules', () => {
  it('allows jokers toward a pung/kong/quint claim', () => {
    const discard = suited('bam', 3);
    const p = player([suited('bam', 3), joker(), joker(), joker()]);
    expect(canPung(p, discard)).toBe(true);  // needs 2
    expect(canKong(p, discard)).toBe(true);  // needs 3
    expect(canQuint(p, discard)).toBe(true); // needs 4
  });

  it('refuses a claim when there are too few naturals + jokers', () => {
    const discard = suited('bam', 3);
    const p = player([suited('bam', 3)]); // only 1 toward a set
    expect(canPung(p, discard)).toBe(false);
  });

  it('never allows claiming a discarded joker', () => {
    const j = joker();
    const p = player([joker(), joker(), joker(), joker()]);
    expect(canPung(p, j)).toBe(false);
    expect(canKong(p, j)).toBe(false);
    expect(canQuint(p, j)).toBe(false);
  });

  it('does NOT let a joker complete a pair or single', () => {
    // FF 2026 2026 2026 is all singles and one pair - jokers are illegal
    // everywhere in it, so a joker-padded hand must not register a win.
    const withJoker = player([
      flower(), joker(),
      suited('crak', 2), dragon('white'), suited('crak', 2), suited('crak', 6),
      suited('bam', 2), dragon('white'), suited('bam', 2), suited('bam', 6),
      suited('dot', 2), dragon('white'), suited('dot', 2), suited('dot', 6),
    ]);
    expect(checkWin(withJoker)).toBeNull();
  });

  it('accepts the same hand once the joker is a real flower', () => {
    const natural = player([
      flower(), flower(),
      suited('crak', 2), dragon('white'), suited('crak', 2), suited('crak', 6),
      suited('bam', 2), dragon('white'), suited('bam', 2), suited('bam', 6),
      suited('dot', 2), dragon('white'), suited('dot', 2), suited('dot', 6),
    ]);
    const win = checkWin(natural);
    expect(win).not.toBeNull();
    expect(win!.id).toBe('sp-6');
  });
});

// ---------- win detection ----------

describe('checkWin', () => {
  it('requires exactly 14 tiles', () => {
    const short = player([flower(), flower()]);
    expect(checkWin(short)).toBeNull();
  });

  it('rejects a concealed-only hand when tiles are exposed', () => {
    // sp-6 is a C hand; any exposure disqualifies it.
    const tiles = [
      suited('crak', 2), dragon('white'), suited('crak', 2), suited('crak', 6),
      suited('bam', 2), dragon('white'), suited('bam', 2), suited('bam', 6),
      suited('dot', 2), dragon('white'), suited('dot', 2), suited('dot', 6),
    ];
    const exposed = player(tiles, [
      { tiles: [flower(), flower()], setType: 'pair' },
    ]);
    expect(checkWin(exposed)).toBeNull();
  });
});

// ---------- scoring ----------

describe('scoring', () => {
  const pattern = ALL_HANDS[0]!;

  it('defaults to the printed card value with no bonuses', () => {
    // Official NMJL scoring is just the hand's printed value.
    expect(calculateScore(pattern, /*selfDrawn*/ true, /*jokers*/ 0)).toBe(pattern.value);
    expect(calculateScore(pattern, false, 3, OFFICIAL_SCORING)).toBe(pattern.value);
  });

  it('applies house-rule bonuses only when enabled', () => {
    const rules = { selfDrawnBonus: true, jokerlessBonus: true };
    const breakdown = scoreHand(pattern, true, 0, rules);
    expect(breakdown.base).toBe(pattern.value);
    expect(breakdown.total).toBe(pattern.value + 2 + 10);
    expect(breakdown.bonuses).toHaveLength(2);
  });

  it('does not award the jokerless bonus when jokers were used', () => {
    const rules = { selfDrawnBonus: false, jokerlessBonus: true };
    expect(scoreHand(pattern, false, 2, rules).total).toBe(pattern.value);
  });
});

// ---------- claims ----------

describe('claim priority', () => {
  it('ranks Mahjong above every exposure claim', () => {
    expect(claimPriority('mahjong')).toBeGreaterThan(claimPriority('quint'));
    expect(claimPriority('quint')).toBeGreaterThan(claimPriority('kong'));
    expect(claimPriority('kong')).toBeGreaterThan(claimPriority('pung'));
    expect(claimPriority('pung')).toBeGreaterThan(claimPriority('pass'));
  });
});

// ---------- charleston ----------

describe('charleston', () => {
  it('runs first R-A-L, second L-A-R, then courtesy, then play', () => {
    const order: GamePhase[] = ['charleston_first_right'];
    let phase: GamePhase = order[0]!;
    for (let i = 0; i < 10 && phase !== 'playing'; i++) {
      phase = nextCharlestonPhase(phase);
      order.push(phase);
    }
    expect(order).toEqual([
      'charleston_first_right',
      'charleston_first_across',
      'charleston_first_left',
      'charleston_second_left',   // second Charleston reverses direction
      'charleston_second_across',
      'charleston_second_right',
      'charleston_courtesy',
      'playing',
    ]);
  });

  it('passes right to the next seat and left to the previous seat', () => {
    expect(getPassTarget(0, 'charleston_first_right')).toBe(1);
    expect(getPassTarget(0, 'charleston_first_left')).toBe(3);
    expect(getPassTarget(0, 'charleston_first_across')).toBe(2);
    // Courtesy is always across
    expect(getPassTarget(1, 'charleston_courtesy')).toBe(3);
  });

  it('makes across passes mutual', () => {
    for (let seat = 0; seat < 4; seat++) {
      const target = getPassTarget(seat, 'charleston_first_across');
      expect(getPassTarget(target, 'charleston_first_across')).toBe(seat);
    }
  });
});

// ---------- tile matching ----------

describe('tilesMatch', () => {
  it('matches identical suited tiles only', () => {
    expect(tilesMatch(suited('bam', 3).kind, suited('bam', 3).kind)).toBe(true);
    expect(tilesMatch(suited('bam', 3).kind, suited('crak', 3).kind)).toBe(false);
    expect(tilesMatch(suited('bam', 3).kind, suited('bam', 4).kind)).toBe(false);
  });

  it('treats all flowers as interchangeable', () => {
    expect(tilesMatch(flower().kind, flower().kind)).toBe(true);
  });

  it('distinguishes dragon colours', () => {
    expect(tilesMatch(dragon('red').kind, dragon('red').kind)).toBe(true);
    expect(tilesMatch(dragon('red').kind, dragon('green').kind)).toBe(false);
  });

  it('identifies jokers', () => {
    expect(isJoker(joker())).toBe(true);
    expect(isJoker(flower())).toBe(false);
  });
});

