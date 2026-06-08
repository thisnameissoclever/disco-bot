import type { Client, Message, GuildBasedChannel } from 'discord.js';
import { childLogger } from '../../util/logger.js';

const log = childLogger({ component: 'discord.message-resolver' });

const MESSAGE_LINK_RE =
  /https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g;

export interface ResolvedTargetMessage {
  message: Message;
  source: 'reply' | 'link' | 'mention_chain';
}

/**
 * Returns the replied-to message and any messages linked in the current message
 * body that the bot can access. Links to other servers are ignored.
 */
export async function resolveTargetMessages(
  client: Client,
  current: Message,
): Promise<ResolvedTargetMessage[]> {
  const out: ResolvedTargetMessage[] = [];

  if (current.reference && current.reference.messageId) {
    try {
      const replied = await current.fetchReference();
      if (replied) out.push({ message: replied, source: 'reply' });
    } catch (err) {
      log.debug({ err }, 'failed to fetch replied-to message');
    }
  }

  const seen = new Set<string>();
  for (const match of current.content.matchAll(MESSAGE_LINK_RE)) {
    const [, guildId, channelId, messageId] = match;
    if (!guildId || !channelId || !messageId) continue;
    if (guildId !== current.guildId) continue;
    if (seen.has(messageId)) continue;
    seen.add(messageId);

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) continue;
      const linked = await channel.messages.fetch(messageId);
      if (linked) out.push({ message: linked, source: 'link' });
    } catch (err) {
      log.debug({ err, channelId, messageId }, 'failed to fetch linked message');
    }
  }

  return out;
}

export function isGuildTextChannel(channel: unknown): channel is GuildBasedChannel {
  if (!channel || typeof channel !== 'object') return false;
  return (channel as GuildBasedChannel).isTextBased?.() === true;
}
