import type { Client, TextBasedChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import type { Db } from '../db/client.js';
import { schema } from '../db/client.js';
import { getValue } from '../config/service.js';
import { childLogger } from '../util/logger.js';

const log = childLogger({ component: 'audit' });

export interface AuditEvent {
  guildId: string;
  eventType:
    | 'config_change'
    | 'config_rollback'
    | 'admin_point_override'
    | 'assistant_access_denied'
    | 'point_award_rejected'
    | 'point_revoked'
    | 'error'
    | 'other';
  actorUserId?: string | null;
  targetUserId?: string | null;
  payload?: Record<string, unknown>;
}

export async function logAuditEvent(
  db: Db,
  event: AuditEvent,
  client?: Client,
): Promise<void> {
  let deliveredToChannel = false;
  try {
    const channelId = await getValue<string | null>(db, event.guildId, 'audit_log_channel');
    if (channelId && client) {
      deliveredToChannel = await postToChannel(client, channelId, event);
    }
  } catch (err) {
    log.warn({ err, eventType: event.eventType }, 'failed to post audit event to channel');
  }

  await db.insert(schema.auditLog).values({
    guildId: event.guildId,
    eventType: event.eventType,
    actorUserId: event.actorUserId ?? null,
    targetUserId: event.targetUserId ?? null,
    payload: (event.payload ?? {}) as never,
    deliveredToChannel,
  });
}

async function postToChannel(
  client: Client,
  channelId: string,
  event: AuditEvent,
): Promise<boolean> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !('send' in channel)) return false;
  const embed = buildEmbed(event);
  await (channel as TextBasedChannel & { send: Function }).send({ embeds: [embed] });
  return true;
}

function buildEmbed(event: AuditEvent): EmbedBuilder {
  const e = new EmbedBuilder()
    .setTitle(prettyTitle(event.eventType))
    .setTimestamp(new Date())
    .setColor(colorFor(event.eventType));
  if (event.actorUserId) e.addFields({ name: 'Actor', value: `<@${event.actorUserId}>`, inline: true });
  if (event.targetUserId) e.addFields({ name: 'Target', value: `<@${event.targetUserId}>`, inline: true });
  if (event.payload && Object.keys(event.payload).length > 0) {
    const text = '```json\n' + JSON.stringify(event.payload, null, 2).slice(0, 1500) + '\n```';
    e.addFields({ name: 'Details', value: text });
  }
  return e;
}

function prettyTitle(t: AuditEvent['eventType']): string {
  switch (t) {
    case 'config_change':
      return 'Configuration changed';
    case 'config_rollback':
      return 'Configuration rolled back';
    case 'admin_point_override':
      return 'Admin adjusted user points';
    case 'assistant_access_denied':
      return 'Assistant access denied';
    case 'point_award_rejected':
      return 'Point award rejected';
    case 'point_revoked':
      return 'Point revoked';
    case 'error':
      return 'Error requiring attention';
    case 'other':
      return 'Audit event';
  }
}

function colorFor(t: AuditEvent['eventType']): number {
  switch (t) {
    case 'config_change':
    case 'config_rollback':
      return 0x3498db;
    case 'admin_point_override':
      return 0xf1c40f;
    case 'assistant_access_denied':
    case 'point_award_rejected':
      return 0xe67e22;
    case 'point_revoked':
      return 0x95a5a6;
    case 'error':
      return 0xe74c3c;
    case 'other':
    default:
      return 0x808080;
  }
}
