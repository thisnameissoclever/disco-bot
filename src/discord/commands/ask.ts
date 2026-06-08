import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { respondAsAssistant } from '../orchestrator.js';
import type { SlashCommand } from './types.js';
import { isDiscoError } from '../../util/errors.js';
import { childLogger } from '../../util/logger.js';

const log = childLogger({ component: 'command.ask' });

export const askCommand: SlashCommand = {
  kind: 'slash',
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask an AI assistant a question.')
    .addStringOption((opt) =>
      opt
        .setName('assistant')
        .setDescription('Which assistant to use')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt.setName('prompt').setDescription('Your question').setRequired(true).setMaxLength(1900),
    ),

  async autocomplete(interaction, { registry }) {
    const focused = interaction.options.getFocused().toString().toLowerCase();
    const choices = registry
      .list()
      .filter((a) => a.id.toLowerCase().includes(focused) || a.displayName.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((a) => ({ name: a.displayName, value: a.id }));
    await interaction.respond(choices);
  },

  async execute(interaction, ctx) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: 'This command must be used inside a server.', flags: MessageFlags.Ephemeral });
      return;
    }
    const assistantId = interaction.options.getString('assistant', true);
    const prompt = interaction.options.getString('prompt', true);
    const assistant = ctx.registry.get(assistantId) ?? ctx.registry.findByName(assistantId);
    if (!assistant) {
      await interaction.reply({ content: `Unknown assistant: \`${assistantId}\``, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    try {
      const channel = interaction.channel;
      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        await interaction.editReply('I cannot reply in this channel.');
        return;
      }
      await respondAsAssistant({
        client: ctx.client,
        db: ctx.db,
        registry: ctx.registry,
        assistant,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        source: {
          kind: 'slash',
          channelId: interaction.channelId,
          channel,
          prompt,
          invokingUserDisplayName:
            (interaction.member && 'displayName' in interaction.member
              ? (interaction.member.displayName as string)
              : interaction.user.username) ?? interaction.user.username,
          replyInline: async (text: string) => {
            await interaction.editReply(text);
          },
        },
      });
    } catch (err) {
      if (isDiscoError(err)) {
        await interaction.editReply({ content: err.userMessage });
      } else {
        log.error({ err }, '/ask failed');
        await interaction.editReply({ content: 'Something went wrong while contacting the assistant.' });
      }
    }
  },
};
