// ============================================================
// useAIGameLoop — timed AI claims / turns (host or single-player)
// ============================================================

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { ActionType, GameState } from '../engine/types';
import { processAction, resolveClaimWindow } from '../engine/game';
import {
  allEligibleClaimsResolved,
  getClaimOptions,
  getValidActions,
  isClaimWindowOpen,
} from '../engine/actions';
import { getAIAction } from '../ai/ai-player';
import { GameSpeed, SPEED_DELAYS } from '../game-settings';
import type { PeerManager } from '../network/peer-manager';

function syncIfHost(peer: PeerManager | null, state: GameState) {
  if (peer?.isHost) peer.syncGameState(state);
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
    if (isClaimWindowOpen(gameState)) {
      // Connected humans who can still claim block AI resolution
      const humanWaiting = gameState.players.some((p, i) => {
        if (p.type !== 'human') return false;
        if (p.id === gameState.lastDiscardBy) return false;
        if (gameState.claimWindow?.claims.has(p.id)) return false;
        return getClaimOptions(gameState, i).length > 0;
      });
      if (humanWaiting) return;

      const delay = SPEED_DELAYS[speedRef.current].claim;
      timerRef.current = setTimeout(() => {
        setGameState(prev => {
          if (!prev || !isClaimWindowOpen(prev)) return prev;

          let next = prev;

          // Record AI responses for seats that can still claim
          for (let i = 0; i < 4; i++) {
            const p = next.players[i]!;
            if (p.type !== 'ai') continue;
            if (p.id === next.lastDiscardBy) continue;
            if (next.claimWindow?.claims.has(p.id)) continue;
            if (getClaimOptions(next, i).length === 0) continue;

            const aiAction = getAIAction(next, i);
            const type: ActionType =
              aiAction && ['pung', 'kong', 'quint', 'mahjong', 'pass'].includes(aiAction.type)
                ? aiAction.type
                : 'pass';
            next = processAction(next, {
              type,
              playerId: p.id,
              targetTile: next.lastDiscard ?? undefined,
            });
          }

          // Anyone still eligible who somehow didn't respond is treated as passed
          if (!allEligibleClaimsResolved(next) && next.claimWindow) {
            for (let i = 0; i < 4; i++) {
              const p = next.players[i]!;
              if (p.id === next.lastDiscardBy) continue;
              if (next.claimWindow?.claims.has(p.id)) continue;
              if (getClaimOptions(next, i).length === 0) continue;
              next = processAction(next, { type: 'pass', playerId: p.id });
            }
          }

          next = resolveClaimWindow(next);
          syncIfHost(peerManager, next);
          return next;
        });
      }, delay);
      return clearTimers;
    }

    // ---- AI draw / discard turn ----
    if (currentPlayer.type === 'ai') {
      const base = SPEED_DELAYS[speedRef.current].turn;
      const jitter = speedRef.current === 'instant' ? 0 : Math.random() * base * 0.25;
      timerRef.current = setTimeout(() => {
        setGameState(prev => {
          if (!prev || isClaimWindowOpen(prev)) return prev;
          if (prev.players[prev.currentPlayerIndex]?.type !== 'ai') return prev;
          const aiAction = getAIAction(prev, prev.currentPlayerIndex);
          if (!aiAction) return prev;
          // Guard: only apply actions the engine would allow
          const allowed = getValidActions(prev, prev.currentPlayerIndex);
          if (!allowed.includes(aiAction.type) && aiAction.type !== 'discard') return prev;
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
