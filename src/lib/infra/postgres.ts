import { Pool, QueryResult, QueryResultRow } from 'pg';
import { getRequiredEnv } from '@/lib/infra/env';

let pool: Pool | null = null;

function createPool(): Pool {
  return new Pool({
    connectionString: getRequiredEnv('GOODBYE_POSTGRES_URL'),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPostgresPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  return getPostgresPool().query<T>(text, values);
}

export async function closePostgresPool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}
