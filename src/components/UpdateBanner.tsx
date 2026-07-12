// ============================================================
// UpdateBanner — non-blocking “new version” prompt
// ============================================================

import { useEffect, useState } from 'react';
import { reloadToNewVersion, subscribePwaUpdate } from '../pwa-update';

export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribePwaUpdate(setReady), []);

  if (!ready || dismissed) return null;

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span>New version ready</span>
      <div className="update-banner-actions">
        <button type="button" className="btn btn-primary btn-compact" onClick={reloadToNewVersion}>
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
