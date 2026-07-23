// ============================================================
// Peer transport — full override of PeerJS / WebRTC defaults
// ============================================================
// PeerJS cloud + default ICE pooling is unreliable on phones /
// guest Wi‑Fi. We never use Peer’s implicit config: explicit
// signaling, iceCandidatePoolSize: 0, and TURN for NAT relay.

import type { PeerJSOption } from 'peerjs';

/** Dual urls+url — PeerJS historically reads `url` for TURN. */
type IceServer = {
  urls: string | string[];
  url?: string | string[];
  username?: string;
  credential?: string;
};

/**
 * STUN for direct paths + Open Relay TURN for cellular / strict NAT.
 * Static Open Relay credentials (public free tier).
 */
const ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turns:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
].map(s => ({
  ...s,
  url: s.urls,
}));

/** Room peer id on the signaling broker */
export function hostPeerId(roomCode: string): string {
  return `mahjon-${roomCode.trim().toUpperCase()}`;
}

/**
 * Complete PeerJS options — do not merge with library defaults for ICE.
 * iceCandidatePoolSize: 0 disables browser ICE candidate pooling.
 */
export function buildPeerOptions(): PeerJSOption {
  return {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    key: 'peerjs',
    debug: 0,
    // pingInterval is supported by PeerJS at runtime but missing from typings
    pingInterval: 4000,
    config: {
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    },
  } as PeerJSOption;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** PeerJS error shape (not always a real Error). */
export function peerErrorType(err: unknown): string {
  if (err && typeof err === 'object' && 'type' in err) {
    return String((err as { type?: string }).type ?? '');
  }
  return '';
}

export function peerErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: string }).message ?? 'Connection error');
  }
  return 'Connection error';
}
