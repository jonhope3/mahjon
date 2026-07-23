// ============================================================
// mp-session — remember the last family table for easy rejoin
// ============================================================

const KEY = 'mahjon-mp-last-table';
const DEEP_KEY = 'mahjon-mp-deeplink';

export interface MpLastTable {
  roomCode: string;
  seatKey: string;
  playerName: string;
  /** When the hand was last active on this device */
  savedAt: number;
}

export function saveMpLastTable(table: Omit<MpLastTable, 'savedAt'>): void {
  try {
    const payload: MpLastTable = { ...table, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadMpLastTable(): MpLastTable | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MpLastTable;
    if (!parsed?.roomCode || !parsed?.seatKey) return null;
    // Keep for a week — family games often pause overnight
    if (Date.now() - (parsed.savedAt || 0) > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearMpLastTable(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Canonical app URL for GitHub Pages (`/mahjon/`) and local (`/`).
 * Always uses a trailing slash so GH Pages doesn’t drop ?room= on redirect.
 */
export function appHomeUrl(): URL {
  const origin = window.location.origin;
  let base = import.meta.env.BASE_URL || '/';
  if (!base.endsWith('/')) base += '/';
  return new URL(base, origin);
}

export type InviteKind = 'table' | 'resume';

/**
 * Build a deep link.
 * - table:  ?room=CODE          (for inviting other people — never include seat)
 * - resume: ?room=CODE&seat=KEY (for reclaiming YOUR seat after a drop)
 */
export function inviteUrl(roomCode: string, kind: InviteKind = 'table', seatKey?: string): string {
  const url = appHomeUrl();
  url.searchParams.set('room', roomCode.trim().toUpperCase());
  if (kind === 'resume' && seatKey?.trim()) {
    url.searchParams.set('seat', seatKey.trim().toUpperCase());
  }
  return url.toString();
}

/** Friendly share / copy text for texting the group (room only — no seat key). */
export function buildInviteMessage(roomCode: string, playerName?: string): string {
  const who = playerName?.trim() ? `${playerName.trim()} is` : 'We are';
  const link = inviteUrl(roomCode, 'table');
  return [
    `${who} hosting Mahjon (American Mahjong).`,
    `Join here: ${link}`,
    `Or open the app → Play with Group → Join with code: ${roomCode}`,
    `(2–4 people. Same Wi‑Fi or internet is fine — no accounts needed.)`,
  ].join('\n');
}

/** Personal rejoin link — includes your seat key. Don’t send this as the group invite. */
export function buildResumeMessage(roomCode: string, seatKey: string, playerName?: string): string {
  const link = inviteUrl(roomCode, 'resume', seatKey);
  const who = playerName?.trim() || 'Your';
  return [
    `${who} Mahjon seat backup`,
    `Room ${roomCode} · Seat ${seatKey}`,
    link,
    `(Only for you — use this if you get disconnected.)`,
  ].join('\n');
}

export async function shareOrCopyInvite(
  roomCode: string,
  playerName?: string,
): Promise<'shared' | 'copied' | 'failed'> {
  const link = inviteUrl(roomCode, 'table');
  const text = buildInviteMessage(roomCode, playerName);
  try {
    if (typeof navigator.share === 'function') {
      // Pass url separately; keep text free of a second copy of the same link on iOS
      await navigator.share({
        title: 'Mahjon — join our table',
        text: `${playerName?.trim() ? `${playerName.trim()} is` : 'We are'} hosting Mahjon. Room code: ${roomCode.trim().toUpperCase()}`,
        url: link,
      });
      return 'shared';
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    try {
      await navigator.clipboard.writeText(link);
      return 'copied';
    } catch {
      try {
        await navigator.clipboard.writeText(roomCode);
        return 'copied';
      } catch {
        return 'failed';
      }
    }
  }
}

/**
 * Capture ?room= / ?seat= from the URL into sessionStorage and strip them.
 * Returns true if a room code was present (App should open the family lobby).
 */
export function noteMpDeepLinkFromUrl(): boolean {
  try {
    const url = new URL(window.location.href);
    const room = url.searchParams.get('room')?.trim().toUpperCase() || undefined;
    const seat = url.searchParams.get('seat')?.trim().toUpperCase() || undefined;
    if (!room && !seat) return false;
    sessionStorage.setItem(DEEP_KEY, JSON.stringify({ room, seat }));
    url.searchParams.delete('room');
    url.searchParams.delete('seat');
    // Prefer canonical base path when rewriting (keeps /mahjon/)
    const clean = appHomeUrl();
    for (const [k, v] of url.searchParams.entries()) {
      clean.searchParams.set(k, v);
    }
    window.history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
    return !!room;
  } catch {
    return false;
  }
}

/** Peek without consuming (safe for Strict Mode / remounts). */
export function peekMpDeepLink(): { room?: string; seat?: string } {
  try {
    const raw = sessionStorage.getItem(DEEP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { room?: string; seat?: string };
    return {
      room: parsed.room?.trim().toUpperCase() || undefined,
      seat: parsed.seat?.trim().toUpperCase() || undefined,
    };
  } catch {
    return {};
  }
}

/** Consume a one-shot deep link (from URL capture). */
export function readMpDeepLink(): { room?: string; seat?: string } {
  const parsed = peekMpDeepLink();
  try {
    sessionStorage.removeItem(DEEP_KEY);
  } catch {
    /* ignore */
  }
  return parsed;
}
