import { closePostgresPool } from '../lib/infra/postgres';
import { closeRedisClients } from '../lib/infra/redis';
import {
  buildSyncScopeKey,
  closeSyncQueue,
  enqueueSyncJob,
  SyncJobPayload,
} from '../lib/infra/sync-jobs';
import { ensureInfraSchema } from '../lib/infra/schema';
import { getBooleanEnv, getIntegerEnv, getRequiredEnv } from '../lib/infra/env';
import { StoredSyncConflictPolicy, StoredSyncDirection } from '../lib/db';
import { normalizeLinearApiKey } from '../lib/security/tokens';

function parseDirection(value: string | undefined): StoredSyncDirection {
  if (value === 'SHORTCUT_TO_LINEAR' || value === 'LINEAR_TO_SHORTCUT') return value;
  return 'BIDIRECTIONAL';
}

function parseConflictPolicy(value: string | undefined): StoredSyncConflictPolicy {
  if (value === 'SHORTCUT_WINS' || value === 'LINEAR_WINS' || value === 'MANUAL') {
    return value;
  }
  return 'NEWEST_WINS';
}

function parseOptionalString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function loadPayloadFromEnv(): SyncJobPayload {
  const direction = parseDirection(process.env.GOODBYE_SYNC_DIRECTION);
  const conflictPolicy = parseConflictPolicy(process.env.GOODBYE_SYNC_CONFLICT_POLICY);
  const shortcutTeamId = parseOptionalString(process.env.GOODBYE_SYNC_SHORTCUT_TEAM_ID);
  const includeComments = getBooleanEnv('GOODBYE_SYNC_INCLUDE_COMMENTS', true);
  const includeAttachments = getBooleanEnv('GOODBYE_SYNC_INCLUDE_ATTACHMENTS', false);

  const config = {
    direction,
    conflictPolicy,
    shortcutTeamId,
    linearTeamId: getRequiredEnv('GOODBYE_LINEAR_TEAM_ID'),
    includeComments,
    includeAttachments,
  } satisfies SyncJobPayload['config'];

  return {
    scopeKey: buildSyncScopeKey(config),
    shortcutToken: getRequiredEnv('GOODBYE_SHORTCUT_TOKEN'),
    linearToken: normalizeLinearApiKey(getRequiredEnv('GOODBYE_LINEAR_TOKEN')),
    config,
    triggerSource: 'system',
    triggerReason: 'scheduled durable sync tick',
  };
}

async function main(): Promise<void> {
  const enabled = getBooleanEnv('GOODBYE_SYNC_SCHEDULER_ENABLED', false);
  if (!enabled) {
    console.log('[sync-scheduler] disabled (GOODBYE_SYNC_SCHEDULER_ENABLED=false)');
    return;
  }

  await ensureInfraSchema();

  const intervalSeconds = getIntegerEnv('GOODBYE_SYNC_SCHEDULER_INTERVAL_SECONDS', 30, {
    min: 5,
    max: 3600,
  });
  const intervalMs = intervalSeconds * 1000;

  console.log(`[sync-scheduler] started interval=${intervalSeconds}s`);

  let inFlight = false;

  const tick = async (): Promise<void> => {
    if (inFlight) {
      console.log('[sync-scheduler] skipping tick (enqueue already in flight)');
      return;
    }

    inFlight = true;
    try {
      const payload = loadPayloadFromEnv();
      const queueJobId = await enqueueSyncJob(payload);
      console.log(`[sync-scheduler] enqueued job=${queueJobId}`);
    } catch (error) {
      console.error('[sync-scheduler] enqueue failed', error);
    } finally {
      inFlight = false;
    }
  };

  await tick();
  const handle = setInterval(() => {
    void tick();
  }, intervalMs);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[sync-scheduler] received ${signal}, shutting down`);
    clearInterval(handle);
    await closeSyncQueue();
    await closeRedisClients();
    await closePostgresPool();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(async (error) => {
  console.error('[sync-scheduler] fatal error', error);
  await closeSyncQueue();
  await closeRedisClients();
  await closePostgresPool();
  process.exit(1);
});
