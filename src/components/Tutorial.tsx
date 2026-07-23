// ============================================================
// Tutorial — Interactive learning mode for American Mahjong
// ============================================================

import { useState } from 'react';
import { TileComponent } from './TileComponent';
import { Tile, TileKind } from '../engine/types';
import { tileLabel } from '../engine/tiles';
import { HandCardModal } from './HandCardModal';
import '../styles/tutorial.css';

interface TutorialProps {
  onBack: () => void;
  onStartPlaying?: () => void;
}

function makeTile(id: number, kind: TileKind): Tile {
  return { id, kind, label: tileLabel(kind) };
}

const SAMPLE_TILES = {
  crak1: makeTile(900, { type: 'suited', suit: 'crak', rank: 1 }),
  bam5: makeTile(903, { type: 'suited', suit: 'bam', rank: 5 }),
  dot7: makeTile(906, { type: 'suited', suit: 'dot', rank: 7 }),
  east: makeTile(910, { type: 'wind', wind: 'east' }),
  south: makeTile(911, { type: 'wind', wind: 'south' }),
  west: makeTile(912, { type: 'wind', wind: 'west' }),
  north: makeTile(913, { type: 'wind', wind: 'north' }),
  dragonRed: makeTile(914, { type: 'dragon', dragon: 'red' }),
  dragonGreen: makeTile(915, { type: 'dragon', dragon: 'green' }),
  dragonWhite: makeTile(916, { type: 'dragon', dragon: 'white' }),
  flower: makeTile(917, { type: 'flower' }),
  joker: makeTile(918, { type: 'joker' }),
};

function SuitRow({ suit, fromId }: { suit: 'crak' | 'bam' | 'dot'; fromId: number }) {
  return (
    <div className="tutorial-tiles-scroll" role="list">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(r => (
        <div key={r} role="listitem">
          <TileComponent
            tile={makeTile(fromId + r, { type: 'suited', suit, rank: r })}
            size="mini"
          />
        </div>
      ))}
    </div>
  );
}

interface TutorialStep {
  title: string;
  content: React.ReactNode;
}

export function Tutorial({ onBack, onStartPlaying }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showHandCard, setShowHandCard] = useState(false);

  const steps: TutorialStep[] = [
    {
      title: 'Welcome to American Mahjong!',
      content: (
        <div className="tutorial-text">
          <p>
            Mahjong is a tile-based game for <strong>4 players</strong>. The goal is to collect a
            winning hand of <strong>14 tiles</strong> that matches one of the patterns on the
            official card.
          </p>
          <p>This tutorial covers the tiles, Charleston, gameplay, and how to win.</p>
          <p className="tutorial-tip-callout">
            <strong>Tip:</strong> Hover a tile (or long-press on phones) anytime to see what it is —
            Crak, Bam, Dot, Wind, Dragon, Flower, and so on.
          </p>
          <div className="tutorial-tiles-demo">
            {[
              SAMPLE_TILES.crak1,
              SAMPLE_TILES.bam5,
              SAMPLE_TILES.dot7,
              SAMPLE_TILES.east,
              SAMPLE_TILES.dragonRed,
              SAMPLE_TILES.flower,
              SAMPLE_TILES.joker,
            ].map(t => (
              <TileComponent key={t.id} tile={t} size="mini" />
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'The Tiles — Suits',
      content: (
        <div className="tutorial-text">
          <p>
            There are <strong>3 suits</strong>, each numbered 1–9 (4 copies of each = 108 suited
            tiles). Swipe a row to see every rank.
          </p>

          <div className="tutorial-section">
            <h4 className="suit-shell">Crak</h4>
            <p>
              Red suited tiles (🐚 shell icon). Same icon on every rank — the{' '}
              <strong>number</strong> is what changes (1–9).
            </p>
            <SuitRow suit="crak" fromId={800} />
          </div>

          <div className="tutorial-section">
            <h4 className="suit-kelp">Bam</h4>
            <p>
              Green numbered tiles (🌿 kelp icon). Same icon; read the number.
            </p>
            <SuitRow suit="bam" fromId={810} />
          </div>

          <div className="tutorial-section">
            <h4 className="suit-pearl">Dot</h4>
            <p>
              Blue numbered tiles (🫧 pearl-bubble icon). Same icon; read the number.
            </p>
            <SuitRow suit="dot" fromId={820} />
          </div>
        </div>
      ),
    },
    {
      title: 'The Tiles — Honors & Specials',
      content: (
        <div className="tutorial-text">
          <div className="tutorial-section tutorial-section--first">
            <h4>Winds (16 tiles)</h4>
            <p>
              East 🌅, South ☀️, West 🌇, North ❄️ — used in wind/dragon hands and mixed patterns.
            </p>
            <div className="tutorial-tiles-demo">
              <TileComponent tile={SAMPLE_TILES.north} size="mini" />
              <TileComponent tile={SAMPLE_TILES.east} size="mini" />
              <TileComponent tile={SAMPLE_TILES.south} size="mini" />
              <TileComponent tile={SAMPLE_TILES.west} size="mini" />
            </div>
          </div>

          <div className="tutorial-section">
            <h4>Dragons (12 tiles)</h4>
            <p>
              Red, Green, and Soap (White) dragons. Year hands (2026) use Soap as the &quot;0&quot;.
            </p>
            <p>
              <strong>Like colors:</strong> each dragon matches one suit — look for the small
              corner icon:
            </p>
            <ul>
              <li>
                🪸 Red ↔ 🐚 Crak
              </li>
              <li>
                🌊 Green ↔ 🌿 Bam
              </li>
              <li>
                🦪 Soap (White) ↔ 🫧 Dot
              </li>
            </ul>
            <div className="tutorial-tiles-demo">
              <TileComponent tile={SAMPLE_TILES.dragonRed} size="mini" />
              <TileComponent tile={SAMPLE_TILES.dragonGreen} size="mini" />
              <TileComponent tile={SAMPLE_TILES.dragonWhite} size="mini" />
            </div>
          </div>

          <div className="tutorial-section">
            <h4>Flowers &amp; Jokers (8 each)</h4>
            <p>
              <strong>Flowers</strong> (🌺) appear in many patterns.{' '}
              <strong>Jokers</strong> (🪼) are wild in groups of 3+, but never in pairs or singles.
              Do not confuse Flowers with the Red Dragon (🪸).
            </p>
            <div className="tutorial-tiles-demo">
              <TileComponent tile={SAMPLE_TILES.flower} size="mini" />
              <TileComponent tile={SAMPLE_TILES.joker} size="mini" />
            </div>
          </div>

          <p className="tutorial-total">
            Total: <strong>152 tiles</strong> (108 suited + 16 winds + 12 dragons + 8 flowers + 8
            jokers)
          </p>
        </div>
      ),
    },
    {
      title: 'Game Setup & The Charleston',
      content: (
        <div className="tutorial-text">
          <p>At the start of each round:</p>
          <ol>
            <li>
              <strong>Build the wall</strong> — tiles are shuffled and stacked
            </li>
            <li>
              <strong>Deal</strong> — each player gets 13 tiles (East/dealer gets 14)
            </li>
            <li>
              <strong>The Charleston</strong> — a tile-passing ritual:
              <ul>
                <li>
                  <strong>First Charleston</strong> (mandatory): Pass 3 tiles Right → Across → Left
                </li>
                <li>
                  <strong>Second Charleston</strong> (optional): Pass 3 tiles Left → Across → Right
                </li>
                <li>
                  <strong>Courtesy Pass</strong> (optional): Pass 3 tiles across, or skip.
                </li>
              </ul>
            </li>
          </ol>
          <p>Pass tiles you do not need to shape your hand toward a winning pattern.</p>
        </div>
      ),
    },
    {
      title: 'Gameplay — Drawing & Discarding',
      content: (
        <div className="tutorial-text">
          <p>On each turn, the active player:</p>
          <ol>
            <li>
              <strong>Draws</strong> one tile from the wall
            </li>
            <li>
              <strong>Discards</strong> one tile face-up
            </li>
          </ol>
          <p>
            Play goes <strong>counterclockwise</strong> (East → South → West → North).
          </p>

          <div className="tutorial-highlight">
            <h4>Claiming a Discard</h4>
            <p>When someone discards, any player can claim it for:</p>
            <ul>
              <li>
                <strong className="claim-pung">Pung</strong> — 3 of a kind (need 2 matching)
              </li>
              <li>
                <strong className="claim-kong">Kong</strong> — 4 of a kind (need 3 matching)
              </li>
              <li>
                <strong className="claim-quint">Quint</strong> — 5 of a kind (need 4, using jokers)
              </li>
              <li>
                <strong className="claim-mahjong">Mahjong!</strong> — win the game (highest priority)
              </li>
            </ul>
            <p>Priority: Mahjong &gt; Quint &gt; Kong &gt; Pung. Claimed sets are exposed face-up.</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Winning — The Hand Card',
      content: (
        <div className="tutorial-text">
          <p>
            To win, your 14 tiles (hand + exposed sets) must match{' '}
            <strong>exactly one pattern</strong> on the card.
          </p>

          <div className="tutorial-highlight">
            <h4>Reading the Card</h4>
            <ul>
              <li>
                Numbers are tile <strong>ranks</strong> (1–9)
              </li>
              <li>
                <strong>Colors matter</strong>: same color = same suit
              </li>
              <li>
                <strong>F</strong> = Flower, <strong>D</strong> = Dragon, <strong>N/E/S/W</strong> =
                Winds
              </li>
              <li>
                <strong>X25</strong> = Exposed hand worth 25 points
              </li>
              <li>
                <strong>C30</strong> = Concealed hand worth 30 points
              </li>
            </ul>
          </div>

          <p>
            Declare <strong>Mahjong</strong> when your hand matches — after drawing or by claiming
            a discard.
          </p>

          <button
            type="button"
            className="btn btn-secondary tutorial-hand-btn"
            onClick={() => setShowHandCard(true)}
          >
            View 2026 Hand Patterns
          </button>
        </div>
      ),
    },
    {
      title: 'Strategy Tips',
      content: (
        <div className="tutorial-text">
          <div className="tutorial-section tutorial-section--first">
            <h4>Beginner Tips</h4>
            <ul>
              <li>
                <strong>Keep jokers</strong> — they are the most valuable tiles
              </li>
              <li>
                <strong>Stay flexible</strong> — do not lock into one hand too early
              </li>
              <li>
                <strong>Watch discards</strong> — switch patterns if your tiles are gone
              </li>
              <li>
                <strong>Concealed hands</strong> score more but you cannot claim for them
              </li>
              <li>
                <strong>Use the Charleston</strong> — pass suits you do not need
              </li>
            </ul>
          </div>

          <div className="tutorial-section">
            <h4>Intermediate Tips</h4>
            <ul>
              <li>
                <strong>Defensive play</strong> — avoid feeding other players
              </li>
              <li>
                <strong>Count tiles</strong> — track what has been discarded
              </li>
              <li>
                <strong>2026 is 6-heavy</strong> — many patterns feature 6s and Flowers
              </li>
              <li>
                <strong>Quints</strong> — with 8 jokers, they are more reachable than they look
              </li>
            </ul>
          </div>

          <p className="tutorial-ready">You&apos;re ready to play!</p>
        </div>
      ),
    },
  ];

  const step = steps[currentStep]!;
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="tutorial-screen">
      <div className="tutorial-shell">
        <header className="tutorial-header">
          <div className="tutorial-progress" aria-hidden="true">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`tutorial-progress-seg${i <= currentStep ? ' active' : ''}`}
              />
            ))}
          </div>
          <p className="tutorial-step-label">
            Step {currentStep + 1} of {steps.length}
          </p>
          <h1 className="tutorial-title">{step.title}</h1>
        </header>

        <div className="tutorial-body" key={currentStep}>
          {step.content}
        </div>

        <footer className="tutorial-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => (isFirst ? onBack() : setCurrentStep(c => c - 1))}
          >
            {isFirst ? 'Exit' : 'Previous'}
          </button>
          {isLast ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (onStartPlaying ? onStartPlaying() : onBack())}
            >
              Start Playing
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCurrentStep(c => c + 1)}
            >
              Next
            </button>
          )}
        </footer>
      </div>

      {showHandCard && <HandCardModal onClose={() => setShowHandCard(false)} />}
    </div>
  );
}
