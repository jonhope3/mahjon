// ============================================================
// ActionButtons — draw / discard / claims shared by layouts
// ============================================================

import type { ActionType } from '../engine/types';

interface ActionButtonsProps {
  validActions: ActionType[];
  canDiscard: boolean;
  onAction: (action: ActionType) => void;
  onDiscard: () => void;
}

const CLAIM_BTNS: { type: ActionType; label: string; className: string }[] = [
  { type: 'pung', label: 'Pung', className: 'pung' },
  { type: 'kong', label: 'Kong', className: 'kong' },
  { type: 'quint', label: 'Quint', className: 'quint' },
  { type: 'mahjong', label: 'Mahjong!', className: 'mahjong' },
];

export function ActionButtons({
  validActions,
  canDiscard,
  onAction,
  onDiscard,
}: ActionButtonsProps) {
  return (
    <>
      {validActions.includes('draw') && (
        <button type="button" className="btn btn-action draw" onClick={() => onAction('draw')}>
          Draw
        </button>
      )}
      {validActions.includes('discard') && canDiscard && (
        <button type="button" className="btn btn-action discard" onClick={onDiscard}>
          Discard
        </button>
      )}
      {CLAIM_BTNS.map(b =>
        validActions.includes(b.type) ? (
          <button
            key={b.type}
            type="button"
            className={`btn btn-action ${b.className}`}
            onClick={() => onAction(b.type)}
          >
            {b.label}
          </button>
        ) : null,
      )}
      {validActions.includes('pass') && (
        <button type="button" className="btn btn-action pass" onClick={() => onAction('pass')}>
          Pass
        </button>
      )}
    </>
  );
}
