// ============================================================
// useHandOrder - player-controlled tile arrangement
// ============================================================
//
// Why this exists: in real American Mahjong, physically grouping tiles on
// your rack into the *shape of your target hand* is a core part of how
// players think - you put your FF together, your 2222 together, your pair
// off to one side. Forced auto-sorting fights that: every draw destroys
// the arrangement you just built.
//
// This hook keeps a per-player manual order, applies it to the live hand,
// and folds in newly drawn tiles without disturbing existing placement.
// Auto-sort remains available, but as an explicit action rather than a
// behaviour imposed on every render.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Tile } from '../engine/types';
import { sortTiles } from '../engine/tiles';

/** Where a newly acquired tile lands when the player has a custom order. */
const NEW_TILE_POSITION = 'end' as const;

export interface HandOrderApi {
  /** The hand in display order (custom if set, otherwise engine sort). */
  orderedHand: Tile[];
  /** True when the player has manually rearranged. */
  isCustomOrder: boolean;
  /** Move the tile at `from` to index `to`. */
  moveTile: (from: number, to: number) => void;
  /** Drop the custom order and return to suit/rank sorting. */
  resetOrder: () => void;
}

/**
 * @param hand      the player's live concealed hand
 * @param storageKey persist the arrangement across reloads (optional)
 */
export function useHandOrder(hand: Tile[], storageKey?: string): HandOrderApi {
  // Explicit tile-id order. `null` = follow the engine's automatic sort.
  const [order, setOrder] = useState<number[] | null>(() => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every(n => typeof n === 'number')) {
        return parsed;
      }
    } catch {
      /* ignore corrupt state */
    }
    return null;
  });

  const persist = useCallback(
    (next: number[] | null) => {
      if (!storageKey) return;
      try {
        if (next) localStorage.setItem(storageKey, JSON.stringify(next));
        else localStorage.removeItem(storageKey);
      } catch {
        /* storage full or blocked - arrangement still works in-session */
      }
    },
    [storageKey],
  );

  // Reconcile the saved order against the hand actually held right now.
  // Tiles that left the hand (discarded, melded, passed) drop out; tiles
  // that arrived (drawn, received in the Charleston) are appended so the
  // player's existing grouping is never scrambled by a draw.
  const orderedHand = useMemo(() => {
    if (!order) return sortTiles(hand);

    const byId = new Map(hand.map(t => [t.id, t]));
    const result: Tile[] = [];
    for (const id of order) {
      const tile = byId.get(id);
      if (tile) {
        result.push(tile);
        byId.delete(id);
      }
    }
    // Anything left is new to the hand.
    const incoming = sortTiles([...byId.values()]);
    return NEW_TILE_POSITION === 'end' ? [...result, ...incoming] : [...incoming, ...result];
  }, [hand, order]);

  // Keep the stored order in sync once tiles enter/leave, so the next
  // rearrange starts from what the player can actually see.
  const lastSyncedRef = useRef<string>('');
  useEffect(() => {
    if (!order) return;
    const currentIds = orderedHand.map(t => t.id);
    const signature = currentIds.join(',');
    if (signature === lastSyncedRef.current) return;
    if (signature !== order.join(',')) {
      lastSyncedRef.current = signature;
      setOrder(currentIds);
      persist(currentIds);
    }
  }, [orderedHand, order, persist]);

  const moveTile = useCallback(
    (from: number, to: number) => {
      setOrder(prev => {
        // First manual move promotes the current visual order to explicit.
        const base = prev ?? orderedHand.map(t => t.id);
        if (
          from === to ||
          from < 0 ||
          to < 0 ||
          from >= base.length ||
          to >= base.length
        ) {
          return prev;
        }
        const next = [...base];
        const [moved] = next.splice(from, 1);
        if (moved === undefined) return prev;
        next.splice(to, 0, moved);
        persist(next);
        return next;
      });
    },
    [orderedHand, persist],
  );

  const resetOrder = useCallback(() => {
    setOrder(null);
    persist(null);
  }, [persist]);

  return {
    orderedHand,
    isCustomOrder: order !== null,
    moveTile,
    resetOrder,
  };
}

