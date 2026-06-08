import {
  pgTable,
  text,
  timestamp,
  jsonb,
  bigserial,
  boolean,
  uniqueIndex,
  index,
  integer,
  numeric,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const guilds = pgTable('guilds', {
  guildId: text('guild_id').primaryKey(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const guildConfig = pgTable(
  'guild_config',
  {
    guildId: text('guild_id').notNull(),
    configKey: text('config_key').notNull(),
    value: jsonb('value').notNull(),
    updatedByUserId: text('updated_by_user_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.configKey] }),
  }),
);

export const configHistory = pgTable(
  'config_history',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    guildId: text('guild_id').notNull(),
    actingAdminId: text('acting_admin_id').notNull(),
    changes: jsonb('changes').notNull(),
    reason: text('reason'),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    rolledBackAt: timestamp('rolled_back_at', { withTimezone: true }),
    isRollback: boolean('is_rollback').notNull().default(false),
  },
  (table) => ({
    byGuildApplied: index('config_history_guild_applied_idx').on(
      table.guildId,
      table.appliedAt,
    ),
  }),
);

export const assistantOverrides = pgTable(
  'assistant_overrides',
  {
    guildId: text('guild_id').notNull(),
    assistantId: text('assistant_id').notNull(),
    payload: jsonb('payload').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.assistantId] }),
  }),
);

export const conversations = pgTable(
  'conversations',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    threadId: text('thread_id').notNull(),
    assistantId: text('assistant_id').notNull(),
    invokingUserId: text('invoking_user_id').notNull(),
    lastOpenaiResponseId: text('last_openai_response_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byThread: uniqueIndex('conversations_thread_idx').on(table.threadId),
    byGuildAssistant: index('conversations_guild_assistant_idx').on(
      table.guildId,
      table.assistantId,
    ),
  }),
);

export const conversationMessages = pgTable(
  'conversation_messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    conversationId: integer('conversation_id').notNull(),
    discordMessageId: text('discord_message_id'),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byConversation: index('conversation_messages_conversation_idx').on(table.conversationId),
  }),
);

export const pointAwards = pgTable(
  'point_awards',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    guildId: text('guild_id').notNull(),
    giverUserId: text('giver_user_id').notNull(),
    receiverUserId: text('receiver_user_id').notNull(),
    messageId: text('message_id').notNull(),
    channelId: text('channel_id').notNull(),
    emoji: text('emoji').notNull(),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revocationReason: text('revocation_reason'),
  },
  (table) => ({
    uniqueGiverMessageEmoji: uniqueIndex('point_awards_unique_idx').on(
      table.guildId,
      table.giverUserId,
      table.messageId,
      table.emoji,
    ),
    byReceiver: index('point_awards_receiver_idx').on(
      table.guildId,
      table.receiverUserId,
      table.awardedAt,
    ),
    byMessage: index('point_awards_message_idx').on(table.guildId, table.messageId),
    byGiver: index('point_awards_giver_idx').on(
      table.guildId,
      table.giverUserId,
      table.awardedAt,
    ),
  }),
);

export const pointOverrides = pgTable(
  'point_overrides',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    guildId: text('guild_id').notNull(),
    targetUserId: text('target_user_id').notNull(),
    actingAdminId: text('acting_admin_id').notNull(),
    operation: text('operation').notNull(),
    amount: integer('amount'),
    finalValue: numeric('final_value'),
    reason: text('reason'),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byTarget: index('point_overrides_target_idx').on(table.guildId, table.targetUserId),
  }),
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    guildId: text('guild_id').notNull(),
    eventType: text('event_type').notNull(),
    actorUserId: text('actor_user_id'),
    targetUserId: text('target_user_id'),
    payload: jsonb('payload').notNull().default({}),
    deliveredToChannel: boolean('delivered_to_channel').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byGuildCreated: index('audit_log_guild_created_idx').on(table.guildId, table.createdAt),
  }),
);

export const providerResources = pgTable(
  'provider_resources',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    guildId: text('guild_id'),
    assistantId: text('assistant_id').notNull(),
    provider: text('provider').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    status: text('status').notNull().default('ready'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byAssistant: index('provider_resources_assistant_idx').on(
      table.assistantId,
      table.provider,
      table.resourceType,
    ),
    byGuild: index('provider_resources_guild_idx').on(
      table.guildId,
      table.assistantId,
      table.resourceType,
    ),
  }),
);
