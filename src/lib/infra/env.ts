function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getStringEnv(name: string): string | undefined {
  return readEnv(name);
}

export function getRequiredEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getBooleanEnv(name: string, fallback: boolean = false): boolean {
  const value = readEnv(name);
  if (!value) return fallback;

  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

export function getIntegerEnv(
  name: string,
  fallback: number,
  options?: { min?: number; max?: number }
): number {
  const value = readEnv(name);
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;

  const min = options?.min ?? Number.NEGATIVE_INFINITY;
  const max = options?.max ?? Number.POSITIVE_INFINITY;
  return Math.min(Math.max(parsed, min), max);
}

export function isProductionModeEnabled(): boolean {
  return getBooleanEnv('GOODBYE_PRODUCTION_MODE', false);
}
