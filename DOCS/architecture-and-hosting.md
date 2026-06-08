# Architecture and Hosting

## Current Hosting Decision

The first implementation should use Render as the primary hosting platform.

Render should host:

1. The always-on Discord bot worker.
2. The primary Postgres database for durable bot state.
3. Any later scheduled jobs or private services if the bot needs them.

This choice is intended to keep the MVP simple. The Discord bot needs a continuously running process for Gateway events, slash command handling, reaction tracking, thread handling, and background work. Render background workers fit that shape directly.

## Storage Decision

The first durable storage backend should be Render Postgres.

Render Postgres should store:

1. Guild configuration.
2. Configuration change history and rollback records.
3. Assistant registry overrides.
4. Conversation and Discord thread mapping.
5. Point award events.
6. Point revocation events.
7. Admin point overrides.
8. Leaderboard query data.
9. Audit records.
10. Provider metadata, such as OpenAI vector store ids.

The bot should keep schema design provider-neutral. Render is the hosting choice, but application code should treat Postgres as the durable store rather than depending on Render-specific APIs for core behavior.

## Assistant Knowledge

The first hosted-knowledge implementation should continue to use OpenAI Responses API file search and vector stores.

This means Render Postgres does not need to store assistant embeddings for the MVP. It only needs to store which assistant uses which provider, model role, retrieval mode, and provider-specific knowledge store id.

If OpenAI file search satisfies the ServiceNow Developers and STFUAI Podcasts knowledge requirements, Render Postgres does not reduce bot functionality compared with Supabase. It reduces the number of moving parts and keeps the first production deployment easier to reason about.

## Self-Managed Retrieval

Self-managed retrieval should remain a future-compatible design path.

If the project later needs self-managed retrieval, Render Postgres can still support that path because Render Postgres supports the `pgvector` extension on supported PostgreSQL versions. Supabase remains a reasonable future option if the project later needs its AI helpers, Auth, Storage, Edge Functions, Realtime, or dashboard-first database workflows.

For the MVP, do not add Supabase as an application dependency unless a requirement appears that Render Postgres plus OpenAI hosted file search cannot satisfy.

## Practical Implications

This decision means:

1. The first deployment stack is simpler: Render worker plus Render Postgres plus OpenAI.
2. Bot functionality is not reduced for the documented MVP requirements.
3. The database schema should stay portable Postgres, with migrations and typed data access owned by the app.
4. Vector search should be treated as optional future infrastructure, not required for the first build.
5. The architecture should preserve an adapter boundary so Supabase, another Postgres host, or another retrieval provider can be introduced later without rewriting Discord bot behavior.

## Cost Notes

Pricing changes over time, so these values should be rechecked before production deployment.

As of the current planning decision:

1. Render background worker paid compute starts with the Starter worker tier.
2. Render Postgres paid database tiers include a low-cost Basic-256mb tier.
3. Supabase bills at the organization level, but each project has dedicated compute. Additional Supabase projects in a paid organization can increase monthly compute cost even when the organization is already on Pro.

## References

1. [Render background workers](https://render.com/docs/background-workers)
2. [Render Postgres connection docs](https://render.com/docs/postgresql-creating-connecting)
3. [Render Postgres extensions](https://render.com/docs/postgresql-extensions)
4. [Render pricing](https://render.com/pricing)
5. [OpenAI file search](https://platform.openai.com/docs/guides/tools-file-search)
6. [Supabase billing overview](https://supabase.com/docs/guides/platform/billing-on-supabase)
7. [Supabase billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)
