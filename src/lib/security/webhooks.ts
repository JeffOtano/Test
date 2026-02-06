import crypto from 'node:crypto';

const MAX_REPLAY_CACHE_ENTRIES = 5000;

const replayCache = new Map<string, number>();

function cleanupReplayCache(nowMs: number): void {
  for (const [key, expiresAt] of replayCache.entries()) {
    if (expiresAt <= nowMs) {
      replayCache.delete(key);
    }
  }

  if (replayCache.size <= MAX_REPLAY_CACHE_ENTRIES) return;

  const overflow = replayCache.size - MAX_REPLAY_CACHE_ENTRIES;
  const keys = replayCache.keys();
  for (let index = 0; index < overflow; index += 1) {
    const nextKey = keys.next();
    if (nextKey.done) break;
    replayCache.delete(nextKey.value);
  }
}

function normalizeSignatureFragment(value: string): string | null {
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return null;

  const extracted = trimmed.includes('=')
    ? trimmed.slice(trimmed.indexOf('=') + 1).trim()
    : trimmed;

  return extracted.length > 0 ? extracted : null;
}

function extractSignatureCandidates(signatureHeader: string): string[] {
  const rawFragments = signatureHeader
    .split(',')
    .map((fragment) => normalizeSignatureFragment(fragment))
    .filter((fragment): fragment is string => Boolean(fragment));

  return rawFragments;
}

function decodeSignatureCandidate(signature: string): Buffer | null {
  if (/^[a-fA-F0-9]+$/.test(signature) && signature.length % 2 === 0) {
    return Buffer.from(signature.toLowerCase(), 'hex');
  }

  try {
    const decoded = Buffer.from(signature, 'base64');
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

function timingSafeCompare(expected: Buffer, actual: Buffer): boolean {
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function computeHmacSha256(secret: string, payload: string): Buffer {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest();
}

export function verifyHmacSha256Signature(params: {
  secret: string;
  payload: string;
  signatureHeader: string | null | undefined;
}): boolean {
  const { secret, payload, signatureHeader } = params;
  if (!secret.trim() || !signatureHeader?.trim()) return false;

  const expected = computeHmacSha256(secret, payload);
  const candidates = extractSignatureCandidates(signatureHeader);

  for (const candidate of candidates) {
    const decoded = decodeSignatureCandidate(candidate);
    if (decoded && timingSafeCompare(expected, decoded)) {
      return true;
    }
  }

  return false;
}

export function consumeReplayKey(
  replayKey: string,
  ttlMs: number,
  nowMs: number = Date.now()
): boolean {
  if (!replayKey.trim()) return true;

  cleanupReplayCache(nowMs);

  const existingExpiry = replayCache.get(replayKey);
  if (existingExpiry && existingExpiry > nowMs) {
    return false;
  }

  replayCache.set(replayKey, nowMs + Math.max(ttlMs, 1));
  return true;
}

export function parseTimestampMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function isTimestampFresh(
  timestampMs: number,
  toleranceMs: number,
  nowMs: number = Date.now()
): boolean {
  const drift = Math.abs(nowMs - timestampMs);
  return drift <= Math.max(toleranceMs, 0);
}
