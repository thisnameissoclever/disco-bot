import { REST, Routes } from 'discord.js';
import type { AnyCommand } from './commands/types.js';
import { askCommand } from './commands/ask.js';
import { stewConfigCommand } from './commands/stew-config.js';
import { leaderboardCommand } from './commands/leaderboard.js';
import { pointsCommand } from './commands/points.js';
import { adminPointsCommand } from './commands/admin-points.js';
import { askMessageContextCommand } from './contextMenus/ask-message.js';
import { childLogger } from '../util/logger.js';
import { loadEnv } from '../env.js';

const log = childLogger({ component: 'register' });

export const ALL_COMMANDS: AnyCommand[] = [
  askCommand,
  stewConfigCommand,
  leaderboardCommand,
  pointsCommand,
  adminPointsCommand,
  askMessageContextCommand,
];

export async function registerCommands(options: { scope: 'global' | 'guild'; guildId?: string }): Promise<void> {
  const env = loadEnv();
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const payload = ALL_COMMANDS.map((cmd) => cmd.data.toJSON());

  if (options.scope === 'guild') {
    if (!options.guildId) throw new Error('guildId is required for guild-scope registration');
    log.info({ guildId: options.guildId, count: payload.length }, 'registering guild commands');
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, options.guildId), {
      body: payload,
    });
    return;
  }

  log.info({ count: payload.length }, 'registering global commands');
  await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: payload });
}
