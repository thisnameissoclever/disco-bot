import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadEnv } from '../env.js';
import { getLogger } from '../util/logger.js';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

export async function runMigrations(): Promise<void> {
  const env = loadEnv();
  const logger = getLogger().child({ component: 'migrate' });
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_URL.includes('sslmode=disable')
      ? false
      : { rejectUnauthorized: false },
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "_disco_migrations" (
        "filename" text PRIMARY KEY,
        "applied_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const applied = new Set(
      (await pool.query<{ filename: string }>('SELECT filename FROM "_disco_migrations"')).rows.map(
        (row) => row.filename,
      ),
    );

    for (const file of files) {
      if (applied.has(file)) {
        logger.debug({ file }, 'migration already applied');
        continue;
      }
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      logger.info({ file }, 'applying migration');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO "_disco_migrations" (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        logger.info({ file }, 'migration applied');
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error({ file, err }, 'migration failed');
        throw err;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}
