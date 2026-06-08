import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ContextMenuCommandBuilder,
  Client,
} from 'discord.js';
import type { Db } from '../../db/client.js';
import type { AssistantRegistry } from '../../assistants/registry.js';

export interface CommandContext {
  client: Client;
  db: Db;
  registry: AssistantRegistry;
}

export interface SlashCommand {
  kind: 'slash';
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, ctx: CommandContext): Promise<void>;
}

export interface MessageContextCommand {
  kind: 'message_context';
  data: ContextMenuCommandBuilder;
  execute(interaction: MessageContextMenuCommandInteraction, ctx: CommandContext): Promise<void>;
}

export type AnyCommand = SlashCommand | MessageContextCommand;
