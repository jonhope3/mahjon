// ============================================================
// CharlestonDialog — Tile-passing dialog + learning help
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { Tile, GamePhase } from '../engine/types';
import { getCharlestonDirection, getCharlestonRound } from '../engine/charleston';
import { isJoker } from '../engine/tiles';
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
  const [error, setError] = useState<string | null>(null);

  const direction = getCharlestonDirection(phase);
  const round = getCharlestonRound(phase);
  const courtesy = round === 'courtesy';
  const maxPass = 3;

  useEffect(() => {
    if (round === 'first' && shouldShowCharlestonIntro(teachMode)) {
      setShowIntro(true);
    }
  }, [round, teachMode]);

  useEffect(() => {
    setSelectedTiles([]);
    setError(null);
  }, [phase]);

  const handleTileClick = useCallback(
    (tile: Tile) => {
      setError(null);
      if (isJoker(tile)) {
        setError('Jokers stay with you — you can’t pass them in Charleston.');
        return;
      }
      setSelectedTiles(prev => {
        const idx = prev.findIndex(t => t.id === tile.id);
        if (idx !== -1) return prev.filter(t => t.id !== tile.id);
        if (prev.length >= maxPass) return prev;
        return [...prev, tile];
      });
    },
    [maxPass],
  );

  const handleConfirm = () => {
    if (selectedTiles.some(isJoker)) {
      setError('Jokers stay with you — you can’t pass them in Charleston.');
      return;
    }
    if (courtesy) {
      onConfirm(selectedTiles);
      setSelectedTiles([]);
      return;
    }
    if (selectedTiles.length === 3) {
      onConfirm(selectedTiles);
      setSelectedTiles([]);
    }
  };

  const dismissIntro = () => {
    markCharlestonIntroSeen();
    setShowIntro(false);
  };

  const isReady = courtesy ? true : selectedTiles.length === 3;
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
                  jokers — they never leave your hand in Charleston.
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
                  {courtesy
                    ? 'Courtesy: offer 0–3 tiles across. You and the player across pass the smaller number.'
                    : round === 'second'
                      ? 'Optional — pass 3 (no jokers), skip this pass, or skip the rest.'
                      : 'Tap 3 tiles to pass. Jokers cannot be passed.'}
                </p>

                {error && (
                  <p className="charleston-error" role="alert">
                    {error}
                  </p>
                )}

                <div
                  className={`charleston-selected ${isReady && selectedTiles.length > 0 ? 'ready' : ''} charleston-selected-row`}
                >
                  {selectedTiles.length === 0 && (
                    <span className="charleston-placeholder">
                      {courtesy ? 'Offer 0–3 tiles (or pass none)' : 'Select 3 tiles'}
                    </span>
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
                      clickable={!isJoker(tile) || selectedTiles.some(t => t.id === tile.id)}
                      selected={selectedTiles.some(t => t.id === tile.id)}
                      onClick={handleTileClick}
                      size="normal"
                      className={isJoker(tile) ? 'tile-no-pass' : undefined}
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
                    {courtesy
                      ? selectedTiles.length === 0
                        ? 'Pass nothing'
                        : `Offer ${selectedTiles.length} tile${selectedTiles.length === 1 ? '' : 's'}`
                      : `Pass (${selectedTiles.length}/3)`}
                  </button>
                  {round === 'second' && onSkip && (
                    <button className="btn btn-secondary" onClick={onSkip} id="skip-charleston-btn">
                      Skip this pass
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
