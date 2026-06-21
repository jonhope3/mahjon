// ============================================================
// GameBoard — Main game UI layout
// ============================================================

import { useCallback, useState, useEffect } from 'react';
import { GameState, Tile, ActionType, Player } from '../engine/types';
import { TileComponent } from './TileComponent';
import { sortTiles, wallRemaining } from '../engine/tiles';
import { getValidActions } from '../engine/actions';
import { ALL_HAND_CATEGORIES } from '../engine/hands';

interface GameBoardProps {
  state: GameState;
  humanPlayerIndex: number;
  onAction: (action: ActionType, tiles?: Tile[]) => void;
  selectedTile: Tile | null;
  onSelectTile: (tile: Tile | null) => void;
}

export function GameBoard({
  state,
  humanPlayerIndex,
  onAction,
  selectedTile,
  onSelectTile,
}: GameBoardProps) {
  const [showHandCard, setShowHandCard] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const humanPlayer = state.players[humanPlayerIndex]!;
  const validActions = getValidActions(state, humanPlayerIndex);
  const isMyTurn = state.currentPlayerIndex === humanPlayerIndex;

  // Get opponent indices (relative to human: across, left, right)
  const opponentIndices = [
    (humanPlayerIndex + 2) % 4, // across (top)
    (humanPlayerIndex + 1) % 4, // right
    (humanPlayerIndex + 3) % 4, // left
  ];

  const handleTileClick = useCallback((tile: Tile) => {
    if (selectedTile?.id === tile.id) {
      onSelectTile(null);
    } else {
      onSelectTile(tile);
    }
  }, [selectedTile, onSelectTile]);

  const handleDiscard = useCallback(() => {
    if (selectedTile) {
      onAction('discard', [selectedTile]);
      onSelectTile(null);
    }
  }, [selectedTile, onAction, onSelectTile]);

  const handleExposedJokerClick = useCallback((jokerTile: Tile) => {
    if (isMyTurn && state.hasDrawn && selectedTile) {
      onAction('swap_joker', [selectedTile, jokerTile]);
      onSelectTile(null);
    }
  }, [isMyTurn, state.hasDrawn, selectedTile, onAction, onSelectTile]);

  const allDiscards = state.players.flatMap(p => p.discards);

  if (isMobile) {
    return (
      <div className="game-board mobile">
        {/* Mobile Top Bar */}
        <div className="mobile-top-bar">
          <div className="mobile-info-row">
            <span className="info-item">R: <strong>{state.roundNumber}</strong></span>
            <span className="info-item">T: <strong>{state.turnNumber}</strong></span>
            <span className="info-item">Wall: <strong>{wallRemaining(state.wall)}</strong></span>
          </div>
          <button className="btn btn-secondary btn-mini" onClick={() => setShowHandCard(true)}>
            📋 Card
          </button>
        </div>

        {/* Mobile Opponents Row */}
        <div className="mobile-opponents-row">
          {opponentIndices.map((idx) => {
            const opp = state.players[idx]!;
            const isActive = state.currentPlayerIndex === idx;
            return (
              <div key={idx} className={`mobile-opponent-card ${isActive ? 'active' : ''}`}>
                <div className="opp-header">
                  <span className="opp-wind">{opp.seatWind[0]?.toUpperCase()}</span>
                  <span className="opp-name">{opp.name}</span>
                  <span className="opp-count">[{opp.hand.length}]</span>
                </div>
                {opp.exposedSets.length > 0 && (
                  <div className="opp-exposed-mini">
                    {opp.exposedSets.map((set, sIdx) => (
                      <div key={sIdx} className="opp-set-mini">
                        {set.tiles.map(tile => {
                          const isJok = tile.kind.type === 'joker';
                          return (
                            <TileComponent
                              key={tile.id}
                              tile={tile}
                              size="tiny"
                              faceUp
                              clickable={isJok}
                              onClick={isJok ? () => handleExposedJokerClick(tile) : undefined}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile Discard Pool */}
        <div className="mobile-discard-pool">
          {allDiscards.length === 0 && (
            <span className="discard-pool-label">Discards</span>
          )}
          <div className="discard-grid">
            {allDiscards.map((tile) => (
              <TileComponent
                key={tile.id}
                tile={tile}
                size="mini"
                isLastDiscard={state.lastDiscard?.id === tile.id}
              />
            ))}
          </div>
        </div>

        {/* Mobile Bottom Bar */}
        <div className="mobile-bottom-bar">
          <div className="mobile-player-status">
            <span className="player-name">{humanPlayer.name} ({humanPlayer.seatWind[0]?.toUpperCase()})</span>
            <span className="player-score">Score: {humanPlayer.score}</span>
          </div>

          {/* Exposed Sets */}
          {humanPlayer.exposedSets.length > 0 && (
            <div className="mobile-player-exposed">
              {humanPlayer.exposedSets.map((set, i) => (
                <div key={i} className="exposed-set">
                  {set.tiles.map((tile) => {
                    const isJok = tile.kind.type === 'joker';
                    return (
                      <TileComponent
                        key={tile.id}
                        tile={tile}
                        size="mini"
                        clickable={isJok && isMyTurn && state.hasDrawn && !!selectedTile}
                        onClick={isJok ? () => handleExposedJokerClick(tile) : undefined}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Player Hand */}
          <div className="mobile-player-hand">
            {sortTiles(humanPlayer.hand).map((tile) => (
              <TileComponent
                key={tile.id}
                tile={tile}
                clickable={isMyTurn && state.hasDrawn}
                selected={selectedTile?.id === tile.id}
                onClick={handleTileClick}
                size="mini"
              />
            ))}
          </div>

          {/* Action Bar */}
          <div className="mobile-action-bar">
            {validActions.includes('draw') && (
              <button className="btn btn-action draw" onClick={() => onAction('draw')}>Draw</button>
            )}
            {validActions.includes('discard') && selectedTile && (
              <button className="btn btn-action discard" onClick={handleDiscard} style={{ background: '#607d8b', color: 'white' }}>Discard</button>
            )}
            {validActions.includes('pung') && (
              <button className="btn btn-action pung" onClick={() => onAction('pung')}>Pung</button>
            )}
            {validActions.includes('kong') && (
              <button className="btn btn-action kong" onClick={() => onAction('kong')}>Kong</button>
            )}
            {validActions.includes('quint') && (
              <button className="btn btn-action quint" onClick={() => onAction('quint')}>Quint</button>
            )}
            {validActions.includes('mahjong') && (
              <button className="btn btn-action mahjong" onClick={() => onAction('mahjong')}>Mahjong!</button>
            )}
            {validActions.includes('pass') && (
              <button className="btn btn-action pass" onClick={() => onAction('pass')}>Pass</button>
            )}
            <span className="mobile-turn-indicator">
              {isMyTurn ? 'Your Turn' : `${state.players[state.currentPlayerIndex]?.name}'s turn`}
            </span>
          </div>
        </div>

        {/* Round End Overlay */}
        {state.phase === 'round_end' && (
          <div className="round-end-overlay">
            <div className="round-end-content">
              <h2>{state.winner
                ? `🏆 ${state.players.find(p => p.id === state.winner)?.name} Wins!`
                : 'Draw Game'
              }</h2>
              {state.winningHand && (
                <p className="winning-pattern">
                  {state.winningHand.description}
                  <br />
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {state.winningHand.category} • {state.winningHand.value} points
                  </span>
                </p>
              )}
              <div className="scoreboard">
                {state.players.map((p, i) => (
                  <div key={i} className={`score-card ${p.id === state.winner ? 'winner' : ''}`}>
                    <div className="player-name">{p.name}</div>
                    <div className="score-value">{p.score}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'var(--space-xl)', display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => onAction('draw')}>
                  New Round
                </button>
                <button className="btn btn-secondary" onClick={() => window.location.reload()}>
                  Main Menu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hand card modal */}
        {showHandCard && (
          <div className="modal-overlay" onClick={() => setShowHandCard(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '85vh', overflowY: 'auto' }}>
              <h2>2026 Hand Patterns</h2>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-sm) var(--space-md)',
                marginBottom: 'var(--space-md)',
                fontSize: 'var(--font-size-xs)',
                lineHeight: '1.4',
                border: '1px solid var(--color-panel-border)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                gap: 'var(--space-sm)',
                textAlign: 'left',
              }}>
                <div><strong>F</strong> = Anemone (Flower) 🪸</div>
                <div><strong>D</strong> = Dragon (🪸 / 🌊 / 🦪)</div>
                <div><strong>E/S/W/N</strong> = Winds 🧭</div>
                <div><strong>Suits</strong> = Shell 🐚 / Kelp 🌿 / Pearl 🫧</div>
              </div>
              {ALL_HAND_CATEGORIES.map(cat => (
                <div key={cat.name} style={{ marginBottom: 'var(--space-lg)' }}>
                  <h3 style={{
                    color: 'var(--color-accent)', fontSize: 'var(--font-size-md)',
                    borderBottom: '1px solid var(--color-panel-border)',
                    paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-sm)',
                  }}>
                    {cat.name}
                  </h3>
                  {cat.hands.map(hand => (
                    <div key={hand.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      fontSize: 'var(--font-size-sm)',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}>
                      <span style={{ flex: 1, textAlign: 'left' }}>{hand.description}</span>
                      <span style={{
                        color: hand.concealed ? 'var(--color-info)' : 'var(--color-success)',
                        fontWeight: 700, minWidth: 50, textAlign: 'right',
                      }}>
                        {hand.concealed ? 'C' : 'X'}{hand.value}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              <button className="btn btn-secondary" onClick={() => setShowHandCard(false)} style={{ width: '100%', marginTop: 'var(--space-md)' }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="game-board">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="game-info">
          <div className="game-info-item">
            <span className="game-info-label">Round</span>
            <span className="game-info-value">{state.roundNumber}</span>
          </div>
          <div className="game-info-item">
            <span className="game-info-label">Turn</span>
            <span className="game-info-value">{state.turnNumber}</span>
          </div>
          <div className="game-info-item">
            <span className="game-info-label">Wall</span>
            <span className="game-info-value">{wallRemaining(state.wall)}</span>
          </div>
          <button className="btn btn-secondary" onClick={() => setShowHandCard(true)} style={{ marginLeft: 'var(--space-md)' }}>
            📋 View Card
          </button>
        </div>
        {/* Top opponent */}
        <OpponentDisplay
          player={state.players[opponentIndices[0]!]!}
          isActive={state.currentPlayerIndex === opponentIndices[0]}
          position="top"
          onJokerClick={handleExposedJokerClick}
        />
        <div className="game-info">
          {state.players.map((p, i) => (
            <div key={i} className="game-info-item">
              <span className="game-info-label">{p.name}</span>
              <span className="game-info-value">{p.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Center Area */}
      <div className="center-area">
        {/* Left opponent */}
        <div className="opponent-area left">
          <OpponentDisplay
            player={state.players[opponentIndices[2]!]!}
            isActive={state.currentPlayerIndex === opponentIndices[2]}
            position="left"
            onJokerClick={handleExposedJokerClick}
          />
        </div>

        {/* Discard pool */}
        <div className="discard-pool">
          {allDiscards.length === 0 && (
            <span className="discard-pool-label">Discards</span>
          )}
          {allDiscards.map((tile) => (
            <TileComponent
              key={tile.id}
              tile={tile}
              size="mini"
              isLastDiscard={state.lastDiscard?.id === tile.id}
            />
          ))}
        </div>

        {/* Right opponent */}
        <div className="opponent-area right">
          <OpponentDisplay
            player={state.players[opponentIndices[1]!]!}
            isActive={state.currentPlayerIndex === opponentIndices[1]}
            position="right"
            onJokerClick={handleExposedJokerClick}
          />
        </div>

        {/* Wall counter overlay */}
        <div className="wall-counter">
          <div className="count">{wallRemaining(state.wall)}</div>
          <div className="label">Tiles Left</div>
        </div>
      </div>

      {/* Bottom Bar - Player's hand & actions */}
      <div className="bottom-bar">
        {/* Player info */}
        <div className="player-info-bar">
          <span className="player-name">{humanPlayer.name}</span>
          <span className="player-wind">{humanPlayer.seatWind}</span>
          <span className="player-score">Score: {humanPlayer.score}</span>
        </div>

        {/* Hand + Exposed sets */}
        <div className="player-hand-container">
          <div className="player-hand">
            {sortTiles(humanPlayer.hand).map((tile) => (
              <TileComponent
                key={tile.id}
                tile={tile}
                clickable={isMyTurn && state.hasDrawn}
                selected={selectedTile?.id === tile.id}
                onClick={handleTileClick}
              />
            ))}
          </div>
          {humanPlayer.exposedSets.length > 0 && (
            <div className="exposed-sets">
              {humanPlayer.exposedSets.map((set, i) => (
                <div key={i} className="exposed-set">
                  {set.tiles.map((tile) => {
                    const isJok = tile.kind.type === 'joker';
                    return (
                      <TileComponent
                        key={tile.id}
                        tile={tile}
                        size="mini"
                        clickable={isJok && isMyTurn && state.hasDrawn && !!selectedTile}
                        onClick={isJok ? () => handleExposedJokerClick(tile) : undefined}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="action-bar">
          <span className={`turn-indicator ${isMyTurn ? 'your-turn' : ''}`}>
            {isMyTurn ? '⟡ Your Turn' : `${state.players[state.currentPlayerIndex]?.name}'s turn`}
          </span>

          {validActions.includes('draw') && (
            <button className="btn btn-action draw" onClick={() => onAction('draw')}>
              Draw
            </button>
          )}
          {validActions.includes('discard') && selectedTile && (
            <button className="btn btn-action" onClick={handleDiscard}
              style={{ background: '#607d8b', color: 'white' }}>
              Discard
            </button>
          )}
          {validActions.includes('pung') && (
            <button className="btn btn-action pung" onClick={() => onAction('pung')}>
              Pung
            </button>
          )}
          {validActions.includes('kong') && (
            <button className="btn btn-action kong" onClick={() => onAction('kong')}>
              Kong
            </button>
          )}
          {validActions.includes('quint') && (
            <button className="btn btn-action quint" onClick={() => onAction('quint')}>
              Quint
            </button>
          )}
          {validActions.includes('mahjong') && (
            <button className="btn btn-action mahjong" onClick={() => onAction('mahjong')}>
              Mahjong!
            </button>
          )}
          {validActions.includes('pass') && (
            <button className="btn btn-action pass" onClick={() => onAction('pass')}>
              Pass
            </button>
          )}
        </div>
      </div>

      {/* Game Log */}
      <div className="game-log">
        {state.log.slice(-8).reverse().map((entry, i) => (
          <div key={i} className="log-entry">{entry.message}</div>
        ))}
      </div>

      {/* Round End Overlay */}
      {state.phase === 'round_end' && (
        <div className="round-end-overlay">
          <div className="round-end-content">
            <h2>{state.winner
              ? `🏆 ${state.players.find(p => p.id === state.winner)?.name} Wins!`
              : 'Draw Game'
            }</h2>
            {state.winningHand && (
              <p className="winning-pattern">
                {state.winningHand.description}
                <br />
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {state.winningHand.category} • {state.winningHand.value} points
                </span>
              </p>
            )}
            <div className="scoreboard">
              {state.players.map((p, i) => (
                <div key={i} className={`score-card ${p.id === state.winner ? 'winner' : ''}`}>
                  <div className="player-name">{p.name}</div>
                  <div className="score-value">{p.score}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 'var(--space-xl)', display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => onAction('draw')}>
                New Round
              </button>
              <button className="btn btn-secondary" onClick={() => window.location.reload()}>
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hand card modal */}
      {showHandCard && (
        <div className="modal-overlay" onClick={() => setShowHandCard(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '85vh', overflowY: 'auto' }}>
            <h2>2026 Hand Patterns</h2>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-sm) var(--space-md)',
              marginBottom: 'var(--space-md)',
              fontSize: 'var(--font-size-xs)',
              lineHeight: '1.4',
              border: '1px solid var(--color-panel-border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
              gap: 'var(--space-sm)',
              textAlign: 'left',
            }}>
              <div><strong>F</strong> = Anemone (Flower) 🪸</div>
              <div><strong>D</strong> = Dragon (🪸 / 🌊 / 🦪)</div>
              <div><strong>E/S/W/N</strong> = Winds 🧭</div>
              <div><strong>Suits</strong> = Shell 🐚 / Kelp 🌿 / Pearl 🫧</div>
            </div>
            {ALL_HAND_CATEGORIES.map(cat => (
              <div key={cat.name} style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 style={{
                  color: 'var(--color-accent)', fontSize: 'var(--font-size-md)',
                  borderBottom: '1px solid var(--color-panel-border)',
                  paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-sm)',
                }}>
                  {cat.name}
                </h3>
                {cat.hands.map(hand => (
                  <div key={hand.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    fontSize: 'var(--font-size-sm)',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                  }}>
                    <span style={{ flex: 1, textAlign: 'left' }}>{hand.description}</span>
                    <span style={{
                      color: hand.concealed ? 'var(--color-info)' : 'var(--color-success)',
                      fontWeight: 700, minWidth: 50, textAlign: 'right',
                    }}>
                      {hand.concealed ? 'C' : 'X'}{hand.value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <button className="btn btn-secondary" onClick={() => setShowHandCard(false)} style={{ width: '100%', marginTop: 'var(--space-md)' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Opponent Display Component ----
function OpponentDisplay({
  player,
  isActive,
  position,
  onJokerClick,
}: {
  player: Player;
  isActive: boolean;
  position: 'top' | 'left' | 'right';
  onJokerClick?: (tile: Tile) => void;
}) {
  const tileCount = player.hand.length;
  const maxShow = position === 'top' ? 14 : 8;

  return (
    <div className={`opponent-info ${isActive ? 'active' : ''}`}>
      <span className="opponent-name">{player.name}</span>
      <span className="opponent-wind">{player.seatWind}</span>
      <span className="opponent-tile-count">{tileCount} tiles</span>
      <div className={`opponent-tiles ${position !== 'top' ? 'vertical' : ''}`}>
        {Array.from({ length: Math.min(tileCount, maxShow) }, (_, i) => (
          <TileComponent key={i} faceUp={false} size="tiny" />
        ))}
      </div>
      {player.exposedSets.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {player.exposedSets.map((set, i) => (
            <div key={i} style={{ display: 'flex', gap: '1px' }}>
              {set.tiles.map((tile) => {
                const isJok = tile.kind.type === 'joker';
                return (
                  <TileComponent
                    key={tile.id}
                    tile={tile}
                    size="tiny"
                    faceUp
                    clickable={isJok}
                    onClick={isJok ? () => onJokerClick?.(tile) : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
