// ============================================================
// RoundEndOverlay — scores + next round / menu + teach link
// ============================================================

import type { GameState } from '../engine/types';
import { BusyDots } from './BusyDots';

interface RoundEndOverlayProps {
  state: GameState;
  onNewRound: () => void;
  onQuitToMenu: () => void;
  onOpenHandCard?: () => void;
  /** False for MP clients waiting on the host */
  canStartNextRound?: boolean;
}

export function RoundEndOverlay({
  state,
  onNewRound,
  onQuitToMenu,
  onOpenHandCard,
  canStartNextRound = true,
}: RoundEndOverlayProps) {
  const winner = state.winner
    ? state.players.find(p => p.id === state.winner)?.name
    : null;

  return (
    <div className="round-end-overlay" role="presentation">
      <div
        className="round-end-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="round-end-title"
        tabIndex={-1}
      >
        <h2 id="round-end-title">{winner ? `${winner} Wins!` : 'Draw Game'}</h2>
        {state.winningHand && (
          <p className="winning-pattern">
            {state.winningHand.description}
            <br />
            <span className="winning-pattern-meta">
              {state.winningHand.category} • {state.winningHand.value} points
              {state.winningHand.concealed ? ' • Concealed' : ' • Exposed OK'}
            </span>
          </p>
        )}
        {state.winningHand && onOpenHandCard && (
          <p className="round-end-teach">
            That pattern is on the Hand Card
            {state.winningHand.concealed
              ? ' (concealed hands cannot expose sets along the way).'
              : '.'}{' '}
            <button type="button" className="linkish" onClick={onOpenHandCard}>
              Open Hand Card
            </button>
          </p>
        )}
        <div className="scoreboard">
          {state.players.map((p, i) => (
            <div key={i} className={`score-card${p.id === state.winner ? ' winner' : ''}`}>
              <div className="player-name">{p.name}</div>
              <div className="score-value">{p.score}</div>
            </div>
          ))}
        </div>
        <p className="round-end-meta">Round {state.roundNumber}</p>
        <div className="round-end-actions">
          {canStartNextRound ? (
            <button type="button" className="btn btn-primary" onClick={onNewRound}>
              New Round
            </button>
          ) : (
            <p className="lobby-waiting">
              Waiting for host to start the next round
              <BusyDots />
            </p>
          )}
          <button type="button" className="btn btn-secondary" onClick={onQuitToMenu}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
