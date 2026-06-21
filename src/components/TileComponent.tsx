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

/** Emojis for Shell suit (ranks 1-9) */
const SHELL_EMOJIS: Record<number, string> = {
  1: '🐚', // Conch Shell
  2: '🦪', // Oyster
  3: '🪸', // Coral
  4: '🦀', // Crab
  5: '🐡', // Pufferfish
  6: '🐙', // Octopus
  7: '🐬', // Dolphin
  8: '🐳', // Whale
  9: '🦈', // Shark
};

/** Wind display labels */
const WIND_LABELS: Record<string, string> = {
  east: 'EAST', south: 'SOUTH', west: 'WEST', north: 'NORTH',
};

/** Dragon display configuration */
const DRAGON_DISPLAY: Record<string, { char: string; label: string; cls: string }> = {
  red: { char: '🪸', label: 'Coral', cls: 'dragon-red' },
  green: { char: '🌊', label: 'Wave', cls: 'dragon-green' },
  white: { char: '🦪', label: 'Pearl', cls: 'dragon-white' },
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
            <span className="tile-suit-label wind">🧭 {WIND_LABELS[kind.wind]}</span>
          )}
        </>
      );
    case 'dragon': {
      const d = DRAGON_DISPLAY[kind.dragon]!;
      return (
        <>
          <span className={`tile-emoji ${d.cls}`} style={{ fontSize: size === 'normal' ? '24px' : '16px' }}>{d.char}</span>
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
          <span className="tile-emoji flower" style={{ fontSize: size === 'normal' ? '22px' : '16px' }}>🪸</span>
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
          <span className="tile-emoji">{SHELL_EMOJIS[rank]}</span>
          {size === 'normal' && (
            <span className="tile-suit-label crak">{rank}</span>
          )}
        </>
      );
    case 'dot':
      return (
        <>
          <span className={`tile-rank dot`}>{rank}</span>
          {renderDots(rank, size)}
        </>
      );
    case 'bam':
      return (
        <>
          <span className="tile-emoji">🌿</span>
          {size === 'normal' && (
            <span className="tile-suit-label bam">{rank}</span>
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
