// ============================================================
// CharlestonDialog — Tile-passing dialog + learning help
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { Tile, GamePhase } from '../engine/types';
import { getCharlestonDirection, getCharlestonRound } from '../engine/charleston';
import { TileComponent } from './TileComponent';
import { sortTiles } from '../engine/tiles';
import { HandCardModal } from './HandCardModal';
import { HelpPanel, CHARLESTON_HELP } from './HelpPanel';
import type { TeachMode } from '../game-settings';
import {
  markCharlestonIntroSeen,
  shouldShowCharlestonIntro,
  showTurnCoaching,
} from '../teach';

interface CharlestonDialogProps {
  phase: GamePhase;
  hand: Tile[];
  onConfirm: (tiles: Tile[]) => void;
  onSkip?: () => void;
  /** Jump past remaining optional Charleston (2nd + courtesy) into play */
  onSkipRest?: () => void;
  teachMode?: TeachMode;
  /** When true, show waiting state after you've already passed */
  waitingForOthers?: boolean;
}

export function CharlestonDialog({
  phase,
  hand,
  onConfirm,
  onSkip,
  onSkipRest,
  teachMode = 'guided',
  waitingForOthers = false,
}: CharlestonDialogProps) {
  const [selectedTiles, setSelectedTiles] = useState<Tile[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showHandCard, setShowHandCard] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  const direction = getCharlestonDirection(phase);
  const round = getCharlestonRound(phase);

  useEffect(() => {
    if (round === 'first' && shouldShowCharlestonIntro(teachMode)) {
      setShowIntro(true);
    }
  }, [round, teachMode]);

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

  const dismissIntro = () => {
    markCharlestonIntroSeen();
    setShowIntro(false);
  };

  const isReady = selectedTiles.length === 3;
  const roundLabel = round === 'first' ? 'First' : round === 'second' ? 'Second' : 'Courtesy';
  const help = CHARLESTON_HELP[round ?? 'first'];
  const canSkipRest = round === 'second' || round === 'courtesy';

  return (
    <>
      <div className="modal-overlay charleston-overlay" role="presentation">
        <div
          className="modal-content charleston-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="charleston-title"
          tabIndex={-1}
          ref={panel => {
            if (panel && document.activeElement === document.body) {
              panel.focus();
            }
          }}
        >
          <div className="charleston-panel">
            <header className="charleston-header">
              <p className="charleston-kicker">{roundLabel} Charleston</p>
              <h2 className="charleston-title" id="charleston-title">
                Pass {direction}
              </h2>
            </header>

            {showIntro && showTurnCoaching(teachMode) ? (
              <div className="charleston-intro">
                <p>
                  Pass <strong>3 tiles</strong> you don’t need — right, across, then left. Keep
                  jokers.
                </p>
                <p className="charleston-hint">
                  Tap tiles to select them. Long-press any tile to see what it is.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={dismissIntro}
                  id="charleston-intro-got-it"
                >
                  Got it — pick tiles
                </button>
              </div>
            ) : waitingForOthers ? (
              <p className="charleston-waiting" role="status">
                Tiles sent — waiting for the other players…
              </p>
            ) : (
              <>
                <p className="charleston-hint">
                  {round === 'courtesy'
                    ? 'Optional — pass 3 across, or skip.'
                    : round === 'second'
                      ? 'Optional — pass, skip this pass, or skip the rest.'
                      : 'Tap 3 tiles to pass. Long-press a tile to identify it.'}
                </p>

                <div className={`charleston-selected ${isReady ? 'ready' : ''} charleston-selected-row`}>
                  {selectedTiles.length === 0 && (
                    <span className="charleston-placeholder">Select 3 tiles</span>
                  )}
                  {selectedTiles.map(tile => (
                    <TileComponent
                      key={tile.id}
                      tile={tile}
                      clickable
                      onClick={() => handleTileClick(tile)}
                      highlighted
                      size="normal"
                    />
                  ))}
                </div>

                <div
                  className="charleston-hand-row"
                  style={{ '--hand-size': hand.length } as React.CSSProperties}
                >
                  {sortTiles(hand).map(tile => (
                    <TileComponent
                      key={tile.id}
                      tile={tile}
                      clickable
                      selected={selectedTiles.some(t => t.id === tile.id)}
                      onClick={handleTileClick}
                      size="normal"
                    />
                  ))}
                </div>

                <div className="charleston-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleConfirm}
                    disabled={!isReady}
                    id="confirm-charleston-btn"
                  >
                    Pass ({selectedTiles.length}/3)
                  </button>
                  {round === 'second' && onSkip && (
                    <button className="btn btn-secondary" onClick={onSkip} id="skip-charleston-btn">
                      Skip this pass
                    </button>
                  )}
                  {round === 'courtesy' && onSkip && (
                    <button className="btn btn-secondary" onClick={onSkip} id="skip-courtesy-btn">
                      Skip courtesy
                    </button>
                  )}
                  {canSkipRest && onSkipRest && (
                    <button
                      className="btn btn-secondary"
                      onClick={onSkipRest}
                      id="skip-rest-charleston-btn"
                    >
                      Skip rest → play
                    </button>
                  )}
                </div>

                <div className="charleston-links">
                  <button type="button" className="linkish" onClick={() => setShowHandCard(true)}>
                    Hand card
                  </button>
                  <span className="charleston-links-sep" aria-hidden>
                    ·
                  </span>
                  <button type="button" className="linkish" onClick={() => setShowHelp(true)}>
                    Help
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showHelp && (
        <HelpPanel title={help.title} onClose={() => setShowHelp(false)}>
          {help.body}
        </HelpPanel>
      )}
      {showHandCard && <HandCardModal onClose={() => setShowHandCard(false)} />}
    </>
  );
}
