// ============================================================
// Tutorial — Interactive learning mode for American Mahjong
// ============================================================

import { useState, useEffect } from 'react';
import { TileComponent } from './TileComponent';
import { createTileSet } from '../engine/tiles';
import { Tile, TileKind } from '../engine/types';
import { ALL_HAND_CATEGORIES } from '../engine/hands';
import '../styles/tutorial.css';

interface TutorialProps {
  onBack: () => void;
}

// Create sample tiles for display
function makeTile(id: number, kind: TileKind): Tile {
  const labels: Record<string, string> = {
    suited: '', wind: '', dragon: '', flower: 'F', joker: 'J',
  };
  return { id, kind, label: labels[kind.type] || '' };
}

const SAMPLE_TILES = {
  crak1: makeTile(900, { type: 'suited', suit: 'crak', rank: 1 }),
  crak2: makeTile(901, { type: 'suited', suit: 'crak', rank: 2 }),
  crak3: makeTile(902, { type: 'suited', suit: 'crak', rank: 3 }),
  bam5: makeTile(903, { type: 'suited', suit: 'bam', rank: 5 }),
  bam5b: makeTile(904, { type: 'suited', suit: 'bam', rank: 5 }),
  bam5c: makeTile(905, { type: 'suited', suit: 'bam', rank: 5 }),
  dot7: makeTile(906, { type: 'suited', suit: 'dot', rank: 7 }),
  dot7b: makeTile(907, { type: 'suited', suit: 'dot', rank: 7 }),
  dot7c: makeTile(908, { type: 'suited', suit: 'dot', rank: 7 }),
  dot7d: makeTile(909, { type: 'suited', suit: 'dot', rank: 7 }),
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

interface TutorialStep {
  title: string;
  content: React.ReactNode;
}

export function Tutorial({ onBack }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showHandCard, setShowHandCard] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia('(max-width: 767px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const steps: TutorialStep[] = [
    {
      title: 'Welcome to American Mahjong!',
      content: (
        <div className="tutorial-text">
          <p>Mahjong is a tile-based game for <strong>4 players</strong>. The goal is to collect a winning hand of <strong>14 tiles</strong> that matches one of the patterns on the official card.</p>
          <p>This tutorial will teach you everything you need to start playing. Let's begin with the tiles!</p>
          <div className="tutorial-tiles-demo">
            {[SAMPLE_TILES.crak1, SAMPLE_TILES.bam5, SAMPLE_TILES.dot7, SAMPLE_TILES.east, SAMPLE_TILES.dragonRed, SAMPLE_TILES.flower, SAMPLE_TILES.joker].map(t => (
              <TileComponent key={t.id} tile={t} size="normal" />
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'The Tiles — Suits',
      content: (
        <div className="tutorial-text">
          <p>There are <strong>3 suits</strong>, each numbered 1-9 (4 copies of each = 108 suited tiles):</p>

          <div className="tutorial-section">
            <h4 style={{ color: 'var(--color-crak)' }}>Shells</h4>
            <p>Marked with a unique ocean life or shell type label.</p>
            <div className="tutorial-tiles-row">
              {[1,2,3,4,5,6,7,8,9].map(r =>
                <TileComponent key={r} tile={makeTile(800+r, {type:'suited',suit:'crak',rank:r})} size="normal" />
              )}
            </div>
          </div>

          <div className="tutorial-section">
            <h4 style={{ color: 'var(--color-bam)' }}>Kelp</h4>
            <p>Green numbered tiles with Kelp seaweed stalks.</p>
            <div className="tutorial-tiles-row">
              {[1,2,3,4,5,6,7,8,9].map(r =>
                <TileComponent key={r} tile={makeTile(810+r, {type:'suited',suit:'bam',rank:r})} size="normal" />
              )}
            </div>
          </div>

          <div className="tutorial-section">
            <h4 style={{ color: 'var(--color-dot)' }}>Pearls</h4>
            <p>Blue numbered tiles with circular pearl bubbles.</p>
            <div className="tutorial-tiles-row">
              {[1,2,3,4,5,6,7,8,9].map(r =>
                <TileComponent key={r} tile={makeTile(820+r, {type:'suited',suit:'dot',rank:r})} size="normal" />
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'The Tiles — Honors & Specials',
      content: (
        <div className="tutorial-text">
          <div className="tutorial-section">
            <h4>Winds (4 copies each = 16 tiles)</h4>
            <p>North, East, South, West — represented by compass directions (E, S, W, N) and used in wind/dragon hands and some mixed patterns.</p>
            <div className="tutorial-tiles-row">
              <TileComponent tile={SAMPLE_TILES.north} size="normal" />
              <TileComponent tile={SAMPLE_TILES.east} size="normal" />
              <TileComponent tile={SAMPLE_TILES.south} size="normal" />
              <TileComponent tile={SAMPLE_TILES.west} size="normal" />
            </div>
          </div>

          <div className="tutorial-section">
            <h4>Dragons (4 copies each = 12 tiles)</h4>
            <p>Coral (Coral Dragon), Sea Wave (Wave Dragon), and Pearl (Pearl Dragon). The "0" in year hands (2026) uses the Pearl Dragon.</p>
            <div className="tutorial-tiles-row">
              <TileComponent tile={SAMPLE_TILES.dragonRed} size="normal" />
              <TileComponent tile={SAMPLE_TILES.dragonGreen} size="normal" />
              <TileComponent tile={SAMPLE_TILES.dragonWhite} size="normal" />
            </div>
          </div>

          <div className="tutorial-section">
            <h4>Sea Anemones (8 tiles) & Jokers (8 tiles)</h4>
            <p><strong>Sea Anemones</strong> (Flowers) are used in many hand patterns. <strong>Jokers</strong> are wild — they can substitute for any tile in a group of 3 or more, but NOT in pairs or singles.</p>
            <div className="tutorial-tiles-row">
              <TileComponent tile={SAMPLE_TILES.flower} size="normal" />
              <TileComponent tile={SAMPLE_TILES.joker} size="normal" />
            </div>
          </div>

          <p style={{ marginTop: 'var(--space-md)', fontWeight: 600 }}>
            Total: <strong>152 tiles</strong> (108 suited + 16 winds + 12 dragons + 8 anemones + 8 jokers)
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
            <li><strong>Build the wall</strong> — tiles are shuffled and stacked</li>
            <li><strong>Deal</strong> — each player gets 13 tiles (East/dealer gets 14)</li>
            <li><strong>The Charleston</strong> — a mandatory tile-passing ritual:
              <ul>
                <li>🔄 <strong>First Charleston</strong> (mandatory): Pass 3 tiles Right → Across → Left</li>
                <li>🔄 <strong>Second Charleston</strong> (optional): Pass 3 tiles Left → Across → Right</li>
                <li>🤝 <strong>Courtesy Pass</strong> (optional): Exchange 0-3 tiles with the player across</li>
              </ul>
            </li>
          </ol>
          <p>The Charleston helps you shape your hand toward a winning pattern. Pass tiles you don't need!</p>
        </div>
      ),
    },
    {
      title: 'Gameplay — Drawing & Discarding',
      content: (
        <div className="tutorial-text">
          <p>On each turn, the active player:</p>
          <ol>
            <li><strong>Draws</strong> one tile from the wall</li>
            <li><strong>Discards</strong> one tile face-up</li>
          </ol>
          <p>Play goes <strong>counterclockwise</strong> (East → South → West → North).</p>

          <div className="tutorial-highlight">
            <h4>🎯 Claiming a Discard</h4>
            <p>When someone discards, ANY player (not just the next player) can claim it for:</p>
            <ul>
              <li><strong style={{color:'var(--color-action-pung)'}}>Pung</strong> — 3 of a kind (need 2 matching in hand)</li>
              <li><strong style={{color:'var(--color-action-kong)'}}>Kong</strong> — 4 of a kind (need 3 matching)</li>
              <li><strong style={{color:'var(--color-action-quint)'}}>Quint</strong> — 5 of a kind (need 4, using jokers)</li>
              <li><strong style={{color:'var(--color-action-mahjong)'}}>Mahjong!</strong> — win the game (highest priority)</li>
             </ul>
            <p>Claimed sets are placed face-up ("exposed") in front of you. Priority: Mahjong &gt; Quint &gt; Kong &gt; Pung.</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Winning — The Hand Card',
      content: (
        <div className="tutorial-text">
          <p>To win, your 14 tiles (hand + exposed sets) must match <strong>exactly one pattern</strong> on the card.</p>

          <div className="tutorial-highlight">
            <h4>Reading the Card</h4>
            <ul>
              <li>Numbers represent tile <strong>ranks</strong> (1-9)</li>
              <li><strong>Colors matter</strong>: Same color = same suit, different colors = different suits</li>
              <li><strong>F</strong> = Flower, <strong>D</strong> = Dragon, <strong>N/E/S/W</strong> = Winds</li>
              <li><strong>X25</strong> = Exposed hand worth 25 points</li>
              <li><strong>C30</strong> = Concealed hand worth 30 points (cannot have exposed sets)</li>
            </ul>
          </div>

          <p>Declare <strong>"Mahjong"</strong> when your hand matches a pattern — either after drawing or by claiming a discard.</p>

          <button className="btn btn-secondary" onClick={() => setShowHandCard(true)} style={{ marginTop: 'var(--space-md)' }}>
            View 2026 Hand Patterns
          </button>
        </div>
      ),
    },
    {
      title: 'Strategy Tips',
      content: (
        <div className="tutorial-text">
          <div className="tutorial-section">
            <h4>🧠 Beginner Tips</h4>
            <ul>
              <li><strong>Keep jokers!</strong> They're the most valuable tiles in the game</li>
              <li><strong>Stay flexible</strong> — don't commit to one hand too early</li>
              <li><strong>Watch discards</strong> — if many of your needed tiles are gone, switch patterns</li>
              <li><strong>Concealed hands</strong> score more but are harder — you can't claim discards for them</li>
              <li><strong>Use the Charleston wisely</strong> — pass tiles from suits you don't need</li>
            </ul>
          </div>

          <div className="tutorial-section">
            <h4>🎯 Intermediate Tips</h4>
            <ul>
              <li><strong>Defensive play</strong> — avoid discarding tiles others might need</li>
              <li><strong>Count tiles</strong> — track what's been discarded to know what's available</li>
              <li><strong>2026 is 6-heavy</strong> — many patterns on this year's card feature 6s and Flowers</li>
              <li><strong>Quints are powerful</strong> — with 8 jokers, they're more achievable than you'd think</li>
            </ul>
          </div>

          <p style={{ textAlign: 'center', marginTop: 'var(--space-lg)', fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
            You're ready to play!
          </p>
        </div>
      ),
    },
  ];

  const step = steps[currentStep]!;
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="main-menu">
      <div className="menu-card" style={{ maxWidth: 640 }}>
        {/* Progress bar */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 'var(--space-lg)',
        }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= currentStep ? 'var(--color-accent)' : 'var(--color-panel)',
              transition: 'background 0.3s ease',
            }} />
          ))}
        </div>

        <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-lg)' }}>
          {step.title}
        </h2>

        <div style={{ marginBottom: 'var(--space-xl)', minHeight: 300 }}>
          {step.content}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'space-between' }}>
          <button
            className="btn btn-secondary"
            onClick={() => isFirst ? onBack() : setCurrentStep(c => c - 1)}
          >
            {isFirst ? '← Exit' : '← Previous'}
          </button>
          <span style={{ color: 'var(--color-text-muted)', alignSelf: 'center', fontSize: 'var(--font-size-sm)' }}>
            {currentStep + 1} / {steps.length}
          </span>
          {isLast ? (
            <button className="btn btn-primary" onClick={onBack}>
              Start Playing →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setCurrentStep(c => c + 1)}>
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Hand card modal */}
      {showHandCard && (
        <div className="modal-overlay" onClick={() => setShowHandCard(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '85vh', overflowY: 'auto' }}>
            <h2>2026 Hand Patterns</h2>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-sm) var(--space-md)',
              marginBottom: 'var(--space-md)',
              fontSize: 'var(--font-size-xs)',
              lineHeight: '1.4',
              border: '1px solid var(--color-panel-border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
              gap: 'var(--space-sm)',
              textAlign: 'left',
            }}>
              <div><strong>F</strong> = Anemone (Flower)</div>
              <div><strong>D</strong> = Dragon (Coral / Wave / Pearl)</div>
              <div><strong>E/S/W/N</strong> = Winds</div>
              <div><strong>Suits</strong> = Shell / Kelp / Pearl</div>
            </div>
            {ALL_HAND_CATEGORIES.map(cat => (
              <div key={cat.name} style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 style={{
                  color: 'var(--color-accent)', fontSize: 'var(--font-size-md)',
                  borderBottom: '1px solid var(--color-panel-border)',
                  paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-sm)',
                }}>
                  {cat.name}
                </h3>
                {cat.hands.map(hand => (
                  <div key={hand.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '4px 0', fontSize: 'var(--font-size-sm)',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                  }}>
                    <span style={{ flex: 1 }}>{hand.description}</span>
                    <span style={{
                      color: hand.concealed ? 'var(--color-info)' : 'var(--color-success)',
                      fontWeight: 700, minWidth: 50, textAlign: 'right',
                    }}>
                      {hand.concealed ? 'C' : 'X'}{hand.value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <button className="btn btn-secondary" onClick={() => setShowHandCard(false)} style={{ width: '100%' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
