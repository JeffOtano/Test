import { Queue } from 'bullmq';
import {
  StoredSyncConflictPolicy,
  StoredSyncDirection,
  SyncCursorState,
  SyncEventRecord,
} from '@/lib/db';
import { runSyncCycle, SyncCycleResult } from '@/lib/sync/service';
import { getBullRedisConnection } from '@/lib/infra/redis';
import { ensureInfraSchema } from '@/lib/infra/schema';
import { getIntegerEnv } from '@/lib/infra/env';
import { query } from '@/lib/infra/postgres';

export interface SyncJobPayload {
  scopeKey: string;
  shortcutToken: string;
  linearToken: string;
  config: {
    direction: StoredSyncDirection;
    conflictPolicy: StoredSyncConflictPolicy;
    shortcutTeamId?: string;
    linearTeamId: string;
    includeComments: boolean;
    includeAttachments: boolean;
  };
  triggerSource: 'shortcut' | 'linear' | 'system';
  triggerReason: string;
}

export interface SyncJobRunResult {
  queueJobId: string;
  result: SyncCycleResult;
}

interface SyncCursorRow {
  shortcut_updated_at: string | null;
  linear_updated_at: string | null;
}

export const SYNC_QUEUE_NAME = 'sync-jobs';
const SYNC_JOB_NAME = 'sync-cycle';

let queue: Queue<SyncJobPayload> | null = null;

function getQueue(): Queue<SyncJobPayload> {
  if (!queue) {
    queue = new Queue<SyncJobPayload>(SYNC_QUEUE_NAME, {
      connection: getBullRedisConnection(),
    });
  }
  return queue;
}

export function buildSyncScopeKey(config: {
  linearTeamId: string;
  shortcutTeamId?: string;
  direction: StoredSyncDirection;
}): string {
  const shortcutTeam = config.shortcutTeamId ?? '*';
  return `linear:${config.linearTeamId}|shortcut:${shortcutTeam}|direction:${config.direction}`;
}

export async function enqueueSyncJob(payload: SyncJobPayload): Promise<string> {
  await ensureInfraSchema();

  const attempts = getIntegerEnv('GOODBYE_SYNC_JOB_ATTEMPTS', 5, { min: 1, max: 20 });
  const backoffDelay = getIntegerEnv('GOODBYE_SYNC_JOB_BACKOFF_MS', 2_000, {
    min: 100,
    max: 60_000,
  });

  const job = await getQueue().add(SYNC_JOB_NAME, payload, {
    attempts,
    backoff: {
      type: 'exponential',
      delay: backoffDelay,
    },
    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 2_000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
      count: 10_000,
    },
  });

  const queueJobId = String(job.id);

  await query(
    `
      INSERT INTO sync_job_runs (queue_job_id, scope_key, source, reason, status)
      VALUES ($1, $2, $3, $4, 'QUEUED')
      ON CONFLICT (queue_job_id) DO NOTHING
    `,
    [queueJobId, payload.scopeKey, payload.triggerSource, payload.triggerReason]
  );

  return queueJobId;
}

async function getCursor(scopeKey: string): Promise<SyncCursorState> {
  const result = await query<SyncCursorRow>(
    `
      SELECT shortcut_updated_at, linear_updated_at
      FROM sync_cursors
      WHERE scope_key = $1
      LIMIT 1
    `,
    [scopeKey]
  );

  const row = result.rows[0];
  if (!row) return {};

  return {
    shortcutUpdatedAt: row.shortcut_updated_at ?? undefined,
    linearUpdatedAt: row.linear_updated_at ?? undefined,
  };
}

async function upsertCursor(scopeKey: string, cursor: SyncCursorState): Promise<void> {
  await query(
    `
      INSERT INTO sync_cursors (scope_key, shortcut_updated_at, linear_updated_at, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (scope_key)
      DO UPDATE SET
        shortcut_updated_at = EXCLUDED.shortcut_updated_at,
        linear_updated_at = EXCLUDED.linear_updated_at,
        updated_at = NOW()
    `,
    [scopeKey, cursor.shortcutUpdatedAt ?? null, cursor.linearUpdatedAt ?? null]
  );
}

async function insertEvents(scopeKey: string, events: SyncEventRecord[]): Promise<void> {
  if (events.length === 0) return;

  for (const event of events) {
    await query(
      `
        INSERT INTO sync_events (
          scope_key,
          event_id,
          event_ts,
          level,
          source,
          action,
          entity_type,
          entity_id,
          message,
          details
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        scopeKey,
        event.id,
        event.timestamp,
        event.level,
        event.source,
        event.action,
        event.entityType,
        event.entityId,
        event.message,
        event.details ?? null,
      ]
    );
  }
}

export async function processSyncJob(
  queueJobId: string,
  payload: SyncJobPayload
): Promise<SyncJobRunResult> {
  await ensureInfraSchema();

  await query(
    `
      UPDATE sync_job_runs
      SET status = 'PROCESSING', started_at = NOW(), completed_at = NULL, error = NULL
      WHERE queue_job_id = $1
    `,
    [queueJobId]
  );

  const previousCursor = await getCursor(payload.scopeKey);

  try {
    const result = await runSyncCycle({
      shortcutToken: payload.shortcutToken,
      linearToken: payload.linearToken,
      config: payload.config,
      cursors: previousCursor,
      triggerSource: payload.triggerSource,
      triggerReason: payload.triggerReason,
    });

    await upsertCursor(payload.scopeKey, result.cursors);
    await insertEvents(payload.scopeKey, result.events);

    await query(
      `
        UPDATE sync_job_runs
        SET
          status = 'COMPLETED',
          delta = $2::jsonb,
          error = NULL,
          completed_at = NOW()
        WHERE queue_job_id = $1
      `,
      [queueJobId, JSON.stringify(result.delta)]
    );

    return {
      queueJobId,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync failure';

    await query(
      `
        UPDATE sync_job_runs
        SET
          status = 'FAILED',
          error = $2,
          completed_at = NOW()
        WHERE queue_job_id = $1
      `,
      [queueJobId, message]
    );

    throw error;
  }
}

export async function closeSyncQueue(): Promise<void> {
  if (!queue) return;
  await queue.close();
  queue = null;
}
