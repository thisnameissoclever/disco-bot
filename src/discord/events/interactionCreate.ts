import type { Client } from 'discord.js';
import { Events } from 'discord.js';
import type { Db } from '../../db/client.js';
import type { AssistantRegistry } from '../../assistants/registry.js';
import { childLogger } from '../../util/logger.js';
import { getSlashCommandByName, getMessageContextByName } from '../commands/index.js';

const log = childLogger({ component: 'event.interactionCreate' });

export function registerInteractionCreate(
  client: Client,
  db: Db,
  registry: AssistantRegistry,
): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    const ctx = { client, db, registry };
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = getSlashCommandByName(interaction.commandName);
        if (!cmd) {
          log.warn({ name: interaction.commandName }, 'unknown slash command');
          return;
        }
        await cmd.execute(interaction, ctx);
        return;
      }
      if (interaction.isAutocomplete()) {
        const cmd = getSlashCommandByName(interaction.commandName);
        if (cmd?.autocomplete) await cmd.autocomplete(interaction, ctx);
        return;
      }
      if (interaction.isMessageContextMenuCommand()) {
        const cmd = getMessageContextByName(interaction.commandName);
        if (!cmd) {
          log.warn({ name: interaction.commandName }, 'unknown context menu');
          return;
        }
        await cmd.execute(interaction, ctx);
      }
    } catch (err) {
      log.error({ err }, 'interaction handler crashed');
    }
  });
}
