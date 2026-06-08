# Requirements

## Current Status

This document captures early requirements for the base Disco Stew project. Detailed feature requirements for AI assistants, participation points, leaderboards, and server configuration are tracked in [Assistant and Community Feature Requirements](assistant-and-community-feature-requirements.md).

## Foundational Requirements

1. The bot must support a shared base implementation that can be reused across multiple Discord servers.
2. The bot must allow server-specific forks or extensions without forcing unrelated communities to inherit each other's behavior.
3. Shared functionality should be designed around explicit extension points.
4. Server-specific configuration should be separate from reusable base behavior.
5. Community-assisting functionality should be prioritized over novelty features.
6. Gamification should reward helpful behavior while avoiding incentives for spam, cliques, or low-quality activity.
7. The first two pilot servers are ServiceNow Developers and STFUAI Podcasts.
8. Server-specific assistant behavior must be driven by a general assistant template rather than hard-coded pilot assumptions.
9. The administrative configuration command must be `/stew-config`.
10. Runtime configurable values must be defined in a centralized typed config registry before being exposed to server admins.
11. AI provider, retrieval provider, and model selection must be configurable by model role instead of hard-coded globally.
12. The first hosted-knowledge implementation should use OpenAI Responses API with file search and vector stores, while keeping Anthropic and OpenRouter available as future provider adapters.
13. The first deployment target should be Render.
14. The first durable storage backend should be Render Postgres.
15. The first build should avoid a Supabase dependency unless a future requirement needs Supabase-specific platform features or self-managed retrieval beyond what Render Postgres and OpenAI hosted file search can provide.
16. Day-one admin configuration must support viewing the current effective configuration and rolling back the most recent successful configuration change.
17. Assistants must ask clarifying questions when additional details are necessary for a good, useful answer, but they must answer directly when the available context is sufficient.

## Candidate Feature Areas

1. Help request intake and routing.
2. Helpful-answer recognition.
3. Reputation, points, badges, or levels.
4. Server-specific onboarding.
5. Knowledge base lookup.
6. Community prompts and recurring activities.
7. Maintainer or moderator utilities.
8. Analytics and community health signals.
9. AI assistant conversations with server-specific knowledge and instructions.
10. Per-server bot display naming where Discord permissions allow.
11. User and message leaderboards.
12. Admin point adjustments.
13. Per-server AI model role configuration for primary assistant replies, utility tasks, escalation, embeddings, and rerank.
14. Render-hosted worker deployment and Render Postgres persistence.
15. Admin configuration viewing and last-change rollback.
16. Conditional assistant clarification behavior.

## Open Questions

1. Which exact OpenAI escalation model should be the first high-capability default at implementation time?
2. What exact assistant should STFUAI Podcasts use first?
3. Which channels and roles should be included or excluded for each pilot server?
