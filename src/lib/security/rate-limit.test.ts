import { describe, expect, it } from 'vitest';
import { consumeRateLimit, getClientIp } from './rate-limit';

describe('getClientIp', () => {
  it('returns first x-forwarded-for entry', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.10, 10.0.0.1',
    });
    expect(getClientIp(headers)).toBe('203.0.113.10');
  });

  it('falls back to x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '198.51.100.5' });
    expect(getClientIp(headers)).toBe('198.51.100.5');
  });
});

describe('consumeRateLimit', () => {
  it('allows requests up to limit and blocks beyond limit', () => {
    const key = `limit-key-${Date.now()}`;
    const now = 1_700_000_000_000;

    expect(
      consumeRateLimit({ key, limit: 2, windowMs: 1_000, nowMs: now }).allowed
    ).toBe(true);
    expect(
      consumeRateLimit({ key, limit: 2, windowMs: 1_000, nowMs: now + 10 }).allowed
    ).toBe(true);
    expect(
      consumeRateLimit({ key, limit: 2, windowMs: 1_000, nowMs: now + 20 }).allowed
    ).toBe(false);
  });

  it('resets after the configured window', () => {
    const key = `reset-key-${Date.now()}`;
    const now = 1_700_000_000_000;

    consumeRateLimit({ key, limit: 1, windowMs: 100, nowMs: now });
    expect(
      consumeRateLimit({ key, limit: 1, windowMs: 100, nowMs: now + 10 }).allowed
    ).toBe(false);
    expect(
      consumeRateLimit({ key, limit: 1, windowMs: 100, nowMs: now + 150 }).allowed
    ).toBe(true);
  });
});
