import type { ZodTypeAny } from 'zod';

export type ConfigScope = 'guild' | 'guild_assistant';

export type ConfigTakesEffect = 'immediate' | 'command_reregister' | 'restart';

export interface ConfigEntry {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'string_nullable' | 'integer' | 'boolean' | 'string_array' | 'enum' | 'json';
  schema: ZodTypeAny;
  default: unknown;
  allowedValues?: readonly unknown[];
  scope: ConfigScope;
  adminEditable: boolean;
  takesEffect: ConfigTakesEffect;
  category: string;
}

export interface ModelRef {
  provider: 'openai' | 'anthropic' | 'openrouter';
  modelId: string;
}

export interface FallbackBehavior {
  enabled: boolean;
  triggers: Array<'provider_error' | 'model_overloaded' | 'rate_limited'>;
}

export type ChannelAccessMode = 'allowlist' | 'denylist';
export type ClarificationPolicy = 'ask_when_needed' | 'never_ask' | 'always_ask';
export type ReactionRemovalBehavior =
  | 'revoke_within_1_hour'
  | 'never_revoke'
  | 'always_revoke';
export type PointAwardNotificationMode = 'dm' | 'public_channel' | 'disabled';
export type LeaderboardVisibility = 'ephemeral' | 'public';
export type RetrievalProvider = 'openai_file_search' | 'self_managed_rag' | 'none';
