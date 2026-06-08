import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { CONFIG_REGISTRY, getConfigEntry } from '../../config/registry.js';
import {
  findRollbackTarget,
  getEffectiveConfig,
  rollbackLast,
  setConfig,
} from '../../config/service.js';
import { logAuditEvent } from '../../audit/log.js';
import { isDiscoError } from '../../util/errors.js';
import type { SlashCommand } from './types.js';
import { childLogger } from '../../util/logger.js';

const log = childLogger({ component: 'command.stew-config' });

export const stewConfigCommand: SlashCommand = {
  kind: 'slash',
  data: new SlashCommandBuilder()
    .setName('stew-config')
    .setDescription('View or modify Disco Stew configuration for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addSubcommand((sc) =>
      sc
        .setName('view')
        .setDescription('Show the current effective configuration.')
        .addStringOption((opt) =>
          opt.setName('assistant').setDescription('Optional assistant id for per-assistant scope').setRequired(false).setAutocomplete(true),
        )
        .addStringOption((opt) =>
          opt.setName('category').setDescription('Filter by category').setRequired(false),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName('set')
        .setDescription('Set a config value.')
        .addStringOption((opt) =>
          opt.setName('key').setDescription('Config key').setRequired(true).setAutocomplete(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('value')
            .setDescription('JSON value (string is auto-coerced if needed)')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('assistant').setDescription('Assistant id (for per-assistant keys)').setRequired(false).setAutocomplete(true),
        )
        .addStringOption((opt) => opt.setName('reason').setDescription('Optional reason').setRequired(false)),
    )
    .addSubcommand((sc) =>
      sc.setName('preview-rollback').setDescription('Show what a rollback would do.'),
    )
    .addSubcommand((sc) =>
      sc
        .setName('rollback')
        .setDescription('Roll back the most recent configuration change.')
        .addStringOption((opt) => opt.setName('reason').setDescription('Optional reason').setRequired(false)),
    ),

  async autocomplete(interaction, { registry }) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'assistant') {
      const choices = registry
        .list()
        .filter((a) => a.id.includes(focused.value.toLowerCase()))
        .slice(0, 25)
        .map((a) => ({ name: a.displayName, value: a.id }));
      await interaction.respond(choices);
      return;
    }
    if (focused.name === 'key') {
      const choices = CONFIG_REGISTRY
        .filter((e) => e.key.includes(focused.value.toLowerCase()))
        .slice(0, 25)
        .map((e) => ({ name: e.key, value: e.key }));
      await interaction.respond(choices);
    }
  },

  async execute(interaction, ctx) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }
    const sub = interaction.options.getSubcommand();

    try {
      if (sub === 'view') await viewSubcommand(interaction, ctx);
      else if (sub === 'set') await setSubcommand(interaction, ctx);
      else if (sub === 'preview-rollback') await previewRollbackSubcommand(interaction, ctx);
      else if (sub === 'rollback') await rollbackSubcommand(interaction, ctx);
    } catch (err) {
      if (isDiscoError(err)) {
        await safeRespond(interaction, err.userMessage);
        return;
      }
      log.error({ err, sub }, 'stew-config failed');
      await safeRespond(interaction, 'Something went wrong handling that config command.');
    }
  },
};

async function viewSubcommand(
  interaction: import('discord.js').ChatInputCommandInteraction,
  ctx: { db: import('../../db/client.js').Db },
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const assistantId = interaction.options.getString('assistant') ?? undefined;
  const category = interaction.options.getString('category') ?? undefined;
  const values = await getEffectiveConfig(ctx.db, interaction.guildId!, assistantId);

  const lines = values
    .filter((v) => {
      if (!category) return true;
      const entry = getConfigEntry(v.key);
      return entry?.category === category;
    })
    .map((v) => {
      const entry = getConfigEntry(v.key)!;
      const badge = v.isOverride ? '🟢' : '⚪';
      const valueText = JSON.stringify(v.value);
      return `${badge} \`${v.key}\` (${entry.scope}): ${truncate(valueText, 120)}`;
    });
  const embed = new EmbedBuilder()
    .setTitle('Disco Stew configuration')
    .setDescription(lines.join('\n') || '_No values._')
    .setFooter({ text: '🟢 server override · ⚪ default' })
    .setColor(0x3498db);
  await interaction.editReply({ embeds: [embed] });
}

async function setSubcommand(
  interaction: import('discord.js').ChatInputCommandInteraction,
  ctx: { db: import('../../db/client.js').Db; client: import('discord.js').Client },
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const key = interaction.options.getString('key', true);
  const rawValue = interaction.options.getString('value', true);
  const assistantId = interaction.options.getString('assistant') ?? undefined;
  const reason = interaction.options.getString('reason') ?? undefined;
  const entry = getConfigEntry(key);
  if (!entry) {
    await interaction.editReply(`Unknown key: \`${key}\``);
    return;
  }
  const parsed = parseValue(rawValue, entry.type);
  const result = await setConfig(ctx.db, {
    guildId: interaction.guildId!,
    actingAdminId: interaction.user.id,
    ...(assistantId ? { assistantId } : {}),
    ...(reason ? { reason } : {}),
    changes: [{ key, value: parsed, ...(assistantId ? { assistantId } : {}) }],
  });

  if (result.applied.length === 0) {
    await interaction.editReply(`No change - \`${key}\` already has that value.`);
    return;
  }

  await logAuditEvent(
    ctx.db,
    {
      guildId: interaction.guildId!,
      eventType: 'config_change',
      actorUserId: interaction.user.id,
      payload: { historyId: result.historyId, changes: result.applied, reason: reason ?? null },
    },
    ctx.client,
  );
  await interaction.editReply(
    `Updated \`${key}\` (history #${result.historyId}). Use \`/stew-config rollback\` to revert.`,
  );
}

async function previewRollbackSubcommand(
  interaction: import('discord.js').ChatInputCommandInteraction,
  ctx: { db: import('../../db/client.js').Db },
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const target = await findRollbackTarget(ctx.db, interaction.guildId!);
  if (!target) {
    await interaction.editReply('There is nothing to roll back for this server.');
    return;
  }
  const summary = target.changes
    .map((c) => `\`${c.key}\`: ${JSON.stringify(c.next)} → ${JSON.stringify(c.prev)}`)
    .join('\n');
  const embed = new EmbedBuilder()
    .setTitle(`Rollback preview - history #${target.id}`)
    .setDescription(summary || '_(no diff)_')
    .addFields(
      { name: 'Applied by', value: `<@${target.actingAdminId}>`, inline: true },
      { name: 'Applied at', value: `<t:${Math.floor(target.appliedAt.getTime() / 1000)}:R>`, inline: true },
    )
    .setColor(0xf1c40f);
  await interaction.editReply({ embeds: [embed] });
}

async function rollbackSubcommand(
  interaction: import('discord.js').ChatInputCommandInteraction,
  ctx: { db: import('../../db/client.js').Db; client: import('discord.js').Client },
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const reason = interaction.options.getString('reason') ?? undefined;
  const result = await rollbackLast(ctx.db, interaction.guildId!, interaction.user.id, reason);
  if (!result) {
    await interaction.editReply('There is nothing to roll back for this server.');
    return;
  }
  await logAuditEvent(
    ctx.db,
    {
      guildId: interaction.guildId!,
      eventType: 'config_rollback',
      actorUserId: interaction.user.id,
      payload: {
        rolledBackHistoryId: result.rolledBackHistoryId,
        appliedHistoryId: result.appliedHistoryId,
        changes: result.changes,
        reason: reason ?? null,
      },
    },
    ctx.client,
  );
  await interaction.editReply(
    `Rolled back history #${result.rolledBackHistoryId}. Applied as history #${result.appliedHistoryId}.`,
  );
}

function parseValue(raw: string, _type: import('../../config/types.js').ConfigEntry['type']): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Permit shorthand for booleans, numbers, and bare strings.
    if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true';
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

async function safeRespond(
  interaction: import('discord.js').ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  if (interaction.deferred || interaction.replied) await interaction.editReply(content);
  else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}
