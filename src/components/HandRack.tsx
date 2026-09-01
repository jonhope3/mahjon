// ============================================================
// HandRack - the player's tiles, drag-to-rearrange
// ============================================================
//
// Mobile-first interaction model:
//   • Tap                     → select / deselect a tile
//   • Drag (past 8px)         → rearrange the rack
//   • Keyboard ← →            → move selection
//   • Keyboard Shift+← →      → move the *tile* (iPad keyboard / laptop)
//
// Drag state lives in a ref so a quick mouse/touch drag still commits even
// if React hasn't flushed setState yet. Pointer capture is taken on down so
// the gesture survives leaving the original tile.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { Tile } from '../engine/types';
import { TileComponent } from './TileComponent';
import { haptic } from '../haptics';

/** Pointer travel (px) before a press becomes a drag rather than a tap. */
const DRAG_THRESHOLD_PX = 8;

interface HandRackProps {
  tiles: Tile[];
  selectedTile: Tile | null;
  clickable: boolean;
  onTileClick: (tile: Tile) => void;
  onMoveTile: (from: number, to: number) => void;
  size?: 'normal' | 'mini';
  className?: string;
  /** Accessible name for the rack region. */
  label?: string;
}

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  from: number;
  over: number;
  active: boolean;
};

export function HandRack({
  tiles,
  selectedTile,
  clickable,
  onTileClick,
  onMoveTile,
  size = 'normal',
  className = '',
  label = 'Your hand',
}: HandRackProps) {
  const rackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  // Keep keyboard focus in range as the hand grows/shrinks.
  useEffect(() => {
    setFocusIndex(i => Math.min(i, Math.max(0, tiles.length - 1)));
  }, [tiles.length]);

  /** Which tile slot sits under a given viewport x/y. */
  const indexFromPoint = useCallback((clientX: number, clientY: number): number | null => {
    const rack = rackRef.current;
    if (!rack) return null;
    const slots = Array.from(rack.querySelectorAll<HTMLElement>('[data-tile-slot]'));
    if (slots.length === 0) return null;

    let closest: { index: number; distance: number } | null = null;
    for (let i = 0; i < slots.length; i++) {
      const rect = slots[i]!.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top - 40 &&
        clientY <= rect.bottom + 40
      ) {
        return i;
      }
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distance = Math.hypot(clientX - cx, clientY - cy);
      if (!closest || distance < closest.distance) closest = { index: i, distance };
    }
    return closest?.index ?? null;
  }, []);

  const clearDragVisual = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const commitDrag = useCallback(() => {
    const session = dragRef.current;
    dragRef.current = null;
    if (
      session?.active &&
      session.from !== session.over &&
      session.from >= 0 &&
      session.over >= 0
    ) {
      onMoveTile(session.from, session.over);
      haptic('commit');
    }
    clearDragVisual();
  }, [onMoveTile, clearDragVisual]);

  const handlePointerDown = useCallback(
    (index: number) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Mouse: capture immediately. Touch: wait until we know this is a
      // horizontal rearrange so the page can still scroll.
      if (e.pointerType === 'mouse') {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        from: index,
        over: index,
        active: false,
      };
      setFocusIndex(index);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const session = dragRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      if (!session.active) {
        const dx = e.clientX - session.startX;
        const dy = e.clientY - session.startY;
        const travelled = Math.hypot(dx, dy);
        if (travelled < DRAG_THRESHOLD_PX) return;
        // Mostly vertical: let the browser scroll; drop this drag session.
        if (Math.abs(dy) > Math.abs(dx) * 1.15) {
          dragRef.current = null;
          return;
        }
        session.active = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.preventDefault();
        setDragIndex(session.from);
        setOverIndex(session.from);
        haptic('select');
      } else {
        e.preventDefault();
      }

      const target = indexFromPoint(e.clientX, e.clientY);
      if (target !== null && target !== session.over) {
        session.over = target;
        setOverIndex(target);
      }
    },
    [indexFromPoint],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const session = dragRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      const wasDrag = session.active;
      const from = session.from;
      commitDrag();
      if (!wasDrag && clickable) {
        const tile = tiles[from];
        if (tile) onTileClick(tile);
      }
    },
    [commitDrag, clickable, tiles, onTileClick],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const session = dragRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      dragRef.current = null;
      clearDragVisual();
    },
    [clearDragVisual],
  );

  const handleKeyDown = useCallback(
    (index: number) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const last = tiles.length - 1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const next = Math.min(last, Math.max(0, index + delta));

        if (e.shiftKey) {
          if (next !== index) {
            onMoveTile(index, next);
            haptic('commit');
          }
        }
        setFocusIndex(next);
        requestAnimationFrame(() => {
          rackRef.current
            ?.querySelectorAll<HTMLElement>('[data-tile-slot]')
            ?.[next]?.focus();
        });
        return;
      }

      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const next = e.key === 'Home' ? 0 : last;
        setFocusIndex(next);
        requestAnimationFrame(() => {
          rackRef.current
            ?.querySelectorAll<HTMLElement>('[data-tile-slot]')
            ?.[next]?.focus();
        });
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (clickable) {
          const tile = tiles[index];
          if (tile) onTileClick(tile);
        }
      }
    },
    [tiles, onMoveTile, clickable, onTileClick],
  );

  return (
    <div
      ref={rackRef}
      className={`hand-rack ${className} ${dragIndex !== null ? 'is-dragging' : ''}`}
      style={{ '--hand-size': tiles.length } as CSSProperties}
      role="group"
      aria-label={`${label}. Drag tiles to rearrange. Arrow keys move between tiles; shift plus arrow keys rearrange.`}
    >
      {tiles.map((tile, index) => {
        const isDragged = dragIndex === index;
        const isDropTarget = dragIndex !== null && overIndex === index && !isDragged;
        return (
          <div
            key={tile.id}
            data-tile-slot
            className={[
              'hand-rack-slot',
              isDragged ? 'is-dragged' : '',
              isDropTarget ? 'is-drop-target' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onPointerDown={handlePointerDown(index)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onKeyDown={handleKeyDown(index)}
            tabIndex={index === focusIndex ? 0 : -1}
            aria-roledescription="Draggable tile"
          >
            <TileComponent
              tile={tile}
              clickable={false}
              selected={selectedTile?.id === tile.id}
              size={size}
              // Tips still work via hover / long-press; selection is owned by the slot.
              onClick={undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
