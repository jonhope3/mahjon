// ============================================================
// InstallNudge — soft “Add to Home Screen” tip on the menu only
// ============================================================

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'mahjon-install-dismissed';
const VISITS_KEY = 'mahjon-menu-visits';

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function InstallNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
      if (isStandalone()) return;
      const visits = Number(localStorage.getItem(VISITS_KEY) || '0') + 1;
      localStorage.setItem(VISITS_KEY, String(visits));
      // Soft: only after a return visit
      if (visits >= 2) setShow(true);
    } catch {
      /* private mode */
    }
  }, []);

  if (!show) return null;

  return (
    <div className="install-nudge" role="note">
      <p>
        Tip: Add Mahjon to your Home Screen for a full-screen, offline-friendly table.
      </p>
      <button
        type="button"
        className="btn btn-secondary btn-compact"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, '1');
          } catch {
            /* ignore */
          }
          setShow(false);
        }}
      >
        Got it
      </button>
    </div>
  );
}
