import { useCallback, useState } from 'react';
import { clearCacheAndReload, hardResetApp } from '../game-settings';

/** Shared loading flag for cache wipe / hard reset navigations. */
export function useFreshReload() {
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      setBusy(false);
    }
  }, []);

  return {
    busy,
    clearCacheAndReload: () => run(clearCacheAndReload),
    hardReset: () => run(hardResetApp),
  };
}
