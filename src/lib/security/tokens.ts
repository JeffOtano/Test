export function normalizeLinearApiKey(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';

  const bearerMatch = trimmed.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) return trimmed;

  const candidate = bearerMatch[1].trim();
  if (/^lin_(api|dev)_/i.test(candidate)) {
    return candidate;
  }

  return trimmed;
}
