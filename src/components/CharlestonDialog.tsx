// ============================================================
// CharlestonDialog — Tile-passing dialog
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { Tile, GamePhase } from '../engine/types';
import { getCharlestonDirection, getCharlestonRound } from '../engine/charleston';
import { TileComponent } from './TileComponent';
import { sortTiles } from '../engine/tiles';

interface CharlestonDialogProps {
  phase: GamePhase;
  hand: Tile[];
  onConfirm: (tiles: Tile[]) => void;
  onSkip?: () => void;
}

export function CharlestonDialog({ phase, hand, onConfirm, onSkip }: CharlestonDialogProps) {
  const [selectedTiles, setSelectedTiles] = useState<Tile[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const direction = getCharlestonDirection(phase);
  const round = getCharlestonRound(phase);

  const handleTileClick = useCallback((tile: Tile) => {
    setSelectedTiles(prev => {
      const idx = prev.findIndex(t => t.id === tile.id);
      if (idx !== -1) {
        return prev.filter(t => t.id !== tile.id);
      }
      if (prev.length >= 3) return prev;
      return [...prev, tile];
    });
  }, []);

  const handleConfirm = () => {
    if (selectedTiles.length === 3) {
      onConfirm(selectedTiles);
      setSelectedTiles([]);
    }
  };

  const isReady = selectedTiles.length === 3;
  const roundLabel = round === 'first' ? 'First' : round === 'second' ? 'Second' : 'Courtesy';

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="charleston-panel">
          <h2>Charleston</h2>
          <div className="charleston-direction">
            Pass {direction} →
          </div>
          <p className="charleston-instruction">
            {roundLabel} Charleston — Select 3 tiles to pass {direction.toLowerCase()}
          </p>

          {/* Selected tiles area */}
          <div className={`charleston-selected ${isReady ? 'ready' : ''}`}>
            {selectedTiles.length === 0 && (
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                Click tiles below to select them
              </span>
            )}
            {selectedTiles.map(tile => (
              <TileComponent
                key={tile.id}
                tile={tile}
                clickable
                onClick={() => handleTileClick(tile)}
                highlighted
                size={isMobile ? 'mini' : 'normal'}
              />
            ))}
          </div>

          {/* Hand */}
          <div style={{
            display: 'flex', gap: '3px', flexWrap: 'wrap',
            justifyContent: 'center', marginBottom: 'var(--space-lg)',
          }}>
            {sortTiles(hand).map(tile => (
              <TileComponent
                key={tile.id}
                tile={tile}
                clickable
                selected={selectedTiles.some(t => t.id === tile.id)}
                onClick={handleTileClick}
                size={isMobile ? 'mini' : 'normal'}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={!isReady}
              id="confirm-charleston-btn"
            >
              Pass Tiles
            </button>
            {round === 'second' && onSkip && (
              <button className="btn btn-secondary" onClick={onSkip} id="skip-charleston-btn">
                Skip 2nd Charleston
              </button>
            )}
            {round === 'courtesy' && onSkip && (
              <button className="btn btn-secondary" onClick={onSkip} id="skip-courtesy-btn">
                Skip Courtesy
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
