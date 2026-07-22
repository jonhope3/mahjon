// ============================================================
// HelpPanel — Contextual “what’s going on?” learning overlay
// ============================================================

import type { ReactNode } from 'react';
import { Modal } from './Modal';

interface HelpPanelProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function HelpPanel({ title, children, onClose }: HelpPanelProps) {
  return (
    <Modal
      title={title}
      titleId="help-panel-title"
      onClose={onClose}
      className="help-panel"
      overlayClassName="help-overlay"
      closeOnOverlayClick={false}
      footer={
        <button type="button" className="btn btn-primary help-panel-close" onClick={onClose}>
          Got it
        </button>
      }
    >
      <div className="help-panel-body">{children}</div>
    </Modal>
  );
}

export const CHARLESTON_HELP = {
  first: {
    title: 'What is the First Charleston?',
    body: (
      <>
        <p>
          The <strong>Charleston</strong> is a mandatory tile-passing ritual before play starts.
          It helps everyone shape their hand toward a winning pattern.
        </p>
        <ol>
          <li>
            Select <strong>3 tiles</strong> you do not want (usually from suits you are not
            chasing).
          </li>
          <li>
            Pass them <strong>Right</strong>, then you will pass <strong>Across</strong>, then{' '}
            <strong>Left</strong>.
          </li>
          <li>You receive 3 new tiles each time someone passes to you.</li>
        </ol>
        <p>Tip: Keep jokers and tiles that fit the patterns on the Hand Card.</p>
      </>
    ),
  },
  second: {
    title: 'What is the Second Charleston?',
    body: (
      <>
        <p>
          The <strong>Second Charleston</strong> is optional. Same idea — pass 3 tiles — but the
          directions reverse: Left → Across → Right.
        </p>
        <p>
          Skip a single pass, or use <strong>Skip rest → play</strong> to jump straight into the
          hand if you are happy with your tiles.
        </p>
      </>
    ),
  },
  courtesy: {
    title: 'What is the Courtesy Pass?',
    body: (
      <>
        <p>
          After both Charlestons, you may optionally exchange tiles with the player sitting across
          from you — <strong>0 to 3 tiles</strong>. You each offer a number; you pass the{' '}
          <strong>smaller</strong> count (real-table courtesy).
        </p>
        <p>
          Jokers never pass. You can also <strong>Skip rest → play</strong> to start the hand
          immediately.
        </p>
      </>
    ),
  },
} as const;

export const PLAY_HELP = (
  <>
    <p>
      <strong>Tiles:</strong> Hover (or long-press on phones) any face-up tile to see whether it is
      Shell/Crak, Kelp/Bam, Pearl/Dot, a Wind, Dragon, Anemone, or Joker.
    </p>
    <p>
      <strong>Your turn:</strong> Draw a tile, then discard one. Tap a tile to select it, then
      Discard.
    </p>
    <p>
      <strong>Claim window (Pung / Pass):</strong> When someone discards, a banner shows that tile.
      Tap <strong>Pung</strong> (3 of a kind), <strong>Kong</strong> (4), <strong>Quint</strong> (5),
      or <strong>Mahjong</strong> if it completes a card hand — or tap <strong>Pass</strong> to let
      play continue. You do not select tiles from your hand for a normal pung/kong claim.
    </p>
    <p>
      <strong>Hand Card:</strong> Open the Card anytime to see the 2026 winning patterns (72 hands on
      the official-style card). Your 14 tiles must match one exactly.
    </p>
    <p>
      <strong>Kong on your turn:</strong> After you draw, you may declare a kong from your hand or
      promote an exposed pung — then discard as usual.
    </p>
    <p>
      <strong>Jokers:</strong> Wild in groups of 3+. Never in pairs or singles. You can swap a
      matching tile for an exposed joker on your turn.
    </p>
  </>
);
