// ============================================================
// TileComponent — Renders a single mahjong tile
// ============================================================

import { Tile } from '../engine/types';
import './TileComponent.css';

interface TileComponentProps {
  tile?: Tile;               // undefined = face-down
  faceUp?: boolean;
  size?: 'normal' | 'mini' | 'tiny';
  clickable?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  isLastDiscard?: boolean;
  winning?: boolean;
  onClick?: (tile: Tile) => void;
  className?: string;
}

/** Wind display labels */
const WIND_LABELS: Record<string, string> = {
  east: 'EAST', south: 'SOUTH', west: 'WEST', north: 'NORTH',
};

/** Dragon display configuration */
const DRAGON_DISPLAY: Record<string, { char: string; label: string; cls: string }> = {
  red: { char: 'C', label: 'Coral', cls: 'dragon-red' },
  green: { char: 'W', label: 'Wave', cls: 'dragon-green' },
  white: { char: 'P', label: 'Pearl', cls: 'dragon-white' },
};

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
}: TileComponentProps) {
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
    className,
  ].filter(Boolean).join(' ');

  const handleClick = () => {
    if (clickable && tile && onClick) {
      onClick(tile);
    }
  };

  if (!tile || !faceUp) {
    return <div className={classes} />;
  }

  return (
    <div className={classes} onClick={handleClick} title={tile.label}>
      {renderTileFace(tile, size)}
    </div>
  );
}

function renderTileFace(tile: Tile, size: string) {
  const kind = tile.kind;

  switch (kind.type) {
    case 'suited':
      return renderSuitedTile(kind.suit, kind.rank, size);
    case 'wind':
      return (
        <>
          <span className="tile-rank wind">{kind.wind[0]?.toUpperCase()}</span>
          {size === 'normal' && (
            <span className="tile-suit-label wind">{WIND_LABELS[kind.wind]}</span>
          )}
        </>
      );
    case 'dragon': {
      const d = DRAGON_DISPLAY[kind.dragon]!;
      return (
        <>
          <span className={`tile-rank dragon ${d.cls}`}>{d.char}</span>
          {size === 'normal' && (
            <span className={`tile-suit-label ${d.cls}`}>
              {d.label}
            </span>
          )}
        </>
      );
    }
    case 'flower':
      return (
        <>
          <span className="tile-rank flower">A</span>
          {size === 'normal' && (
            <span className="tile-suit-label anemone" style={{ color: '#d81b60' }}>Anemone</span>
          )}
        </>
      );
    case 'joker':
      return (
        <>
          <span className="tile-rank joker">JOKER</span>
        </>
      );
  }
}

function renderSuitedTile(suit: string, rank: number, size: string) {
  switch (suit) {
    case 'crak':
      return (
        <>
          <span className="tile-rank crak">{rank}</span>
          {size === 'normal' && (
            <span className="tile-suit-label crak">SHELL</span>
          )}
        </>
      );
    case 'dot':
      return (
        <>
          <span className={`tile-rank dot`}>{rank}</span>
          {renderDots(rank, size)}
          {size === 'normal' && (
            <span className="tile-suit-label dot">PEARL</span>
          )}
        </>
      );
    case 'bam':
      return (
        <>
          <span className="tile-rank bam">{rank}</span>
          {size === 'normal' && (
            <span className="tile-suit-label bam">KELP</span>
          )}
        </>
      );
    default:
      return <span className="tile-rank">{rank}</span>;
  }
}

function renderDots(count: number, size: string) {
  if (size === 'tiny') return null;
  const dotCount = Math.min(count, 4); // Show up to 4 visual dots
  return (
    <div className="dot-grid" style={{
      gridTemplateColumns: `repeat(${Math.min(dotCount, 3)}, 1fr)`,
    }}>
      {Array.from({ length: dotCount }, (_, i) => (
        <div key={i} className="dot-circle" />
      ))}
    </div>
  );
}
