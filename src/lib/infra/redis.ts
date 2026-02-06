import IORedis from 'ioredis';
import { getRequiredEnv } from '@/lib/infra/env';

let redis: IORedis | null = null;
let bullRedis: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (!redis) {
    redis = new IORedis(getRequiredEnv('GOODBYE_REDIS_URL'));
  }
  return redis;
}

export function getBullRedisConnection(): IORedis {
  if (!bullRedis) {
    bullRedis = new IORedis(getRequiredEnv('GOODBYE_REDIS_URL'), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return bullRedis;
}

export async function closeRedisClients(): Promise<void> {
  await Promise.all([
    redis ? redis.quit().catch(() => undefined) : Promise.resolve(undefined),
    bullRedis ? bullRedis.quit().catch(() => undefined) : Promise.resolve(undefined),
  ]);

  redis = null;
  bullRedis = null;
}
