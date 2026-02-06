import { closePostgresPool } from '../src/lib/infra/postgres';
import { closeRedisClients, getRedisClient } from '../src/lib/infra/redis';
import { ensureInfraSchema } from '../src/lib/infra/schema';

async function main(): Promise<void> {
  await ensureInfraSchema();

  const redis = getRedisClient();
  const pong = await redis.ping();

  console.log('[infra-init] postgres schema ensured');
  console.log(`[infra-init] redis ping=${pong}`);
}

main()
  .catch((error) => {
    console.error('[infra-init] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRedisClients();
    await closePostgresPool();
  });
