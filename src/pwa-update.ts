// ============================================================
// PWA update checks — find new SW, notify UI, apply on demand
// ============================================================

type Listener = (updateReady: boolean) => void;

let registration: ServiceWorkerRegistration | null = null;
let updateReady = false;
const listeners = new Set<Listener>();

function notify(ready: boolean) {
  updateReady = ready;
  for (const fn of listeners) fn(ready);
}

function watchRegistration(reg: ServiceWorkerRegistration) {
  registration = reg;

  const markIfUpdate = () => {
    // New worker installed while this page already had a controller = update available
    if (reg.waiting && navigator.serviceWorker.controller) {
      notify(true);
    }
  };

  markIfUpdate();

  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        notify(true);
      }
    });
  });
}

async function checkForUpdate() {
  try {
    await registration?.update();
    if (registration?.waiting && navigator.serviceWorker.controller) {
      notify(true);
    }
  } catch {
    /* offline / ignored */
  }
}

/** Call once from main.tsx */
export function initPwaUpdates(): void {
  if (!('serviceWorker' in navigator)) return;

  const base = import.meta.env.BASE_URL || '/';

  const start = async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${base}sw.js`);
      watchRegistration(reg);
      await checkForUpdate();
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  };

  if (document.readyState === 'complete') void start();
  else window.addEventListener('load', () => void start());

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });

  window.setInterval(() => void checkForUpdate(), 30 * 60 * 1000);
}

export function subscribePwaUpdate(listener: Listener): () => void {
  listeners.add(listener);
  listener(updateReady);
  return () => {
    listeners.delete(listener);
  };
}

/** Activate waiting worker (if any) and reload into the new build. */
export function reloadToNewVersion(): void {
  const waiting = registration?.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        window.location.reload();
      },
      { once: true },
    );
    // Fallback if controllerchange already fired / skipWaiting was auto
    window.setTimeout(() => window.location.reload(), 800);
    return;
  }
  window.location.reload();
}
