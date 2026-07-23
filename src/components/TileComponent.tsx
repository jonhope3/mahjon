// ============================================================
// TileComponent — Renders a single mahjong tile (sea theme)
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tile } from '../engine/types';
import { tileTooltip } from '../engine/tiles';
import {
  DRAGON_FACES,
  DRAGON_MATCHING_SUIT,
  FLOWER_FACE,
  JOKER_FACE,
  SUIT_FACES,
  SUIT_MATCHING_DRAGON,
  WIND_FACES,
  dragonPairIcon,
  suitFace,
  suitPairIcon,
} from '../engine/tile-faces';
import './TileComponent.css';

interface TileComponentProps {
  tile?: Tile;
  faceUp?: boolean;
  size?: 'normal' | 'mini' | 'tiny';
  clickable?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  isLastDiscard?: boolean;
  winning?: boolean;
  onClick?: (tile: Tile) => void;
  className?: string;
  showIdentity?: boolean;
}

const LONG_PRESS_MS = 420;
const TIP_MARGIN = 10;

type TipPlacement = 'above' | 'below';

interface TipPos {
  top: number;
  left: number;
  placement: TipPlacement;
}

function clampTipToViewport(
  tileRect: DOMRect,
  tipWidth: number,
  tipHeight: number,
  prefer: TipPlacement,
): TipPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const safeTop = TIP_MARGIN + (window.visualViewport?.offsetTop ?? 0);
  const safeBottom = (window.visualViewport?.height ?? vh) - TIP_MARGIN;

  let placement: TipPlacement = prefer;
  const spaceAbove = tileRect.top - safeTop;
  const spaceBelow = safeBottom - tileRect.bottom;

  if (prefer === 'above' && spaceAbove < tipHeight + 8 && spaceBelow > spaceAbove) {
    placement = 'below';
  } else if (prefer === 'below' && spaceBelow < tipHeight + 8 && spaceAbove > spaceBelow) {
    placement = 'above';
  }

  let top =
    placement === 'above'
      ? tileRect.top - 8
      : tileRect.bottom + 8;

  // `above` uses translateY(-100%), so `top` is the tip's bottom edge
  if (placement === 'above') {
    if (top - tipHeight < safeTop) {
      if (spaceBelow >= tipHeight + 8) {
        placement = 'below';
        top = tileRect.bottom + 8;
      } else {
        top = safeTop + tipHeight;
      }
    }
  }

  if (placement === 'below') {
    if (top + tipHeight > safeBottom) {
      if (spaceAbove >= tipHeight + 8) {
        placement = 'above';
        top = Math.max(safeTop + tipHeight, tileRect.top - 8);
      } else {
        top = Math.max(safeTop, safeBottom - tipHeight);
      }
    }
  }

  let left = tileRect.left + tileRect.width / 2;
  const half = tipWidth / 2;
  left = Math.min(vw - TIP_MARGIN - half, Math.max(TIP_MARGIN + half, left));

  return { top, left, placement };
}

export function TileComponent({
  tile,
  faceUp = true,
  size = 'normal',
  clickable = false,
  selected = false,
  highlighted = false,
  isLastDiscard = false,
  winning = false,
  onClick,
  className = '',
  showIdentity = true,
}: TileComponentProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [tipVisible, setTipVisible] = useState(false);
  const [tipPos, setTipPos] = useState<TipPos | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const tipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const identity = tile && faceUp ? tileTooltip(tile.kind) : '';
  const canShowTip = showIdentity && !!identity;

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const hideTipSoon = useCallback(() => {
    if (tipHideTimer.current) clearTimeout(tipHideTimer.current);
    tipHideTimer.current = setTimeout(() => setTipVisible(false), 1600);
  }, []);

  const updateTipPos = useCallback((measured?: { w: number; h: number }) => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tipW = measured?.w ?? Math.min(260, window.innerWidth * 0.82);
    const tipH = measured?.h ?? 48;
    setTipPos(clampTipToViewport(rect, tipW, tipH, 'above'));
  }, []);

  useLayoutEffect(() => {
    if (!tipVisible || !tipRef.current || !rootRef.current) return;
    const tipRect = tipRef.current.getBoundingClientRect();
    const tileRect = rootRef.current.getBoundingClientRect();
    const next = clampTipToViewport(tileRect, tipRect.width, tipRect.height, tipPos?.placement ?? 'above');
    setTipPos(prev => {
      if (
        prev &&
        Math.abs(prev.left - next.left) < 1 &&
        Math.abs(prev.top - next.top) < 1 &&
        prev.placement === next.placement
      ) {
        return prev;
      }
      return next;
    });
  }, [tipVisible, tipPos?.placement, identity]);

  useEffect(() => {
    if (!tipVisible) return;
    const onScroll = () => {
      const tipEl = tipRef.current;
      if (tipEl) {
        const r = tipEl.getBoundingClientRect();
        updateTipPos({ w: r.width, h: r.height });
      } else {
        updateTipPos();
      }
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    window.visualViewport?.addEventListener('resize', onScroll);
    window.visualViewport?.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.visualViewport?.removeEventListener('resize', onScroll);
      window.visualViewport?.removeEventListener('scroll', onScroll);
    };
  }, [tipVisible, updateTipPos]);

  const showTip = useCallback(() => {
    updateTipPos();
    setTipVisible(true);
  }, [updateTipPos]);

  useEffect(() => {
    return () => {
      clearLongPress();
      if (tipHideTimer.current) clearTimeout(tipHideTimer.current);
    };
  }, [clearLongPress]);

  const sizeClass = size === 'mini' ? 'mini' : size === 'tiny' ? 'tiny' : '';
  const classes = [
    'tile',
    faceUp && tile ? 'face-up' : 'face-down',
    sizeClass,
    clickable ? 'clickable' : '',
    selected ? 'selected' : '',
    highlighted ? 'highlighted' : '',
    isLastDiscard ? 'last-discard' : '',
    winning ? 'winning' : '',
    tipVisible ? 'tip-open' : '',
    className,
  ].filter(Boolean).join(' ');

  const handleClick = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (clickable && tile && onClick) {
      onClick(tile);
    }
  };

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (!canShowTip) return;
    if (e.pointerType === 'mouse') {
      showTip();
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      setTipVisible(false);
    }
    clearLongPress();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canShowTip) return;
    if (e.pointerType === 'mouse') return;
    longPressFired.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      showTip();
      hideTipSoon();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(12);
        } catch {
          /* ignore */
        }
      }
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    clearLongPress();
  };

  if (!tile || !faceUp) {
    return <div ref={rootRef} className={classes} />;
  }

  const tip =
    canShowTip && tipVisible && tipPos
      ? createPortal(
          <span
            ref={tipRef}
            className={`tile-identity-tip tile-identity-tip--portal tip-${tipPos.placement}`}
            role="tooltip"
            style={{ top: tipPos.top, left: tipPos.left }}
          >
            {identity}
          </span>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={rootRef}
        className={classes}
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick();
                }
              }
            : undefined
        }
        aria-label={identity}
        aria-pressed={clickable ? !!selected : undefined}
        role={clickable ? 'button' : 'img'}
        tabIndex={clickable ? 0 : undefined}
      >
        {renderTileFace(tile, size)}
      </div>
      {tip}
    </>
  );
}

function renderTileFace(tile: Tile, size: string) {
  const kind = tile.kind;
  const showCaption = size !== 'tiny';

  switch (kind.type) {
    case 'suited':
      return renderSuitedTile(kind.suit, kind.rank, showCaption, size);
    case 'wind': {
      const w = WIND_FACES[kind.wind];
      return (
        <>
          <span className="tile-emoji wind">{w.icon}</span>
          {showCaption && (
            <span className="tile-suit-label wind">{w.label}</span>
          )}
        </>
      );
    }
    case 'dragon': {
      const d = DRAGON_FACES[kind.dragon];
      const pairSuit = SUIT_FACES[DRAGON_MATCHING_SUIT[kind.dragon]];
      return (
        <>
          {size !== 'tiny' && (
            <span
              className={`tile-pair-badge tile-pair-badge--dragon ${pairSuit.cls}`}
              title={`Matches ${pairSuit.name}`}
              aria-hidden="true"
            >
              {dragonPairIcon(kind.dragon)}
            </span>
          )}
          <span className={`tile-emoji ${d.cls}`}>{d.icon}</span>
          {showCaption && (
            <span className={`tile-suit-label ${d.cls}`}>{d.label}</span>
          )}
        </>
      );
    }
    case 'flower':
      return (
        <>
          <span className="tile-emoji flower" aria-hidden="true">
            {FLOWER_FACE.icon}
          </span>
          {showCaption && (
            <span className="tile-suit-label anemone">{FLOWER_FACE.label}</span>
          )}
        </>
      );
    case 'joker':
      return (
        <>
          <span className="tile-emoji joker" aria-hidden="true">
            {JOKER_FACE.icon}
          </span>
          {showCaption && (
            <span className="tile-suit-label joker">{JOKER_FACE.label}</span>
          )}
        </>
      );
  }
}

function renderSuitedTile(suit: string, rank: number, showCaption: boolean, size: string) {
  const face = suitFace(suit as 'crak' | 'bam' | 'dot');
  const pairDragon = DRAGON_FACES[SUIT_MATCHING_DRAGON[suit as 'crak' | 'bam' | 'dot']];
  return (
    <>
      {size !== 'tiny' && (
        <span
          className={`tile-pair-badge tile-pair-badge--suit ${pairDragon.cls}`}
          title={`Matches ${pairDragon.label} Dragon`}
          aria-hidden="true"
        >
          {suitPairIcon(suit as 'crak' | 'bam' | 'dot')}
        </span>
      )}
      <span className={`tile-rank ${face.cls}`}>{rank}</span>
      <span className={`tile-emoji tile-emoji--suit ${face.cls}`} aria-hidden="true">
        {face.icon}
      </span>
      {showCaption && (
        <span className={`tile-suit-label ${face.cls}`}>{face.name}</span>
      )}
    </>
  );
}
