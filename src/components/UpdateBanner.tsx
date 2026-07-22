// ============================================================
// UpdateBanner — non-blocking “new version” prompt
// ============================================================

import { useEffect, useState } from 'react';
import { reloadToNewVersion, subscribePwaUpdate } from '../pwa-update';

interface UpdateBannerProps {
  /** When true, warn before reload so a live hand isn’t abandoned casually */
  inGame?: boolean;
}

export function UpdateBanner({ inGame = false }: UpdateBannerProps) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribePwaUpdate(setReady), []);

  if (!ready || dismissed) return null;

  const onReload = () => {
    if (inGame) {
      const ok = window.confirm(
        'Reload now? An in-progress game may be lost (multiplayer hosts: the room ends; clients can rejoin with Room + Seat key if the host is still up).',
      );
      if (!ok) return;
    }
    reloadToNewVersion();
  };

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span>New version ready</span>
      <div className="update-banner-actions">
        <button type="button" className="btn btn-primary btn-compact" onClick={onReload}>
          Reload
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-compact"
          onClick={() => setDismissed(true)}
        >
          Later
        </button>
      </div>
    </div>
  );
}
