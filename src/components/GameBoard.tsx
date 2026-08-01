// ============================================================
// GameBoard - Main game UI (mobile + desktop shells)
// ============================================================

import { useCallback, useState, useEffect, useRef } from 'react';
import { GameState, Tile, ActionType, Player } from '../engine/types';
import { TileComponent } from './TileComponent';
import { wallRemaining, isJoker, tilesMatch } from '../engine/tiles';
import { getValidActions } from '../engine/actions';
import { checkWin } from '../engine/scoring';
import { HandCardModal } from './HandCardModal';
import { HelpPanel, PlayHelp } from './HelpPanel';
import { useInputProfile } from '../hooks/useInputProfile';
import { ClaimCoach } from './ClaimCoach';
import { ClaimConfirm, type PendingClaim } from './ClaimConfirm';
import { HandRack } from './HandRack';
import { RoundEndOverlay } from './RoundEndOverlay';
import { ActionButtons } from './ActionButtons';
import { useHandOrder } from '../hooks/useHandOrder';
import { haptic } from '../haptics';
import type { TeachMode } from '../game-settings';
import {
  handProgressHint,
  markJokerSwapTipSeen,
  shouldShowJokerSwapTip,
  showHandProgress,
  showTurnCoaching,
  turnHint,
} from '../teach';
import { shareOrCopyInvite } from '../mp-session';
import { BusyDots } from './BusyDots';

interface GameBoardProps {
  state: GameState;
  humanPlayerIndex: number;
  onAction: (action: ActionType, tiles?: Tile[]) => void;
  selectedTile: Tile | null;
  onSelectTile: (tile: Tile | null) => void;
  onOpenSettings: () => void;
  onQuitToMenu: () => void;
  teachMode?: TeachMode;
  /** Shown during MP so a disconnected player can rejoin */
  resumeKey?: string;
  roomCode?: string;
  /** Host can tap Share invite from the table chip */
  isHost?: boolean;
  /** Host (or solo) can start the next round */
  canStartNextRound?: boolean;
}

export function GameBoard({
  state,
  humanPlayerIndex,
  onAction,
  selectedTile,
  onSelectTile,
  onOpenSettings,
  onQuitToMenu,
  teachMode = 'guided',
  resumeKey,
  roomCode,
  isHost = false,
  canStartNextRound = true,
}: GameBoardProps) {
  const [showHandCard, setShowHandCard] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showJokerTip, setShowJokerTip] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [inviteFlash, setInviteFlash] = useState<string | null>(null);
  /** Claim awaiting explicit confirmation (mis-tap guard). */
  const [pendingClaim, setPendingClaim] = useState<PendingClaim | null>(null);
  // Phones only (CSS W ≤699). iPad mini starts at 744 points.
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia('(max-width: 699px)').matches,
  );
  const inputProfile = useInputProfile();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 699px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const humanPlayer = state.players[humanPlayerIndex]!;
  const validActions = getValidActions(state, humanPlayerIndex);
  const isMyTurn = state.currentPlayerIndex === humanPlayerIndex;
  const claimPending = !!(
    state.lastDiscard &&
    state.claimWindow &&
    !state.claimWindow.resolved &&
    state.lastDiscardBy !== humanPlayer.id
  );
  const isClaimWindow = validActions.includes('pass');
  const waitingOnClaims =
    claimPending && state.claimWindow!.claims.has(humanPlayer.id);
  const discarder = state.lastDiscardBy
    ? state.players.find(p => p.id === state.lastDiscardBy)
    : undefined;
  const claimActions = validActions.filter(a =>
    ['pung', 'kong', 'quint', 'mahjong'].includes(a),
  );
  const opponentIndices = [
    (humanPlayerIndex + 2) % 4,
    (humanPlayerIndex + 1) % 4,
    (humanPlayerIndex + 3) % 4,
  ];
  const allDiscards = state.players.flatMap(p => p.discards);

  const exposedJokerExists = state.players.some(p =>
    p.exposedSets.some(s => s.tiles.some(t => t.kind.type === 'joker')),
  );
  const canSwapJoker = isMyTurn && state.hasDrawn && !!selectedTile && exposedJokerExists;

  useEffect(() => {
    if (canSwapJoker && shouldShowJokerSwapTip(teachMode)) {
      setShowJokerTip(true);
    }
  }, [canSwapJoker, teachMode]);

  const hint = showTurnCoaching(teachMode)
    ? turnHint(state, humanPlayerIndex, validActions, !!selectedTile)
    : null;
  const progress = showHandProgress(teachMode) ? handProgressHint(humanPlayer) : null;

  // ---- Hand arrangement -------------------------------------------------
  // Players group tiles into their target hand shape; auto-sort is opt-in.
  const { orderedHand, isCustomOrder, moveTile, resetOrder } = useHandOrder(
    humanPlayer.hand,
    `mahjon-hand-order-${humanPlayer.id}`,
  );

  // ---- Haptic turn cues -------------------------------------------------
  // Phone players look away between turns; a short buzz beats watching.
  useEffect(() => {
    if (isMyTurn && state.phase === 'playing' && !state.hasDrawn) haptic('turn');
  }, [isMyTurn, state.phase, state.hasDrawn]);

  const canClaimNow = claimPending && claimActions.length > 0 && !waitingOnClaims;
  useEffect(() => {
    if (canClaimNow) haptic('claim');
  }, [canClaimNow]);

  useEffect(() => {
    if (state.winner && state.winner === humanPlayer.id) haptic('mahjong');
  }, [state.winner, humanPlayer.id]);

  const handleTileClick = useCallback((tile: Tile) => {
    onSelectTile(selectedTile?.id === tile.id ? null : tile);
  }, [selectedTile, onSelectTile]);

  const handleSortHand = useCallback(() => {
    resetOrder();
    haptic('commit');
  }, [resetOrder]);

  const handleDiscard = useCallback(() => {
    if (!selectedTile) return;
    haptic('commit');
    onAction('discard', [selectedTile]);
    onSelectTile(null);
  }, [selectedTile, onAction, onSelectTile]);

  /**
   * Claims are irreversible and appear under time pressure, so they get a
   * confirmation step showing exactly which tiles will be exposed.
   */
  const requestAction = useCallback(
    (action: ActionType) => {
      if (action !== 'pung' && action !== 'kong' && action !== 'quint' && action !== 'mahjong') {
        onAction(action);
        return;
      }

      const discard = state.lastDiscard;

      if (action === 'mahjong') {
        const probe: Player = discard && state.lastDiscardBy !== humanPlayer.id
          ? { ...humanPlayer, hand: [...humanPlayer.hand, discard] }
          : humanPlayer;
        const pattern = checkWin(probe);
        setPendingClaim({
          action,
          discard: state.lastDiscardBy !== humanPlayer.id ? discard : null,
          tilesFromHand: [],
          handName: pattern?.description,
        });
        return;
      }

      // Preview the tiles this claim will consume - naturals first, then
      // jokers, matching the engine's own selection in applyExposedClaim.
      const setSize = action === 'pung' ? 3 : action === 'kong' ? 4 : 5;
      const needed = setSize - 1;
      const naturals = discard
        ? humanPlayer.hand.filter(t => !isJoker(t) && tilesMatch(t.kind, discard.kind))
        : [];
      const jokers = humanPlayer.hand.filter(t => isJoker(t));
      const fromNaturals = naturals.slice(0, Math.min(naturals.length, needed));
      const fromJokers = jokers.slice(0, Math.max(0, needed - fromNaturals.length));

      setPendingClaim({
        action,
        discard,
        tilesFromHand: [...fromNaturals, ...fromJokers],
      });
    },
    [onAction, state.lastDiscard, state.lastDiscardBy, humanPlayer],
  );

  const confirmClaim = useCallback(() => {
    if (!pendingClaim) return;
    haptic('commit');
    onAction(pendingClaim.action);
    setPendingClaim(null);
  }, [pendingClaim, onAction]);

  const cancelClaim = useCallback(() => {
    setPendingClaim(null);
  }, []);

  // Dismiss discard-claim confirms when the claim window closes. Track the
  // previous value so self-kong / self-drawn Mahjong confirms (opened while
  // claimPending is already false) are not wiped on mount or unrelated renders.
  const wasClaimPending = useRef(claimPending);
  useEffect(() => {
    if (wasClaimPending.current && !claimPending) {
      setPendingClaim(null);
    }
    wasClaimPending.current = claimPending;
  }, [claimPending]);

  // ---- Keyboard shortcuts ------------------------------------------------
  // Everything was click-only, which is slow on a laptop or an iPad with a
  // Magic Keyboard - especially in the timed claim window, where mouse travel
  // is a real disadvantage. Tile-level arrows/Enter live in HandRack.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't hijack typing, and let open dialogs handle their own keys.
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (pendingClaim || showHandCard || showHelp) return;

      const key = e.key.toLowerCase();

      // Reference panels - always available.
      if (key === 'c') {
        e.preventDefault();
        setShowHandCard(true);
        return;
      }
      if (key === '?' || (key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      if (state.phase !== 'playing') return;

      if (key === 'd' && validActions.includes('draw')) {
        e.preventDefault();
        requestAction('draw');
        return;
      }
      if (e.key === 'Enter' && validActions.includes('discard') && selectedTile) {
        e.preventDefault();
        handleDiscard();
        return;
      }
      if (key === 'p' && validActions.includes('pass')) {
        e.preventDefault();
        requestAction('pass');
        return;
      }

      // Claim shortcuts mirror the on-screen button order.
      const claimKeys: Record<string, ActionType> = {
        '1': 'pung',
        '2': 'kong',
        '3': 'quint',
        '4': 'mahjong',
      };
      const claim = claimKeys[e.key];
      if (claim && validActions.includes(claim)) {
        e.preventDefault();
        requestAction(claim);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    state.phase,
    validActions,
    selectedTile,
    pendingClaim,
    showHandCard,
    showHelp,
    requestAction,
    handleDiscard,
  ]);

  const handleShareInvite = useCallback(async () => {
    if (!roomCode) return;
    // Always room-only - seat keys are personal, not for group invites
    const result = await shareOrCopyInvite(roomCode, humanPlayer.name);
    if (result === 'copied') {
      setInviteFlash('Invite copied');
      window.setTimeout(() => setInviteFlash(null), 2000);
    } else if (result === 'shared') {
      setInviteFlash('Shared!');
      window.setTimeout(() => setInviteFlash(null), 2000);
    }
  }, [roomCode, humanPlayer.name]);

  const tableChip =
    roomCode && resumeKey ? (
      <div className="resume-chip" title="Keep this if anyone drops offline">
        <span className="resume-chip-main">
          Room <strong>{roomCode}</strong>
          <span className="resume-chip-sep">·</span>
          Seat <strong>{resumeKey}</strong>
        </span>
        {isHost && (
          <button type="button" className="resume-chip-share" onClick={handleShareInvite}>
            {inviteFlash || 'Share invite'}
          </button>
        )}
        {!isHost && inviteFlash && <span className="resume-chip-flash">{inviteFlash}</span>}
      </div>
    ) : null;

  const handleExposedJokerClick = useCallback((jokerTile: Tile) => {
    if (isMyTurn && state.hasDrawn && selectedTile) {
      if (showJokerTip) {
        markJokerSwapTipSeen();
        setShowJokerTip(false);
      }
      onAction('swap_joker', [selectedTile, jokerTile]);
      onSelectTile(null);
    }
  }, [isMyTurn, state.hasDrawn, selectedTile, onAction, onSelectTile, showJokerTip]);

  const openHelp = () => setShowHelp(true);

  const overlays = (
    <>
      {state.phase === 'round_end' && (
        <RoundEndOverlay
          state={state}
          onNewRound={() => onAction('draw')}
          onQuitToMenu={onQuitToMenu}
          onOpenHandCard={() => setShowHandCard(true)}
          canStartNextRound={canStartNextRound}
        />
      )}
      {pendingClaim && (
        <ClaimConfirm
          claim={pendingClaim}
          onConfirm={confirmClaim}
          onCancel={cancelClaim}
        />
      )}
      {showHandCard && <HandCardModal onClose={() => setShowHandCard(false)} />}
      {showHelp && (
        <HelpPanel title="How this turn works" onClose={() => setShowHelp(false)}>
          <PlayHelp />
        </HelpPanel>
      )}
    </>
  );

  const rotatePrompt = (
    <div className="rotate-prompt">
      <div className="rotate-prompt-content">
        <span className="rotate-icon">📱</span>
        <h3>Please Rotate Your Device</h3>
        <p>Mahjon is best played in portrait mode on mobile devices.</p>
      </div>
    </div>
  );

  const discardGuide =
    validActions.includes('discard') && selectedTile
      ? ' discard-ready'
      : validActions.includes('discard') && !selectedTile
        ? ' discard-pick'
        : '';

  if (isMobile) {
    const latestLog = state.log[state.log.length - 1];
    const tickerMessage = latestLog ? latestLog.message : 'Game started. Pass or draw to begin.';

    return (
      <div
        className={`game-board mobile${claimPending ? ' claim-active' : ''}${
          humanPlayer.exposedSets.length > 0 ? ' has-exposed' : ''
        }${discardGuide}`}
      >
        {rotatePrompt}
        <div className="mobile-top-bar">
          <div className="status-pill round">
            <span className="label">R:</span>
            <span className="val">{state.roundNumber}</span>
          </div>
          <div className="status-pill turn">
            <span className="label">T:</span>
            <span className="val">{state.turnNumber}</span>
          </div>
          <div className="status-pill wall">
            <span className="label">Wall:</span>
            <span className="val">{wallRemaining(state.wall)}</span>
          </div>
        </div>

        <div className="mobile-opponents-row">
          {opponentIndices.map(idx => {
            const opp = state.players[idx]!;
            return (
              <div
                key={idx}
                className={`mobile-opponent-card${state.currentPlayerIndex === idx ? ' active' : ''}`}
              >
                <div className="opp-avatar-row">
                  <div className="opp-avatar">{opp.seatWind[0]?.toUpperCase()}</div>
                  <div className="opp-meta">
                    <span className="opp-name">{opp.name}</span>
                    <span className="opp-count">
                      Hand: {opp.hand.length}
                      {opp.exposedSets.length > 0
                        ? ` · ${opp.exposedSets.length} exposed`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Exposed melds are public - show them readable (not tiny in the seat cards) */}
        {opponentIndices.some(idx => state.players[idx]!.exposedSets.length > 0) && (
          <div className="mobile-table-exposed" aria-label="Opponents’ exposed sets">
            <span className="mobile-table-exposed-label">Table</span>
            <div className="mobile-table-exposed-scroll">
              {opponentIndices.map(idx => {
                const opp = state.players[idx]!;
                if (opp.exposedSets.length === 0) return null;
                return (
                  <div key={idx} className="mobile-table-exposed-player">
                    <span className="mobile-table-exposed-name">{opp.name}</span>
                    {opp.exposedSets.map((set, sIdx) => (
                      <div key={sIdx} className="mobile-table-exposed-set">
                        {set.tiles.map(tile => {
                          const isJok = tile.kind.type === 'joker';
                          const canSwap = isJok && canSwapJoker;
                          return (
                            <TileComponent
                              key={tile.id}
                              tile={tile}
                              size="mini"
                              faceUp
                              showIdentity
                              clickable={canSwap}
                              onClick={canSwap ? () => handleExposedJokerClick(tile) : undefined}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          className="mobile-activity-ticker"
          onClick={() => setShowRecent(r => !r)}
          aria-expanded={showRecent}
        >
          <span className="ticker-dot" />
          <span className="ticker-text">{tickerMessage}</span>
        </button>
        {showRecent && (
          <div className="mobile-recent-log">
            {state.log.slice(-6).reverse().map((entry, i) => (
              <div key={i} className="log-entry">{entry.message}</div>
            ))}
          </div>
        )}
        {progress && <div className="coach-hand-hint">{progress}</div>}
        {showJokerTip && canSwapJoker && (
          <div className="coach-banner coach-banner--inline">
            <p>
              Joker swap: select a natural tile that matches an exposed set, then tap the{' '}
              <strong>jellyfish</strong> (joker) to swap.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => {
                markJokerSwapTipSeen();
                setShowJokerTip(false);
              }}
            >
              Got it
            </button>
          </div>
        )}
        {tableChip}

        <div className="mobile-discard-pool">
          {allDiscards.length === 0 && <span className="discard-pool-label">Discards</span>}
          <div className="discard-grid">
            {allDiscards.map(tile => (
              <TileComponent
                key={tile.id}
                tile={tile}
                size="mini"
                isLastDiscard={state.lastDiscard?.id === tile.id}
              />
            ))}
          </div>
        </div>

        <div
          className={`mobile-bottom-bar${
            humanPlayer.exposedSets.length > 0 ? ' has-exposed' : ''
          }`}
        >
          {/* Zone 1: identity + tools - never scrolls over the hand */}
          <div className="mobile-player-status">
            <div className="player-avatar-col">
              <div className="player-avatar" aria-hidden>
                {humanPlayer.seatWind[0]?.toUpperCase()}
              </div>
              <div className="player-meta">
                <span className="player-name">{humanPlayer.name}</span>
                <span className="player-score-col">{humanPlayer.score} pts</span>
              </div>
            </div>
            <div className="mobile-utility-btns" role="toolbar" aria-label="Game tools">
              <button
                type="button"
                className="btn-tool btn-tool--accent"
                onClick={() => setShowHandCard(true)}
              >
                Card
              </button>
              <button type="button" className="btn-tool" onClick={openHelp}>
                Help
              </button>
              <button
                type="button"
                className="btn-tool"
                onClick={onOpenSettings}
                aria-label="Settings"
                title="Settings"
              >
                ···
              </button>
            </div>
          </div>

          {/* Zone 2: exposed melds - own row, compact, cannot cover the hand */}
          {humanPlayer.exposedSets.length > 0 && (
            <div className="mobile-player-exposed" aria-label="Your exposed sets">
              <span className="mobile-exposed-label">Exposed</span>
              {humanPlayer.exposedSets.map((set, i) => (
                <div key={i} className="mobile-exposed-set">
                  {set.tiles.map(tile => {
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

          {/* Zone 3: hand - reserved height, horizontal scroll only */}
          <div className="mobile-hand-slot">
            <HandRack
              className="mobile-player-hand"
              tiles={orderedHand}
              selectedTile={selectedTile}
              clickable={isMyTurn && state.hasDrawn}
              onTileClick={handleTileClick}
              onMoveTile={moveTile}
              size="normal"
            />
          </div>
          <div className="hand-tools">
            <span className="hand-tools-hint">
              {inputProfile === 'desktop'
                ? 'Drag tiles to group your hand'
                : 'Slide a tile to rearrange'}
            </span>
            <button
              type="button"
              className="btn-sort"
              onClick={handleSortHand}
              disabled={!isCustomOrder}
              aria-label="Sort hand by suit and rank"
            >
              Sort
            </button>
          </div>

          {isClaimWindow && state.lastDiscard && teachMode !== 'expert' && (
            <ClaimCoach
              discard={state.lastDiscard}
              discarderName={discarder?.name}
              claimActions={claimActions}
              onHelp={openHelp}
            />
          )}

          {/* Zone 4: actions / hints - always below the hand */}
          <div
            className={`mobile-action-bar${isClaimWindow ? ' claim-mode' : ''}${
              validActions.includes('draw') ? ' draw-ready' : ''
            }${discardGuide}`}
          >
            {waitingOnClaims ? (
              <div className="mobile-action-hint" role="status">
                Waiting for other claims
                <BusyDots />
              </div>
            ) : hint ? (
              <div className="mobile-action-hint" role="status">
                {hint}
              </div>
            ) : null}
            <div className="mobile-action-buttons">
              <ActionButtons
                validActions={validActions}
                canDiscard={!!selectedTile}
                onAction={requestAction}
                onDiscard={handleDiscard}
              />
            </div>
            {!hint && !waitingOnClaims && (
              <span className="mobile-turn-indicator">
                {isClaimWindow
                  ? 'Choose a claim, or Pass'
                  : isMyTurn
                    ? '● Your Turn'
                    : `● ${state.players[state.currentPlayerIndex]?.name}'s turn`}
              </span>
            )}
          </div>
        </div>

        {overlays}
      </div>
    );
  }

  return (
    <div className={`game-board${discardGuide}`}>
      {rotatePrompt}
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
          <div className="board-utility-btns" role="toolbar" aria-label="Game tools">
            <button
              type="button"
              className="btn btn-primary btn-compact"
              onClick={() => setShowHandCard(true)}
            >
              Hand Card
            </button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={openHelp}>
              Help
            </button>
            <button type="button" className="btn btn-secondary btn-compact" onClick={onOpenSettings}>
              Settings
            </button>
          </div>
        </div>
        <OpponentDisplay
          player={state.players[opponentIndices[0]!]!}
          isActive={state.currentPlayerIndex === opponentIndices[0]}
          position="top"
          onJokerClick={handleExposedJokerClick}
          canSwapJoker={canSwapJoker}
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

      <div className="center-area">
        <div className="opponent-area left">
          <OpponentDisplay
            player={state.players[opponentIndices[2]!]!}
            isActive={state.currentPlayerIndex === opponentIndices[2]}
            position="left"
            onJokerClick={handleExposedJokerClick}
            canSwapJoker={canSwapJoker}
          />
        </div>
        <div className="discard-pool">
          {allDiscards.length === 0 ? (
            <div className="discard-pool-empty" aria-hidden="true">
              <span className="discard-pool-empty-count">{wallRemaining(state.wall)}</span>
              <span className="discard-pool-empty-title">Discards</span>
              <span className="discard-pool-empty-sub">tiles left in the wall</span>
            </div>
          ) : (
            allDiscards.map(tile => (
              <TileComponent
                key={tile.id}
                tile={tile}
                size="mini"
                isLastDiscard={state.lastDiscard?.id === tile.id}
              />
            ))
          )}
        </div>
        <div className="opponent-area right">
          <OpponentDisplay
            player={state.players[opponentIndices[1]!]!}
            isActive={state.currentPlayerIndex === opponentIndices[1]}
            position="right"
            onJokerClick={handleExposedJokerClick}
            canSwapJoker={canSwapJoker}
          />
        </div>
      </div>

      <div className="bottom-bar">
        {progress && <div className="coach-hand-hint">{progress}</div>}
        {showJokerTip && canSwapJoker && (
          <div className="coach-banner coach-banner--inline">
            <p>
              Joker swap: select a natural tile that matches an exposed set, then tap the{' '}
              <strong>jellyfish</strong> (joker) to swap.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => {
                markJokerSwapTipSeen();
                setShowJokerTip(false);
              }}
            >
              Got it
            </button>
          </div>
        )}
        {tableChip}
        <div className="player-info-bar">          <span className="player-name">{humanPlayer.name}</span>
          <span className="player-wind">{humanPlayer.seatWind}</span>
          <span className="player-score">Score: {humanPlayer.score}</span>
        </div>
        <div className="player-hand-container">
          {humanPlayer.exposedSets.length > 0 && (
            <div className="exposed-sets" aria-label="Your exposed sets">
              {humanPlayer.exposedSets.map((set, i) => (
                <div key={i} className="exposed-set">
                  {set.tiles.map(tile => {
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
          <HandRack
            className="player-hand"
            tiles={orderedHand}
            selectedTile={selectedTile}
            clickable={isMyTurn && state.hasDrawn}
            onTileClick={handleTileClick}
            onMoveTile={moveTile}
          />
          <div className="hand-tools">
            <span className="hand-tools-hint">
              {inputProfile === 'tablet'
                ? 'Drag tiles to rearrange · Shift + ← → with a keyboard'
                : 'Drag tiles to group your hand · Shift + ← → to rearrange'}
            </span>
            <button
              type="button"
              className="btn-sort"
              onClick={handleSortHand}
              disabled={!isCustomOrder}
              aria-label="Sort hand by suit and rank"
            >
              Sort
            </button>
          </div>
        </div>

        <div className="action-bar-wrap">
          {isClaimWindow && state.lastDiscard && teachMode !== 'expert' && (
            <ClaimCoach
              discard={state.lastDiscard}
              discarderName={discarder?.name}
              claimActions={claimActions}
              onHelp={openHelp}
              variant="desktop"
            />
          )}
          <div
            className={`action-bar${isClaimWindow ? ' claim-mode' : ''}${
              validActions.includes('draw') ? ' draw-ready' : ''
            }${discardGuide}`}
          >
            <span className={`turn-indicator${isMyTurn ? ' your-turn' : ''}`}>
              {waitingOnClaims ? (
                <>
                  Waiting for other claims
                  <BusyDots />
                </>
              ) : (
                hint ??
                (isClaimWindow
                  ? 'Claim or Pass'
                  : isMyTurn
                    ? 'Your Turn'
                    : `${state.players[state.currentPlayerIndex]?.name}'s turn`)
              )}
            </span>
            <ActionButtons
              validActions={validActions}
              canDiscard={!!selectedTile}
              onAction={requestAction}
              onDiscard={handleDiscard}
            />
          </div>
        </div>
      </div>

      <div className="game-log">
        {state.log.slice(-8).reverse().map((entry, i) => (
          <div key={i} className="log-entry">{entry.message}</div>
        ))}
      </div>

      {overlays}
    </div>
  );
}

function OpponentDisplay({
  player,
  isActive,
  position,
  onJokerClick,
  canSwapJoker,
}: {
  player: Player;
  isActive: boolean;
  position: 'top' | 'left' | 'right';
  onJokerClick?: (tile: Tile) => void;
  canSwapJoker?: boolean;
}) {
  const tileCount = player.hand.length;
  const maxShow = position === 'top' ? 14 : 8;

  return (
    <div className={`opponent-info${isActive ? ' active' : ''}`}>
      <span className="opponent-name">{player.name}</span>
      <span className="opponent-wind">{player.seatWind}</span>
      <span className="opponent-tile-count">{tileCount} tiles</span>
      <div className={`opponent-tiles${position !== 'top' ? ' vertical' : ''}`}>
        {Array.from({ length: Math.min(tileCount, maxShow) }, (_, i) => (
          <TileComponent key={i} faceUp={false} size="tiny" />
        ))}
      </div>
      {player.exposedSets.length > 0 && (
        <div className="opponent-exposed">
          {player.exposedSets.map((set, i) => (
            <div key={i} className="opponent-exposed-set">
              {set.tiles.map(tile => {
                const isJok = tile.kind.type === 'joker';
                const canSwap = !!(isJok && canSwapJoker);
                return (
                  <TileComponent
                    key={tile.id}
                    tile={tile}
                    size="mini"
                    faceUp
                    showIdentity
                    clickable={canSwap}
                    onClick={canSwap ? () => onJokerClick?.(tile) : undefined}
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
