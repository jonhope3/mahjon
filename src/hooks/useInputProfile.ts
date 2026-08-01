// ============================================================
// useInputProfile - phone / tablet / desktop for help & chrome
// ============================================================
//
// Matches how the app already splits shells:
//   • phone  → max-width 699px (mobile game board)
//   • tablet → wider + touch-primary (iPad)
//   • desktop → mouse / trackpad primary

import { useEffect, useState } from 'react';

export type InputProfile = 'phone' | 'tablet' | 'desktop';

function readProfile(): InputProfile {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia('(max-width: 699px)').matches) return 'phone';
  // iPad (and similar): large viewport but finger-first.
  if (window.matchMedia('(pointer: coarse)').matches) return 'tablet';
  return 'desktop';
}

/** Live input profile for Help copy and rearrange hints. */
export function useInputProfile(): InputProfile {
  const [profile, setProfile] = useState<InputProfile>(() => readProfile());

  useEffect(() => {
    const phone = window.matchMedia('(max-width: 699px)');
    const coarse = window.matchMedia('(pointer: coarse)');
    const sync = () => setProfile(readProfile());
    sync();
    phone.addEventListener('change', sync);
    coarse.addEventListener('change', sync);
    return () => {
      phone.removeEventListener('change', sync);
      coarse.removeEventListener('change', sync);
    };
  }, []);

  return profile;
}
