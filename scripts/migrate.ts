import { runMigrations } from '../src/db/migrate.js';
import { getLogger } from '../src/util/logger.js';

async function main(): Promise<void> {
  await runMigrations();
  getLogger().info('migrations complete');
}

void main().catch((err) => {
  getLogger().fatal({ err }, 'migration failed');
  process.exitCode = 1;
});
