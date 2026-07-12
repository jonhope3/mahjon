// ============================================================
// LobbyScreen — Multiplayer lobby for creating/joining rooms
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { PeerManager, ConnectionStatus } from '../network/peer-manager';
import { LobbyState, LobbySlot } from '../network/protocol';
import { GameConfig } from '../engine/game';

interface LobbyScreenProps {
  peerManager: PeerManager;
  onStartGame: (config: GameConfig) => void;
  onBack: () => void;
  onOpenSettings: () => void;
  defaultName?: string;
}

const SEATS = ['East', 'South', 'West', 'North'] as const;

export function LobbyScreen({
  peerManager,
  onStartGame,
  onBack,
  onOpenSettings,
  defaultName = 'Player',
}: LobbyScreenProps) {
  const [mode, setMode] = useState<'choose' | 'host' | 'join'>('choose');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [playerName, setPlayerName] = useState(defaultName);
  const [roomCode, setRoomCode] = useState('');
  const [resumeKey, setResumeKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlayerName(defaultName);
  }, [defaultName]);

  useEffect(() => {
    peerManager.updateCallbacks({
      onStatusChange: setStatus,
      onLobbyUpdate: setLobby,
      onError: err => setError(err),
    });
  }, [peerManager]);

  const handleCreateRoom = useCallback(async () => {
    setError(null);
    try {
      await peerManager.createRoom(playerName || 'Host');
      setMode('host');
    } catch {
      /* callback */
    }
  }, [peerManager, playerName]);

  const handleJoinRoom = useCallback(async () => {
    if (!roomCode.trim()) return;
    setError(null);
    try {
      await peerManager.joinRoom(
        roomCode.trim().toUpperCase(),
        playerName || 'Guest',
        resumeKey.trim() || undefined,
      );
      setMode('join');
    } catch (err) {
      setMode('choose');
      setError(err instanceof Error ? err.message : 'Could not join room');
    }
  }, [peerManager, roomCode, playerName, resumeKey]);

  const handleStartGame = useCallback(() => {
    if (!lobby) return;
    const offlineHuman = lobby.slots.find(s => s.type === 'human' && !s.connected);
    if (offlineHuman) {
      setError(
        `${offlineHuman.playerName} is offline. Wait for them to reconnect, or remove them before starting.`,
      );
      return;
    }
    setError(null);
    onStartGame({
      players: lobby.slots.map(s => ({
        name: s.playerName,
        type: s.type,
        difficulty: s.type === 'ai' ? s.difficulty || 'medium' : undefined,
      })),
    });
  }, [lobby, onStartGame]);

  const handleSlotChange = useCallback((index: number, updates: Partial<LobbySlot>) => {
    if (peerManager.isHost) peerManager.updateSlot(index, updates);
  }, [peerManager]);

  const copyRoomCode = () => {
    if (peerManager.roomCode) void navigator.clipboard.writeText(peerManager.roomCode);
  };

  const seatKey =
    lobby?.slots[peerManager.playerIndex]?.resumeKey || peerManager.resumeKey || '';

  return (
    <div className="main-menu">
      <button
        type="button"
        className="menu-settings-btn"
        onClick={onOpenSettings}
        aria-label="Settings"
      >
        ⚙
      </button>

      <div className="menu-logo">
        <h1>Mahjon</h1>
        <p className="subtitle">Online Multiplayer</p>
      </div>

      <div className="menu-card lobby-card">
        {error && <div className="lobby-error">{error}</div>}

        {mode === 'choose' && (
          <>
            <h2>Multiplayer</h2>
            <p className="mp-version-note">
              Full online table — empty seats fill with AI. Dropped? Rejoin with Room + Seat key
              (shown in Settings during play).
            </p>
            <label className="lobby-field">
              <span>Your Name</span>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                id="mp-player-name"
                autoComplete="off"
              />
            </label>
            <div className="menu-actions">
              <button className="btn btn-primary" onClick={handleCreateRoom} id="create-room-btn">
                Create Room
              </button>
              <div className="lobby-join-row">
                <input
                  type="text"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ROOM"
                  maxLength={5}
                  id="room-code-input"
                  className="lobby-code-input"
                  autoComplete="off"
                />
                <input
                  type="text"
                  value={resumeKey}
                  onChange={e => setResumeKey(e.target.value.toUpperCase())}
                  placeholder="SEAT"
                  maxLength={4}
                  title="Seat key — only needed to rejoin mid-game"
                  id="resume-key-input"
                  className="lobby-seat-input"
                  autoComplete="off"
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleJoinRoom}
                  disabled={roomCode.trim().length < 3}
                  id="join-room-btn"
                >
                  Join
                </button>
              </div>
              <p className="settings-hint lobby-hint">
                Seat key optional — use it to reclaim your hand after a disconnect.
              </p>
              <button className="btn btn-secondary" onClick={onBack} id="mp-back-btn">
                ← Back
              </button>
            </div>
          </>
        )}

        {(mode === 'host' || mode === 'join') && lobby && (
          <>
            <div className="lobby-room-header">
              <div className="lobby-room-label">Room Code</div>
              <button
                type="button"
                className="lobby-room-code"
                onClick={copyRoomCode}
                title="Click to copy"
              >
                {lobby.roomCode}
              </button>
              <p className="lobby-room-note">
                Share this code · Seat key is below and in Settings once play starts
              </p>
              {seatKey && (
                <p className="lobby-seat-key">
                  Your seat key: <strong>{seatKey}</strong>
                </p>
              )}
            </div>

            <div className="lobby-slots">
              {lobby.slots.map((slot, i) => (
                <div key={i} className="setup-player">
                  <span className="seat-label">{SEATS[i]}</span>
                  <span className={`lobby-slot-name${slot.connected ? '' : ' is-offline'}`}>
                    {slot.playerName}
                    {!slot.connected && slot.type === 'human' ? ' (offline)' : ''}
                  </span>
                  {mode === 'host' && slot.type === 'ai' && (
                    <select
                      value={slot.difficulty || 'medium'}
                      onChange={e =>
                        handleSlotChange(i, {
                          difficulty: e.target.value as LobbySlot['difficulty'],
                        })
                      }
                      className="lobby-ai-select"
                      aria-label={`${SEATS[i]} AI difficulty`}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  )}
                  <span className={`lobby-type-badge lobby-type-badge--${slot.type}`}>
                    {slot.type === 'human' ? 'Human' : 'AI'}
                  </span>
                </div>
              ))}
            </div>

            <div className="lobby-actions">
              {mode === 'host' && (
                <button
                  className="btn btn-primary"
                  onClick={handleStartGame}
                  id="start-mp-game-btn"
                >
                  Start Game
                </button>
              )}
              {mode === 'join' && (
                <p className="lobby-waiting">Waiting for host to start…</p>
              )}
              <button
                className="btn btn-danger"
                onClick={() => {
                  peerManager.disconnect();
                  onBack();
                }}
              >
                Leave
              </button>
            </div>

            <p className="lobby-status">
              Status: {status} ·{' '}
              {lobby.slots.filter(s => s.type === 'human' && s.connected).length}/4 humans
            </p>
          </>
        )}
      </div>
    </div>
  );
}
