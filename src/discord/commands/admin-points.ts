import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { adjustUserPoints } from '../../points/admin-overrides.js';
import { isDiscoError } from '../../util/errors.js';
import { childLogger } from '../../util/logger.js';
import type { SlashCommand } from './types.js';

const log = childLogger({ component: 'command.admin-points' });

export const adminPointsCommand: SlashCommand = {
  kind: 'slash',
  data: new SlashCommandBuilder()
    .setName('admin-points')
    .setDescription('Admin adjustments to user points.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addSubcommand((sc) =>
      sc
        .setName('add')
        .setDescription('Add points to a user.')
        .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(10_000),
        )
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
    )
    .addSubcommand((sc) =>
      sc
        .setName('subtract')
        .setDescription('Subtract points from a user.')
        .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(10_000),
        )
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
    )
    .addSubcommand((sc) =>
      sc
        .setName('set')
        .setDescription('Set a user\'s point total.')
        .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('total').setDescription('Exact total').setRequired(true).setMinValue(0).setMaxValue(1_000_000),
        )
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
    ),

  async execute(interaction, ctx) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: 'Use this in a server.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? undefined;

    try {
      if (sub === 'add' || sub === 'subtract') {
        const amount = interaction.options.getInteger('amount', true);
        const result = await adjustUserPoints({
          client: ctx.client,
          db: ctx.db,
          guildId: interaction.guildId,
          actingAdminId: interaction.user.id,
          targetUserId: target.id,
          operation: sub,
          amount,
          ...(reason ? { reason } : {}),
        });
        await interaction.editReply(
          `${sub === 'add' ? 'Added' : 'Subtracted'} ${amount} for <@${target.id}>. Total: ${result.previousTotal} → ${result.newTotal}.`,
        );
        return;
      }
      if (sub === 'set') {
        const total = interaction.options.getInteger('total', true);
        const result = await adjustUserPoints({
          client: ctx.client,
          db: ctx.db,
          guildId: interaction.guildId,
          actingAdminId: interaction.user.id,
          targetUserId: target.id,
          operation: 'set',
          amount: total,
          ...(reason ? { reason } : {}),
        });
        await interaction.editReply(
          `Set <@${target.id}> total to ${result.newTotal} (was ${result.previousTotal}).`,
        );
      }
    } catch (err) {
      if (isDiscoError(err)) {
        await interaction.editReply(err.userMessage);
      } else {
        log.error({ err }, 'admin-points failed');
        await interaction.editReply('Something went wrong adjusting points.');
      }
    }
  },
};
