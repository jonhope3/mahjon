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
  noteMultiplayerReturnFromUrl,
  shouldOpenMultiplayerLobby,
} from './multiplayer-fresh';

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

  useEffect(() => () => peerManagerRef.current?.disconnect(), []);

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
        setGameState(current => {
          if (!current) return null;
          const next = {
            ...current,
            players: current.players.map((p, i) =>
              i === playerIndex
                ? { ...p, type: 'ai' as const, difficulty: p.difficulty ?? 'medium' }
                : p,
            ),
          };
          peerManagerRef.current?.syncGameState(next);
          return next;
        });
      },
      onPlayerRejoined: playerIndex => {
        setGameState(current => {
          if (!current) return null;
          const next = {
            ...current,
            players: current.players.map((p, i) =>
              i === playerIndex ? { ...p, type: 'human' as const } : p,
            ),
          };
          peerManagerRef.current?.syncGameState(next);
          return next;
        });
      },
      onGameAction: msg => {
        if (!peerManagerRef.current?.isHost) return;
        const serializableAction = msg.payload.action;
        setGameState(current => {
          if (!current) return null;
          const targetTile =
            serializableAction.targetTileId !== undefined &&
            current.lastDiscard?.id === serializableAction.targetTileId
              ? current.lastDiscard
              : undefined;
          const newState = processAction(current, {
            type: serializableAction.type,
            playerId: serializableAction.playerId,
            tiles: serializableAction.tiles,
            targetTile,
          });
          peerManagerRef.current?.syncGameState(newState);
          return newState;
        });
      },
      onCharlestonTiles: (playerIdx, tileIds) => {
        if (!peerManagerRef.current?.isHost) return;
        charlestonSelectionsRef.current.set(playerIdx, tileIds);
        const current = gameStateRef.current;
        if (current) finishHostCharleston(current, charlestonSelectionsRef.current);
      },
      onCharlestonControl: kind => {
        if (!peerManagerRef.current?.isHost) return;
        const current = gameStateRef.current;
        if (!current || !current.phase.startsWith('charleston')) return;
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
  }, [enterPlaying, finishHostCharleston]);

  // After a multiplayer-bound cache reload (?mp=1), open the lobby automatically
  useEffect(() => {
    noteMultiplayerReturnFromUrl();
  }, []);

  useEffect(() => {
    if (screen !== 'menu') return;
    if (!shouldOpenMultiplayerLobby()) return;
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
    if (peerManagerRef.current?.isHost) {
      enterPlaying(dealt, 0);
      peerManagerRef.current.startGame(dealt);
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
    peerManagerRef.current?.disconnect();
    setPeerManager(null);
    setGameState(null);
    setSelectedTile(null);
    goScreen(setScreen, 'menu');
  }, [clearTimers]);

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

  const showCharleston =
    !!gameState &&
    gameState.phase.startsWith('charleston') &&
    gameState.phase !== 'playing';

  return (
    <>
      <UpdateBanner />
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
          inGame={screen === 'playing' && !!gameState}
          players={gameState?.players}
          roomCode={peerManager?.roomCode || undefined}
          resumeKey={peerManager?.resumeKey || undefined}
          onApplyLiveNames={(names: string[]) => {
            setGameState(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.map((p, i) => ({
                  ...p,
                  name: names[i] ?? p.name,
                })),
              };
            });
          }}
          onNewGame={
            !peerManager || peerManager.isHost ? handleNewGameFromSettings : undefined
          }
          onQuitToMenu={handleQuitToMenu}
        />
      )}
    </>
  );
}
