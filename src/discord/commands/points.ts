import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { currentTotal } from '../../points/admin-overrides.js';
import { getRemainingBudget } from '../../points/budget.js';
import { getValue } from '../../config/service.js';
import type { PeriodType } from '../../util/time.js';
import type { SlashCommand } from './types.js';

export const pointsCommand: SlashCommand = {
  kind: 'slash',
  data: new SlashCommandBuilder()
    .setName('points')
    .setDescription('Show points for yourself or another user.')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Defaults to you').setRequired(false),
    ),

  async execute(interaction, ctx) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: 'Use this in a server.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const target = interaction.options.getUser('user') ?? interaction.user;
    const total = await currentTotal(ctx.db, interaction.guildId, target.id);

    const perUser = await getValue<number>(ctx.db, interaction.guildId, 'point_budget_per_user');
    const periodType = await getValue<PeriodType>(ctx.db, interaction.guildId, 'point_budget_period_type');
    const rollingHours = await getValue<number>(ctx.db, interaction.guildId, 'point_rolling_period_hours');

    const budget =
      target.id === interaction.user.id
        ? await getRemainingBudget(ctx.db, {
            guildId: interaction.guildId,
            giverUserId: interaction.user.id,
            perUserBudget: perUser,
            period: { type: periodType, rollingHours },
          })
        : null;

    const embed = new EmbedBuilder()
      .setTitle(`Points - ${target.username}`)
      .setColor(0x2ecc71)
      .addFields({ name: 'Total', value: String(total), inline: true });
    if (budget) {
      embed.addFields({
        name: `Your award budget (${budget.period.label})`,
        value: `${budget.remaining} of ${perUser} remaining`,
        inline: true,
      });
    }
    await interaction.editReply({ embeds: [embed] });
  },
};
