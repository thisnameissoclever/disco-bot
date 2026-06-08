import type { Client, Message, ThreadChannel } from 'discord.js';
import type { Db } from '../../db/client.js';
import { getValue } from '../../config/service.js';
import type { AssistantDefinition } from '../../assistants/types.js';
import type { ContextMessage } from '../../ai/types.js';
import { resolveTargetMessages } from './message-resolver.js';
import { fetchRecentThreadMessages, fetchThreadStarter, isThread } from './thread-helpers.js';
import { childLogger } from '../../util/logger.js';

const log = childLogger({ component: 'discord.context.builder' });

export interface BuildContextInput {
  client: Client;
  db: Db;
  guildId: string;
  message: Message;
  assistant: AssistantDefinition;
  botUserId: string;
}

export interface AssembledContext {
  contextMessages: ContextMessage[];
  userPrompt: string;
  missingNotes: string[];
}

/**
 * Assembles context per requirements:
 * - Replied-to / linked message content (when available).
 * - Thread starter + last N messages (when in a thread).
 * - The current user message becomes userPrompt.
 *
 * The bot's own messages in a thread are included as `assistant` role so the
 * provider sees its own prior turns.
 */
export async function buildAssistantContext(
  input: BuildContextInput,
): Promise<AssembledContext> {
  const { client, db, guildId, message, assistant, botUserId } = input;
  const contextMessages: ContextMessage[] = [];
  const missingNotes: string[] = [];

  // Replied-to and linked messages.
  const targets = await resolveTargetMessages(client, message);
  if (message.reference && message.reference.messageId && targets.every((t) => t.source !== 'reply')) {
    missingNotes.push(
      'I could not read the message you replied to. Try mentioning me directly under that message, or paste the relevant text.',
    );
  }
  for (const target of targets) {
    contextMessages.push({
      role: 'user',
      authorDisplayName: target.message.member?.displayName ?? target.message.author.username,
      content: target.message.content || '(empty message body)',
      source: target.source === 'reply' ? 'replied-to message' : 'linked message',
    });
  }

  // Thread context.
  if (isThread(message.channel)) {
    const thread = message.channel;
    const limit = await getValue<number>(
      db,
      guildId,
      'max_recent_thread_messages',
      assistant.id,
    );

    const starter = await fetchThreadStarter(thread);
    if (starter && starter.id !== message.id) {
      contextMessages.push({
        role: 'user',
        authorDisplayName: starter.member?.displayName ?? starter.author.username,
        content: starter.content || '(empty starter)',
        source: 'thread starter',
      });
    }

    const recent = await fetchRecentThreadMessages(thread, limit);
    for (const m of recent) {
      if (m.id === message.id) continue;
      if (starter && m.id === starter.id) continue;
      const role: ContextMessage['role'] = m.author.id === botUserId ? 'assistant' : 'user';
      contextMessages.push({
        role,
        authorDisplayName: m.member?.displayName ?? m.author.username,
        content: m.content || '(empty message)',
        source: 'thread message',
      });
    }

    log.debug({ thread: thread.id, count: recent.length, limit }, 'thread context built');
  }

  const userPrompt = stripBotMentions(message.content, botUserId).trim() || '(no prompt provided)';
  return { contextMessages, userPrompt, missingNotes };
}

export interface BuildSlashContextInput {
  prompt: string;
  invokingUserDisplayName: string;
}

export function buildSlashContext(input: BuildSlashContextInput): AssembledContext {
  return {
    contextMessages: [],
    userPrompt: input.prompt,
    missingNotes: [],
  };
}

export function stripBotMentions(text: string, botUserId: string): string {
  return text
    .replace(new RegExp(`<@!?${botUserId}>`, 'g'), '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isMessageInThread(message: Message): message is Message & { channel: ThreadChannel } {
  return isThread(message.channel);
}
