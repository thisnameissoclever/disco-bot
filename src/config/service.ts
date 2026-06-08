import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { schema } from '../db/client.js';
import { ConfigValidationError } from '../util/errors.js';
import { CONFIG_REGISTRY, getConfigEntry, validateConfigValue } from './registry.js';
import type { ConfigEntry } from './types.js';

export interface ConfigChange {
  scope: 'guild' | 'guild_assistant';
  key: string;
  assistantId: string | null;
  prev: unknown;
  next: unknown;
}

export interface EffectiveValue {
  key: string;
  value: unknown;
  isOverride: boolean;
  scope: ConfigEntry['scope'];
  assistantId?: string;
}

export interface SetInput {
  guildId: string;
  actingAdminId: string;
  reason?: string;
  assistantId?: string;
  changes: Array<{ key: string; value: unknown; assistantId?: string }>;
}

export interface SetResult {
  applied: ConfigChange[];
  historyId: number;
}

/**
 * Returns effective values for ALL guild-scoped keys (and a default snapshot
 * for guild_assistant-scoped keys when assistantId is provided).
 */
export async function getEffectiveConfig(
  db: Db,
  guildId: string,
  assistantId?: string,
): Promise<EffectiveValue[]> {
  const guildRows = await db
    .select()
    .from(schema.guildConfig)
    .where(eq(schema.guildConfig.guildId, guildId));
  const guildMap = new Map(guildRows.map((row) => [row.configKey, row.value]));

  let assistantPayload: Record<string, unknown> = {};
  if (assistantId) {
    const rows = await db
      .select()
      .from(schema.assistantOverrides)
      .where(
        and(
          eq(schema.assistantOverrides.guildId, guildId),
          eq(schema.assistantOverrides.assistantId, assistantId),
        ),
      );
    if (rows[0]) assistantPayload = rows[0].payload as Record<string, unknown>;
  }

  const result: EffectiveValue[] = [];
  for (const entry of CONFIG_REGISTRY) {
    if (entry.scope === 'guild') {
      const overridden = guildMap.has(entry.key);
      result.push({
        key: entry.key,
        value: overridden ? guildMap.get(entry.key) : entry.default,
        isOverride: overridden,
        scope: entry.scope,
      });
    } else if (assistantId) {
      const overridden = Object.prototype.hasOwnProperty.call(assistantPayload, entry.key);
      result.push({
        key: entry.key,
        value: overridden ? assistantPayload[entry.key] : entry.default,
        isOverride: overridden,
        scope: entry.scope,
        assistantId,
      });
    }
  }
  return result;
}

/**
 * Returns a single effective value, falling back to the registry default.
 */
export async function getValue<T = unknown>(
  db: Db,
  guildId: string,
  key: string,
  assistantId?: string,
): Promise<T> {
  const entry = getConfigEntry(key);
  if (!entry) throw new ConfigValidationError(key, 'unknown config key');

  if (entry.scope === 'guild') {
    const rows = await db
      .select()
      .from(schema.guildConfig)
      .where(and(eq(schema.guildConfig.guildId, guildId), eq(schema.guildConfig.configKey, key)));
    if (rows[0]) return rows[0].value as T;
    return entry.default as T;
  }

  if (!assistantId) {
    throw new ConfigValidationError(key, `key has guild_assistant scope; assistantId required`);
  }

  const rows = await db
    .select()
    .from(schema.assistantOverrides)
    .where(
      and(
        eq(schema.assistantOverrides.guildId, guildId),
        eq(schema.assistantOverrides.assistantId, assistantId),
      ),
    );
  const payload = (rows[0]?.payload ?? {}) as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(payload, key)) return payload[key] as T;
  return entry.default as T;
}

/**
 * Applies a batch of config changes inside one transaction and writes a history row.
 * Returns the list of changes actually applied (entries unchanged from current
 * value are filtered out).
 */
export async function setConfig(db: Db, input: SetInput): Promise<SetResult> {
  if (input.changes.length === 0) {
    throw new ConfigValidationError('(set)', 'no changes provided');
  }

  // Validate everything first.
  const validated: Array<{ entry: ConfigEntry; key: string; value: unknown; assistantId: string | null }> = [];
  for (const change of input.changes) {
    const entry = getConfigEntry(change.key);
    if (!entry) throw new ConfigValidationError(change.key, 'unknown config key');
    const result = validateConfigValue(change.key, change.value);
    if (!result.ok) throw new ConfigValidationError(change.key, result.error);
    const assistantId =
      entry.scope === 'guild_assistant' ? change.assistantId ?? input.assistantId ?? null : null;
    if (entry.scope === 'guild_assistant' && !assistantId) {
      throw new ConfigValidationError(change.key, 'assistantId required for per-assistant key');
    }
    validated.push({ entry, key: change.key, value: result.value, assistantId });
  }

  return await db.transaction(async (tx) => {
    await ensureGuildRow(tx, input.guildId);

    const applied: ConfigChange[] = [];
    for (const v of validated) {
      const prev = await readCurrent(tx, input.guildId, v.entry, v.assistantId);
      if (jsonEqual(prev, v.value)) continue;
      await writeValue(tx, input.guildId, v.entry, v.assistantId, v.value, input.actingAdminId);
      applied.push({
        scope: v.entry.scope,
        key: v.key,
        assistantId: v.assistantId,
        prev,
        next: v.value,
      });
    }

    if (applied.length === 0) {
      return { applied, historyId: -1 };
    }

    const inserted = await tx
      .insert(schema.configHistory)
      .values({
        guildId: input.guildId,
        actingAdminId: input.actingAdminId,
        changes: applied,
        reason: input.reason ?? null,
      })
      .returning({ id: schema.configHistory.id });

    return { applied, historyId: inserted[0]!.id };
  });
}

/**
 * Returns the latest non-rolled-back history row that this guild can roll back.
 * Useful for both preview and apply.
 */
export async function findRollbackTarget(
  db: Db,
  guildId: string,
): Promise<{
  id: number;
  changes: ConfigChange[];
  actingAdminId: string;
  reason: string | null;
  appliedAt: Date;
} | null> {
  const rows = await db
    .select()
    .from(schema.configHistory)
    .where(
      and(
        eq(schema.configHistory.guildId, guildId),
        isNull(schema.configHistory.rolledBackAt),
        eq(schema.configHistory.isRollback, false),
      ),
    )
    .orderBy(desc(schema.configHistory.appliedAt))
    .limit(1);
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    changes: rows[0].changes as ConfigChange[],
    actingAdminId: rows[0].actingAdminId,
    reason: rows[0].reason,
    appliedAt: rows[0].appliedAt,
  };
}

export async function rollbackLast(
  db: Db,
  guildId: string,
  actingAdminId: string,
  reason?: string,
): Promise<{ rolledBackHistoryId: number; appliedHistoryId: number; changes: ConfigChange[] } | null> {
  return await db.transaction(async (tx) => {
    const target = await findRollbackTarget(tx, guildId);
    if (!target) return null;

    // Apply prev values.
    const inverse: ConfigChange[] = [];
    for (const change of target.changes) {
      const entry = getConfigEntry(change.key);
      if (!entry) continue;
      const current = await readCurrent(tx, guildId, entry, change.assistantId);
      await writeValue(tx, guildId, entry, change.assistantId, change.prev, actingAdminId);
      inverse.push({
        scope: change.scope,
        key: change.key,
        assistantId: change.assistantId,
        prev: current,
        next: change.prev,
      });
    }

    await tx
      .update(schema.configHistory)
      .set({ rolledBackAt: new Date() })
      .where(eq(schema.configHistory.id, target.id));

    const inserted = await tx
      .insert(schema.configHistory)
      .values({
        guildId,
        actingAdminId,
        changes: inverse,
        reason: reason ?? `Rollback of #${target.id}`,
        isRollback: true,
      })
      .returning({ id: schema.configHistory.id });

    return {
      rolledBackHistoryId: target.id,
      appliedHistoryId: inserted[0]!.id,
      changes: inverse,
    };
  });
}

async function ensureGuildRow(tx: Db, guildId: string): Promise<void> {
  await tx
    .insert(schema.guilds)
    .values({ guildId })
    .onConflictDoNothing({ target: schema.guilds.guildId });
}

async function readCurrent(
  tx: Db,
  guildId: string,
  entry: ConfigEntry,
  assistantId: string | null,
): Promise<unknown> {
  if (entry.scope === 'guild') {
    const rows = await tx
      .select()
      .from(schema.guildConfig)
      .where(
        and(eq(schema.guildConfig.guildId, guildId), eq(schema.guildConfig.configKey, entry.key)),
      );
    if (rows[0]) return rows[0].value;
    return entry.default;
  }
  if (!assistantId) return entry.default;
  const rows = await tx
    .select()
    .from(schema.assistantOverrides)
    .where(
      and(
        eq(schema.assistantOverrides.guildId, guildId),
        eq(schema.assistantOverrides.assistantId, assistantId),
      ),
    );
  const payload = (rows[0]?.payload ?? {}) as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(payload, entry.key)) return payload[entry.key];
  return entry.default;
}

async function writeValue(
  tx: Db,
  guildId: string,
  entry: ConfigEntry,
  assistantId: string | null,
  value: unknown,
  actingAdminId: string,
): Promise<void> {
  if (entry.scope === 'guild') {
    await tx
      .insert(schema.guildConfig)
      .values({
        guildId,
        configKey: entry.key,
        value: value as never,
        updatedByUserId: actingAdminId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.guildConfig.guildId, schema.guildConfig.configKey],
        set: { value: value as never, updatedByUserId: actingAdminId, updatedAt: new Date() },
      });
    return;
  }
  if (!assistantId) throw new Error('assistantId required');

  // Use jsonb_set to merge into the existing payload atomically.
  await tx
    .insert(schema.assistantOverrides)
    .values({
      guildId,
      assistantId,
      payload: { [entry.key]: value } as never,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.assistantOverrides.guildId, schema.assistantOverrides.assistantId],
      set: {
        payload: sql`jsonb_set(${schema.assistantOverrides.payload}, ${`{${entry.key}}`}::text[], ${JSON.stringify(value)}::jsonb, true)`,
        updatedAt: new Date(),
      },
    });
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
