// ============================================================
// ClaimCoach — teach the claim window in place
// ============================================================

import type { ActionType, Tile } from '../engine/types';
import { TileComponent } from './TileComponent';

interface ClaimCoachProps {
  discard: Tile;
  discarderName?: string;
  claimActions: ActionType[];
  onHelp: () => void;
  variant?: 'mobile' | 'desktop';
}

function labelAction(a: ActionType): string {
  if (a === 'mahjong') return 'Mahjong';
  return a[0]!.toUpperCase() + a.slice(1);
}

export function ClaimCoach({
  discard,
  discarderName,
  claimActions,
  onHelp,
  variant = 'mobile',
}: ClaimCoachProps) {
  const can = claimActions.length > 0;
  const list = claimActions.map(labelAction).join(' / ');
  const helpLabel =
    claimActions.includes('mahjong')
      ? 'What’s Mahjong / a claim?'
      : claimActions.includes('quint')
        ? 'What’s a Quint / Pung?'
        : 'What’s a Pung / Kong?';

  return (
    <div className={`claim-coach${variant === 'desktop' ? ' claim-coach--desktop' : ''}`}>
      <TileComponent tile={discard} size="normal" isLastDiscard />
      <div className="claim-coach-copy">
        <strong>
          {discarderName ?? 'Someone'} discarded {discard.label}
        </strong>
        <p>
          {can
            ? `Claim ${discard.label} with ${list}, or Pass.`
            : `Nothing to claim on ${discard.label} — Pass to continue.`}
        </p>
        <button type="button" className="claim-coach-help" onClick={onHelp}>
          {helpLabel}
        </button>
      </div>
    </div>
  );
}
