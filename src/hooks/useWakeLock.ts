// ============================================================
// useWakeLock - keep the screen awake during play
// ============================================================
//
// Without this the phone/iPad dims and sleeps while you watch AI
// opponents take their turns, or while waiting on other humans in a
// multiplayer game - exactly the "playing on the couch / on a plane"
// scenario this app is built for.
//
// The Screen Wake Lock API drops the lock automatically whenever the
// document becomes hidden, so we re-acquire on `visibilitychange`.

import { useEffect, useRef } from 'react';

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
};

type WakeLockCapableNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

/**
 * Holds a screen wake lock while `active` is true.
 * No-ops on browsers without support (older Safari, Firefox).
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined') return;

    const nav = navigator as WakeLockCapableNavigator;
    if (!nav.wakeLock) return;

    let cancelled = false;

    const acquire = async () => {
      // Only meaningful while the tab is actually visible
      if (document.visibilityState !== 'visible') return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        const sentinel = await nav.wakeLock!.request('screen');
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // Denied (battery saver, no user gesture yet, unsupported) - ignore.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => {});
      }
    };
  }, [active]);
}

