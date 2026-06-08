import { startBot } from './bot.js';
import { runMigrations } from './db/migrate.js';
import { childLogger, getLogger } from './util/logger.js';
import { closeDb } from './db/client.js';

const log = childLogger({ component: 'index' });

async function main(): Promise<void> {
  log.info('starting Disco Stew');

  // Run any pending migrations before connecting. Idempotent.
  await runMigrations();

  const handle = await startBot();

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'shutting down');
    try {
      await handle.shutdown();
    } catch (err) {
      log.warn({ err }, 'shutdown error');
    }
    await closeDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main().catch((err) => {
  getLogger().fatal({ err }, 'fatal startup error');
  process.exitCode = 1;
});
