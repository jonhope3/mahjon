// ============================================================
// HelpPanel - Contextual “what’s going on?” learning overlay
// ============================================================

import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { useInputProfile, type InputProfile } from '../hooks/useInputProfile';

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
          The <strong>Second Charleston</strong> is optional. Same idea - pass 3 tiles - but the
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
          from you - <strong>0 to 3 tiles</strong>. You each offer a number; you pass the{' '}
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

function ControlsHelp({ profile }: { profile: InputProfile }) {
  if (profile === 'phone') {
    return (
      <section className="help-controls">
        <h3>Controls · Phone</h3>
        <ul>
          <li>
            <strong>Select a tile:</strong> Tap it, then tap <strong>Discard</strong>.
          </li>
          <li>
            <strong>Rearrange your hand:</strong> Press a tile and <em>slide it</em> left or right
            along the rack - just like sliding tiles on a physical rack. New draws land at the end
            so your groups stay put. Tap <strong>Sort</strong> anytime to reset to suit order.
          </li>
          <li>
            <strong>Identify a tile:</strong> Long-press any face-up tile for its name (Crak, Bam,
            Dot, Wind, Dragon, Flower, Joker).
          </li>
          <li>
            <strong>Claims:</strong> When someone discards, use the Pung / Kong / Quint / Mahjong /
            Pass buttons - you don’t pick tiles from your hand for a normal claim.
          </li>
        </ul>
      </section>
    );
  }

  if (profile === 'tablet') {
    return (
      <section className="help-controls">
        <h3>Controls · iPad</h3>
        <ul>
          <li>
            <strong>Select a tile:</strong> Tap it, then tap <strong>Discard</strong>.
          </li>
          <li>
            <strong>Rearrange your hand:</strong> Press a tile and <em>drag it</em> along the rack to
            group your hand the way you would at a real table. New draws land at the end. Tap{' '}
            <strong>Sort</strong> to return to suit order.
          </li>
          <li>
            <strong>Identify a tile:</strong> Long-press (or hover with a trackpad) any face-up tile.
          </li>
          <li>
            <strong>Keyboard (Magic Keyboard / Smart Keyboard):</strong>{' '}
            <kbd>←</kbd> <kbd>→</kbd> move between tiles, <kbd>Shift</kbd> + <kbd>←</kbd>{' '}
            <kbd>→</kbd> rearrange, <kbd>Enter</kbd> discards. <kbd>D</kbd> draws, <kbd>P</kbd>{' '}
            passes, <kbd>1</kbd>-<kbd>4</kbd> call Pung / Kong / Quint / Mahjong. <kbd>C</kbd> opens
            the Hand Card, <kbd>?</kbd> opens Help.
          </li>
        </ul>
      </section>
    );
  }

  return (
    <section className="help-controls">
      <h3>Controls · Desktop</h3>
      <ul>
        <li>
          <strong>Select a tile:</strong> Click it, then click <strong>Discard</strong> (or press{' '}
          <kbd>Enter</kbd>).
        </li>
        <li>
          <strong>Rearrange your hand:</strong> Click and <em>drag</em> a tile left or right along
          your rack to group it. New draws land at the end so your arrangement isn’t scrambled.
          Click <strong>Sort</strong> to reset to suit order.
        </li>
        <li>
          <strong>Identify a tile:</strong> Hover any face-up tile.
        </li>
        <li>
          <strong>Keyboard:</strong> <kbd>←</kbd> <kbd>→</kbd> move between tiles,{' '}
          <kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd> rearrange, <kbd>Enter</kbd> discards.{' '}
          <kbd>D</kbd> draws, <kbd>P</kbd> passes, <kbd>1</kbd>-<kbd>4</kbd> call Pung / Kong /
          Quint / Mahjong. <kbd>C</kbd> opens the Hand Card, <kbd>?</kbd> opens Help.
        </li>
      </ul>
    </section>
  );
}

/** In-game help: rules + device-specific controls. */
export function PlayHelp() {
  const profile = useInputProfile();

  return (
    <>
      <ControlsHelp profile={profile} />

      <p>
        <strong>Your turn:</strong> Draw a tile, then discard one.
      </p>
      <p>
        <strong>Claim window:</strong> When someone discards, a banner shows that tile. Choose{' '}
        <strong>Pung</strong> (3 of a kind), <strong>Kong</strong> (4), <strong>Quint</strong> (5),
        or <strong>Mahjong</strong> if it completes a card hand - or <strong>Pass</strong> to let
        play continue.
      </p>
      <p>
        <strong>Hand Card:</strong> Open the Card anytime to see the 2026 winning patterns. Your 14
        tiles must match one exactly.
      </p>
      <p>
        <strong>Kong on your turn:</strong> After you draw, you may declare a kong from your hand or
        promote an exposed pung - then discard as usual.
      </p>
      <p>
        <strong>Jokers:</strong> Wild in groups of 3+. Never in pairs or singles. You can swap a
        matching tile for an exposed joker on your turn.
      </p>
    </>
  );
}
