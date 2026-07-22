import type { Difficulty } from './engine/types';

export type GameSpeed = 'slow' | 'normal' | 'fast' | 'instant';

/** How much in-game teaching to show. Experts can turn it off. */
export type TeachMode = 'expert' | 'guided' | 'coach';

export const SPEED_DELAYS: Record<GameSpeed, { claim: number; advance: number; turn: number }> = {
  slow: { claim: 2000, advance: 1600, turn: 1800 },
  normal: { claim: 1200, advance: 1000, turn: 1200 },
  fast: { claim: 400, advance: 300, turn: 350 },
  instant: { claim: 50, advance: 40, turn: 50 },
};

export const SPEED_CYCLE: GameSpeed[] = ['slow', 'normal', 'fast', 'instant'];

export const SPEED_LABEL: Record<GameSpeed, string> = {
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
  instant: 'Max',
};

export const SPEED_HINT: Record<GameSpeed, string> = {
  slow: 'Relaxed AI turns — good for learning',
  normal: 'Balanced pace',
  fast: 'Snappy AI turns',
  instant: 'Nearly instant AI — for testing',
};

export const TEACH_LABEL: Record<TeachMode, string> = {
  expert: 'Expert',
  guided: 'Guided',
  coach: 'Coach',
};

export const TEACH_HINT: Record<TeachMode, string> = {
  expert: 'Full table feel — no coaches. Stricter norms still apply (no Charleston jokers, real courtesy).',
  guided: 'Turn tips and one-time coaches (recommended for learning)',
  coach: 'Guided plus gentle “closest hands” hints',
};

export interface BotPref {
  name: string;
  difficulty: Difficulty;
}

export interface AppPrefs {
  humanName: string;
  bots: [BotPref, BotPref, BotPref];
  speed: GameSpeed;
  teachMode: TeachMode;
}

export const DEFAULT_PREFS: AppPrefs = {
  humanName: 'You',
  bots: [
    { name: 'Bot Alice', difficulty: 'medium' },
    { name: 'Bot Bob', difficulty: 'medium' },
    { name: 'Bot Carol', difficulty: 'medium' },
  ],
  speed: 'normal',
  teachMode: 'guided',
};

const PREFS_KEY = 'mahjon-prefs';

function isSpeed(v: unknown): v is GameSpeed {
  return v === 'slow' || v === 'normal' || v === 'fast' || v === 'instant';
}

function isDifficulty(v: unknown): v is Difficulty {
  return v === 'easy' || v === 'medium' || v === 'hard';
}

function isTeachMode(v: unknown): v is TeachMode {
  return v === 'expert' || v === 'guided' || v === 'coach';
}

/** Load prefs; migrates legacy mahjon-speed key. */
export function loadPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppPrefs>;
      const bots = Array.isArray(parsed.bots) ? parsed.bots : DEFAULT_PREFS.bots;
      return {
        humanName: typeof parsed.humanName === 'string' && parsed.humanName.trim()
          ? parsed.humanName.trim()
          : DEFAULT_PREFS.humanName,
        bots: [0, 1, 2].map(i => {
          const b = bots[i] as Partial<BotPref> | undefined;
          const fallback = DEFAULT_PREFS.bots[i]!;
          return {
            name: typeof b?.name === 'string' && b.name.trim() ? b.name.trim() : fallback.name,
            difficulty: isDifficulty(b?.difficulty) ? b.difficulty : fallback.difficulty,
          };
        }) as AppPrefs['bots'],
        speed: isSpeed(parsed.speed) ? parsed.speed : DEFAULT_PREFS.speed,
        teachMode: isTeachMode(parsed.teachMode) ? parsed.teachMode : DEFAULT_PREFS.teachMode,
      };
    }
  } catch {
    /* fall through */
  }

  const legacy = localStorage.getItem('mahjon-speed');
  if (isSpeed(legacy)) {
    return { ...DEFAULT_PREFS, speed: legacy, bots: [...DEFAULT_PREFS.bots] as AppPrefs['bots'] };
  }
  return { ...DEFAULT_PREFS, bots: [...DEFAULT_PREFS.bots] as AppPrefs['bots'] };
}

export function savePrefs(prefs: AppPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  localStorage.setItem('mahjon-speed', prefs.speed);
}

/** Wipe Mahjon prefs. Does not touch unrelated site storage. */
export function clearPrefs(): AppPrefs {
  localStorage.removeItem(PREFS_KEY);
  localStorage.removeItem('mahjon-speed');
  return {
    ...DEFAULT_PREFS,
    bots: DEFAULT_PREFS.bots.map(b => ({ ...b })) as AppPrefs['bots'],
  };
}

/** Delete Cache Storage entries and unregister service workers. */
async function wipeOfflineCache(): Promise<void> {
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch {
      /* ignore */
    }
  }

  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Fresh page load with offline/service-worker cache wiped.
 * Keeps saved names/speed prefs.
 * @param extraParams optional query params to keep across the reload (e.g. mp=1)
 */
export async function clearCacheAndReload(
  extraParams?: Record<string, string>,
): Promise<void> {
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }

  await wipeOfflineCache();
  forceFreshNavigate(extraParams);
}

/** Reload in place after cache wipe. Optional params (e.g. mp=1) only when needed. */
function forceFreshNavigate(extraParams?: Record<string, string>): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('_fresh');
  url.hash = '';

  let needsParamNav = false;
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      if (url.searchParams.get(k) !== v) {
        url.searchParams.set(k, v);
        needsParamNav = true;
      }
    }
  }

  if (needsParamNav) {
    const next =
      url.pathname +
      (url.searchParams.toString() ? `?${url.searchParams}` : '');
    window.location.replace(next);
    return;
  }

  // Same URL — true reload, no query-string "new page" hop
  window.location.reload();
}

/**
 * Full wipe: prefs + cache + storage leftovers, then fresh reload.
 */
export async function hardResetApp(): Promise<void> {
  clearPrefs();

  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }

  await wipeOfflineCache();

  if ('indexedDB' in window && indexedDB.databases) {
    try {
      const dbs = await indexedDB.databases();
      await Promise.all(
        dbs
          .map(db => db.name)
          .filter((name): name is string => !!name)
          .map(
            name =>
              new Promise<void>((resolve) => {
                const req = indexedDB.deleteDatabase(name);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              }),
          ),
      );
    } catch {
      /* ignore */
    }
  }

  forceFreshNavigate();
}

export function prefsToGamePlayers(prefs: AppPrefs) {
  return [
    { name: prefs.humanName, type: 'human' as const },
    ...prefs.bots.map(b => ({
      name: b.name,
      type: 'ai' as const,
      difficulty: b.difficulty,
    })),
  ];
}
