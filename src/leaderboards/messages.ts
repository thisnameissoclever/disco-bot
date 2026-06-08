import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import type { Client } from 'discord.js';
import type { Db } from '../db/client.js';
import { schema } from '../db/client.js';
import { daysAgo } from '../util/time.js';

export interface MessageLeaderboardRow {
  messageId: string;
  channelId: string;
  authorUserId: string | null;
  points: number;
  jumpUrl: string;
  preview: string | null;
}

export async function buildMessageLeaderboard(
  db: Db,
  client: Client,
  guildId: string,
  windowDays: number,
  limit = 10,
): Promise<MessageLeaderboardRow[]> {
  const since = daysAgo(new Date(), windowDays);
  const grouped = await db
    .select({
      messageId: schema.pointAwards.messageId,
      channelId: schema.pointAwards.channelId,
      receiver: schema.pointAwards.receiverUserId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.pointAwards)
    .where(
      and(
        eq(schema.pointAwards.guildId, guildId),
        gte(schema.pointAwards.awardedAt, since),
        isNull(schema.pointAwards.revokedAt),
      ),
    )
    .groupBy(
      schema.pointAwards.messageId,
      schema.pointAwards.channelId,
      schema.pointAwards.receiverUserId,
    )
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  const rows: MessageLeaderboardRow[] = [];
  for (const row of grouped) {
    const jumpUrl = `https://discord.com/channels/${guildId}/${row.channelId}/${row.messageId}`;
    let preview: string | null = null;
    try {
      const channel = await client.channels.fetch(row.channelId);
      if (channel && channel.isTextBased() && 'messages' in channel) {
        const message = await channel.messages.fetch(row.messageId);
        preview = message.content?.slice(0, 140) ?? null;
      }
    } catch {
      preview = null;
    }
    rows.push({
      messageId: row.messageId,
      channelId: row.channelId,
      authorUserId: row.receiver,
      points: Number(row.count),
      jumpUrl,
      preview,
    });
  }
  return rows;
}
