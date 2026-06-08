import type { Client } from 'discord.js';
import { createDiscordClient } from './discord/client.js';
import { onReady } from './discord/events/ready.js';
import { registerInteractionCreate } from './discord/events/interactionCreate.js';
import { registerMessageCreate } from './discord/events/messageCreate.js';
import { registerMessageReactionAdd } from './discord/events/messageReactionAdd.js';
import { registerMessageReactionRemove } from './discord/events/messageReactionRemove.js';
import { registerThreadCreate } from './discord/events/threadCreate.js';
import { AssistantRegistry } from './assistants/registry.js';
import { getDb } from './db/client.js';
import { loadEnv } from './env.js';

export interface BotHandle {
  client: Client;
  shutdown(): Promise<void>;
}

export async function startBot(): Promise<BotHandle> {
  const env = loadEnv();
  const db = getDb();
  const registry = await AssistantRegistry.fromDisk();
  const client = createDiscordClient();

  onReady(client);
  registerInteractionCreate(client, db, registry);
  registerMessageCreate(client, db, registry);
  registerMessageReactionAdd(client, db);
  registerMessageReactionRemove(client, db);
  registerThreadCreate(client);

  await client.login(env.DISCORD_TOKEN);

  return {
    client,
    async shutdown() {
      await client.destroy();
    },
  };
}
