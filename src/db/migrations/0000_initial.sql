-- Disco Stew initial schema.
-- Hand-written so first-time deploys don't require drizzle-kit to be invoked
-- against an empty database. Subsequent migrations should be generated via
-- `npm run db:generate`.

CREATE TABLE IF NOT EXISTS "guilds" (
  "guild_id" text PRIMARY KEY,
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "guild_config" (
  "guild_id" text NOT NULL,
  "config_key" text NOT NULL,
  "value" jsonb NOT NULL,
  "updated_by_user_id" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("guild_id", "config_key")
);

CREATE TABLE IF NOT EXISTS "config_history" (
  "id" bigserial PRIMARY KEY,
  "guild_id" text NOT NULL,
  "acting_admin_id" text NOT NULL,
  "changes" jsonb NOT NULL,
  "reason" text,
  "applied_at" timestamptz NOT NULL DEFAULT now(),
  "rolled_back_at" timestamptz,
  "is_rollback" boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS "config_history_guild_applied_idx"
  ON "config_history" ("guild_id", "applied_at");

CREATE TABLE IF NOT EXISTS "assistant_overrides" (
  "guild_id" text NOT NULL,
  "assistant_id" text NOT NULL,
  "payload" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("guild_id", "assistant_id")
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" bigserial PRIMARY KEY,
  "guild_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "thread_id" text NOT NULL,
  "assistant_id" text NOT NULL,
  "invoking_user_id" text NOT NULL,
  "last_openai_response_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_thread_idx"
  ON "conversations" ("thread_id");
CREATE INDEX IF NOT EXISTS "conversations_guild_assistant_idx"
  ON "conversations" ("guild_id", "assistant_id");

CREATE TABLE IF NOT EXISTS "conversation_messages" (
  "id" bigserial PRIMARY KEY,
  "conversation_id" integer NOT NULL,
  "discord_message_id" text,
  "role" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "conversation_messages_conversation_idx"
  ON "conversation_messages" ("conversation_id");

CREATE TABLE IF NOT EXISTS "point_awards" (
  "id" bigserial PRIMARY KEY,
  "guild_id" text NOT NULL,
  "giver_user_id" text NOT NULL,
  "receiver_user_id" text NOT NULL,
  "message_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "emoji" text NOT NULL,
  "awarded_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz,
  "revocation_reason" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "point_awards_unique_idx"
  ON "point_awards" ("guild_id", "giver_user_id", "message_id", "emoji");
CREATE INDEX IF NOT EXISTS "point_awards_receiver_idx"
  ON "point_awards" ("guild_id", "receiver_user_id", "awarded_at");
CREATE INDEX IF NOT EXISTS "point_awards_message_idx"
  ON "point_awards" ("guild_id", "message_id");
CREATE INDEX IF NOT EXISTS "point_awards_giver_idx"
  ON "point_awards" ("guild_id", "giver_user_id", "awarded_at");

CREATE TABLE IF NOT EXISTS "point_overrides" (
  "id" bigserial PRIMARY KEY,
  "guild_id" text NOT NULL,
  "target_user_id" text NOT NULL,
  "acting_admin_id" text NOT NULL,
  "operation" text NOT NULL,
  "amount" integer,
  "final_value" numeric,
  "reason" text,
  "applied_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "point_overrides_target_idx"
  ON "point_overrides" ("guild_id", "target_user_id");

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" bigserial PRIMARY KEY,
  "guild_id" text NOT NULL,
  "event_type" text NOT NULL,
  "actor_user_id" text,
  "target_user_id" text,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "delivered_to_channel" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "audit_log_guild_created_idx"
  ON "audit_log" ("guild_id", "created_at");

CREATE TABLE IF NOT EXISTS "provider_resources" (
  "id" bigserial PRIMARY KEY,
  "guild_id" text,
  "assistant_id" text NOT NULL,
  "provider" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ready',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "provider_resources_assistant_idx"
  ON "provider_resources" ("assistant_id", "provider", "resource_type");
CREATE INDEX IF NOT EXISTS "provider_resources_guild_idx"
  ON "provider_resources" ("guild_id", "assistant_id", "resource_type");
