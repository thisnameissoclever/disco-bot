# Assistant and Community Feature Requirements

## Scope

This document captures the first major feature requirements for Disco Stew.

The first implementation should support two pilot servers:

1. ServiceNow Developers
2. STFUAI Podcasts

The design must stay generalizable. ServiceNow-specific assistant behavior and STFUAI-specific assistant behavior must both be expressed through the same assistant template and server configuration model.

## AI Provider Boundary

The bot must keep AI provider access behind an adapter boundary. The first implementation should use OpenAI directly for assistant conversations that need uploaded, indexed knowledge, because OpenAI Responses API file search and vector stores fit the current "pre-built assistant with knowledge files" requirement with the least custom retrieval infrastructure.

OpenRouter and Anthropic should remain supported design targets through provider adapters, but they should not be the first hosted-knowledge implementation unless their hosted retrieval capabilities match the requirements at implementation time. OpenRouter can be used later for model routing, self-managed retrieval-augmented generation, embeddings, rerank, or provider diversification. Anthropic can be used later for high-quality Claude responses, long-context document analysis, or server-specific assistants where hosted vector-store file search is not required.

The bot remains responsible for Discord events, assistant selection, conversation state, thread mapping, point tracking, admin configuration, and storage. Provider-specific hosted retrieval may be delegated to the AI provider, but the bot must still own which assistant is used, which provider configuration is selected, and which Discord context is sent.

The first deployment should use Render for the bot worker and Render Postgres for durable bot state. This hosting decision must not change the provider adapter boundary. The bot should treat Postgres as the durable application store and should avoid Render-specific application behavior unless it is limited to deployment configuration.

Required AI capabilities:

1. Send model requests with assistant instructions, user prompt, Discord conversation context, and any retrieved or hosted file-search knowledge.
2. Support per-server provider and model overrides.
3. Support assistant-specific provider and model defaults.
4. Support hosted file search for knowledge files where available.
5. Support retrieval-augmented generation for providers that do not provide hosted file search.
6. Support provider-independent AI usage so the base bot is not locked to one model vendor.
7. Support separate configurable model roles for different use cases instead of one global model for everything.
8. Ask clarifying questions only when missing details would prevent a good, useful answer.
9. Answer directly when the available Discord context, assistant instructions, and knowledge retrieval are sufficient.

Initial provider strategy:

1. Primary hosted-knowledge provider: OpenAI Responses API with file search and vector stores.
2. Optional later chat provider: Anthropic Claude models for assistants where Claude is preferred and hosted vector-store file search is not required.
3. Optional later routing or self-managed retrieval provider: OpenRouter.
4. Retrieval provider values should include at least `openai_file_search`, `self_managed_rag`, and `none`.

Initial model role defaults:

1. Primary assistant replies: OpenAI `gpt-5-mini`, configurable per server and per assistant.
2. Utility work such as routing, classification, lightweight summarization, and prompt shaping: OpenAI `gpt-5-nano`, configurable per server and per assistant.
3. Escalation for hard technical questions or unusually ambiguous assistant requests: a higher-capability OpenAI model selected at implementation time, configurable per server and per assistant.
4. Embeddings for self-managed retrieval: configurable provider and model, only required when retrieval provider is `self_managed_rag`.
5. Rerank for self-managed retrieval: configurable provider and model, optional and only required when retrieval provider is `self_managed_rag`.

Model role configuration must support:

1. Provider id.
2. Model id.
3. Use case label.
4. Whether server admins can override it.
5. Allowed provider choices.
6. Allowed model choices for each provider.
7. Optional reasoning or thinking configuration when the provider supports it.
8. Max output tokens.
9. Temperature or equivalent sampling controls where appropriate.
10. Whether the role can fall back to another provider or model.
11. Fallback provider and model.
12. Retrieval provider to use with that model role.
13. Provider-specific metadata, such as OpenAI vector store ids for hosted file search.

AI provider references:

1. [OpenAI Responses API migration guide](https://developers.openai.com/api/docs/guides/migrate-to-responses)
2. [OpenAI file search](https://developers.openai.com/api/docs/guides/tools-file-search)
3. [OpenAI pricing](https://platform.openai.com/docs/pricing)
4. [Anthropic models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
5. [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
6. [Anthropic Files API](https://platform.claude.com/docs/en/build-with-claude/files)
7. [OpenRouter chat completions](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request)
8. [OpenRouter embeddings](https://openrouter.ai/docs/api/reference/embeddings)
9. [OpenRouter RAG cookbook](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/rag)

## Hosted Knowledge and Retrieval

Hosted knowledge configuration should be represented in the same assistant template as self-managed retrieval configuration. An assistant should be able to use provider-managed file search when the provider supports it, or fall back to self-managed retrieval when it does not.

For the MVP, hosted assistant knowledge should be handled by OpenAI file search and vector stores rather than by storing embeddings in the project database. Render Postgres should store provider metadata, such as vector store ids and indexing status, but it should not be required to perform vector retrieval for the first build.

Hosted knowledge requirements:

1. Each assistant may define provider-specific knowledge store identifiers.
2. OpenAI vector store ids should be configurable per assistant and overridable per server where appropriate.
3. Knowledge files should remain listed in the assistant definition even when uploaded to a provider, so the source of truth is visible in the project.
4. Provider indexing status should be tracked before an assistant is enabled for hosted file search.
5. The bot should report a clear admin-facing error if an assistant is configured for hosted file search but the required provider store is missing or not ready.
6. Self-managed retrieval should remain a supported retrieval path for future OpenRouter, Anthropic, or local retrieval usage.
7. If self-managed retrieval becomes necessary later, Render Postgres may be used with `pgvector`, or the project may add Supabase if its platform features are worth the additional dependency.

## Assistant Registry

The bot must expose an assistant registry. Each assistant definition should include:

1. Assistant id.
2. Display name.
3. Description.
4. Allowed pilot servers or server families.
5. Instruction file path.
6. Knowledge source paths.
7. Default AI provider.
8. Default retrieval provider.
9. Default primary assistant model role.
10. Default utility model role.
11. Default escalation model role.
12. Optional embedding model role.
13. Optional rerank model role.
14. Provider-specific hosted knowledge configuration, such as OpenAI vector store ids.
15. Retrieval mode.
16. Max response length.
17. Default command binding.
18. Allowed invocation modes.
19. Safety and disclosure rules.
20. Clarification behavior policy.

Retrieval mode should support at least:

1. `none`: no external knowledge is injected.
2. `instructions_only`: assistant instructions are used, but no file retrieval is performed.
3. `hosted_file_search`: provider-managed file search is used, such as OpenAI vector stores.
4. `rag`: relevant chunks are retrieved from assistant knowledge files and injected into the model request by the bot.

The ServiceNow Development assistant should be the first concrete assistant definition. STFUAI Podcasts should be added from the same template rather than by modifying the base assistant behavior.

## Assistant Invocation

Users must be able to invoke assistants through multiple Discord surfaces:

1. Slash command invocation.
2. Message context menu invocation on an existing message.
3. Mention-based invocation, such as tagging the bot while asking for help.
4. Mention-based invocation while replying to another message.
5. Mention-based invocation while linking to another Discord message.
6. Continuation inside a thread where the bot is already participating.

Slash commands are useful for explicit prompts. Message context menu commands are the preferred way to target an existing message through Discord's interaction model. Mention-based invocation is required because server members will naturally say something like `@bot-name can you help with this?`.

## Discord Context Requirements

When invoked, the bot must build context from the relevant Discord surface.

Required context rules:

1. If the user invokes the bot while replying to a message, include the replied-to message content.
2. If the user invokes the bot while tagging or linking to another Discord message, include that target message content when the bot can access it.
3. If the invocation happens inside a thread, include the thread starter message when available.
4. If the invocation happens inside a thread, include the most recent up-to-N thread messages.
5. The default recent thread message limit is `50`.
6. The recent thread message limit must be configurable per server.
7. If the invocation happens outside a thread, the bot should create a new thread and reply inside that thread.
8. If the invocation happens inside a thread where the bot is already participating, the bot should treat the interaction as a continuation of the existing conversation.
9. If the invocation happens inside a thread where the bot is not already participating, the bot should join or participate only if the server configuration allows it.
10. If required message context is unavailable, the bot should say what context it could not access and ask the user to provide it.

Context assembly should prioritize:

1. Assistant instructions.
2. User's current request.
3. Targeted replied-to, tagged, or linked message.
4. Thread starter message.
5. Recent thread messages up to the configured limit.
6. Retrieved assistant knowledge snippets.
7. Prior assistant conversation state.

The bot may need Discord message content access to reliably read surrounding channel and thread messages. This should be treated as an implementation requirement, not an assumption.

## Assistant Clarification Behavior

Assistants should use conditional clarification. They should ask concise follow-up questions when additional details are necessary to provide a good, useful answer. They should not ask questions as a default ritual when the available Discord context is already enough to answer.

Clarification behavior requirements:

1. The default clarification policy must be `ask_when_needed`.
2. The policy must apply to all assistants unless a stricter assistant definition overrides it.
3. Assistants should ask the smallest number of clarifying questions needed to proceed.
4. Assistants should explain which missing detail is needed when asking a clarifying question.
5. Assistants should continue with a direct answer when the missing detail is optional or can be handled as an explicit assumption.
6. The bot should preserve clarification questions and user replies as part of the conversation state for that thread.

Discord references:

1. [Application commands](https://docs.discord.com/developers/interactions/application-commands)
2. [Receiving and responding to interactions](https://docs.discord.com/developers/interactions/receiving-and-responding)
3. [Threads](https://docs.discord.com/developers/topics/threads)
4. [Channel thread endpoints](https://docs.discord.com/developers/resources/channel)
5. [Gateway events](https://docs.discord.com/developers/events/gateway-events)
6. [Message reactions](https://docs.discord.com/developers/resources/message)
7. [Gateway and message content intent](https://docs.discord.com/developers/events/gateway)

## Conversation State

The bot must store enough conversation state to continue assistant threads without confusing one thread or server for another.

Conversation records should include:

1. Guild id.
2. Channel id.
3. Thread id.
4. Assistant id.
5. User id for the invoking user.
6. Message ids included in the context.
7. Recent model request metadata.
8. Created timestamp.
9. Updated timestamp.

The bot should not store more message content than needed for correct operation unless a later data-retention requirement explicitly says otherwise.

## Per-Server Assistant Access

Assistant availability must be configurable per server.

Channel access must support both modes:

1. Allowlist mode: only configured channels can invoke the assistant.
2. Denylist mode: all channels can invoke the assistant except configured channels.

Role access must support:

1. Excluded roles.
2. Required roles.
3. Admin override.

Each server must be able to configure which assistants are available, which channels may use them, and which roles may use them.

## Participation Points

The bot must track points for helpful participation.

Point awards are driven by reactions using a configured emoji.

Default behavior:

1. The default award emoji is `➕`.
2. The emoji must be configurable per server.
3. Custom server emoji must be supported.
4. Each user has a configurable number of award points they can give during a configured period.
5. The default point budget is `5`.
6. The default point period is calendar day.
7. Alternative periods must include rolling N-hour windows, calendar week, and calendar month.

Abuse controls:

1. Users must not award points to themselves.
2. Bot users must not earn or grant points unless explicitly allowed by configuration.
3. Repeated awards from the same giver to the same message should not count more than once unless explicitly configured.
4. Excluded channels must not count for points.
5. Excluded roles must not earn or grant points.
6. Required roles may be configured for earning points, granting points, or both.
7. Point events must be auditable.

Reaction removal behavior:

1. Removing a qualifying reaction should revoke the awarded point if the reaction is removed within 1 hour of the award.
2. Removing a qualifying reaction after 1 hour should not revoke the awarded point.
3. The 1-hour revocation window should be the default reaction removal behavior.
4. Reaction removal behavior must be configurable per server.

Award confirmation notifications:

1. When a user grants a point with the configured reaction, the bot should attempt to notify the giver that the point was awarded.
2. The notification should include the recipient's server display name or username.
3. The notification should include the giver's remaining points for the active award period.
4. The notification should describe the active award period, such as today, the current rolling N-hour window, this week, or this month.
5. Discord does not support sending an ephemeral channel or thread message in response to a reaction add event. Reaction add is a gateway event, while ephemeral messages require an interaction response or interaction followup token.
6. For reaction-based awards, the supported private notification mode should be DM to the giver.
7. If DM delivery fails, the bot should not leak the confirmation publicly unless the server has explicitly enabled public award confirmations.
8. For command-based or component-based award flows, ephemeral confirmations are allowed because those flows are Discord interactions.
9. Award confirmation behavior must be configurable per server.
10. Supported notification modes should include `dm`, `public_channel`, and `disabled`.

## Admin Point Overrides

Admins must be able to adjust user point totals.

Supported operations:

1. Add a number of points.
2. Subtract a number of points.
3. Set a user's point total to an exact value.

Admin point overrides must:

1. Require admin permission.
2. Record the acting admin.
3. Record the target user.
4. Record the operation.
5. Record the amount or final value.
6. Record an optional reason.
7. Write to the configured audit log channel when one is configured.

## Leaderboards

The bot must support user leaderboards and helpful-message leaderboards.

User leaderboards must show:

1. Current total points.
2. Points accumulated over the last 1 day.
3. Points accumulated over the last 7 days.
4. Points accumulated over the last 30 days.
5. Points accumulated over the last 90 days.

Leaderboard windows must be configurable per server.

Leaderboard response visibility must be configurable per server:

1. Ephemeral response visible only to the command invoker.
2. Public response posted to the channel where the command was run.

Message leaderboards must show the most helpful messages based on point awards.

Message leaderboard entries should include:

1. Message author.
2. Point total.
3. Message link.
4. Channel or thread.
5. Award time window.

Privacy opt-out is not required for the first version. Discord activity is already public within the server, and the leaderboard is scoped to the server.

## Admin Configuration

The administrative configuration command must be `/stew-config`.

The command name is treated as a registered Discord command name. It should remain stable unless the application command registration is deliberately regenerated.

Admins must be able to configure supported options from inside Discord. Values should be selectable from approved choices where applicable.

Day-one admin configuration must include:

1. Viewing the current effective server configuration.
2. Seeing which values are defaults and which values are server overrides.
3. Rolling back the most recent successful configuration change.
4. Previewing the rollback before it is applied.
5. Recording rollback actions in the audit log.

All configurable options must be defined in a centralized typed config registry. The registry should define:

1. Config key.
2. Display label.
3. Description.
4. Data type.
5. Default value.
6. Allowed values where applicable.
7. Scope.
8. Whether server admins can edit it.
9. Validation rules.
10. Whether a change requires command re-registration, bot restart, or takes effect immediately.

Runtime config values must be stored per server. The registry defines what can be configured. Server config stores the selected value for each guild.

Configuration rollback requirements:

1. Every successful configuration change must create a config history record.
2. The history record must include the acting admin, guild id, changed keys, previous values, new values, timestamp, and reason when provided.
3. Rolling back the last change must restore the previous values from the latest successful config history record for that guild.
4. If the latest change has already been rolled back, the bot must not apply it again.
5. If no rollback target exists, the bot should report that clearly to the admin.
6. Rollback must be treated as a new audited config change.

## Required Per-Server Config Options

The first config registry should include at least:

1. Server bot display name.
2. Enabled assistants.
3. Default AI provider.
4. Default retrieval provider.
5. Assistant primary reply model provider and model.
6. Assistant utility model provider and model.
7. Assistant escalation model provider and model.
8. Assistant embedding model provider and model.
9. Assistant rerank model provider and model.
10. Allowed model providers.
11. Allowed model ids per provider.
12. AI model fallback behavior.
13. AI model fallback provider and model per role.
14. AI max output tokens per model role.
15. AI temperature or equivalent sampling value per model role.
16. AI reasoning or thinking settings per model role where supported.
17. Hosted knowledge vector store ids per assistant where supported.
18. Assistant clarification policy, default `ask_when_needed`.
19. Assistant model override.
20. Assistant channel access mode.
21. Assistant allowed channels.
22. Assistant denied channels.
23. Assistant required roles.
24. Assistant excluded roles.
25. Assistant max recent thread messages, default `50`.
26. Assistant max response length.
27. AI cooldown per user.
28. AI cooldown per channel.
29. Point award emoji.
30. Point budget per user.
31. Point budget period type.
32. Point rolling period hours.
33. Point-earning required roles.
34. Point-earning excluded roles.
35. Point-granting required roles.
36. Point-granting excluded roles.
37. Point-counting allowed channels.
38. Point-counting denied channels.
39. Reaction removal behavior, default `revoke_within_1_hour`.
40. Point award notification mode, default `dm`.
41. Leaderboard windows.
42. Leaderboard visibility.
43. Helpful-message leaderboard windows.
44. Audit log channel.

## Audit Logging

The bot must support a configurable audit log channel per server.

Audit events should include:

1. Admin configuration changes.
2. Admin point overrides.
3. Assistant access denials caused by server config.
4. Point awards rejected by abuse controls.
5. Point revocations caused by reaction removal.
6. Errors that require admin attention.
7. Configuration rollback actions.

## Initial Feature Set

The first buildable feature set should include:

1. Assistant registry with ServiceNow Developers and STFUAI Podcasts definitions.
2. Assistant invocation through slash command, message context command, and bot mention.
3. Thread creation for non-thread invocations.
4. Thread continuation for bot-participating threads.
5. Per-server assistant model override.
6. Config registry and `/stew-config`.
7. Viewing current effective server configuration.
8. Rolling back the most recent successful configuration change.
9. Conditional assistant clarification behavior.
10. Emoji-based point awards.
11. Admin point overrides.
12. User leaderboard.
13. Helpful-message leaderboard.
14. Audit log channel support.

## Design Biases

1. Build extensible modules before server-specific forks.
2. Keep server-specific behavior in assistant definitions and guild config.
3. Prefer explicit configuration over hidden behavior.
4. Treat Discord permissions and message content access as first-class requirements.
5. Avoid gamification rules that reward spam or coordination abuse.
6. Keep the base bot useful even when only one assistant is enabled.
