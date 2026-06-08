import { Events, type Client } from 'discord.js';
import type { Db } from '../../db/client.js';
import { processReactionRemove } from '../../points/revocation.js';
import { childLogger } from '../../util/logger.js';

const log = childLogger({ component: 'event.reactionRemove' });

export function registerMessageReactionRemove(client: Client, db: Db): void {
  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    try {
      await processReactionRemove({ client, db, reaction, user });
    } catch (err) {
      log.error({ err }, 'reaction-remove handler crashed');
    }
  });
}
