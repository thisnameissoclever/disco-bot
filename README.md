# Disco Stew

Disco Stew is a multi-server Discord community + AI assistant bot. It hosts assistants behind a provider-adapter boundary (OpenAI Responses API + file search out of the box), supports `/stew-config` for per-server configuration with rollback, tracks participation points via reactions, and exposes user and message leaderboards.

The first deployment target is Render (background worker + Render Postgres). The same Docker image runs anywhere a long-lived Node process is supported.

## Highlights

1. Slash commands, message context menu, mention, and thread-continuation invocation paths.
2. `/stew-config` for guild admins, backed by a centralized typed config registry of 44 keys with full audit history and last-change rollback.
3. Provider-adapter boundary: OpenAI ships live. Anthropic and OpenRouter are stubbed and ready to add later.
4. Participation points via reactions with abuse controls (self-award, duplicate, role/channel gating, budget windows).
5. User leaderboard with 1/7/30/90-day windows and helpful-message leaderboard with configurable windows.
6. Audit log channel support for config changes, point overrides, access denials, revocations, and errors.
7. ServiceNow Development assistant ships with the bundled knowledge corpus. STFUAI Podcasts ships as a placeholder skeleton.

## Quickstart

See **[DEPLOY.md](./DEPLOY.md)** for the full Render deploy walkthrough plus a local dev recipe. The short version:

```sh
cp .env.example .env       # fill in secrets
npm install
npm run db:migrate
npm run register-commands -- --guild=<dev-guild-id>
npm run dev
```

## Project docs

The full requirements and architecture documents live in [`DOCS/`](./DOCS):

1. [Project Overview](./DOCS/project-overview.md)
2. [Requirements](./DOCS/requirements.md)
3. [Assistant and Community Feature Requirements](./DOCS/assistant-and-community-feature-requirements.md)
4. [Architecture and Hosting](./DOCS/architecture-and-hosting.md)
5. [Lessons Learned](./DOCS/lessons-learned.md)

## Stack

1. Node.js 20+ / TypeScript 5 (strict, ESM)
2. discord.js v14
3. OpenAI Node SDK (Responses API + file search)
4. Drizzle ORM + PostgreSQL
5. Zod for runtime validation
6. Pino for structured logging
7. Vitest for tests
