import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { schema } from '../db/client.js';
import { daysAgo } from '../util/time.js';
import { currentTotal } from '../points/admin-overrides.js';

export interface UserLeaderboardRow {
  userId: string;
  total: number;
  windows: Record<number, number>; // days -> points awarded in last N days
}

export async function buildUserLeaderboard(
  db: Db,
  guildId: string,
  windows: number[],
  limit = 10,
): Promise<UserLeaderboardRow[]> {
  // Aggregate award counts per receiver overall (alltime).
  const totals = await db
    .select({
      userId: schema.pointAwards.receiverUserId,
      total: sql<number>`count(*)::int`,
    })
    .from(schema.pointAwards)
    .where(
      and(
        eq(schema.pointAwards.guildId, guildId),
        isNull(schema.pointAwards.revokedAt),
      ),
    )
    .groupBy(schema.pointAwards.receiverUserId)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  // For each top row, compute window slices + factor in admin overrides.
  const rows: UserLeaderboardRow[] = [];
  for (const t of totals) {
    const windowsMap: Record<number, number> = {};
    for (const days of windows) {
      const since = daysAgo(new Date(), days);
      const c = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.pointAwards)
        .where(
          and(
            eq(schema.pointAwards.guildId, guildId),
            eq(schema.pointAwards.receiverUserId, t.userId),
            gte(schema.pointAwards.awardedAt, since),
            isNull(schema.pointAwards.revokedAt),
          ),
        );
      windowsMap[days] = Number(c[0]?.count ?? 0);
    }
    const total = await currentTotal(db, guildId, t.userId);
    rows.push({ userId: t.userId, total, windows: windowsMap });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows.slice(0, limit);
}
