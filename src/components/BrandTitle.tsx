// ============================================================
// BrandTitle — "Mahjon" mark; long-press / right-click hard refresh
// ============================================================

import { useCallback, useEffect, useRef } from 'react';
import { useFreshReload } from '../hooks/useFreshReload';

const LONG_PRESS_MS = 520;

interface BrandTitleProps {
  /** Visual size — hero for menus, compact for in-game chrome */
  variant?: 'hero' | 'compact';
  className?: string;
  as?: 'h1' | 'span';
}

/**
 * Looks like static branding. Long-press (touch) or right-click (desktop)
 * wipes the offline cache and reloads — same as Settings → Hard refresh.
 */
export function BrandTitle({
  variant = 'hero',
  className = '',
  as: Tag = 'h1',
}: BrandTitleProps) {
  const { busy, clearCacheAndReload } = useFreshReload();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const triggerRefresh = useCallback(() => {
    if (busy) return;
    clearTimer();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(14);
      } catch {
        /* ignore */
      }
    }
    void clearCacheAndReload();
  }, [busy, clearCacheAndReload, clearTimer]);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    triggerRefresh();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (busy || e.button !== 0) return;
    // Mouse right-click is handled via contextmenu; only arm long-press for touch/pen
    if (e.pointerType === 'mouse') return;
    armedRef.current = true;
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (armedRef.current) triggerRefresh();
    }, LONG_PRESS_MS);
  };

  const onPointerEnd = () => {
    armedRef.current = false;
    clearTimer();
  };

  const classes = [
    'brand-title',
    `brand-title--${variant}`,
    busy ? 'is-refreshing' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes}>
      <button
        type="button"
        className="brand-title__btn"
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
        disabled={busy}
        aria-busy={busy}
        aria-label="Mahjon. Long-press or right-click to hard refresh."
        title="Long-press or right-click to hard refresh"
      >
        Mahjon
      </button>
    </Tag>
  );
}
