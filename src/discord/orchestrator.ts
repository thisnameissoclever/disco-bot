import {
  ChannelType,
  type Client,
  type GuildTextBasedChannel,
  type Message,
  type ThreadChannel,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { schema } from '../db/client.js';
import type { AssistantRegistry } from '../assistants/registry.js';
import type { AssistantDefinition } from '../assistants/types.js';
import { getValue } from '../config/service.js';
import type { ChannelAccessMode } from '../config/types.js';
import { resolveRole } from '../ai/router.js';
import { getAdapter } from '../ai/providers/index.js';
import { buildKnowledgeRef } from '../ai/retrieval/index.js';
import type { ContextMessage } from '../ai/types.js';
import {
  buildAssistantContext,
  isMessageInThread,
} from './context/builder.js';
import {
  chunkMessage,
  createReplyThread,
  isThread,
} from './context/thread-helpers.js';
import { AssistantAccessDeniedError } from '../util/errors.js';
import { logAuditEvent } from '../audit/log.js';
import { childLogger } from '../util/logger.js';

const log = childLogger({ component: 'orchestrator' });

const COOLDOWNS = new Map<string, number>();

export interface RespondInput {
  client: Client;
  db: Db;
  registry: AssistantRegistry;
  assistant: AssistantDefinition;
  guildId: string;
  userId: string;
  /**
   * Either a Discord Message (mention/reply path) or a synthetic source
   * created from a slash command. Provides the user's prompt and a channel
   * to reply in.
   */
  source: OrchestratorSource;
}

export type OrchestratorSource =
  | { kind: 'message'; message: Message }
  | {
      kind: 'slash';
      channelId: string;
      channel: GuildTextBasedChannel;
      prompt: string;
      invokingUserDisplayName: string;
      replyInline: (text: string) => Promise<unknown>;
    };

export async function respondAsAssistant(input: RespondInput): Promise<void> {
  const { client, db, assistant, guildId, userId, source } = input;

  await enforceAccess({ db, guildId, assistant, channelId: channelIdOf(source), userId, client });
  await enforceCooldowns({ db, guildId, userId, channelId: channelIdOf(source) });

  const targetThread = await pickOrCreateThread({ client, source, assistant });

  // Build context.
  const ctx = await buildContextFor({ client, db, guildId, source, assistant, botUserId: client.user!.id });

  // Resolve role + retrieval.
  const role = await resolveRole({ db, assistant, guildId, role: 'primary' });
  const knowledge = buildKnowledgeRef(role.retrievalMode, role);

  // Find an existing conversation for this thread (for continuation chaining).
  let previousResponseId: string | undefined;
  let conversationId: number | undefined;
  if (targetThread) {
    const existing = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.threadId, targetThread.id));
    if (existing[0]) {
      conversationId = existing[0].id;
      previousResponseId = existing[0].lastOpenaiResponseId ?? undefined;
    }
  }

  const adapter = getAdapter(role.modelRef.provider);
  if (!adapter.isConfigured()) {
    throw new AssistantAccessDeniedError(
      `The AI provider '${role.modelRef.provider}' is not configured in this deployment.`,
    );
  }

  const reply = await adapter.reply({
    modelRef: role.modelRef,
    systemInstructions: buildSystemInstructions(assistant),
    userPrompt: ctx.userPrompt,
    contextMessages: ctx.contextMessages,
    knowledge,
    maxOutputTokens: role.maxOutputTokens,
    temperature: role.temperature,
    ...(role.reasoning ? { reasoning: role.reasoning } : {}),
    ...(previousResponseId ? { previousResponseId } : {}),
    clarificationPolicy: assistant.clarificationPolicy,
  });

  const responseText = ctx.missingNotes.length > 0
    ? `${ctx.missingNotes.join('\n')}\n\n${reply.text}`
    : reply.text;

  await sendReply({
    client,
    source,
    targetThread,
    text: responseText,
    maxLength: assistant.maxResponseLength,
  });

  await persistConversation({
    db,
    guildId,
    assistant,
    userId,
    source,
    targetThread,
    lastResponseId: reply.providerResponseId,
    conversationId,
  });

  log.info(
    {
      guildId,
      assistant: assistant.id,
      provider: role.modelRef.provider,
      model: role.modelRef.modelId,
      thread: targetThread?.id ?? null,
      prevResponse: previousResponseId ?? null,
      newResponse: reply.providerResponseId ?? null,
    },
    'assistant reply delivered',
  );
}

interface AccessInput {
  client: Client;
  db: Db;
  guildId: string;
  assistant: AssistantDefinition;
  channelId: string;
  userId: string;
}

async function enforceAccess(input: AccessInput): Promise<void> {
  const enabled = await getValue<string[]>(input.db, input.guildId, 'enabled_assistants');
  if (enabled.length > 0 && !enabled.includes(input.assistant.id)) {
    await denyAndAudit(input.db, input.client, input.guildId, input.userId, input.assistant.id, 'assistant_disabled');
    throw new AssistantAccessDeniedError(
      `The \`${input.assistant.displayName}\` assistant is not enabled in this server.`,
    );
  }

  const mode = await getValue<ChannelAccessMode>(input.db, input.guildId, 'channel_access_mode', input.assistant.id);
  const allowed = await getValue<string[]>(input.db, input.guildId, 'allowed_channels', input.assistant.id);
  const denied = await getValue<string[]>(input.db, input.guildId, 'denied_channels', input.assistant.id);
  if (mode === 'allowlist' && allowed.length > 0 && !allowed.includes(input.channelId)) {
    await denyAndAudit(input.db, input.client, input.guildId, input.userId, input.assistant.id, 'channel_not_allowlisted');
    throw new AssistantAccessDeniedError('This channel is not in the assistant allowlist.');
  }
  if (mode === 'denylist' && denied.includes(input.channelId)) {
    await denyAndAudit(input.db, input.client, input.guildId, input.userId, input.assistant.id, 'channel_denied');
    throw new AssistantAccessDeniedError('This channel is denied for this assistant.');
  }

  const requiredRoles = await getValue<string[]>(input.db, input.guildId, 'required_roles', input.assistant.id);
  const excludedRoles = await getValue<string[]>(input.db, input.guildId, 'excluded_roles', input.assistant.id);
  if (requiredRoles.length === 0 && excludedRoles.length === 0) return;

  try {
    const guild = await input.client.guilds.fetch(input.guildId);
    const member = await guild.members.fetch(input.userId);
    const roleIds = member.roles.cache.map((r) => r.id);
    if (excludedRoles.some((r) => roleIds.includes(r))) {
      await denyAndAudit(input.db, input.client, input.guildId, input.userId, input.assistant.id, 'excluded_role');
      throw new AssistantAccessDeniedError('A role on your account excludes you from this assistant.');
    }
    if (requiredRoles.length > 0 && !requiredRoles.some((r) => roleIds.includes(r))) {
      await denyAndAudit(input.db, input.client, input.guildId, input.userId, input.assistant.id, 'missing_required_role');
      throw new AssistantAccessDeniedError('You do not have a required role for this assistant.');
    }
  } catch (err) {
    if (err instanceof AssistantAccessDeniedError) throw err;
    log.warn({ err }, 'failed to fetch member for role enforcement');
  }
}

async function denyAndAudit(
  db: Db,
  client: Client,
  guildId: string,
  userId: string,
  assistantId: string,
  reason: string,
): Promise<void> {
  await logAuditEvent(
    db,
    {
      guildId,
      eventType: 'assistant_access_denied',
      actorUserId: userId,
      payload: { assistantId, reason },
    },
    client,
  );
}

interface CooldownInput {
  db: Db;
  guildId: string;
  userId: string;
  channelId: string;
}

async function enforceCooldowns(input: CooldownInput): Promise<void> {
  const userSec = await getValue<number>(input.db, input.guildId, 'ai_cooldown_user_seconds');
  const channelSec = await getValue<number>(input.db, input.guildId, 'ai_cooldown_channel_seconds');
  const now = Date.now();

  const userKey = `u:${input.guildId}:${input.userId}`;
  const channelKey = `c:${input.guildId}:${input.channelId}`;
  if (userSec > 0) {
    const last = COOLDOWNS.get(userKey) ?? 0;
    if (now - last < userSec * 1000) {
      throw new AssistantAccessDeniedError(
        `Slow down - please wait ${Math.ceil((userSec * 1000 - (now - last)) / 1000)}s before invoking again.`,
      );
    }
    COOLDOWNS.set(userKey, now);
  }
  if (channelSec > 0) {
    const last = COOLDOWNS.get(channelKey) ?? 0;
    if (now - last < channelSec * 1000) {
      throw new AssistantAccessDeniedError(
        'This channel is in a cooldown for AI invocations.',
      );
    }
    COOLDOWNS.set(channelKey, now);
  }
}

interface PickThreadInput {
  client: Client;
  source: OrchestratorSource;
  assistant: AssistantDefinition;
}

async function pickOrCreateThread(input: PickThreadInput): Promise<ThreadChannel | null> {
  const { source, assistant } = input;
  if (source.kind === 'message') {
    if (isMessageInThread(source.message)) return source.message.channel as ThreadChannel;
    const channel = source.message.channel;
    if (!('threads' in channel)) return null;
    const titleSeed = source.message.content.replace(/<@!?\d+>/g, '').trim();
    const title = `${assistant.displayName}: ${titleSeed || 'help'}`.slice(0, 100);
    return await createReplyThread(source.message, title);
  }

  // Slash invocation - create a thread off a quick anchor message if possible.
  const channel = source.channel;
  if (isThread(channel)) return channel as ThreadChannel;
  if (channel.type === ChannelType.GuildText && 'threads' in channel) {
    const anchor = await channel.send({
      content: `<@${source.channelId ? '' : ''}>Starting an assistant thread for ${source.invokingUserDisplayName}.`,
    });
    const title = `${assistant.displayName}: ${source.prompt.slice(0, 70)}`.slice(0, 100);
    return await anchor.startThread({ name: title, autoArchiveDuration: 60 * 24 });
  }
  return null;
}

interface BuildContextInput {
  client: Client;
  db: Db;
  guildId: string;
  source: OrchestratorSource;
  assistant: AssistantDefinition;
  botUserId: string;
}

async function buildContextFor(input: BuildContextInput): Promise<{
  userPrompt: string;
  contextMessages: ContextMessage[];
  missingNotes: string[];
}> {
  if (input.source.kind === 'message') {
    return await buildAssistantContext({
      client: input.client,
      db: input.db,
      guildId: input.guildId,
      message: input.source.message,
      assistant: input.assistant,
      botUserId: input.botUserId,
    });
  }
  return {
    userPrompt: input.source.prompt,
    contextMessages: [],
    missingNotes: [],
  };
}

function channelIdOf(source: OrchestratorSource): string {
  return source.kind === 'message' ? source.message.channelId : source.channelId;
}

interface SendReplyInput {
  client: Client;
  source: OrchestratorSource;
  targetThread: ThreadChannel | null;
  text: string;
  maxLength: number;
}

async function sendReply(input: SendReplyInput): Promise<void> {
  const chunks = chunkMessage(input.text, Math.min(input.maxLength, 1900));
  if (input.targetThread) {
    for (const part of chunks) {
      await input.targetThread.send(part);
    }
    return;
  }
  // Fallback: reply inline.
  if (input.source.kind === 'slash') {
    await input.source.replyInline(chunks[0] ?? '_no response_');
    for (const part of chunks.slice(1)) await input.source.channel.send(part);
    return;
  }
  for (const part of chunks) await input.source.message.reply(part);
}

interface PersistConversationInput {
  db: Db;
  guildId: string;
  assistant: AssistantDefinition;
  userId: string;
  source: OrchestratorSource;
  targetThread: ThreadChannel | null;
  lastResponseId: string | undefined;
  conversationId: number | undefined;
}

async function persistConversation(input: PersistConversationInput): Promise<void> {
  if (!input.targetThread) return;
  if (input.conversationId) {
    await input.db
      .update(schema.conversations)
      .set({ lastOpenaiResponseId: input.lastResponseId ?? null, updatedAt: new Date() })
      .where(eq(schema.conversations.id, input.conversationId));
    return;
  }
  const channelId =
    input.source.kind === 'message' ? input.source.message.channelId : input.source.channelId;
  await input.db.insert(schema.conversations).values({
    guildId: input.guildId,
    channelId,
    threadId: input.targetThread.id,
    assistantId: input.assistant.id,
    invokingUserId: input.userId,
    lastOpenaiResponseId: input.lastResponseId ?? null,
  });
}

function buildSystemInstructions(assistant: AssistantDefinition): string {
  const safety = assistant.safetyRules.length > 0
    ? `\n\nSafety rules:\n- ${assistant.safetyRules.join('\n- ')}`
    : '';
  return `${assistant.instructions}${safety}`;
}
