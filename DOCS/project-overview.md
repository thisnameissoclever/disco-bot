# Project Overview

## Purpose

Disco Stew is a Discord bot intended to help communities run more smoothly across multiple servers. The base bot should provide community-assisting functionality, gamification for helping others, AI assistant access, and reusable foundations that can be adapted for specific communities.

The bot is expected to support multiple Discord servers with different needs, including developer communities and STFUAI Podcasts communities. The base project should stay focused on shared functionality, while server-specific versions can extend or override behavior where needed. Each server should be able to set its own bot display name where Discord permissions allow, while the shared project keeps the base name Disco Stew.

## Product Goals

1. Provide useful community-assisting tools for Discord servers.
2. Encourage and reward members who help others.
3. Make helpful activity visible without turning the community into a popularity contest.
4. Keep the base bot reusable across multiple unrelated communities.
5. Allow server-specific forks or extensions for communities such as ServiceNow Developers, Salesforce developers, and STFUAI Podcasts.

## Extensibility Principle

Any functionality that could reasonably vary by server should be built extensibly.

This means the base bot should prefer clear extension points over hard-coded community assumptions. Server-specific behavior should be isolated in modules, plugins, configuration, or fork-specific packages so that each community can add its own workflows without polluting the shared foundation.

## Base Bot Responsibilities

1. Define shared bot architecture and conventions.
2. Provide reusable command, event, permission, and configuration patterns.
3. Provide shared community-support features that make sense across servers.
4. Provide reusable gamification primitives such as points, badges, levels, or reputation signals.
5. Provide a durable path for server-specific extensions.

## Server-Specific Responsibilities

1. Add commands, workflows, labels, and content specific to one server.
2. Customize gamification rules where a community has unique norms.
3. Integrate with server-specific services or knowledge bases.
4. Override configuration without modifying shared base behavior unnecessarily.

## Pilot Servers

1. ServiceNow Developers
2. STFUAI Podcasts

The first assistant and gamification work should support both pilot servers from the start. ServiceNow-specific logic must be represented as one assistant configuration, not as hidden base behavior. STFUAI-specific logic must follow the same template so future servers can be added without removing or rewriting ServiceNow assumptions.

## Early Non-Goals

1. Do not hard-code one server's needs into the base bot.
2. Do not add broad dependency or infrastructure commitments before the base architecture is decided.
3. Do not build moderation enforcement as the first priority unless requirements change.
