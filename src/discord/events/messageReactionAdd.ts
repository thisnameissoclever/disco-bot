import { Events, type Client } from 'discord.js';
import type { Db } from '../../db/client.js';
import { processReactionAdd } from '../../points/awards.js';
import { childLogger } from '../../util/logger.js';

const log = childLogger({ component: 'event.reactionAdd' });

export function registerMessageReactionAdd(client: Client, db: Db): void {
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      await processReactionAdd({ client, db, reaction, user });
    } catch (err) {
      log.error({ err }, 'reaction-add handler crashed');
    }
  });
}
