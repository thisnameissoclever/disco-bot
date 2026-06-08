import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Client } from 'discord.js';
import type { Db } from '../db/client.js';
import { schema } from '../db/client.js';
import { logAuditEvent } from '../audit/log.js';

export type AdminOperation = 'add' | 'subtract' | 'set';

export interface AdminAdjustInput {
  client: Client;
  db: Db;
  guildId: string;
  actingAdminId: string;
  targetUserId: string;
  operation: AdminOperation;
  amount: number;
  reason?: string;
}

export interface AdminAdjustResult {
  previousTotal: number;
  newTotal: number;
}

export async function adjustUserPoints(input: AdminAdjustInput): Promise<AdminAdjustResult> {
  const { db, guildId, targetUserId, operation, amount } = input;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('amount must be a non-negative number');
  }

  const previous = await currentTotal(db, guildId, targetUserId);

  let next: number;
  switch (operation) {
    case 'add':
      next = previous + amount;
      break;
    case 'subtract':
      next = Math.max(0, previous - amount);
      break;
    case 'set':
      next = amount;
      break;
  }

  await db.insert(schema.pointOverrides).values({
    guildId,
    targetUserId,
    actingAdminId: input.actingAdminId,
    operation,
    amount,
    finalValue: next.toString(),
    reason: input.reason ?? null,
  });

  await logAuditEvent(
    db,
    {
      guildId,
      eventType: 'admin_point_override',
      actorUserId: input.actingAdminId,
      targetUserId,
      payload: {
        operation,
        amount,
        previousTotal: previous,
        newTotal: next,
        reason: input.reason ?? null,
      },
    },
    input.client,
  );

  return { previousTotal: previous, newTotal: next };
}

export async function currentTotal(db: Db, guildId: string, userId: string): Promise<number> {
  const award = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.pointAwards)
    .where(
      and(
        eq(schema.pointAwards.guildId, guildId),
        eq(schema.pointAwards.receiverUserId, userId),
        isNull(schema.pointAwards.revokedAt),
      ),
    );
  const fromAwards = Number(award[0]?.count ?? 0);

  const latestOverride = await db
    .select()
    .from(schema.pointOverrides)
    .where(
      and(
        eq(schema.pointOverrides.guildId, guildId),
        eq(schema.pointOverrides.targetUserId, userId),
      ),
    )
    .orderBy(sql`applied_at DESC`)
    .limit(1);

  if (!latestOverride[0]) return fromAwards;

  // Override semantics: `set` replaces. `add`/`subtract` apply to the override
  // baseline going forward. Simplest interpretation: the most recent override
  // row's finalValue plus any award delta since that override was applied.
  const baseAt = latestOverride[0].appliedAt;
  const overrideBaseline = Number(latestOverride[0].finalValue ?? 0);

  const deltaSinceOverride = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.pointAwards)
    .where(
      and(
        eq(schema.pointAwards.guildId, guildId),
        eq(schema.pointAwards.receiverUserId, userId),
        sql`${schema.pointAwards.awardedAt} > ${baseAt}`,
        isNull(schema.pointAwards.revokedAt),
      ),
    );
  return overrideBaseline + Number(deltaSinceOverride[0]?.count ?? 0);
}
