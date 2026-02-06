import { StoredSyncConflictPolicy, StoredSyncDirection } from '@/lib/db';
import { normalizeLinearApiKey } from '@/lib/security/tokens';

export interface WebhookBody {
  shortcutToken?: string;
  linearToken?: string;
  linearTeamId?: string;
  shortcutTeamId?: string;
  direction?: StoredSyncDirection;
  conflictPolicy?: StoredSyncConflictPolicy;
  includeComments?: boolean;
  includeAttachments?: boolean;
  webhookTimestamp?: number | string;
}

export interface ResolvedSyncCredentials {
  shortcutToken?: string;
  linearToken?: string;
  linearTeamId?: string;
}

export function parseDirection(value: unknown): StoredSyncDirection {
  if (value === 'SHORTCUT_TO_LINEAR' || value === 'LINEAR_TO_SHORTCUT') {
    return value;
  }
  return 'BIDIRECTIONAL';
}

export function parseConflictPolicy(value: unknown): StoredSyncConflictPolicy {
  if (
    value === 'SHORTCUT_WINS' ||
    value === 'LINEAR_WINS' ||
    value === 'MANUAL'
  ) {
    return value;
  }
  return 'NEWEST_WINS';
}

export function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

export function parseString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function envValue(name: string): string | undefined {
  return parseString(process.env[name]);
}

export function resolveSyncCredentials(
  body: WebhookBody,
  headers: Headers
): ResolvedSyncCredentials {
  const shortcutToken =
    parseString(headers.get('x-shortcut-token')) ??
    parseString(body.shortcutToken) ??
    envValue('GOODBYE_SHORTCUT_TOKEN');
  const linearTokenRaw =
    parseString(headers.get('x-linear-token')) ??
    parseString(body.linearToken) ??
    envValue('GOODBYE_LINEAR_TOKEN');
  const linearTeamId =
    parseString(headers.get('x-linear-team-id')) ??
    parseString(body.linearTeamId) ??
    envValue('GOODBYE_LINEAR_TEAM_ID');

  return {
    shortcutToken,
    linearToken: linearTokenRaw ? normalizeLinearApiKey(linearTokenRaw) : undefined,
    linearTeamId,
  };
}

export function resolveWebhookSecret(provider: 'shortcut' | 'linear'): string | undefined {
  const shared = envValue('GOODBYE_WEBHOOK_SHARED_SECRET');
  const providerSecret =
    provider === 'shortcut'
      ? envValue('GOODBYE_SHORTCUT_WEBHOOK_SECRET')
      : envValue('GOODBYE_LINEAR_WEBHOOK_SECRET');

  return providerSecret ?? shared;
}
