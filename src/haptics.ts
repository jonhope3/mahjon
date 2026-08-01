// ============================================================
// Haptics - short vibration cues for phone/tablet play
// ============================================================
//
// Mobile players often look away between turns. A short buzz when it
// becomes your turn (or when a time-sensitive claim window opens) makes
// the game far more playable one-handed.
//
// All calls are best-effort: unsupported platforms (desktop, iOS Safari)
// silently no-op. Respects the user's reduced-motion preference and the
// in-app Settings toggle.

export type HapticCue =
  | 'select'      // tile picked up / long-press identify
  | 'turn'        // it just became your turn
  | 'claim'       // a claim window opened and YOU can claim
  | 'commit'      // discard / claim confirmed
  | 'mahjong';    // you won

/** Vibration patterns, in ms. Arrays alternate buzz/pause. */
const PATTERNS: Record<HapticCue, number | number[]> = {
  select: 12,
  turn: 18,
  claim: [14, 60, 14],
  commit: 22,
  mahjong: [30, 70, 30, 70, 90],
};

let enabled = true;

/** Toggled from Settings. Defaults on. */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function getHapticsEnabled(): boolean {
  return enabled;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Fire a haptic cue. Safe to call anywhere; never throws. */
export function haptic(cue: HapticCue): void {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate(PATTERNS[cue]);
  } catch {
    /* ignore - unsupported or blocked */
  }
}

