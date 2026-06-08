import type { Client } from 'discord.js';
import { childLogger } from '../../util/logger.js';

const log = childLogger({ component: 'event.ready' });

export function onReady(client: Client): void {
  client.once('ready', () => {
    log.info(
      { username: client.user?.username, id: client.user?.id, guilds: client.guilds.cache.size },
      'discord client ready',
    );
  });
}
