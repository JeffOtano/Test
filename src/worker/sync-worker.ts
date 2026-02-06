import { Worker } from 'bullmq';
import { getIntegerEnv } from '../lib/infra/env';
import { getBullRedisConnection, closeRedisClients } from '../lib/infra/redis';
import {
  closeSyncQueue,
  processSyncJob,
  SYNC_QUEUE_NAME,
  SyncJobPayload,
} from '../lib/infra/sync-jobs';
import { closePostgresPool } from '../lib/infra/postgres';
import { ensureInfraSchema } from '../lib/infra/schema';

const concurrency = getIntegerEnv('GOODBYE_SYNC_WORKER_CONCURRENCY', 4, {
  min: 1,
  max: 64,
});

async function main(): Promise<void> {
  await ensureInfraSchema();

  const worker = new Worker<SyncJobPayload>(
    SYNC_QUEUE_NAME,
    async (job) => {
      await processSyncJob(String(job.id), job.data);
    },
    {
      connection: getBullRedisConnection(),
      concurrency,
    }
  );

  worker.on('ready', () => {
    console.log(
      `[sync-worker] ready (queue=${SYNC_QUEUE_NAME}, concurrency=${concurrency})`
    );
  });

  worker.on('completed', (job) => {
    console.log(`[sync-worker] completed job=${job.id}`);
  });

  worker.on('failed', (job, error) => {
    console.error(
      `[sync-worker] failed job=${job?.id ?? 'unknown'} error=${error.message}`
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[sync-worker] received ${signal}, shutting down`);
    await worker.close();
    await closeSyncQueue();
    await closeRedisClients();
    await closePostgresPool();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(async (error) => {
  console.error('[sync-worker] fatal error', error);
  await closeSyncQueue();
  await closeRedisClients();
  await closePostgresPool();
  process.exit(1);
});
