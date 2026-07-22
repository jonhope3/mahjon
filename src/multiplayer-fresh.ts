// ============================================================
// Multiplayer freshness — same build before anyone hosts/joins
// ============================================================

import { APP_VERSION } from './app-version';
import { clearCacheAndReload } from './game-settings';

const READY_KEY = 'mahjon-mp-ready';
const OPEN_KEY = 'mahjon-mp-open';

/** True if this tab already refreshed onto the current APP_VERSION for multiplayer. */
export function isMultiplayerFresh(): boolean {
  try {
    return sessionStorage.getItem(READY_KEY) === APP_VERSION;
  } catch {
    return false;
  }
}

export function markMultiplayerFresh(): void {
  try {
    sessionStorage.setItem(READY_KEY, APP_VERSION);
  } catch {
    /* ignore */
  }
}

/**
 * If the URL has ?mp=1 (set by a multiplayer-bound refresh), strip it,
 * mark this session fresh, and leave an open-lobby flag for App.
 */
export function noteMultiplayerReturnFromUrl(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get('mp') !== '1') return;
  url.searchParams.delete('mp');
  window.history.replaceState(
    null,
    '',
    url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash,
  );
  markMultiplayerFresh();
  try {
    sessionStorage.setItem(OPEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function shouldOpenMultiplayerLobby(): boolean {
  try {
    return sessionStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOpenMultiplayerLobby(): void {
  try {
    sessionStorage.setItem(OPEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearMultiplayerLobbyIntent(): void {
  try {
    sessionStorage.removeItem(OPEN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Ensure this device is on a recent build before multiplayer.
 * Prefer a quiet SW update; only hard-reload when a waiting worker
 * must activate (avoids surprising grandparents every time).
 */
export async function ensureFreshForMultiplayer(): Promise<'ready' | 'reloading'> {
  if (isMultiplayerFresh()) return 'ready';

  let needsHardReload = false;
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) {
          needsHardReload = true;
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    } catch {
      /* continue */
    }
  }

  // First visit this session: mark fresh without forcing a reload unless SW is waiting
  if (!needsHardReload) {
    markMultiplayerFresh();
    return 'ready';
  }

  await clearCacheAndReload({ mp: '1' });
  return 'reloading';
}
