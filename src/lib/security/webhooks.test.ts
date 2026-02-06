import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  computeHmacSha256,
  consumeReplayKey,
  isTimestampFresh,
  parseTimestampMs,
  verifyHmacSha256Signature,
} from './webhooks';

describe('verifyHmacSha256Signature', () => {
  it('accepts a raw hex digest signature', () => {
    const secret = 'my-secret';
    const payload = '{"hello":"world"}';
    const signature = computeHmacSha256(secret, payload).toString('hex');

    expect(
      verifyHmacSha256Signature({
        secret,
        payload,
        signatureHeader: signature,
      })
    ).toBe(true);
  });

  it('accepts prefixed signatures in a header list', () => {
    const secret = 'my-secret';
    const payload = '{"hello":"world"}';
    const signature = computeHmacSha256(secret, payload).toString('hex');

    expect(
      verifyHmacSha256Signature({
        secret,
        payload,
        signatureHeader: `t=123,v1=deadbeef,sha256=${signature}`,
      })
    ).toBe(true);
  });

  it('rejects invalid signature', () => {
    expect(
      verifyHmacSha256Signature({
        secret: 'my-secret',
        payload: '{"hello":"world"}',
        signatureHeader: 'sha256=deadbeef',
      })
    ).toBe(false);
  });
});

describe('consumeReplayKey', () => {
  it('blocks immediate replay of the same key', () => {
    const replayKey = `replay-${randomUUID()}`;
    const now = 1_700_000_000_000;

    expect(consumeReplayKey(replayKey, 60_000, now)).toBe(true);
    expect(consumeReplayKey(replayKey, 60_000, now + 10)).toBe(false);
  });

  it('allows key reuse after ttl expires', () => {
    const replayKey = `replay-${randomUUID()}`;
    const now = 1_700_000_000_000;

    expect(consumeReplayKey(replayKey, 1_000, now)).toBe(true);
    expect(consumeReplayKey(replayKey, 1_000, now + 1_500)).toBe(true);
  });
});

describe('timestamp parsing and freshness', () => {
  it('parses numeric and string timestamps', () => {
    expect(parseTimestampMs(12345)).toBe(12345);
    expect(parseTimestampMs('12345')).toBe(12345);
  });

  it('returns null for invalid timestamp values', () => {
    expect(parseTimestampMs('abc')).toBeNull();
    expect(parseTimestampMs(undefined)).toBeNull();
  });

  it('checks freshness against tolerance window', () => {
    const now = 1_700_000_000_000;
    expect(isTimestampFresh(now - 500, 1_000, now)).toBe(true);
    expect(isTimestampFresh(now - 2_000, 1_000, now)).toBe(false);
  });
});
