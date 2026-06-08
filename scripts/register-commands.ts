import { registerCommands } from '../src/discord/register.js';
import { getLogger } from '../src/util/logger.js';
import { loadEnv } from '../src/env.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const args = process.argv.slice(2);
  const guildArg = args.find((a) => a.startsWith('--guild='));
  const scope: 'global' | 'guild' = args.includes('--global') || !guildArg && !env.DISCORD_DEV_GUILD_ID
    ? 'global'
    : 'guild';
  if (scope === 'guild') {
    const guildId = guildArg ? guildArg.split('=')[1] : env.DISCORD_DEV_GUILD_ID;
    if (!guildId) {
      throw new Error('Set DISCORD_DEV_GUILD_ID or pass --guild=<id> to register guild commands.');
    }
    await registerCommands({ scope: 'guild', guildId });
  } else {
    await registerCommands({ scope: 'global' });
  }
  getLogger().info({ scope }, 'commands registered');
}

void main().catch((err) => {
  getLogger().fatal({ err }, 'command registration failed');
  process.exitCode = 1;
});
