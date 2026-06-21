// ============================================================
// App — Root component with game state management
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, Tile, ActionType, GamePhase, GameAction } from './engine/types';
import { GameConfig, createGame, dealTiles, processAction, advanceTurn, skipCharleston } from './engine/game';
import { getAIAction, getAICharlestonTiles } from './ai/ai-player';
import { getValidActions } from './engine/actions';
import {
  executeCharlestonPass,
  nextCharlestonPhase,
  getCharlestonRound,
} from './engine/charleston';
import { MainMenu } from './components/MainMenu';
import { GameBoard } from './components/GameBoard';
import { CharlestonDialog } from './components/CharlestonDialog';
import { LobbyScreen } from './components/LobbyScreen';
import { Tutorial } from './components/Tutorial';
import { PeerManager } from './network/peer-manager';
import { serializeAction } from './network/protocol';

import './styles/index.css';
import './styles/menu.css';
import './styles/game.css';

type Screen = 'menu' | 'playing' | 'lobby' | 'tutorial';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [humanPlayerIndex, setHumanPlayerIndex] = useState(0);
  const [peerManager, setPeerManager] = useState<PeerManager | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs of current values to avoid dependency array issues in useCallback
  const gameStateRef = useRef<GameState | null>(null);
  gameStateRef.current = gameState;
  const humanPlayerIndexRef = useRef(humanPlayerIndex);
  humanPlayerIndexRef.current = humanPlayerIndex;
  const peerManagerRef = useRef<PeerManager | null>(null);
  peerManagerRef.current = peerManager;

  const charlestonSelectionsRef = useRef<Map<number, number[]>>(new Map());

  // Check and execute Charleston if all players ready
  const checkCharlestonComplete = useCallback((state: GameState, selections: Map<number, number[]>) => {
    if (!peerManagerRef.current || !peerManagerRef.current.isHost) return;

    const newSelections = new Map<number, Tile[]>();

    for (let i = 0; i < 4; i++) {
      const p = state.players[i]!;
      if (p.type === 'ai') {
        const aiTiles = getAICharlestonTiles(p);
        newSelections.set(i, aiTiles);
      } else {
        const ids = selections.get(i);
        if (!ids || ids.length !== 3) {
          // Still waiting for this human player
          return;
        }
        const tiles = ids.map(id => p.hand.find(t => t.id === id)!).filter(Boolean);
        if (tiles.length !== 3) return; // safety check
        newSelections.set(i, tiles);
      }
    }

    // All 4 players ready - execute pass
    const newPlayers = executeCharlestonPass(state.players, newSelections, state.phase);
    const nextPhase = nextCharlestonPhase(state.phase);

    const newState = {
      ...state,
      players: newPlayers,
      phase: nextPhase,
    };

    selections.clear();
    setGameState(newState);
    peerManagerRef.current.syncGameState(newState);
  }, []);

  // Initialize PeerJS Room Manager
  const handlePlayMultiplayer = useCallback(() => {
    const pm = new PeerManager({
      onStatusChange: () => {},
      onLobbyUpdate: () => {},
      onGameStart: (state, playerIndex) => {
        setGameState(state);
        setHumanPlayerIndex(playerIndex);
        setSelectedTile(null);
        setScreen('playing');
      },
      onGameStateSync: (state) => {
        setGameState(state);
      },
      onGameAction: (msg) => {
        if (!peerManagerRef.current?.isHost) return;
        const serializableAction = msg.payload.action;

        setGameState(current => {
          if (!current) return null;

          let targetTile: Tile | undefined;
          if (serializableAction.targetTileId !== undefined) {
            if (current.lastDiscard?.id === serializableAction.targetTileId) {
              targetTile = current.lastDiscard;
            }
          }

          const action = {
            type: serializableAction.type,
            playerId: serializableAction.playerId,
            tiles: serializableAction.tiles,
            targetTile,
          };

          let newState = processAction(current, action);
          if (action.type === 'discard') {
            // opened claim window, let AI loop or human callbacks resolve
          } else if (action.type === 'pass') {
            newState = advanceTurn(newState);
          }

          peerManagerRef.current?.syncGameState(newState);
          return newState;
        });
      },
      onCharlestonTiles: (playerIdx, tileIds) => {
        if (peerManagerRef.current?.isHost) {
          charlestonSelectionsRef.current.set(playerIdx, tileIds);
          setGameState(current => {
            if (current) {
              checkCharlestonComplete(current, charlestonSelectionsRef.current);
            }
            return current;
          });
        }
      },
      onChat: () => {},
      onError: () => {},
    });

    setPeerManager(pm);
    setScreen('lobby');
  }, [checkCharlestonComplete]);

  // Start a new game
  const handleStartGame = useCallback((config: GameConfig) => {
    if (peerManagerRef.current?.isHost) {
      let state = createGame(config);
      state = dealTiles(state);
      setGameState(state);
      setHumanPlayerIndex(0);
      setSelectedTile(null);
      setScreen('playing');
      peerManagerRef.current.startGame(state);
      return;
    }

    // Single-player mode
    const state = createGame(config);
    const dealt = dealTiles(state);
    setGameState(dealt);
    setHumanPlayerIndex(0);
    setSelectedTile(null);
    setScreen('playing');
  }, []);

  // Handle player actions
  const handleAction = useCallback((actionType: ActionType, tiles?: Tile[]) => {
    const state = gameStateRef.current;
    if (!state) return;

    // Special case: "New Round" from round end
    if (state.phase === 'round_end' && actionType === 'draw') {
      if (!peerManager || peerManager.isHost) {
        handleStartGame({
          players: state.players.map(p => ({
            name: p.name,
            type: p.type,
            difficulty: p.difficulty,
          })),
        });
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

    // Client forwards action to Host
    if (peerManager && !peerManager.isHost) {
      peerManager.sendAction({
        type: 'game_action',
        payload: { action: serializeAction(action) },
      });
      return;
    }

    // Local / Host processing
    let newState = processAction(state, action);

    if (actionType === 'discard') {
      setGameState(newState);
      if (peerManager?.isHost) {
        peerManager.syncGameState(newState);
      }
      return;
    }

    if (actionType === 'pass') {
      newState = advanceTurn(newState);
    }

    setGameState(newState);
    if (peerManager?.isHost) {
      peerManager.syncGameState(newState);
    }
  }, [peerManager, handleStartGame]);

  // Handle Charleston confirmation
  const handleCharlestonConfirm = useCallback((tiles: Tile[]) => {
    const state = gameStateRef.current;
    if (!state) return;

    const humanIdx = humanPlayerIndexRef.current;

    // Multiplayer Charleston Selection
    if (peerManager) {
      if (peerManager.isHost) {
        charlestonSelectionsRef.current.set(humanIdx, tiles.map(t => t.id));
        checkCharlestonComplete(state, charlestonSelectionsRef.current);
      } else {
        peerManager.sendCharlestonTiles(humanIdx, tiles.map(t => t.id));
      }
      return;
    }

    // Single-player Charleston Pass
    const selectedTiles = new Map<number, Tile[]>();
    selectedTiles.set(humanIdx, tiles);

    for (let i = 0; i < 4; i++) {
      if (i === humanIdx) continue;
      const aiTiles = getAICharlestonTiles(state.players[i]!);
      selectedTiles.set(i, aiTiles);
    }

    const newPlayers = executeCharlestonPass(state.players, selectedTiles, state.phase);
    const nextPhase = nextCharlestonPhase(state.phase);

    setGameState(prev => prev ? {
      ...prev,
      players: newPlayers,
      phase: nextPhase,
    } : null);
  }, [peerManager, checkCharlestonComplete]);

  // Handle skipping Charleston
  const handleSkipCharleston = useCallback(() => {
    const state = gameStateRef.current;
    if (!state) return;
    const newState = skipCharleston(state);
    setGameState(newState);
    if (peerManager?.isHost) {
      peerManager.syncGameState(newState);
    }
  }, [peerManager]);

  // Cleanup connections on unmount
  useEffect(() => {
    return () => {
      if (peerManagerRef.current) {
        peerManagerRef.current.disconnect();
      }
    };
  }, []);

  // AI game loop
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;

    // In multiplayer, only the host processes AI decisions
    const isMultiplayer = !!peerManager;
    const isHost = peerManager?.isHost;
    if (isMultiplayer && !isHost) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    // Check if any AI needs to respond to a discard
    if (gameState.lastDiscard && gameState.lastDiscardBy) {
      let highestClaim: { playerIdx: number; action: ActionType; priority: number } | null = null;

      for (let i = 0; i < 4; i++) {
        const p = gameState.players[i]!;
        if (p.id === gameState.lastDiscardBy) continue;
        if (i === humanPlayerIndex) continue; // human handles their own claims

        if (p.type === 'ai') {
          const aiAction = getAIAction(gameState, i);
          if (aiAction && aiAction.type !== 'pass') {
            const priority = aiAction.type === 'mahjong' ? 100 :
                            aiAction.type === 'quint' ? 4 :
                            aiAction.type === 'kong' ? 3 :
                            aiAction.type === 'pung' ? 2 : 0;
            if (!highestClaim || priority > highestClaim.priority) {
              highestClaim = { playerIdx: i, action: aiAction.type, priority };
            }
          }
        }
      }

      // Check if any human player can claim
      let humanCanClaim = false;
      for (let i = 0; i < 4; i++) {
        const p = gameState.players[i]!;
        if (p.type === 'human') {
          const humanActions = getValidActions(gameState, i);
          if (humanActions.some(a => ['pung', 'kong', 'quint', 'mahjong'].includes(a))) {
            humanCanClaim = true;
            break;
          }
        }
      }

      if (humanCanClaim) {
        // Wait for human to decide
        return;
      }

      if (highestClaim) {
        // AI claims the discard
        aiTimerRef.current = setTimeout(() => {
          const claimAction = {
            type: highestClaim!.action,
            playerId: gameState.players[highestClaim!.playerIdx]!.id,
            targetTile: gameState.lastDiscard!,
          };
          setGameState(prev => {
            if (!prev) return null;
            const newState = processAction(prev, claimAction);
            if (peerManager?.isHost) {
              peerManager.syncGameState(newState);
            }
            return newState;
          });
        }, 600);
        return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
      }

      // No claims — advance turn
      aiTimerRef.current = setTimeout(() => {
        setGameState(prev => {
          if (!prev) return null;
          const newState = advanceTurn(prev);
          if (peerManager?.isHost) {
            peerManager.syncGameState(newState);
          }
          return newState;
        });
      }, 400);
      return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
    }

    // AI's turn to draw and discard
    if (currentPlayer.type === 'ai' && currentPlayer.id !== gameState.lastDiscardBy) {
      aiTimerRef.current = setTimeout(() => {
        setGameState(prev => {
          if (!prev) return null;
          const aiAction = getAIAction(prev, prev.currentPlayerIndex);
          if (aiAction) {
            let newState = processAction(prev, aiAction);

            // If AI drew, immediately decide on discard
            if (aiAction.type === 'draw') {
              const discardAction = getAIAction(newState, prev.currentPlayerIndex);
              if (discardAction) {
                newState = processAction(newState, discardAction);
              }
            }

            if (peerManager?.isHost) {
              peerManager.syncGameState(newState);
            }
            return newState;
          }
          return prev;
        });
      }, 500 + Math.random() * 500);

      return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
    }
  }, [gameState, humanPlayerIndex, peerManager]);

  const showCharleston = gameState &&
    gameState.phase.startsWith('charleston') &&
    gameState.phase !== 'playing';

  return (
    <>
      {screen === 'menu' && (
        <MainMenu
          onStartGame={handleStartGame}
          onPlayMultiplayer={handlePlayMultiplayer}
          onStartTutorial={() => setScreen('tutorial')}
        />
      )}
      {screen === 'lobby' && peerManager && (
        <LobbyScreen
          peerManager={peerManager}
          onStartGame={handleStartGame}
          onBack={() => {
            peerManager.disconnect();
            setPeerManager(null);
            setScreen('menu');
          }}
        />
      )}
      {screen === 'tutorial' && (
        <Tutorial onBack={() => setScreen('menu')} />
      )}
      {screen === 'playing' && gameState && (
        <>
          <GameBoard
            state={gameState}
            humanPlayerIndex={humanPlayerIndex}
            onAction={handleAction}
            selectedTile={selectedTile}
            onSelectTile={setSelectedTile}
          />
          {showCharleston && (
            <CharlestonDialog
              phase={gameState.phase}
              hand={gameState.players[humanPlayerIndex]!.hand}
              onConfirm={handleCharlestonConfirm}
              onSkip={
                getCharlestonRound(gameState.phase) !== 'first'
                  ? handleSkipCharleston
                  : undefined
              }
            />
          )}
        </>
      )}
    </>
  );
}
