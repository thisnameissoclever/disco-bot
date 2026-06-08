import { Events, type Client, type ThreadChannel } from 'discord.js';
import { childLogger } from '../../util/logger.js';

const log = childLogger({ component: 'event.threadCreate' });

export function registerThreadCreate(client: Client): void {
  client.on(Events.ThreadCreate, async (thread: ThreadChannel) => {
    try {
      // Auto-join bot-owned threads so the bot can post follow-ups without a
      // manual join. Discord requires the bot to be a member of private
      // threads to send messages.
      if (thread.joinable && thread.ownerId === client.user?.id) {
        await thread.join();
      }
    } catch (err) {
      log.warn({ err }, 'thread join failed');
    }
  });
}
