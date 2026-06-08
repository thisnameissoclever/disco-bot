import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { schema } from '../db/client.js';
import { activePeriod, type PeriodConfig, type PeriodWindow } from './periods.js';

export interface RemainingBudgetInput {
  guildId: string;
  giverUserId: string;
  perUserBudget: number;
  period: PeriodConfig;
  now?: Date;
}

export interface RemainingBudgetResult {
  used: number;
  remaining: number;
  period: PeriodWindow;
}

export async function getRemainingBudget(
  db: Db,
  input: RemainingBudgetInput,
): Promise<RemainingBudgetResult> {
  const now = input.now ?? new Date();
  const period = activePeriod(now, input.period);

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.pointAwards)
    .where(
      and(
        eq(schema.pointAwards.guildId, input.guildId),
        eq(schema.pointAwards.giverUserId, input.giverUserId),
        gte(schema.pointAwards.awardedAt, period.start),
        lte(schema.pointAwards.awardedAt, period.end),
        isNull(schema.pointAwards.revokedAt),
      ),
    );
  const used = Number(result[0]?.count ?? 0);
  return {
    used,
    remaining: Math.max(0, input.perUserBudget - used),
    period,
  };
}
