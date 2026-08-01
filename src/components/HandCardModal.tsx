// ============================================================
// HandCardModal - 2026 hand pattern card overlay
// ============================================================

import { useMemo, useState } from 'react';
import { ALL_HAND_CATEGORIES } from '../engine/hands';
import {
  displayGroupsForPattern,
  exampleTilesForPattern,
  splitHandDescription,
} from '../engine/pattern-display';
import type { HandPattern } from '../engine/types';
import { Modal } from './Modal';
import { TileComponent } from './TileComponent';
import handCardImage from '../../docs/2026-hand-card.png';

interface HandCardModalProps {
  onClose: () => void;
}

type ViewMode = 'list' | 'image';

export function HandCardModal({ onClose }: HandCardModalProps) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const q = query.trim().toLowerCase();

  const categories = useMemo(() => {
    if (!q) return ALL_HAND_CATEGORIES;
    return ALL_HAND_CATEGORIES.map(cat => ({
      ...cat,
      hands: cat.hands.filter(
        hand =>
          hand.description.toLowerCase().includes(q) ||
          hand.id.toLowerCase().includes(q) ||
          cat.name.toLowerCase().includes(q),
      ),
    })).filter(cat => cat.hands.length > 0);
  }, [q]);

  return (
    <Modal
      title="2026 Hand Patterns"
      titleId="hand-card-title"
      onClose={onClose}
      className="hand-card-modal"
      footer={
        <button type="button" className="btn btn-secondary hand-card-close" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="hand-card-body">
        <div className="hand-card-view-toggle" role="group" aria-label="Hand card view">
          <button
            type="button"
            className={`hand-card-view-btn${view === 'list' ? ' is-active' : ''}`}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            List
          </button>
          <button
            type="button"
            className={`hand-card-view-btn${view === 'image' ? ' is-active' : ''}`}
            aria-pressed={view === 'image'}
            onClick={() => setView('image')}
          >
            Card image
          </button>
        </div>

        {view === 'image' ? (
          <div className="hand-card-image-wrap">
            <img
              src={handCardImage}
              alt="2026 Mahjong Hand Tracker and Scorecard - full printed card"
              className="hand-card-image"
            />
            <p className="hand-card-image-hint">
              Printed-style card. Colors mark different suits. Pinch or scroll to zoom on phone.
            </p>
          </div>
        ) : (
          <>
            <label className="hand-card-search">
              <span className="visually-hidden">Search hands</span>
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search hands (e.g. 2026, NEWS, flowers)"
                autoComplete="off"
                enterKeyHint="search"
              />
            </label>

            <ul className="hand-card-legend">
              <li>
                <strong>Crak 🐚</strong> - numbers 1-9
              </li>
              <li>
                <strong>Bam 🌿</strong> - numbers 1-9
              </li>
              <li>
                <strong>Dot 🫧</strong> - numbers 1-9
              </li>
              <li>
                <strong>D</strong> - Dragon (Red 🪸 / Green 🌊 / Soap 🦪)
              </li>
              <li>
                <strong>F</strong> - Flower 🌺
              </li>
              <li>
                <strong>Joker</strong> - 🪼
              </li>
              <li>
                <strong>E / S / W / N</strong> - 🌅 / ☀️ / 🌇 / ❄️
              </li>
              <li>
                <strong>X</strong> exposed · <strong>C</strong> concealed
              </li>
              <li>Colored chips = different suits (like the printed card)</li>
            </ul>

            {categories.length === 0 ? (
              <p className="hand-card-empty">No hands match "{query.trim()}".</p>
            ) : (
              categories.map(cat => {
                const example = cat.hands[0]!;
                const exampleTiles = exampleTilesForPattern(example);
                return (
                  <section key={cat.name} className="hand-card-category">
                    <h3>{cat.name}</h3>
                    <div className="hand-card-example" aria-label={`Example: ${example.description}`}>
                      <span className="hand-card-example-label">Example</span>
                      <div className="hand-card-example-tiles">
                        {exampleTiles.map(tile => (
                          <TileComponent
                            key={tile.id}
                            tile={tile}
                            size="tiny"
                            showIdentity={false}
                          />
                        ))}
                      </div>
                    </div>
                    {cat.hands.map(hand => (
                      <HandRow key={hand.id} hand={hand} />
                    ))}
                  </section>
                );
              })
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function HandRow({ hand }: { hand: HandPattern }) {
  const { notes } = splitHandDescription(hand.description);
  const groups = displayGroupsForPattern(hand);

  return (
    <div className="hand-card-row">
      <div className="hand-card-row-main">
        <div className="hand-card-groups" aria-label={hand.description}>
          {groups.map((g, i) => (
            <span key={`${g.label}-${i}`} className={`hand-card-chip tone-${g.tone}`}>
              {g.label}
            </span>
          ))}
        </div>
        {notes && <p className="hand-card-notes">{notes}</p>}
      </div>
      <span className={`hand-card-value${hand.concealed ? ' concealed' : ' exposed'}`}>
        {hand.concealed ? 'C' : 'X'}
        {hand.value}
      </span>
    </div>
  );
}
