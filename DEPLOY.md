# Disco Stew - Deployment

This document walks through deploying Disco Stew to Render with Render Postgres and OpenAI as the AI provider. The same Docker image runs unchanged anywhere a long-lived Node process is supported.

## 1. Discord application setup

1. Visit https://discord.com/developers/applications and create a new application.
2. Under **Bot**, click "Add Bot". Copy the token - this becomes `DISCORD_TOKEN`.
3. Under **Bot - Privileged Gateway Intents**, enable:
   - Server Members Intent
   - Message Content Intent
4. Under **General Information**, copy the Application ID - this becomes `DISCORD_CLIENT_ID`.
5. Under **OAuth2 - URL Generator**, select scopes `bot` and `applications.commands`. For bot permissions, select:
   - View Channels
   - Send Messages
   - Send Messages in Threads
   - Create Public Threads
   - Create Private Threads
   - Manage Threads
   - Read Message History
   - Use External Emojis
   - Add Reactions
   - Embed Links
   - Attach Files
   This is permissions integer **397821728320** (verify in the URL generator). Use the resulting URL to invite the bot to your server.

## 2. OpenAI setup

1. Create an API key at https://platform.openai.com/api-keys. Save it as `OPENAI_API_KEY`.
2. After deploying, run `npm run upload-knowledge servicenow-development` (locally) or use the Render shell to upload the ServiceNow knowledge files. The script prints a `VECTOR_STORE_ID=vs_...` line. Save that as `SERVICENOW_VECTOR_STORE_ID`.

## 3. Render deploy via Blueprint

1. Fork or push this repo to GitHub.
2. In Render, click **New + - Blueprint**.
3. Select this repository. Render reads `render.yaml` and provisions:
   - A worker named `disco-stew` running the Dockerfile.
   - A Postgres database named `disco-stew-db`.
4. In the worker's **Environment** section, fill in the secrets listed below.
5. Render will build and start the worker. Migrations run automatically on startup.
6. After the first boot, run `npm run register-commands -- --global` once locally (or via Render shell) to publish slash commands. Global commands can take up to an hour to appear in Discord. For faster iteration set `DISCORD_DEV_GUILD_ID` to a guild id and re-run without `--global`.

## 4. Required environment variables

| Variable | Required | Source |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Discord application > Bot |
| `DISCORD_CLIENT_ID` | yes | Discord application > General Information |
| `DISCORD_DEV_GUILD_ID` | no | A guild id for fast slash command iteration |
| `OWNER_DISCORD_ID` | no | A super-admin user id who bypasses guild admin checks |
| `DATABASE_URL` | yes | Auto-injected by Render Postgres |
| `OPENAI_API_KEY` | yes | platform.openai.com |
| `SERVICENOW_VECTOR_STORE_ID` | yes (for hosted file search) | `npm run upload-knowledge servicenow-development` |
| `ANTHROPIC_API_KEY` | no | Future provider |
| `OPENROUTER_API_KEY` | no | Future provider |
| `NODE_ENV` | no | Defaults to `development` locally, set to `production` on Render |
| `LOG_LEVEL` | no | Defaults to `info` |

## 5. Local development

```sh
# 1. Copy env template and fill in values.
cp .env.example .env

# 2. Start a local Postgres (any version 13+).
#    Example with Docker:
docker run --rm -d --name disco-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=disco_stew postgres:16

# 3. Install deps, run migrations, register dev-guild commands, start dev mode.
npm install
npm run db:migrate
npm run register-commands -- --guild=<dev-guild-id>
npm run dev
```

To upload assistant knowledge to OpenAI from your local machine:

```sh
npm run upload-knowledge servicenow-development
# Capture the VECTOR_STORE_ID printed at the end and add it to .env / Render.
```

## 6. Operating the bot

Inside Discord (any guild with the bot invited):

1. `/stew-config view` shows defaults. Use `/stew-config set <key> <value>` to override.
2. `/stew-config preview-rollback` and `/stew-config rollback` undo the last change.
3. `/ask <assistant> <prompt>` invokes an assistant in a fresh thread.
4. Right-click any message - **Apps - Ask Disco Stew about this** to invoke the default assistant on that message.
5. `@bot-name <prompt>` invokes the first enabled assistant (mention by id or display name to target a specific one).
6. React with the configured emoji (`+` by default) to award points. Remove the reaction within 1 hour to revoke.
7. `/leaderboard users` and `/leaderboard messages` show top contributors.
8. `/admin-points add|subtract|set` makes admin adjustments. Set `audit_log_channel` to capture audit events.

## 7. Health checks and troubleshooting

1. Render Worker logs - this is the primary debug source. JSON lines from `pino`.
2. `/stew-config view` is the source of truth for the current guild configuration.
3. If the assistant cannot find its hosted-knowledge store, the bot reports a clear admin-facing error. Re-run `upload-knowledge` and set the env var.
4. If slash commands do not appear, re-run `register-commands` for the desired scope.
