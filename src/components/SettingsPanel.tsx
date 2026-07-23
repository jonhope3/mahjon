// ============================================================
// SettingsPanel — speed, names, new game, quit, fresh reload
// ============================================================

import { useEffect, useState } from 'react';
import type { Difficulty, Player } from '../engine/types';
import {
  AppPrefs,
  BotPref,
  GameSpeed,
  SPEED_CYCLE,
  SPEED_HINT,
  SPEED_LABEL,
  TeachMode,
  TEACH_HINT,
  TEACH_LABEL,
} from '../game-settings';
import { Modal } from './Modal';
import { BusyDots } from './BusyDots';
import { useFreshReload } from '../hooks/useFreshReload';

interface SettingsPanelProps {
  prefs: AppPrefs;
  onPrefsChange: (prefs: AppPrefs) => void;
  onClose: () => void;
  inGame?: boolean;
  players?: Player[];
  onApplyLiveNames?: (names: string[]) => void;
  onNewGame?: () => void;
  onQuitToMenu?: () => void;
  resumeKey?: string;
  roomCode?: string;
}

function cleanPrefs(draft: AppPrefs): AppPrefs {
  return {
    humanName: draft.humanName.trim() || 'You',
    bots: draft.bots.map((b, i) => ({
      name: b.name.trim() || `Bot ${i + 1}`,
      difficulty: b.difficulty,
    })) as AppPrefs['bots'],
    speed: draft.speed,
    teachMode: draft.teachMode,
  };
}

const TEACH_CYCLE: TeachMode[] = ['expert', 'guided', 'coach'];

export function SettingsPanel({
  prefs,
  onPrefsChange,
  onClose,
  inGame = false,
  players,
  onApplyLiveNames,
  onNewGame,
  onQuitToMenu,
  resumeKey,
  roomCode,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<AppPrefs>(prefs);
  const [liveNames, setLiveNames] = useState<string[]>(
    () => players?.map(p => p.name) ?? [],
  );
  const [confirmFullWipe, setConfirmFullWipe] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { busy, clearCacheAndReload, hardReset } = useFreshReload();

  useEffect(() => setDraft(prefs), [prefs]);
  useEffect(() => {
    if (players) setLiveNames(players.map(p => p.name));
  }, [players]);

  const setSpeed = (speed: GameSpeed) => {
    setDraft(d => ({ ...d, speed }));
  };

  const setTeachMode = (teachMode: TeachMode) => {
    setDraft(d => ({ ...d, teachMode }));
  };

  const setBot = (index: number, updates: Partial<BotPref>) => {
    setDraft(d => {
      const bots = [...d.bots] as AppPrefs['bots'];
      bots[index] = { ...bots[index]!, ...updates };
      return { ...d, bots };
    });
  };

  const handleSave = () => {
    const cleaned = cleanPrefs(draft);
    onPrefsChange(cleaned);
    if (inGame && onApplyLiveNames && liveNames.length === 4) {
      onApplyLiveNames(
        liveNames.map(
          (n, i) => n.trim() || (i === 0 ? cleaned.humanName : cleaned.bots[i - 1]!.name),
        ),
      );
    }
    onClose();
  };

  return (
    <Modal
      title="Settings"
      titleId="settings-title"
      onClose={onClose}
      className="settings-panel"
      overlayClassName="settings-overlay"
      footer={
        <div className="settings-footer">
          <div className="settings-actions">
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDraft(prefs);
                if (players) setLiveNames(players.map(p => p.name));
                onClose();
              }}
            >
              Cancel
            </button>
          </div>
          {inGame && (
            <div className="settings-game-actions">
              {onNewGame && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    handleSave();
                    onNewGame();
                  }}
                >
                  New game
                </button>
              )}
              {onQuitToMenu && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    onQuitToMenu();
                    onClose();
                  }}
                >
                  Quit to menu
                </button>
              )}
            </div>
          )}
        </div>
      }
    >
      <div className="settings-body">
        <section className="settings-section">
          <h3>Teaching</h3>
          <p className="settings-hint">{TEACH_HINT[draft.teachMode]}</p>
          <div className="settings-speed-row settings-speed-row--3">
            {TEACH_CYCLE.map(m => (
              <button
                key={m}
                type="button"
                className={`btn btn-compact${draft.teachMode === m ? ' btn-primary' : ' btn-secondary'}`}
                onClick={() => setTeachMode(m)}
                aria-pressed={draft.teachMode === m}
              >
                {TEACH_LABEL[m]}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>AI speed</h3>
          <p className="settings-hint">{SPEED_HINT[draft.speed]}</p>
          <div className="settings-speed-row settings-speed-row--3">
            {SPEED_CYCLE.filter(s => s !== 'instant').map(s => (
              <button
                key={s}
                type="button"
                className={`btn btn-compact${draft.speed === s ? ' btn-primary' : ' btn-secondary'}`}
                onClick={() => setSpeed(s)}
                aria-pressed={draft.speed === s}
              >
                {SPEED_LABEL[s]}
              </button>
            ))}
          </div>
          {draft.speed === 'instant' && !showAdvanced && (
            <p className="settings-hint">Max speed is on — open Advanced to change it.</p>
          )}
        </section>

        {inGame && (roomCode || resumeKey) && (
          <section className="settings-section settings-section--wide">
            <h3>Rejoin this table</h3>
            <p className="settings-hint">
              Dropped offline? Open Play with Group → Join with the room code. Use the same name you
              played with, or your seat key below. This phone also remembers “Resume my seat.”
            </p>
            {roomCode && (
              <p className="settings-resume-line">
                Room <strong>{roomCode}</strong>
              </p>
            )}
            {resumeKey && (
              <p className="settings-resume-line">
                Seat key <strong>{resumeKey}</strong>
              </p>
            )}
          </section>
        )}

        <section className="settings-section settings-section--wide">
          <h3>Default names &amp; bots</h3>
          <p className="settings-hint">Used for Quick Start and new games. Saved on this device.</p>
          <label className="settings-field">
            <span>Your name</span>
            <input
              type="text"
              value={draft.humanName}
              onChange={e => setDraft(d => ({ ...d, humanName: e.target.value }))}
              maxLength={20}
              autoComplete="off"
            />
          </label>
          {draft.bots.map((bot, i) => (
            <div key={i} className="settings-bot-row">
              <label className="settings-field">
                <span>Bot {i + 1}</span>
                <input
                  type="text"
                  value={bot.name}
                  onChange={e => setBot(i, { name: e.target.value })}
                  maxLength={20}
                  autoComplete="off"
                />
              </label>
              <label className="settings-field settings-field--narrow">
                <span>Level</span>
                <select
                  value={bot.difficulty}
                  onChange={e => setBot(i, { difficulty: e.target.value as Difficulty })}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            </div>
          ))}
        </section>

        {inGame && players && onApplyLiveNames && (
          <section className="settings-section settings-section--wide">
            <h3>This game — rename seats</h3>
            <p className="settings-hint">
              Saved with Settings → Save. Host syncs names to the table.
            </p>
            {players.map((p, i) => (
              <label key={p.id} className="settings-field">
                <span>
                  {['East', 'South', 'West', 'North'][i]} · {p.type === 'ai' ? 'AI' : 'You'}
                </span>
                <input
                  type="text"
                  value={liveNames[i] ?? p.name}
                  onChange={e =>
                    setLiveNames(prev => prev.map((n, j) => (j === i ? e.target.value : n)))
                  }
                  maxLength={20}
                  autoComplete="off"
                />
              </label>
            ))}
          </section>
        )}

        <section className="settings-section settings-section--danger">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowAdvanced(a => !a)}
          >
            {showAdvanced ? 'Hide advanced' : 'Advanced…'}
          </button>
          {showAdvanced && (
            <>
              <h3>Max AI speed</h3>
              <p className="settings-hint">{SPEED_HINT.instant}</p>
              <div className="settings-speed-row">
                <button
                  type="button"
                  className={`btn btn-compact${draft.speed === 'instant' ? ' btn-primary' : ' btn-secondary'}`}
                  onClick={() => setSpeed('instant')}
                >
                  {SPEED_LABEL.instant}
                </button>
              </div>
              <h3>Hard refresh</h3>
              <p className="settings-hint">
                Wipe the offline cache and reload. Same as pull-down on the home screen.
                {inGame
                  ? ' Warning: this abandons the current hand (multiplayer clients need Room + Seat key to rejoin if the host stays up).'
                  : ''}
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (inGame) {
                    const ok = window.confirm(
                      'Hard refresh now? Your current game may be lost.',
                    );
                    if (!ok) return;
                  }
                  clearCacheAndReload();
                }}
                disabled={busy}
              >
                {busy ? (
                  <>
                    Refreshing
                    <BusyDots />
                  </>
                ) : (
                  'Hard refresh'
                )}
              </button>
              {!confirmFullWipe ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setConfirmFullWipe(true)}
                  disabled={busy}
                >
                  Wipe settings too…
                </button>
              ) : (
                <div className="settings-reset-confirm">
                  <p className="settings-hint settings-hint--warn">
                    Clears names, speed, prefs, cache — then reloads. Continue?
                  </p>
                  <div className="settings-actions">
                    <button type="button" className="btn btn-danger" onClick={hardReset} disabled={busy}>
                      {busy ? (
                        <>
                          Resetting
                          <BusyDots />
                        </>
                      ) : (
                        'Yes, wipe everything'
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setConfirmFullWipe(false)}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
