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

function inviteUrl(roomCode: string, seatKey?: string): string {
  try {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', roomCode);
    if (seatKey) url.searchParams.set('seat', seatKey);
    return url.toString();
  } catch {
    return '';
  }
}

/** Friendly share / copy text for texting grandparents */
export function buildInviteMessage(roomCode: string, playerName?: string, seatKey?: string): string {
  const who = playerName?.trim() ? `${playerName.trim()} is` : 'We are';
  const link = inviteUrl(roomCode, seatKey);
  const lines = [
    `${who} hosting Mahjon (American Mahjong).`,
    link
      ? `Tap this link, or open the app → Play with Group → Join`
      : `Open the app → Play with Group → Join`,
    `Room code: ${roomCode}`,
  ];
  if (link) lines.push(link);
  lines.push(`(2–4 people. Same Wi‑Fi or internet is fine — no accounts needed.)`);
  return lines.join('\n');
}

export async function shareOrCopyInvite(
  roomCode: string,
  playerName?: string,
  seatKey?: string,
): Promise<'shared' | 'copied' | 'failed'> {
  const text = buildInviteMessage(roomCode, playerName, seatKey);
  const link = inviteUrl(roomCode, seatKey);
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({
        title: 'Mahjon — join our table',
        text,
        ...(link ? { url: link } : {}),
      });
      return 'shared';
    }
  } catch (err) {
    // User canceled share sheet — not a failure for copy fallback
    if (err instanceof DOMException && err.name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(text);
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
    window.history.replaceState(
      null,
      '',
      url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash,
    );
    return !!room;
  } catch {
    return false;
  }
}

/** Consume a one-shot deep link (from URL capture). */
export function readMpDeepLink(): { room?: string; seat?: string } {
  try {
    const raw = sessionStorage.getItem(DEEP_KEY);
    if (!raw) return {};
    sessionStorage.removeItem(DEEP_KEY);
    const parsed = JSON.parse(raw) as { room?: string; seat?: string };
    return {
      room: parsed.room?.trim().toUpperCase() || undefined,
      seat: parsed.seat?.trim().toUpperCase() || undefined,
    };
  } catch {
    return {};
  }
}
