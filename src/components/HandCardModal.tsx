// ============================================================
// HandCardModal — 2026 hand pattern card overlay
// ============================================================

import { useMemo, useState } from 'react';
import { ALL_HAND_CATEGORIES } from '../engine/hands';
import { Modal } from './Modal';

interface HandCardModalProps {
  onClose: () => void;
}

export function HandCardModal({ onClose }: HandCardModalProps) {
  const [query, setQuery] = useState('');
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

        <div className="hand-card-legend">
          <div>
            <strong>Shell 🐚</strong> = Crak (number 1–9)
          </div>
          <div>
            <strong>Kelp 🌿</strong> = Bam (number 1–9)
          </div>
          <div>
            <strong>Pearl 🫧</strong> = Dot (number 1–9)
          </div>
          <div>
            <strong>D</strong> = Dragon 🪸 / 🌊 / 🦪
          </div>
          <div>
            <strong>F</strong> = Anemone 🌺 · <strong>Joker</strong> = 🪼
          </div>
          <div>
            <strong>E/S/W/N</strong> = 🌅 / ☀️ / 🌇 / ❄️
          </div>
        </div>
        {categories.length === 0 ? (
          <p className="hand-card-empty">No hands match “{query.trim()}”.</p>
        ) : (
          categories.map(cat => (
            <div key={cat.name} className="hand-card-category">
              <h3>{cat.name}</h3>
              {cat.hands.map(hand => (
                <div key={hand.id} className="hand-card-row">
                  <span className="hand-card-desc">{hand.description}</span>
                  <span className={`hand-card-value${hand.concealed ? ' concealed' : ' exposed'}`}>
                    {hand.concealed ? 'C' : 'X'}
                    {hand.value}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
