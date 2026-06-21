// ============================================================
// LobbyScreen — Multiplayer lobby for creating/joining rooms
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { PeerManager, ConnectionStatus } from '../network/peer-manager';
import { LobbyState, LobbySlot } from '../network/protocol';
import { GameConfig } from '../engine/game';

interface LobbyScreenProps {
  peerManager: PeerManager;
  onStartGame: (config: GameConfig) => void;
  onBack: () => void;
}

export function LobbyScreen({ peerManager, onStartGame, onBack }: LobbyScreenProps) {
  const [mode, setMode] = useState<'choose' | 'host' | 'join'>('choose');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [playerName, setPlayerName] = useState('Player');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ name: string; msg: string }[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Update callbacks for Lobby
  useEffect(() => {
    peerManager.updateCallbacks({
      onStatusChange: setStatus,
      onLobbyUpdate: setLobby,
      onChat: (name, msg) => setChatMessages(prev => [...prev, { name, msg }]),
      onError: (err) => setError(err),
    });
  }, [peerManager]);

  const handleCreateRoom = useCallback(async () => {
    setError(null);
    try {
      await peerManager.createRoom(playerName || 'Host');
      setMode('host');
    } catch {
      // Error handled by callback
    }
  }, [peerManager, playerName]);

  const handleJoinRoom = useCallback(async () => {
    if (!roomCode.trim()) return;
    setError(null);
    try {
      await peerManager.joinRoom(roomCode.trim().toUpperCase(), playerName || 'Guest');
      setMode('join');
    } catch {
      // Error handled by callback
    }
  }, [peerManager, roomCode, playerName]);

  const handleStartGame = useCallback(() => {
    if (!lobby) return;
    const config: GameConfig = {
      players: lobby.slots.map(s => ({
        name: s.playerName,
        type: s.type,
        difficulty: s.type === 'ai' ? (s.difficulty || 'medium') : undefined,
      })),
    };
    onStartGame(config);
  }, [lobby, onStartGame]);

  const handleSlotChange = useCallback((index: number, updates: Partial<LobbySlot>) => {
    if (peerManager.isHost) {
      peerManager.updateSlot(index, updates);
    }
  }, [peerManager]);

  const handleSendChat = useCallback(() => {
    if (chatInput.trim()) {
      peerManager.sendChat(playerName || 'Player', chatInput.trim());
      setChatInput('');
    }
  }, [peerManager, chatInput, playerName]);

  const copyRoomCode = () => {
    if (peerManager.roomCode) {
      navigator.clipboard.writeText(peerManager.roomCode);
    }
  };

  return (
    <div className="main-menu">
      <div className="menu-logo">
        <h1>Mahjon</h1>
        <p className="subtitle">Online Multiplayer</p>
      </div>

      <div className="menu-card" style={{ maxWidth: 520 }}>
        {error && (
          <div style={{
            background: 'rgba(239, 83, 80, 0.15)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md)',
            marginBottom: 'var(--space-md)',
            color: 'var(--color-danger)',
            fontSize: 'var(--font-size-sm)',
          }}>
            {error}
          </div>
        )}

        {mode === 'choose' && (
          <>
            <h2>Multiplayer</h2>
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="setup-input"
                id="mp-player-name"
                style={{
                  width: '100%', marginTop: 4,
                  background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-panel-border)',
                  borderRadius: 'var(--radius-sm)', padding: '8px 12px',
                  color: 'var(--color-text)', fontFamily: 'var(--font-ui)',
                }}
              />
            </div>
            <div className="menu-actions">
              <button className="btn btn-primary" onClick={handleCreateRoom} id="create-room-btn">
                🏠 Create Room
              </button>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                <input
                  type="text"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  maxLength={5}
                  id="room-code-input"
                  style={{
                    flex: 1, textAlign: 'center', letterSpacing: '0.2em',
                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-panel-border)',
                    borderRadius: 'var(--radius-sm)', padding: '12px',
                    color: 'var(--color-text)', fontFamily: 'var(--font-ui)',
                    fontWeight: 700, fontSize: 'var(--font-size-lg)',
                  }}
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
              <button className="btn btn-secondary" onClick={onBack} id="mp-back-btn">
                ← Back
              </button>
            </div>
          </>
        )}

        {(mode === 'host' || mode === 'join') && lobby && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                Room Code
              </div>
              <div style={{
                fontSize: 'var(--font-size-3xl)', fontWeight: 800, letterSpacing: '0.2em',
                color: 'var(--color-accent)', cursor: 'pointer',
              }} onClick={copyRoomCode} title="Click to copy">
                {lobby.roomCode}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Share this code with friends • Click to copy
              </div>
            </div>

            {/* Player slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
              {lobby.slots.map((slot, i) => (
                <div key={i} className="setup-player">
                  <span className="seat-label">{['East', 'South', 'West', 'North'][i]}</span>
                  <span style={{
                    flex: 1, fontWeight: 600,
                    color: slot.connected ? 'var(--color-text)' : 'var(--color-text-muted)',
                  }}>
                    {slot.playerName}
                  </span>
                  <span style={{
                    fontSize: 'var(--font-size-xs)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-round)',
                    background: slot.type === 'human'
                      ? 'rgba(76, 175, 80, 0.2)'
                      : 'rgba(255, 152, 0, 0.2)',
                    color: slot.type === 'human' ? 'var(--color-success)' : '#ff9800',
                  }}>
                    {slot.type === 'human' ? '👤 Human' : '🤖 AI'}
                  </span>
                  {slot.connected && (
                    <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>●</span>
                  )}
                </div>
              ))}
            </div>

            {/* Chat */}
            <div style={{
              background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)',
              padding: 'var(--space-sm)', marginBottom: 'var(--space-md)',
              maxHeight: 120, overflowY: 'auto',
            }}>
              {chatMessages.length === 0 && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}>
                  Chat messages will appear here
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} style={{ fontSize: 'var(--font-size-xs)' }}>
                  <strong>{m.name}:</strong> {m.msg}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                placeholder="Type a message..."
                style={{
                  flex: 1, background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--color-panel-border)',
                  borderRadius: 'var(--radius-sm)', padding: '6px 10px',
                  color: 'var(--color-text)', fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--font-size-sm)',
                }}
              />
              <button className="btn btn-secondary" onClick={handleSendChat} style={{ padding: '6px 12px' }}>
                Send
              </button>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              {mode === 'host' && (
                <button className="btn btn-primary" onClick={handleStartGame} style={{ flex: 1 }} id="start-mp-game-btn">
                  Start Game
                </button>
              )}
              {mode === 'join' && (
                <div style={{ flex: 1, textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-md)' }}>
                  Waiting for host to start...
                </div>
              )}
              <button className="btn btn-danger" onClick={() => { peerManager.disconnect(); onBack(); }}>
                Leave
              </button>
            </div>

            <div style={{
              marginTop: 'var(--space-md)', textAlign: 'center',
              fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
            }}>
              Status: {status} • {lobby.slots.filter(s => s.type === 'human' && s.connected).length}/4 humans
            </div>
          </>
        )}
      </div>
    </div>
  );
}
