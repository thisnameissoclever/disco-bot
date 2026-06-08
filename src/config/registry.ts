import { z } from 'zod';
import type { ConfigEntry, ModelRef } from './types.js';

const modelRefSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter']),
  modelId: z.string().min(1),
});

const fallbackBehaviorSchema = z.object({
  enabled: z.boolean(),
  triggers: z.array(z.enum(['provider_error', 'model_overloaded', 'rate_limited'])),
});

const discordSnowflake = z.string().regex(/^\d{15,25}$/, 'must be a Discord snowflake id');
const discordSnowflakeArray = z.array(discordSnowflake);

const reactionRemovalSchema = z.enum([
  'revoke_within_1_hour',
  'never_revoke',
  'always_revoke',
]);
const notificationModeSchema = z.enum(['dm', 'public_channel', 'disabled']);
const leaderboardVisibilitySchema = z.enum(['ephemeral', 'public']);
const channelAccessModeSchema = z.enum(['allowlist', 'denylist']);
const clarificationPolicySchema = z.enum(['ask_when_needed', 'never_ask', 'always_ask']);
const retrievalProviderSchema = z.enum(['openai_file_search', 'self_managed_rag', 'none']);
const periodTypeSchema = z.enum(['day', 'week', 'month', 'rolling_n_hours']);

const PRIMARY_DEFAULT: ModelRef = { provider: 'openai', modelId: 'gpt-5-mini' };
const UTILITY_DEFAULT: ModelRef = { provider: 'openai', modelId: 'gpt-5-nano' };
const ESCALATION_DEFAULT: ModelRef = { provider: 'openai', modelId: 'gpt-5' };

export const CONFIG_REGISTRY: readonly ConfigEntry[] = [
  // 1. Server bot display name
  {
    key: 'bot_display_name',
    label: 'Bot display name',
    description: 'Per-server bot display name (Disco permissions allowing).',
    type: 'string',
    schema: z.string().min(1).max(32),
    default: 'Disco Stew',
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'identity',
  },
  // 2. Enabled assistants
  {
    key: 'enabled_assistants',
    label: 'Enabled assistants',
    description: 'Assistant ids enabled for this server. Empty means all registry assistants are usable.',
    type: 'string_array',
    schema: z.array(z.string().min(1)),
    default: [] as string[],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'assistants',
  },
  // 3. Default AI provider
  {
    key: 'default_ai_provider',
    label: 'Default AI provider',
    description: 'AI provider used when an assistant has no explicit provider.',
    type: 'enum',
    schema: z.enum(['openai', 'anthropic', 'openrouter']),
    default: 'openai',
    allowedValues: ['openai', 'anthropic', 'openrouter'],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 4. Default retrieval provider
  {
    key: 'default_retrieval_provider',
    label: 'Default retrieval provider',
    description: 'Retrieval provider used when an assistant has no explicit retrieval mode.',
    type: 'enum',
    schema: retrievalProviderSchema,
    default: 'openai_file_search',
    allowedValues: ['openai_file_search', 'self_managed_rag', 'none'],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 5. Per-assistant primary reply model
  {
    key: 'primary_model',
    label: 'Primary reply model',
    description: 'Provider + model used for an assistant\'s normal replies.',
    type: 'json',
    schema: modelRefSchema,
    default: PRIMARY_DEFAULT,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 6. Per-assistant utility model
  {
    key: 'utility_model',
    label: 'Utility model',
    description: 'Provider + model used for routing, classification, summarization.',
    type: 'json',
    schema: modelRefSchema,
    default: UTILITY_DEFAULT,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 7. Per-assistant escalation model
  {
    key: 'escalation_model',
    label: 'Escalation model',
    description: 'High-capability model used for ambiguous or hard requests.',
    type: 'json',
    schema: modelRefSchema,
    default: ESCALATION_DEFAULT,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 8. Per-assistant embedding model
  {
    key: 'embedding_model',
    label: 'Embedding model',
    description: 'Provider + model for embeddings (only used when retrieval is self_managed_rag).',
    type: 'json',
    schema: modelRefSchema.nullable(),
    default: null,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 9. Per-assistant rerank model
  {
    key: 'rerank_model',
    label: 'Rerank model',
    description: 'Provider + model for rerank (only used when retrieval is self_managed_rag).',
    type: 'json',
    schema: modelRefSchema.nullable(),
    default: null,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 10. Allowed model providers (guild-scope policy)
  {
    key: 'allowed_providers',
    label: 'Allowed model providers',
    description: 'Providers usable in this server. Empty means all configured providers are allowed.',
    type: 'string_array',
    schema: z.array(z.enum(['openai', 'anthropic', 'openrouter'])),
    default: ['openai'] as string[],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 11. Allowed model ids per provider
  {
    key: 'allowed_models',
    label: 'Allowed model ids per provider',
    description: 'Map of provider -> array of allowed model ids. Empty list means all are allowed.',
    type: 'json',
    schema: z.record(z.array(z.string())),
    default: {} as Record<string, string[]>,
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 12. AI model fallback behavior
  {
    key: 'model_fallback_behavior',
    label: 'AI model fallback behavior',
    description: 'When the primary model fails, whether and how to fall back.',
    type: 'json',
    schema: fallbackBehaviorSchema,
    default: { enabled: true, triggers: ['provider_error', 'rate_limited'] },
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 13. Per-assistant fallback model per role
  {
    key: 'fallback_models',
    label: 'Fallback models per role',
    description: 'Map of role -> ModelRef used on fallback. Roles: primary, utility, escalation.',
    type: 'json',
    schema: z.record(modelRefSchema),
    default: {} as Record<string, ModelRef>,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 14. AI max output tokens per model role
  {
    key: 'max_output_tokens',
    label: 'Max output tokens per role',
    description: 'Map of role -> max output tokens.',
    type: 'json',
    schema: z.record(z.number().int().positive().max(64_000)),
    default: { primary: 1500, utility: 600, escalation: 4000 } as Record<string, number>,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 15. AI temperature per role
  {
    key: 'temperatures',
    label: 'Temperature per role',
    description: 'Map of role -> temperature value (0-2). Set null to use provider default.',
    type: 'json',
    schema: z.record(z.number().min(0).max(2).nullable()),
    default: { primary: 0.4, utility: 0.2, escalation: 0.3 } as Record<string, number | null>,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 16. AI reasoning settings per role
  {
    key: 'reasoning_settings',
    label: 'Reasoning settings per role',
    description: 'Map of role -> reasoning config (provider-dependent).',
    type: 'json',
    schema: z.record(
      z.object({
        effort: z.enum(['low', 'medium', 'high']).optional(),
        maxThinkingTokens: z.number().int().positive().optional(),
      }),
    ),
    default: {} as Record<string, { effort?: 'low' | 'medium' | 'high'; maxThinkingTokens?: number }>,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 17. Per-assistant hosted knowledge vector store id
  {
    key: 'vector_store_id',
    label: 'Hosted knowledge vector store id',
    description: 'OpenAI vector store id used for hosted_file_search retrieval.',
    type: 'string_nullable',
    schema: z.string().min(1).nullable(),
    default: null,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 18. Per-assistant clarification policy
  {
    key: 'clarification_policy',
    label: 'Clarification policy',
    description: 'When assistants should ask clarifying questions.',
    type: 'enum',
    schema: clarificationPolicySchema,
    default: 'ask_when_needed',
    allowedValues: ['ask_when_needed', 'never_ask', 'always_ask'],
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'assistant_behavior',
  },
  // 19. Assistant model override (whether overrides are honored)
  {
    key: 'assistant_model_override_enabled',
    label: 'Allow per-assistant model overrides',
    description: 'When false, ignores per-assistant model overrides and uses guild defaults.',
    type: 'boolean',
    schema: z.boolean(),
    default: true,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'assistant_behavior',
  },
  // 20. Per-assistant channel access mode
  {
    key: 'channel_access_mode',
    label: 'Channel access mode',
    description: 'allowlist: only allowed channels. denylist: all except denied channels.',
    type: 'enum',
    schema: channelAccessModeSchema,
    default: 'denylist',
    allowedValues: ['allowlist', 'denylist'],
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'assistant_access',
  },
  // 21. Per-assistant allowed channels
  {
    key: 'allowed_channels',
    label: 'Allowed channels',
    description: 'Channel ids where this assistant may be invoked (when in allowlist mode).',
    type: 'string_array',
    schema: discordSnowflakeArray,
    default: [] as string[],
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'assistant_access',
  },
  // 22. Per-assistant denied channels
  {
    key: 'denied_channels',
    label: 'Denied channels',
    description: 'Channel ids where this assistant may NOT be invoked (when in denylist mode).',
    type: 'string_array',
    schema: discordSnowflakeArray,
    default: [] as string[],
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'assistant_access',
  },
  // 23. Per-assistant required roles
  {
    key: 'required_roles',
    label: 'Required roles',
    description: 'Role ids a user must have to invoke this assistant.',
    type: 'string_array',
    schema: discordSnowflakeArray,
    default: [] as string[],
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'assistant_access',
  },
  // 24. Per-assistant excluded roles
  {
    key: 'excluded_roles',
    label: 'Excluded roles',
    description: 'Role ids that block a user from invoking this assistant.',
    type: 'string_array',
    schema: discordSnowflakeArray,
    default: [] as string[],
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'assistant_access',
  },
  // 25. Per-assistant max recent thread messages
  {
    key: 'max_recent_thread_messages',
    label: 'Max recent thread messages',
    description: 'How many recent thread messages to include as context (default 50).',
    type: 'integer',
    schema: z.number().int().min(0).max(500),
    default: 50,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'assistant_behavior',
  },
  // 26. Per-assistant max response length
  {
    key: 'max_response_length',
    label: 'Max response length',
    description: 'Maximum total characters in an assistant response (used for chunking).',
    type: 'integer',
    schema: z.number().int().min(100).max(20_000),
    default: 3500,
    scope: 'guild_assistant',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'assistant_behavior',
  },
  // 27. AI cooldown per user (seconds)
  {
    key: 'ai_cooldown_user_seconds',
    label: 'AI cooldown per user (seconds)',
    description: 'Minimum seconds between AI invocations by the same user.',
    type: 'integer',
    schema: z.number().int().min(0).max(3600),
    default: 5,
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 28. AI cooldown per channel (seconds)
  {
    key: 'ai_cooldown_channel_seconds',
    label: 'AI cooldown per channel (seconds)',
    description: 'Minimum seconds between AI invocations in the same channel.',
    type: 'integer',
    schema: z.number().int().min(0).max(3600),
    default: 0,
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'ai',
  },
  // 29. Point award emoji
  {
    key: 'point_award_emoji',
    label: 'Point award emoji',
    description: 'Emoji that triggers a point award. Unicode emoji or custom <:name:id> form.',
    type: 'string',
    schema: z.string().min(1).max(100),
    default: '➕',
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 30. Point budget per user
  {
    key: 'point_budget_per_user',
    label: 'Point budget per user',
    description: 'How many points each user can give per active period.',
    type: 'integer',
    schema: z.number().int().min(0).max(100),
    default: 5,
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 31. Point budget period type
  {
    key: 'point_budget_period_type',
    label: 'Point budget period type',
    description: 'How budgets reset.',
    type: 'enum',
    schema: periodTypeSchema,
    default: 'day',
    allowedValues: ['day', 'week', 'month', 'rolling_n_hours'],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 32. Point rolling period hours
  {
    key: 'point_rolling_period_hours',
    label: 'Rolling period hours',
    description: 'Used when period_type is rolling_n_hours.',
    type: 'integer',
    schema: z.number().int().min(1).max(24 * 30),
    default: 24,
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 33. Point-earning required roles
  {
    key: 'point_earning_required_roles',
    label: 'Point-earning required roles',
    description: 'Role ids a user must have to RECEIVE points.',
    type: 'string_array',
    schema: discordSnowflakeArray,
    default: [] as string[],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 34. Point-earning excluded roles
  {
    key: 'point_earning_excluded_roles',
    label: 'Point-earning excluded roles',
    description: 'Role ids that prevent a user from RECEIVING points.',
    type: 'string_array',
    schema: discordSnowflakeArray,
    default: [] as string[],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 35. Point-granting required roles
  {
    key: 'point_granting_required_roles',
    label: 'Point-granting required roles',
    description: 'Role ids a user must have to GIVE points.',
    type: 'string_array',
    schema: discordSnowflakeArray,
    default: [] as string[],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 36. Point-granting excluded roles
  {
    key: 'point_granting_excluded_roles',
    label: 'Point-granting excluded roles',
    description: 'Role ids that prevent a user from GIVING points.',
    type: 'string_array',
    schema: discordSnowflakeArray,
    default: [] as string[],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 37. Point-counting allowed channels
  {
    key: 'point_allowed_channels',
    label: 'Point-counting allowed channels',
    description: 'Channels where reactions count for points (empty = all channels except denied).',
    type: 'string_array',
    schema: discordSnowflakeArray,
    default: [] as string[],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 38. Point-counting denied channels
  {
    key: 'point_denied_channels',
    label: 'Point-counting denied channels',
    description: 'Channels where reactions DO NOT count for points.',
    type: 'string_array',
    schema: discordSnowflakeArray,
    default: [] as string[],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 39. Reaction removal behavior
  {
    key: 'reaction_removal_behavior',
    label: 'Reaction removal behavior',
    description: 'Whether removing the award reaction revokes the awarded point.',
    type: 'enum',
    schema: reactionRemovalSchema,
    default: 'revoke_within_1_hour',
    allowedValues: ['revoke_within_1_hour', 'never_revoke', 'always_revoke'],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 40. Point award notification mode
  {
    key: 'point_award_notification_mode',
    label: 'Point award notification mode',
    description: 'How the bot confirms a point award to the giver.',
    type: 'enum',
    schema: notificationModeSchema,
    default: 'dm',
    allowedValues: ['dm', 'public_channel', 'disabled'],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'points',
  },
  // 41. User leaderboard windows
  {
    key: 'leaderboard_user_windows',
    label: 'User leaderboard windows (days)',
    description: 'Day windows shown in the user leaderboard.',
    type: 'json',
    schema: z.array(z.number().int().positive()).min(1),
    default: [1, 7, 30, 90] as number[],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'leaderboards',
  },
  // 42. Leaderboard visibility
  {
    key: 'leaderboard_visibility',
    label: 'Leaderboard visibility',
    description: 'Whether leaderboard responses are public or ephemeral.',
    type: 'enum',
    schema: leaderboardVisibilitySchema,
    default: 'ephemeral',
    allowedValues: ['ephemeral', 'public'],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'leaderboards',
  },
  // 43. Helpful-message leaderboard windows
  {
    key: 'leaderboard_message_windows',
    label: 'Message leaderboard windows (days)',
    description: 'Day windows shown in the helpful-message leaderboard.',
    type: 'json',
    schema: z.array(z.number().int().positive()).min(1),
    default: [7, 30, 90] as number[],
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'leaderboards',
  },
  // 44. Audit log channel
  {
    key: 'audit_log_channel',
    label: 'Audit log channel',
    description: 'Channel id where audit events are posted. Null disables channel posts.',
    type: 'string_nullable',
    schema: discordSnowflake.nullable(),
    default: null,
    scope: 'guild',
    adminEditable: true,
    takesEffect: 'immediate',
    category: 'audit',
  },
];

const byKey = new Map(CONFIG_REGISTRY.map((entry) => [entry.key, entry]));

export function getConfigEntry(key: string): ConfigEntry | undefined {
  return byKey.get(key);
}

export function listConfigEntries(filter?: { scope?: ConfigEntry['scope']; category?: string }): ConfigEntry[] {
  return CONFIG_REGISTRY.filter((entry) => {
    if (filter?.scope && entry.scope !== filter.scope) return false;
    if (filter?.category && entry.category !== filter.category) return false;
    return true;
  });
}

export function validateConfigValue(key: string, value: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const entry = byKey.get(key);
  if (!entry) return { ok: false, error: `Unknown config key: ${key}` };
  const result = entry.schema.safeParse(value);
  if (!result.success) {
    const reason = result.error.issues.map((i) => i.message).join('; ');
    return { ok: false, error: reason };
  }
  return { ok: true, value: result.data };
}
