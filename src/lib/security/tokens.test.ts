import { describe, expect, it } from 'vitest';
import { normalizeLinearApiKey } from './tokens';

describe('normalizeLinearApiKey', () => {
  it('strips Bearer prefix for Linear API keys', () => {
    expect(normalizeLinearApiKey('Bearer lin_api_abc123')).toBe('lin_api_abc123');
  });

  it('strips Bearer prefix for Linear developer keys', () => {
    expect(normalizeLinearApiKey('  Bearer   lin_dev_abc123  ')).toBe(
      'lin_dev_abc123'
    );
  });

  it('keeps non-Linear bearer values unchanged', () => {
    expect(normalizeLinearApiKey('Bearer not-a-linear-token')).toBe(
      'Bearer not-a-linear-token'
    );
  });

  it('returns trimmed value for plain token input', () => {
    expect(normalizeLinearApiKey('   lin_api_plain   ')).toBe('lin_api_plain');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeLinearApiKey('   ')).toBe('');
    expect(normalizeLinearApiKey(undefined)).toBe('');
  });
});
