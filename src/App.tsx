// ============================================================
// App — screens, game state, multiplayer glue
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, Tile, ActionType } from './engine/types';
import { GameConfig, createGame, dealTiles, processAction, startNextRound, skipCharleston, advanceCharlestonWithoutPass } from './engine/game';
import { getCharlestonRound } from './engine/charleston';
import {
  applyCharlestonPass,
  resolveCharlestonSelections,
  runSoloCharleston,
} from './game/charleston-flow';
import { MainMenu } from './components/MainMenu';
import { GameBoard } from './components/GameBoard';
import { CharlestonDialog } from './components/CharlestonDialog';
import { LobbyScreen } from './components/LobbyScreen';
import { Tutorial } from './components/Tutorial';
import { SettingsPanel } from './components/SettingsPanel';
import { UpdateBanner } from './components/UpdateBanner';
import { PeerManager } from './network/peer-manager';
import { serializeAction } from './network/protocol';
import { AppPrefs, loadPrefs, prefsToGamePlayers, savePrefs } from './game-settings';
import { useAIGameLoop } from './hooks/useAIGameLoop';
import {
  clearMultiplayerLobbyIntent,
  ensureFreshForMultiplayer,
  markOpenMultiplayerLobby,
  noteMultiplayerReturnFromUrl,
  shouldOpenMultiplayerLobby,
} from './multiplayer-fresh';
import { noteMpDeepLinkFromUrl, saveMpLastTable } from './mp-session';
import './styles/index.css';
import './styles/menu.css';
import './styles/game.css';
import './styles/tiles.css';

type Screen = 'menu' | 'connecting' | 'playing' | 'lobby' | 'tutorial';

function goScreen(setScreen: (s: Screen) => void, next: Screen) {
  const run = () => setScreen(next);
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => void;
  };
  if (doc.startViewTransition) doc.startViewTransition(run);
  else run();
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [humanPlayerIndex, setHumanPlayerIndex] = useState(0);
  const [peerManager, setPeerManager] = useState<PeerManager | null>(null);
  const [prefs, setPrefs] = useState<AppPrefs>(() => loadPrefs());
  const [showSettings, setShowSettings] = useState(false);
  const [charlestonWaiting, setCharlestonWaiting] = useState(false);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const humanPlayerIndexRef = useRef(humanPlayerIndex);
  humanPlayerIndexRef.current = humanPlayerIndex;
  const peerManagerRef = useRef(peerManager);
  peerManagerRef.current = peerManager;
  const charlestonSelectionsRef = useRef(new Map<number, number[]>());
  const disconnectGraceRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  // Family tables: give people time to unlock a phone / switch Wi‑Fi before AI takes over
  const DISCONNECT_GRACE_MS = 60000;

  const clearDisconnectGrace = useCallback((playerIndex?: number) => {
    if (playerIndex !== undefined) {
      const t = disconnectGraceRef.current.get(playerIndex);
      if (t) clearTimeout(t);
      disconnectGraceRef.current.delete(playerIndex);
      return;
    }
    for (const t of disconnectGraceRef.current.values()) clearTimeout(t);
    disconnectGraceRef.current.clear();
  }, []);

  const { clearTimers } = useAIGameLoop(
    gameState,
    humanPlayerIndex,
    peerManager,
    prefs.speed,
    setGameState,
  );

  useEffect(() => {
    document.documentElement.className = `app-screen-${screen}`;
    return () => {
      document.documentElement.className = '';
    };
  }, [screen]);

  useEffect(
    () => () => {
      peerManagerRef.current?.disconnect();
      clearDisconnectGrace();
    },
    [clearDisconnectGrace],
  );

  const finishHostCharleston = useCallback((state: GameState, selections: Map<number, number[]>) => {
    const pm = peerManagerRef.current;
    if (!pm?.isHost) return;
    const resolved = resolveCharlestonSelections(state, selections);
    if (!resolved) return;
    selections.clear();
    const next = applyCharlestonPass(state, resolved);
    setGameState(next);
    pm.syncGameState(next);
  }, []);

  const enterPlaying = useCallback((state: GameState, seat: number) => {
    setGameState(state);
    setHumanPlayerIndex(seat);
    setSelectedTile(null);
    goScreen(setScreen, 'playing');
  }, []);

  const handlePlayMultiplayer = useCallback(() => {
    const pm = new PeerManager({
      onStatusChange: () => {},
      onLobbyUpdate: () => {},
      onGameStart: (state, playerIndex) => enterPlaying(state, playerIndex),
      onGameStateSync: setGameState,
      onPlayerDisconnected: playerIndex => {
        clearDisconnectGrace(playerIndex);
        const timer = setTimeout(() => {
          disconnectGraceRef.current.delete(playerIndex);
          setGameState(current => {
            if (!current) return null;
            const seat = current.players[playerIndex];
            if (!seat || seat.type === 'ai') return current;
            const next = {
              ...current,
              players: current.players.map((p, i) =>
                i === playerIndex
                  ? { ...p, type: 'ai' as const, difficulty: p.difficulty ?? 'medium' }
                  : p,
              ),
              log: [
                ...current.log,
                {
                  timestamp: Date.now(),
                  playerId: 'system',
                  action: 'pass' as const,
                  message: `${seat.name} disconnected — AI is playing their seat until they rejoin.`,
                },
              ],
            };
            peerManagerRef.current?.syncGameState(next);
            return next;
          });
        }, DISCONNECT_GRACE_MS);
        disconnectGraceRef.current.set(playerIndex, timer);
        setGameState(current => {
          if (!current) return null;
          const seat = current.players[playerIndex];
          if (!seat) return current;
          return {
            ...current,
            log: [
              ...current.log,
              {
                timestamp: Date.now(),
                playerId: 'system',
                action: 'pass' as const,
                message: `${seat.name} lost connection — waiting briefly before AI takes over…`,
              },
            ],
          };
        });
      },
      onPlayerRejoined: playerIndex => {
        clearDisconnectGrace(playerIndex);
        setGameState(current => {
          if (!current) return null;
          const next = {
            ...current,
            players: current.players.map((p, i) =>
              i === playerIndex ? { ...p, type: 'human' as const } : p,
            ),
            log: [
              ...current.log,
              {
                timestamp: Date.now(),
                playerId: 'system',
                action: 'pass' as const,
                message: `${current.players[playerIndex]?.name ?? 'Player'} rejoined.`,
              },
            ],
          };
          peerManagerRef.current?.syncGameState(next);
          return next;
        });
      },
      onGameAction: (msg, playerIndex) => {
        if (!peerManagerRef.current?.isHost) return;
        const serializableAction = msg.payload.action;
        setGameState(current => {
          if (!current) return null;
          const seatPlayer = current.players[playerIndex];
          if (!seatPlayer || seatPlayer.type !== 'human') return current;
          const targetTile =
            serializableAction.targetTileId !== undefined &&
            current.lastDiscard?.id === serializableAction.targetTileId
              ? current.lastDiscard
              : undefined;
          // Authenticated seat — ignore client-supplied playerId
          const newState = processAction(current, {
            type: serializableAction.type,
            playerId: seatPlayer.id,
            tiles: serializableAction.tiles,
            targetTile,
          });
          peerManagerRef.current?.syncGameState(newState);
          return newState;
        });
      },
      onCharlestonTiles: (playerIdx, tileIds) => {
        if (!peerManagerRef.current?.isHost) return;
        const current = gameStateRef.current;
        if (!current) return;
        const round = getCharlestonRound(current.phase);
        const unique = new Set(tileIds);
        if (unique.size !== tileIds.length) return;
        if (round === 'courtesy') {
          if (tileIds.length > 3) return;
        } else if (tileIds.length !== 3) {
          return;
        }
        charlestonSelectionsRef.current.set(playerIdx, tileIds);
        finishHostCharleston(current, charlestonSelectionsRef.current);
      },
      onCharlestonControl: (kind, _playerIndex) => {
        if (!peerManagerRef.current?.isHost) return;
        const current = gameStateRef.current;
        if (!current || !current.phase.startsWith('charleston')) return;
        const round = getCharlestonRound(current.phase);
        if (round === 'first') return;
        if (kind === 'skip_rest' && round !== 'second' && round !== 'courtesy') return;
        const next =
          kind === 'skip_rest'
            ? skipCharleston(current)
            : advanceCharlestonWithoutPass(current);
        charlestonSelectionsRef.current.clear();
        setGameState(next);
        setCharlestonWaiting(false);
        peerManagerRef.current.syncGameState(next);
      },
      onChat: () => {},
      onError: () => {},
    });
    setPeerManager(pm);
    goScreen(setScreen, 'lobby');
  }, [enterPlaying, finishHostCharleston, clearDisconnectGrace]);

  // After a multiplayer-bound cache reload (?mp=1), or a ?room= invite link, open the lobby
  useEffect(() => {
    noteMultiplayerReturnFromUrl();
    if (noteMpDeepLinkFromUrl()) markOpenMultiplayerLobby();
  }, []);

  useEffect(() => {
    if (screen !== 'menu') return;
    if (!shouldOpenMultiplayerLobby()) return;
    clearMultiplayerLobbyIntent();
    handlePlayMultiplayer();
  }, [screen, handlePlayMultiplayer]);

  const openMultiplayer = useCallback(async () => {
    goScreen(setScreen, 'connecting');
    const result = await ensureFreshForMultiplayer();
    if (result === 'reloading') return;
    handlePlayMultiplayer();
  }, [handlePlayMultiplayer]);

  const handleStartGame = useCallback((config: GameConfig) => {
    const dealt = dealTiles(createGame(config));
    const pm = peerManagerRef.current;
    if (pm?.roomCode && pm.resumeKey) {
      const seatName =
        config.players[pm.playerIndex]?.name ||
        config.players[0]?.name ||
        'Player';
      saveMpLastTable({
        roomCode: pm.roomCode,
        seatKey: pm.resumeKey,
        playerName: seatName,
      });
    }
    if (pm?.isHost) {
      enterPlaying(dealt, 0);
      pm.startGame(dealt);
      return;
    }
    enterPlaying(dealt, 0);
  }, [enterPlaying]);

  const handleAction = useCallback((actionType: ActionType, tiles?: Tile[]) => {
    const state = gameStateRef.current;
    if (!state) return;

    if (state.phase === 'round_end' && actionType === 'draw') {
      if (!peerManager || peerManager.isHost) {
        const next = startNextRound(state);
        enterPlaying(next, humanPlayerIndexRef.current);
        if (peerManager?.isHost) peerManager.startGame(next);
      }
      return;
    }

    const player = state.players[humanPlayerIndexRef.current]!;
    const action = {
      type: actionType,
      playerId: player.id,
      tiles,
      targetTile: state.lastDiscard || undefined,
    };

    if (peerManager && !peerManager.isHost) {
      peerManager.sendAction({
        type: 'game_action',
        payload: { action: serializeAction(action) },
      });
      return;
    }

    const newState = processAction(state, action);
    setGameState(newState);
    if (peerManager?.isHost) peerManager.syncGameState(newState);
  }, [peerManager, enterPlaying]);

  const handleCharlestonConfirm = useCallback((tiles: Tile[]) => {
    const state = gameStateRef.current;
    if (!state) return;
    const humanIdx = humanPlayerIndexRef.current;

    if (peerManager) {
      if (peerManager.isHost) {
        charlestonSelectionsRef.current.set(humanIdx, tiles.map(t => t.id));
        finishHostCharleston(state, charlestonSelectionsRef.current);
        setCharlestonWaiting(true);
      } else {
        peerManager.sendCharlestonTiles(humanIdx, tiles.map(t => t.id));
        setCharlestonWaiting(true);
      }
      return;
    }

    setGameState(runSoloCharleston(state, humanIdx, tiles));
  }, [peerManager, finishHostCharleston]);

  const handleSkipPass = useCallback(() => {
    const state = gameStateRef.current;
    if (!state) return;
    if (getCharlestonRound(state.phase) === 'first') return;
    if (peerManager && !peerManager.isHost) {
      setCharlestonWaiting(true);
      peerManager.sendCharlestonControl('skip_pass');
      return;
    }
    const next = advanceCharlestonWithoutPass(state);
    charlestonSelectionsRef.current.clear();
    setGameState(next);
    setCharlestonWaiting(false);
    if (peerManager?.isHost) peerManager.syncGameState(next);
  }, [peerManager]);

  const handleSkipRest = useCallback(() => {
    const state = gameStateRef.current;
    if (!state) return;
    const round = getCharlestonRound(state.phase);
    if (round !== 'second' && round !== 'courtesy') return;
    if (peerManager && !peerManager.isHost) {
      setCharlestonWaiting(true);
      peerManager.sendCharlestonControl('skip_rest');
      return;
    }
    const next = skipCharleston(state);
    charlestonSelectionsRef.current.clear();
    setGameState(next);
    setCharlestonWaiting(false);
    if (peerManager?.isHost) peerManager.syncGameState(next);
  }, [peerManager]);

  useEffect(() => {
    setCharlestonWaiting(false);
  }, [gameState?.phase]);

  const handlePrefsChange = useCallback((next: AppPrefs) => {
    setPrefs(next);
    savePrefs(next);
  }, []);

  const handleQuitToMenu = useCallback(() => {
    clearTimers();
    clearDisconnectGrace();
    clearMultiplayerLobbyIntent();
    peerManagerRef.current?.disconnect();
    setPeerManager(null);
    setGameState(null);
    setSelectedTile(null);
    goScreen(setScreen, 'menu');
  }, [clearTimers, clearDisconnectGrace]);

  const handleNewGameFromSettings = useCallback(() => {
    if (peerManagerRef.current && !peerManagerRef.current.isHost) return;
    const current = gameStateRef.current;
    handleStartGame({
      players: current
        ? current.players.map(p => ({
            name: p.name,
            type: p.type,
            difficulty: p.difficulty,
          }))
        : prefsToGamePlayers(prefs),
    });
  }, [prefs, handleStartGame]);

  const applyLiveNames = useCallback((names: string[]) => {
    setGameState(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        players: prev.players.map((p, i) => ({
          ...p,
          name: names[i] ?? p.name,
        })),
      };
      if (peerManagerRef.current?.isHost) {
        peerManagerRef.current.syncGameState(next);
      }
      return next;
    });
  }, []);

  const showCharleston =
    !!gameState &&
    gameState.phase.startsWith('charleston') &&
    gameState.phase !== 'playing';

  const inGame = screen === 'playing' && !!gameState;

  return (
    <>
      <UpdateBanner inGame={inGame} />
      {screen === 'menu' && (
        <MainMenu
          onStartGame={handleStartGame}
          onPlayMultiplayer={openMultiplayer}
          onStartTutorial={() => goScreen(setScreen, 'tutorial')}
          onOpenSettings={() => setShowSettings(true)}
          prefs={prefs}
        />
      )}
      {screen === 'connecting' && (
        <div className="connecting-screen" role="status" aria-live="polite">
          <div className="connecting-card">
            <h1>Mahjon</h1>
            <p className="connecting-title">Connecting…</p>
            <p className="connecting-hint">Getting the latest version so everyone plays the same build</p>
          </div>
        </div>
      )}
      {screen === 'lobby' && peerManager && (
        <LobbyScreen
          peerManager={peerManager}
          onStartGame={handleStartGame}
          defaultName={prefs.humanName}
          onOpenSettings={() => setShowSettings(true)}
          onBack={() => {
            clearMultiplayerLobbyIntent();
            peerManager.disconnect();
            setPeerManager(null);
            goScreen(setScreen, 'menu');
          }}
        />
      )}
      {screen === 'tutorial' && (
        <Tutorial
          onBack={() => goScreen(setScreen, 'menu')}
          onStartPlaying={() => {
            handleStartGame({ players: prefsToGamePlayers(prefs) });
          }}
        />
      )}
      {screen === 'playing' && gameState && (
        <>
          <GameBoard
            state={gameState}
            humanPlayerIndex={humanPlayerIndex}
            onAction={handleAction}
            selectedTile={selectedTile}
            onSelectTile={setSelectedTile}
            onOpenSettings={() => setShowSettings(true)}
            onQuitToMenu={handleQuitToMenu}
            teachMode={prefs.teachMode}
            roomCode={peerManager?.roomCode || undefined}
            resumeKey={peerManager?.resumeKey || undefined}
            isHost={!!peerManager?.isHost}
            canStartNextRound={!peerManager || peerManager.isHost}
          />
          {showCharleston && (
            <CharlestonDialog
              phase={gameState.phase}
              hand={gameState.players[humanPlayerIndex]!.hand}
              onConfirm={handleCharlestonConfirm}
              teachMode={prefs.teachMode}
              waitingForOthers={charlestonWaiting}
              onSkip={
                getCharlestonRound(gameState.phase) !== 'first'
                  ? handleSkipPass
                  : undefined
              }
              onSkipRest={
                getCharlestonRound(gameState.phase) === 'second' ||
                getCharlestonRound(gameState.phase) === 'courtesy'
                  ? handleSkipRest
                  : undefined
              }
            />
          )}
        </>
      )}

      {showSettings && (
        <SettingsPanel
          prefs={prefs}
          onPrefsChange={handlePrefsChange}
          onClose={() => setShowSettings(false)}
          inGame={inGame}
          players={gameState?.players}
          roomCode={peerManager?.roomCode || undefined}
          resumeKey={peerManager?.resumeKey || undefined}
          onApplyLiveNames={
            !peerManager || peerManager.isHost ? applyLiveNames : undefined
          }
          onNewGame={
            !peerManager || peerManager.isHost ? handleNewGameFromSettings : undefined
          }
          onQuitToMenu={handleQuitToMenu}
        />
      )}
    </>
  );
}
