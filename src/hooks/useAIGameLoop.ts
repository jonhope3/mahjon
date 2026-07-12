// ============================================================
// useAIGameLoop — timed AI claims / turns (host or single-player)
// ============================================================

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { ActionType, GameState } from '../engine/types';
import { advanceTurn, processAction } from '../engine/game';
import { claimPriority, getValidActions } from '../engine/actions';
import { getAIAction } from '../ai/ai-player';
import { GameSpeed, SPEED_DELAYS } from '../game-settings';
import type { PeerManager } from '../network/peer-manager';

function syncIfHost(peer: PeerManager | null, state: GameState) {
  if (peer?.isHost) peer.syncGameState(state);
}

function hasPassed(state: GameState, playerId: string): boolean {
  return state.claimWindow?.claims.get(playerId) === 'pass';
}

export function useAIGameLoop(
  gameState: GameState | null,
  humanPlayerIndex: number,
  peerManager: PeerManager | null,
  speed: GameSpeed,
  setGameState: Dispatch<SetStateAction<GameState | null>>,
): { clearTimers: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const clearTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;
    if (peerManager && !peerManager.isHost) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    // ---- Claim window after a discard ----
    if (gameState.lastDiscard && gameState.lastDiscardBy) {
      let highest: { playerIdx: number; action: ActionType; priority: number } | null = null;

      for (let i = 0; i < 4; i++) {
        const p = gameState.players[i]!;
        if (p.id === gameState.lastDiscardBy || p.type !== 'ai') continue;
        if (hasPassed(gameState, p.id)) continue;
        const aiAction = getAIAction(gameState, i);
        if (!aiAction || aiAction.type === 'pass') continue;
        const priority = claimPriority(aiAction.type);
        if (!highest || priority > highest.priority) {
          highest = { playerIdx: i, action: aiAction.type, priority };
        }
      }

      // Connected humans who can still claim block AI resolution
      const humanWaiting = gameState.players.some((p, i) => {
        if (p.type !== 'human') return false;
        if (p.id === gameState.lastDiscardBy) return false;
        if (hasPassed(gameState, p.id)) return false;
        return getValidActions(gameState, i).some(a =>
          ['pung', 'kong', 'quint', 'mahjong'].includes(a),
        );
      });
      if (humanWaiting) return;

      if (highest) {
        const claim = highest;
        const delay = SPEED_DELAYS[speedRef.current].claim;
        timerRef.current = setTimeout(() => {
          setGameState(prev => {
            if (!prev?.lastDiscard) return prev;
            const next = processAction(prev, {
              type: claim.action,
              playerId: prev.players[claim.playerIdx]!.id,
              targetTile: prev.lastDiscard,
            });
            syncIfHost(peerManager, next);
            return next;
          });
        }, delay);
        return clearTimers;
      }

      timerRef.current = setTimeout(() => {
        setGameState(prev => {
          if (!prev) return null;
          const next = advanceTurn(prev);
          syncIfHost(peerManager, next);
          return next;
        });
      }, SPEED_DELAYS[speedRef.current].advance);
      return clearTimers;
    }

    // ---- AI draw / discard turn ----
    if (currentPlayer.type === 'ai' && currentPlayer.id !== gameState.lastDiscardBy) {
      const base = SPEED_DELAYS[speedRef.current].turn;
      const jitter = speedRef.current === 'instant' ? 0 : Math.random() * base * 0.25;
      timerRef.current = setTimeout(() => {
        setGameState(prev => {
          if (!prev) return null;
          const aiAction = getAIAction(prev, prev.currentPlayerIndex);
          if (!aiAction) return prev;
          const next = processAction(prev, aiAction);
          syncIfHost(peerManager, next);
          return next;
        });
      }, base + jitter);
      return clearTimers;
    }
  }, [gameState, humanPlayerIndex, peerManager, speed, setGameState]);

  return { clearTimers };
}
