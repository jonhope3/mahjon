// ============================================================
// MainMenu — Landing screen with game setup
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { PlayerType, Difficulty } from '../engine/types';
import { GameConfig } from '../engine/game';
import {
  AppPrefs,
  DIFFICULTY_HINT,
  DIFFICULTY_LABEL,
  prefsToGamePlayers,
  sharedBotDifficulty,
  withBotsDifficulty,
} from '../game-settings';
import { useFreshReload } from '../hooks/useFreshReload';
import { InstallNudge } from './InstallNudge';
import { BusyDots } from './BusyDots';

interface MainMenuProps {
  onStartGame: (config: GameConfig) => void;
  onPlayMultiplayer: () => void;
  onStartTutorial: () => void;
  onOpenSettings: () => void;
  prefs: AppPrefs;
  onPrefsChange: (prefs: AppPrefs) => void;
}

interface PlayerSetup {
  name: string;
  type: PlayerType;
  difficulty: Difficulty;
}

function prefsToSetup(prefs: AppPrefs): PlayerSetup[] {
  return prefsToGamePlayers(prefs).map(p => ({
    name: p.name,
    type: p.type,
    difficulty: 'difficulty' in p && p.difficulty ? p.difficulty : 'medium',
  }));
}

const SEAT_LABELS = ['East', 'South', 'West', 'North'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const PULL_THRESHOLD = 72;

export function MainMenu({
  onStartGame,
  onPlayMultiplayer,
  onStartTutorial,
  onOpenSettings,
  prefs,
  onPrefsChange,
}: MainMenuProps) {
  const [players, setPlayers] = useState<PlayerSetup[]>(() => prefsToSetup(prefs));
  const [showSetup, setShowSetup] = useState(false);
  const [pullY, setPullY] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const { busy, clearCacheAndReload } = useFreshReload();

  const aiDifficulty = sharedBotDifficulty(prefs);

  useEffect(() => {
    if (!showSetup) setPlayers(prefsToSetup(prefs));
  }, [prefs, showSetup]);

  // PWA-friendly pull-to-refresh → clear cache & reload
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    let pulling = false;

    const onStart = (e: TouchEvent) => {
      if (busy) return;
      const scrollTop = el.scrollTop || window.scrollY;
      if (scrollTop > 2) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
      pulling = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!pulling || startY.current == null || busy) return;
      const delta = Math.max(0, (e.touches[0]?.clientY ?? 0) - startY.current);
      if (delta > 8) {
        if (e.cancelable) e.preventDefault();
        setPullY(Math.min(delta * 0.55, 120));
      }
    };

    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      startY.current = null;
      setPullY(prev => {
        if (prev >= PULL_THRESHOLD) void clearCacheAndReload();
        return 0;
      });
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [busy, clearCacheAndReload]);

  const updatePlayer = (index: number, updates: Partial<PlayerSetup>) => {
    setPlayers(prev => prev.map((p, i) => (i === index ? { ...p, ...updates } : p)));
  };

  const setAiDifficulty = (difficulty: Difficulty) => {
    onPrefsChange(withBotsDifficulty(prefs, difficulty));
  };

  const pullReady = pullY >= PULL_THRESHOLD;

  return (
    <div className="main-menu" ref={menuRef}>
      <div
        className={`menu-pull-refresh${pullReady ? ' is-ready' : ''}${busy ? ' is-refreshing' : ''}`}
        style={{ height: busy ? 56 : pullY }}
        aria-hidden={!pullY && !busy}
      >
        <span>
          {busy
            ? (
              <>
                Refreshing
                <BusyDots />
              </>
            )
            : pullReady
              ? 'Release to clear cache & reload'
              : 'Pull to refresh'}
        </span>
      </div>

      <button
        type="button"
        className="menu-settings-btn"
        onClick={onOpenSettings}
        aria-label="Settings"
      >
        ⚙
      </button>

      <div className="deco-tiles left" aria-hidden="true">
        🐚
      </div>
      <div className="deco-tiles right" aria-hidden="true">
        🌊
      </div>

      <div className="menu-logo">
        <h1>Mahjon</h1>
        <p className="subtitle">American Mahjong • 2026</p>
      </div>

      {!showSetup ? (
        <div className="menu-card">
          <h2 className="menu-card-heading">Play Mahjong</h2>

          <div className="difficulty-picker" role="group" aria-label="AI difficulty">
            <div className="difficulty-picker-label">AI difficulty</div>
            <div className="difficulty-chips">
              {DIFFICULTIES.map(level => (
                <button
                  key={level}
                  type="button"
                  className={`difficulty-chip${aiDifficulty === level ? ' is-active' : ''}`}
                  aria-pressed={aiDifficulty === level}
                  onClick={() => setAiDifficulty(level)}
                >
                  {DIFFICULTY_LABEL[level]}
                </button>
              ))}
            </div>
            <p className="difficulty-hint">{DIFFICULTY_HINT[aiDifficulty]}</p>
          </div>

          <div className="menu-actions">
            <button
              className="btn btn-primary"
              onClick={() => onStartGame({ players: prefsToGamePlayers(prefs) })}
              id="quick-start-btn"
            >
              Quick Start vs AI
              <span className="btn-sublabel">
                {DIFFICULTY_LABEL[aiDifficulty]} · best way to learn
              </span>
            </button>
            <button className="btn btn-secondary" onClick={onStartTutorial} id="tutorial-btn">
              How to Play
              <span className="btn-sublabel">New to Mahjong? Start here</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowSetup(true)}
              id="custom-game-btn"
            >
              Custom Game
              <span className="btn-sublabel">Per-seat names & levels</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={onPlayMultiplayer}
              id="multiplayer-btn"
            >
              Play with Group
              <span className="btn-sublabel">2–4 people online</span>
            </button>
          </div>
          <p className="menu-footnote">
            American Mahjong is always 4 seats. New? Open How to Play, then practice with Quick Start.
            When friends are ready, Play with Group (2–4 people; AI fills empty seats).
          </p>
          <InstallNudge />
          <p className="menu-refresh-hint">Pull down to hard refresh</p>
        </div>
      ) : (
        <div className="menu-card menu-card--setup">
          <h2>Game Setup</h2>
          <div className="game-setup">
            {players.map((player, i) => (
              <div key={i} className="setup-player">
                <label className="seat-label" htmlFor={`player-name-${i}`}>
                  {SEAT_LABELS[i]}
                </label>
                <input
                  type="text"
                  value={player.name}
                  onChange={e => updatePlayer(i, { name: e.target.value })}
                  placeholder="Player name"
                  id={`player-name-${i}`}
                  autoComplete="off"
                  aria-label={`${SEAT_LABELS[i]} name`}
                />
                <select
                  value={player.type}
                  onChange={e => {
                    if (i === 0) return;
                    updatePlayer(i, { type: e.target.value as PlayerType });
                  }}
                  id={`player-type-${i}`}
                  disabled={i === 0}
                  aria-label={`${SEAT_LABELS[i]} player type`}
                >
                  {i === 0 ? (
                    <option value="human">You</option>
                  ) : (
                    <option value="ai">AI</option>
                  )}
                </select>
                {player.type === 'ai' && (
                  <div
                    className="difficulty-chips difficulty-chips--compact"
                    role="group"
                    aria-label={`${SEAT_LABELS[i]} AI difficulty`}
                  >
                    {DIFFICULTIES.map(level => (
                      <button
                        key={level}
                        type="button"
                        className={`difficulty-chip${
                          player.difficulty === level ? ' is-active' : ''
                        }`}
                        aria-pressed={player.difficulty === level}
                        onClick={() => updatePlayer(i, { difficulty: level })}
                      >
                        {DIFFICULTY_LABEL[level]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="setup-actions">
              <button
                className="btn btn-primary"
                onClick={() =>
                  onStartGame({
                    players: players.map(p => ({
                      name: p.name,
                      type: p.type,
                      difficulty: p.type === 'ai' ? p.difficulty : undefined,
                    })),
                  })
                }
                id="start-game-btn"
              >
                Start Game
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowSetup(false)}
                id="back-btn"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
