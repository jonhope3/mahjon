// ============================================================
// LobbyScreen — family-friendly multiplayer lobby
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { PeerManager, ConnectionStatus } from '../network/peer-manager';
import { LobbyState, LobbySlot } from '../network/protocol';
import { GameConfig } from '../engine/game';
import {
  buildInviteMessage,
  loadMpLastTable,
  readMpDeepLink,
  saveMpLastTable,
  shareOrCopyInvite,
  type MpLastTable,
} from '../mp-session';

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
  const deep = readMpDeepLink();
  const remembered = loadMpLastTable();

  const [mode, setMode] = useState<'choose' | 'host' | 'join'>('choose');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [playerName, setPlayerName] = useState(
    remembered?.playerName || defaultName,
  );
  const [roomCode, setRoomCode] = useState(deep.room || '');
  const [resumeKey, setResumeKey] = useState(deep.seat || '');
  const [showAdvancedJoin, setShowAdvancedJoin] = useState(!!deep.seat);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<'room' | 'seat' | 'invite' | null>(null);
  const [lastTable] = useState<MpLastTable | null>(remembered);

  useEffect(() => {
    if (!remembered?.playerName) setPlayerName(defaultName);
  }, [defaultName, remembered?.playerName]);

  useEffect(() => {
    peerManager.updateCallbacks({
      onStatusChange: setStatus,
      onLobbyUpdate: next => {
        setLobby({
          ...next,
          slots: next.slots.map(s => ({ ...s })),
        });
      },
      onError: err => {
        setBusy(false);
        setError(err);
      },
    });
  }, [peerManager]);

  // Persist seat credentials once we have them in a lobby
  useEffect(() => {
    if (!lobby) return;
    const seat =
      lobby.slots[peerManager.playerIndex]?.resumeKey || peerManager.resumeKey;
    if (!seat || !lobby.roomCode) return;
    saveMpLastTable({
      roomCode: lobby.roomCode,
      seatKey: seat,
      playerName: playerName.trim() || 'Player',
    });
  }, [lobby, peerManager.playerIndex, peerManager.resumeKey, playerName]);

  const flashCopied = (kind: 'room' | 'seat' | 'invite') => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2200);
  };

  const handleCreateRoom = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await peerManager.createRoom(playerName.trim() || 'Host');
      setMode('host');
    } catch {
      /* onError callback */
    } finally {
      setBusy(false);
    }
  }, [peerManager, playerName]);

  const handleJoinRoom = useCallback(async () => {
    if (!roomCode.trim()) {
      setError('Enter the room code from the person hosting.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await peerManager.joinRoom(
        roomCode.trim().toUpperCase(),
        playerName.trim() || 'Guest',
        resumeKey.trim() || undefined,
      );
      setMode('join');
    } catch (err) {
      setMode('choose');
      setError(err instanceof Error ? err.message : 'Could not join — check the code and try again.');
    } finally {
      setBusy(false);
    }
  }, [peerManager, roomCode, playerName, resumeKey]);

  const handleResumeLast = useCallback(async () => {
    if (!lastTable) return;
    setPlayerName(lastTable.playerName);
    setRoomCode(lastTable.roomCode);
    setResumeKey(lastTable.seatKey);
    setShowAdvancedJoin(true);
    setError(null);
    setBusy(true);
    try {
      await peerManager.joinRoom(
        lastTable.roomCode,
        lastTable.playerName,
        lastTable.seatKey,
      );
      setMode('join');
    } catch (err) {
      setMode('choose');
      setError(
        err instanceof Error
          ? err.message
          : 'Could not resume. Ask the host for the room code, or create a new table.',
      );
    } finally {
      setBusy(false);
    }
  }, [lastTable, peerManager]);

  const handleStartGame = useCallback(() => {
    if (!lobby) return;
    const offlineHuman = lobby.slots.find(s => s.type === 'human' && !s.connected);
    if (offlineHuman) {
      setError(
        `${offlineHuman.playerName} isn’t connected. Wait for them, or tap “Sit AI here” on their seat.`,
      );
      return;
    }
    const people = lobby.slots.filter(s => s.type === 'human' && s.connected).length;
    if (people < 2) {
      setError(
        'Need at least 2 people for a group game. Wait for someone to join, or go back and use Quick Start vs AI to practice alone.',
      );
      return;
    }
    if (people > 4) {
      setError('Mahjong is 4 seats max.');
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

  const seatKey =
    lobby?.slots[peerManager.playerIndex]?.resumeKey || peerManager.resumeKey || '';

  const humanCount = lobby
    ? lobby.slots.filter(s => s.type === 'human' && s.connected).length
    : 0;

  const copyRoomCode = async () => {
    if (!peerManager.roomCode) return;
    try {
      await navigator.clipboard.writeText(peerManager.roomCode);
      flashCopied('room');
    } catch {
      /* ignore */
    }
  };

  const copySeatKey = async () => {
    if (!seatKey) return;
    try {
      await navigator.clipboard.writeText(seatKey);
      flashCopied('seat');
    } catch {
      /* ignore */
    }
  };

  const shareInvite = async () => {
    const code = lobby?.roomCode || peerManager.roomCode;
    if (!code) return;
    const result = await shareOrCopyInvite(code, playerName, seatKey || undefined);
    if (result === 'copied') flashCopied('invite');
  };

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
        <p className="subtitle">Play with group</p>
      </div>

      <div className="menu-card lobby-card">
        {error && (
          <div className="lobby-error" role="alert">
            {error}
          </div>
        )}

        {mode === 'choose' && (
          <>
            <h2>Group table</h2>
            <p className="mp-version-note">
              Mahjong needs <strong>4 seats</strong>. Your group can be <strong>2–4 people</strong>;
              empty seats play as AI. Never played? Go back and tap <strong>How to Play</strong> first —
              or jump in and use teaching tips during the game.
            </p>
            <ol className="lobby-howto">
              <li>One person taps <strong>Host a table</strong> and shares the code.</li>
              <li>Everyone else types that code and taps <strong>Join</strong>.</li>
              <li>Host taps <strong>Start game</strong> when you’re ready (min 2 people).</li>
            </ol>

            <label className="lobby-field">
              <span>Your name</span>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="e.g. Alex"
                id="mp-player-name"
                autoComplete="nickname"
                maxLength={20}
              />
            </label>

            <div className="menu-actions lobby-choose-actions">
              <button
                className="btn btn-primary"
                onClick={handleCreateRoom}
                id="create-room-btn"
                disabled={busy}
              >
                {busy ? 'Please wait…' : 'Host a table'}
              </button>

              {lastTable && (
                <button
                  type="button"
                  className="btn btn-secondary lobby-resume-btn"
                  onClick={handleResumeLast}
                  disabled={busy}
                >
                  Resume my seat
                  <span className="lobby-resume-meta">
                    Room {lastTable.roomCode} · {lastTable.playerName}
                  </span>
                </button>
              )}

              <div className="lobby-join-block">
                <p className="lobby-join-label">Have a room code?</p>
                <div className="lobby-join-row">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="CODE"
                    maxLength={5}
                    id="room-code-input"
                    className="lobby-code-input"
                    autoComplete="off"
                    inputMode="text"
                    aria-label="Room code"
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={handleJoinRoom}
                    disabled={busy || roomCode.trim().length < 3}
                    id="join-room-btn"
                  >
                    {busy ? 'Joining…' : 'Join'}
                  </button>
                </div>

                <button
                  type="button"
                  className="lobby-advanced-toggle"
                  onClick={() => setShowAdvancedJoin(v => !v)}
                  aria-expanded={showAdvancedJoin}
                >
                  {showAdvancedJoin ? 'Hide seat key' : 'Rejoining mid-game? Add seat key'}
                </button>
                {showAdvancedJoin && (
                  <label className="lobby-field lobby-field--seat">
                    <span>Seat key (optional if you use the same name)</span>
                    <input
                      type="text"
                      value={resumeKey}
                      onChange={e =>
                        setResumeKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                      }
                      placeholder="SEAT"
                      maxLength={4}
                      id="resume-key-input"
                      className="lobby-seat-input"
                      autoComplete="off"
                    />
                  </label>
                )}
              </div>

              <button className="btn btn-secondary" onClick={onBack} id="mp-back-btn">
                ← Back
              </button>
            </div>
          </>
        )}

        {(mode === 'host' || mode === 'join') && lobby && (
          <>
            <div className="lobby-room-header">
              {mode === 'host' ? (
                <>
                  <p className="lobby-host-lead">You’re hosting — share this code</p>
                  <button
                    type="button"
                    className="lobby-room-code"
                    onClick={copyRoomCode}
                    title="Tap to copy"
                  >
                    {lobby.roomCode}
                  </button>
                  <p className="lobby-room-note" aria-live="polite">
                    {copied === 'room'
                      ? 'Copied! Text it to your group.'
                      : copied === 'invite'
                        ? 'Invite copied — paste into a text.'
                        : 'Tap the code to copy, or share an invite.'}
                  </p>
                  <button type="button" className="btn btn-primary lobby-share-btn" onClick={shareInvite}>
                    Share invite
                  </button>
                </>
              ) : (
                <>
                  <p className="lobby-host-lead">You’re in room</p>
                  <div className="lobby-room-code lobby-room-code--static">{lobby.roomCode}</div>
                  <p className="lobby-room-note">
                    Waiting for {lobby.hostName || 'the host'} to start. Keep this screen open.
                  </p>
                </>
              )}

              {seatKey && (
                <p className="lobby-seat-key">
                  Your backup seat key:{' '}
                  <button type="button" className="linkish" onClick={copySeatKey}>
                    <strong>{seatKey}</strong>
                    {copied === 'seat' ? ' · Copied' : ''}
                  </button>
                  <span className="lobby-seat-hint">
                    {' '}
                    — saved on this phone for “Resume my seat”
                  </span>
                </p>
              )}
            </div>

            <div className="lobby-slots" role="list">
              {lobby.slots.map((slot, i) => {
                const isYou = i === peerManager.playerIndex;
                const offline = slot.type === 'human' && !slot.connected;
                return (
                  <div
                    key={i}
                    className={`setup-player lobby-seat${isYou ? ' lobby-seat--you' : ''}${
                      offline ? ' lobby-seat--offline' : ''
                    }`}
                    role="listitem"
                  >
                    <span className="seat-label">{SEATS[i]}</span>
                    <span className="lobby-slot-name">
                      {slot.playerName}
                      {isYou ? ' (you)' : ''}
                      {offline ? ' — reconnecting…' : ''}
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
                        aria-label={`${SEATS[i]} AI level`}
                      >
                        <option value="easy">Easy AI</option>
                        <option value="medium">Medium AI</option>
                        <option value="hard">Hard AI</option>
                      </select>
                    )}
                    {mode === 'host' && offline && i !== 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={() => peerManager.fillSeatWithAI(i)}
                      >
                        Sit AI here
                      </button>
                    )}
                    <span
                      className={`lobby-type-badge lobby-type-badge--${
                        offline ? 'offline' : slot.type
                      }`}
                    >
                      {offline ? 'Away' : slot.type === 'human' ? 'Person' : 'AI'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="lobby-actions">
              {mode === 'host' && (
                <button
                  className="btn btn-primary lobby-start-btn"
                  onClick={handleStartGame}
                  id="start-mp-game-btn"
                  disabled={humanCount < 2}
                >
                  {humanCount < 2
                    ? 'Waiting for a 2nd person…'
                    : `Start game · ${humanCount} people (AI fills the rest)`}
                </button>
              )}
              {mode === 'join' && (
                <p className="lobby-waiting" role="status">
                  Waiting for {lobby.hostName || 'host'} to start…
                </p>
              )}
              <button
                className="btn btn-danger"
                onClick={() => {
                  peerManager.disconnect();
                  onBack();
                }}
              >
                Leave table
              </button>
            </div>

            <p className="lobby-status">
              {status === 'connected'
                ? `${humanCount} of 4 people · empty seats are AI · group size 2–4`
                : status === 'connecting'
                  ? 'Connecting…'
                  : `Connection: ${status}`}
            </p>
            {mode === 'host' && (
              <p className="lobby-hint settings-hint">
                Min 2 people to start, max 4. Don’t know the rules yet? Teaching mode coaches you
                during play — or leave and open How to Play.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
