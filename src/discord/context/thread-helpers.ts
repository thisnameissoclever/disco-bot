import {
  ChannelType,
  type Message,
  type ThreadChannel,
  type AnyThreadChannel,
  type TextChannel,
  type Channel,
} from 'discord.js';

type MaybeChannel = Channel | null | undefined;

export function isThread(channel: MaybeChannel): channel is AnyThreadChannel {
  if (!channel) return false;
  return (
    channel.type === ChannelType.PublicThread ||
    channel.type === ChannelType.PrivateThread ||
    channel.type === ChannelType.AnnouncementThread
  );
}

export function isTextChannel(channel: MaybeChannel): channel is TextChannel {
  if (!channel) return false;
  return channel.type === ChannelType.GuildText;
}

/**
 * Creates a thread off of a starter message. The bot replies inside the new
 * thread; the original channel is not noisier than necessary.
 */
export async function createReplyThread(
  starter: Message,
  name: string,
): Promise<ThreadChannel> {
  const channel = starter.channel;
  if (!('threads' in channel)) {
    throw new Error('Cannot create a thread in this channel type');
  }
  const trimmed = name.length > 100 ? `${name.slice(0, 97)}...` : name;
  return await starter.startThread({
    name: trimmed,
    autoArchiveDuration: 60 * 24,
  });
}

export async function fetchRecentThreadMessages(
  thread: ThreadChannel,
  limit: number,
): Promise<Message[]> {
  if (limit <= 0) return [];
  const collection = await thread.messages.fetch({ limit: Math.min(limit, 100) });
  return [...collection.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

export async function fetchThreadStarter(thread: ThreadChannel): Promise<Message | null> {
  try {
    return await thread.fetchStarterMessage();
  } catch {
    return null;
  }
}

export function chunkMessage(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= max) {
      chunks.push(remaining);
      break;
    }
    let split = remaining.lastIndexOf('\n', max);
    if (split < max * 0.5) split = max;
    chunks.push(remaining.slice(0, split));
    remaining = remaining.slice(split).replace(/^\n+/, '');
  }
  return chunks;
}
