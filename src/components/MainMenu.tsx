// ============================================================
// MainMenu — Landing screen with game setup
// ============================================================

import { useState } from 'react';
import { PlayerType, Difficulty } from '../engine/types';
import { GameConfig } from '../engine/game';

interface MainMenuProps {
  onStartGame: (config: GameConfig) => void;
  onPlayMultiplayer: () => void;
  onStartTutorial: () => void;
}

interface PlayerSetup {
  name: string;
  type: PlayerType;
  difficulty: Difficulty;
}

const DEFAULT_PLAYERS: PlayerSetup[] = [
  { name: 'You', type: 'human', difficulty: 'medium' },
  { name: 'Bot Alice', type: 'ai', difficulty: 'medium' },
  { name: 'Bot Bob', type: 'ai', difficulty: 'medium' },
  { name: 'Bot Carol', type: 'ai', difficulty: 'medium' },
];

const SEAT_LABELS = ['East', 'South', 'West', 'North'];

export function MainMenu({ onStartGame, onPlayMultiplayer, onStartTutorial }: MainMenuProps) {
  const [players, setPlayers] = useState<PlayerSetup[]>(DEFAULT_PLAYERS);
  const [showSetup, setShowSetup] = useState(false);

  const updatePlayer = (index: number, updates: Partial<PlayerSetup>) => {
    setPlayers(prev => prev.map((p, i) => i === index ? { ...p, ...updates } : p));
  };

  const handleStart = () => {
    onStartGame({
      players: players.map(p => ({
        name: p.name,
        type: p.type,
        difficulty: p.type === 'ai' ? p.difficulty : undefined,
      })),
    });
  };

  const handleQuickStart = () => {
    onStartGame({ players: DEFAULT_PLAYERS });
  };

  return (
    <div className="main-menu">
      {/* Decorative elements */}
      <div className="deco-tiles left">🐚</div>
      <div className="deco-tiles right">🌊</div>

      <div className="menu-logo">
        <h1>Mahjon</h1>
        <p className="subtitle">American Mahjong • 2026</p>
      </div>

      {!showSetup ? (
        <div className="menu-card">
          <h2>Play Mahjong</h2>
          <div className="menu-actions">
            <button className="btn btn-primary" onClick={handleQuickStart} id="quick-start-btn">
              <span className="btn-icon">🐚</span>
              Quick Start vs AI
            </button>
            <button className="btn btn-secondary" onClick={() => setShowSetup(true)} id="custom-game-btn">
              <span className="btn-icon">⚙️</span>
              Custom Game
            </button>
            <button className="btn btn-secondary" onClick={onPlayMultiplayer} id="multiplayer-btn">
              <span className="btn-icon">🌐</span>
              Online Multiplayer
            </button>
            <button className="btn btn-secondary" onClick={onStartTutorial} id="tutorial-btn">
              <span className="btn-icon">📖</span>
              How to Play (Tutorial)
            </button>
          </div>
          <p style={{
            marginTop: 'var(--space-lg)',
            textAlign: 'center',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
          }}>
            2026 NMJL Hand Card • Play with friends or AI
          </p>
        </div>
      ) : (
        <div className="menu-card">
          <h2>Game Setup</h2>
          <div className="game-setup">
            {players.map((player, i) => (
              <div key={i} className="setup-player">
                <span className="seat-label">{SEAT_LABELS[i]}</span>
                <input
                  type="text"
                  value={player.name}
                  onChange={e => updatePlayer(i, { name: e.target.value })}
                  placeholder="Player name"
                  id={`player-name-${i}`}
                />
                <select
                  value={player.type}
                  onChange={e => updatePlayer(i, { type: e.target.value as PlayerType })}
                  id={`player-type-${i}`}
                >
                  <option value="human">Human</option>
                  <option value="ai">AI</option>
                </select>
                {player.type === 'ai' && (
                  <select
                    value={player.difficulty}
                    onChange={e => updatePlayer(i, { difficulty: e.target.value as Difficulty })}
                    id={`player-difficulty-${i}`}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
              <button className="btn btn-primary" onClick={handleStart} style={{ flex: 1 }} id="start-game-btn">
                Start Game
              </button>
              <button className="btn btn-secondary" onClick={() => setShowSetup(false)} id="back-btn">
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
