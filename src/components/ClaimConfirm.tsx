// ============================================================
// ClaimConfirm - guard rail for irreversible claims
// ============================================================
//
// Discarding is already two-step (select a tile, then press Discard), but
// claims were single-tap and irreversible - and they appear under time
// pressure, which is exactly when a phone mis-tap is most likely.
//
// The stakes are real:
//   • A mistaken Pung/Kong/Quint permanently exposes tiles and forfeits
//     every concealed ("C") hand on the card.
//   • A mistaken Mahjong call is a penalty at a real table.
//
// So we show what is about to be committed before committing it. This
// doubles as teaching: players see exactly which tiles the claim consumes.

import type { ActionType, Tile } from '../engine/types';
import { Modal } from './Modal';
import { TileComponent } from './TileComponent';

export interface PendingClaim {
  action: ActionType;
  /** The discard being claimed (absent for a self-drawn Mahjong). */
  discard?: Tile | null;
  /** Tiles from hand that the claim will consume/expose. */
  tilesFromHand: Tile[];
  /** Name of the hand being declared, when known. */
  handName?: string;
}

interface ClaimConfirmProps {
  claim: PendingClaim;
  onConfirm: () => void;
  onCancel: () => void;
}

const TITLES: Partial<Record<ActionType, string>> = {
  pung: 'Call Pung?',
  kong: 'Call Kong?',
  quint: 'Call Quint?',
  mahjong: 'Declare Mahjong?',
};

export function ClaimConfirm({ claim, onConfirm, onCancel }: ClaimConfirmProps) {
  const isMahjong = claim.action === 'mahjong';
  const title = TITLES[claim.action] ?? 'Confirm';

  const setName =
    claim.action === 'pung' ? 'Pung (3)'
      : claim.action === 'kong' ? 'Kong (4)'
        : claim.action === 'quint' ? 'Quint (5)'
          : 'Mahjong';

  return (
    <Modal
      title={title}
      titleId="claim-confirm-title"
      onClose={onCancel}
      // A mis-tap on the backdrop must not silently cancel a time-sensitive
      // decision - make the player choose explicitly.
      closeOnOverlayClick={false}
      className="claim-confirm-modal"
    >
      <div className="claim-confirm">
        {isMahjong ? (
          <p className="claim-confirm-lead">
            {claim.handName
              ? <>You’re declaring <strong>{claim.handName}</strong>.</>
              : <>You’re declaring Mahjong.</>}
          </p>
        ) : (
          <p className="claim-confirm-lead">
            {claim.discard
              ? <>Claim <strong>{claim.discard.label}</strong> to expose a <strong>{setName}</strong>.</>
              : <>Expose a <strong>{setName}</strong>.</>}
          </p>
        )}

        {claim.tilesFromHand.length > 0 && (
          <>
            <p className="claim-confirm-warn">
              These tiles leave your hand and go face-up on the table:
            </p>
            <div className="claim-confirm-tiles">
              {claim.tilesFromHand.map(t => (
                <TileComponent key={t.id} tile={t} size="mini" />
              ))}
              {claim.discard && (
                <TileComponent tile={claim.discard} size="mini" isLastDiscard />
              )}
            </div>
          </>
        )}

        {!isMahjong && (
          <p className="claim-confirm-warn">
            Exposing tiles gives up every concealed (<strong>C</strong>) hand on the card.
          </p>
        )}

        <div className="claim-confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-action mahjong" onClick={onConfirm}>
            {isMahjong ? 'Declare Mahjong' : `Yes, ${setName.split(' ')[0]}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

