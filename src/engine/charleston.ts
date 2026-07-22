// ============================================================
// Charleston — The tile-passing ritual before gameplay
// ============================================================

import { Tile, Player, GamePhase } from './types';

/** Get the direction label for the current Charleston phase */
export function getCharlestonDirection(phase: GamePhase): string {
  switch (phase) {
    case 'charleston_first_right': return 'Right';
    case 'charleston_first_across': return 'Across';
    case 'charleston_first_left': return 'Left';
    case 'charleston_second_left': return 'Left';
    case 'charleston_second_across': return 'Across';
    case 'charleston_second_right': return 'Right';
    case 'charleston_courtesy': return 'Across (Courtesy)';
    default: return '';
  }
}

/** Get which charleston round we're in */
export function getCharlestonRound(phase: GamePhase): 'first' | 'second' | 'courtesy' | null {
  if (phase.startsWith('charleston_first')) return 'first';
  if (phase.startsWith('charleston_second')) return 'second';
  if (phase === 'charleston_courtesy') return 'courtesy';
  return null;
}

/**
 * Get the target player index for passing tiles.
 * Seats: 0=East, 1=South, 2=West, 3=North (same order as turn advance).
 * Play and Charleston "right" both go to the next seat (+1).
 */
export function getPassTarget(fromIndex: number, phase: GamePhase): number {
  switch (phase) {
    case 'charleston_first_right':
    case 'charleston_second_right':
      return (fromIndex + 1) % 4; // right = next seat (turn direction)
    case 'charleston_first_across':
    case 'charleston_second_across':
    case 'charleston_courtesy':
      return (fromIndex + 2) % 4; // across
    case 'charleston_first_left':
    case 'charleston_second_left':
      return (fromIndex + 3) % 4; // left = opposite of right
    default:
      return fromIndex;
  }
}

/** Get the next Charleston phase */
export function nextCharlestonPhase(current: GamePhase): GamePhase {
  const sequence: GamePhase[] = [
    'charleston_first_right',
    'charleston_first_across',
    'charleston_first_left',
    'charleston_second_left',
    'charleston_second_across',
    'charleston_second_right',
    'charleston_courtesy',
  ];
  const idx = sequence.indexOf(current);
  if (idx === -1 || idx === sequence.length - 1) return 'playing';
  return sequence[idx + 1]!;
}

/**
 * Execute a Charleston pass: remove selected tiles from each player
 * and give them to the target player.
 */
export function executeCharlestonPass(
  players: Player[],
  selectedTiles: Map<number, Tile[]>,
  phase: GamePhase
): Player[] {
  const updatedPlayers = players.map(p => ({
    ...p,
    hand: [...p.hand],
  }));

  // Collect tiles being received by each player
  const receiving = new Map<number, Tile[]>();
  for (let i = 0; i < 4; i++) {
    receiving.set(i, []);
  }

  // Remove tiles from senders and queue for receivers
  for (let i = 0; i < 4; i++) {
    const tilesToPass = selectedTiles.get(i) || [];
    const targetIdx = getPassTarget(i, phase);
    const tileIds = new Set(tilesToPass.map(t => t.id));

    // Remove from sender
    updatedPlayers[i]!.hand = updatedPlayers[i]!.hand.filter(t => !tileIds.has(t.id));

    // Queue for receiver
    receiving.get(targetIdx)!.push(...tilesToPass);
  }

  // Add received tiles to each player
  for (let i = 0; i < 4; i++) {
    updatedPlayers[i]!.hand.push(...receiving.get(i)!);
  }

  return updatedPlayers;
}
