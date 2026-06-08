import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { loadEnv } from '../env.js';
import * as schema from './schema.js';

const { Pool } = pg;

let cachedDb: NodePgDatabase<typeof schema> | undefined;
let cachedPool: pg.Pool | undefined;

export function getDb(): NodePgDatabase<typeof schema> {
  if (cachedDb) return cachedDb;
  const env = loadEnv();
  cachedPool = new Pool({
    connectionString: env.DATABASE_URL,
    // Render Postgres requires SSL but the URL usually includes ?sslmode=require.
    // For other Postgres hosts we still allow self-signed certs in production
    // because Render's certificate chain is not in the system trust store.
    ssl: env.DATABASE_URL.includes('sslmode=disable')
      ? false
      : { rejectUnauthorized: false },
  });
  cachedDb = drizzle(cachedPool, { schema });
  return cachedDb;
}

export async function closeDb(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = undefined;
    cachedDb = undefined;
  }
}

export { schema };
export type Db = NodePgDatabase<typeof schema>;
