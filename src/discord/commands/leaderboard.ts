import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { buildUserLeaderboard } from '../../leaderboards/users.js';
import { buildMessageLeaderboard } from '../../leaderboards/messages.js';
import { renderUserLeaderboard, renderMessageLeaderboard } from '../../leaderboards/render.js';
import { getValue } from '../../config/service.js';
import type { LeaderboardVisibility } from '../../config/types.js';
import type { SlashCommand } from './types.js';

export const leaderboardCommand: SlashCommand = {
  kind: 'slash',
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show leaderboards for this server.')
    .addSubcommand((sc) =>
      sc.setName('users').setDescription('Top users by points earned.'),
    )
    .addSubcommand((sc) =>
      sc
        .setName('messages')
        .setDescription('Most helpful messages by points awarded.')
        .addIntegerOption((opt) =>
          opt
            .setName('window')
            .setDescription('Window in days (default uses the server config)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(365),
        ),
    ),

  async execute(interaction, ctx) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: 'Use this in a server.', flags: MessageFlags.Ephemeral });
      return;
    }
    const visibility = await getValue<LeaderboardVisibility>(
      ctx.db,
      interaction.guildId,
      'leaderboard_visibility',
    );
    const ephemeral = visibility === 'ephemeral';
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});

    const sub = interaction.options.getSubcommand();
    if (sub === 'users') {
      const windows = await getValue<number[]>(ctx.db, interaction.guildId, 'leaderboard_user_windows');
      const rows = await buildUserLeaderboard(ctx.db, interaction.guildId, windows, 10);
      await interaction.editReply({ embeds: [renderUserLeaderboard(rows, windows)] });
      return;
    }

    if (sub === 'messages') {
      const configuredWindows = await getValue<number[]>(
        ctx.db,
        interaction.guildId,
        'leaderboard_message_windows',
      );
      const window = interaction.options.getInteger('window') ?? configuredWindows[0] ?? 7;
      const rows = await buildMessageLeaderboard(ctx.db, ctx.client, interaction.guildId, window, 10);
      await interaction.editReply({ embeds: [renderMessageLeaderboard(rows, window)] });
    }
  },
};
