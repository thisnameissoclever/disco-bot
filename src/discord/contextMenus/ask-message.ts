import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  MessageFlags,
  type MessageContextMenuCommandInteraction,
} from 'discord.js';
import type { MessageContextCommand, CommandContext } from '../commands/types.js';
import { respondAsAssistant } from '../orchestrator.js';
import { isDiscoError } from '../../util/errors.js';
import { childLogger } from '../../util/logger.js';

const log = childLogger({ component: 'command.ctx.ask-message' });

export const askMessageContextCommand: MessageContextCommand = {
  kind: 'message_context',
  data: new ContextMenuCommandBuilder()
    .setName('Ask Disco Stew about this')
    .setType(ApplicationCommandType.Message as number),

  async execute(interaction: MessageContextMenuCommandInteraction, ctx: CommandContext) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: 'This must be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const enabled = ctx.registry.list();
    if (enabled.length === 0) {
      await interaction.reply({
        content: 'No assistants are configured on this server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    // Pick the first enabled assistant. The user can use /ask to target a specific one.
    const assistant = enabled[0]!;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const targetMessage = interaction.targetMessage;
      // Build a synthetic message for the orchestrator: it expects a Message
      // for the "message" source, so we pass the target message directly. The
      // assistant context builder will use this as the replied-to target.
      await respondAsAssistant({
        client: ctx.client,
        db: ctx.db,
        registry: ctx.registry,
        assistant,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        source: { kind: 'message', message: targetMessage },
      });
      await interaction.editReply(`Replied in a new thread on the target message.`);
    } catch (err) {
      if (isDiscoError(err)) {
        await interaction.editReply(err.userMessage);
      } else {
        log.error({ err }, 'context menu failed');
        await interaction.editReply('Something went wrong handling that action.');
      }
    }
  },
};
