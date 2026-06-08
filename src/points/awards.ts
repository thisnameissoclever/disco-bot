import type { Client, GuildMember, MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import type { Db } from '../db/client.js';
import { schema } from '../db/client.js';
import { getValue } from '../config/service.js';
import type { PointAwardNotificationMode } from '../config/types.js';
import type { PeriodType } from '../util/time.js';
import { PointAwardRejectedError, type PointRejectReason } from '../util/errors.js';
import { childLogger } from '../util/logger.js';
import { getRemainingBudget } from './budget.js';
import { logAuditEvent } from '../audit/log.js';

const log = childLogger({ component: 'points.awards' });

export interface ProcessReactionAddInput {
  client: Client;
  db: Db;
  reaction: MessageReaction | PartialMessageReaction;
  user: User | PartialUser;
}

export async function processReactionAdd(input: ProcessReactionAddInput): Promise<void> {
  const reaction = await ensureFullReaction(input.reaction);
  const user = await ensureFullUser(input.user);
  if (!reaction || !user) return;

  const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
  const guildId = message.guildId;
  if (!guildId) return;
  if (user.id === input.client.user?.id) return;

  // 1. Emoji match.
  const configuredEmoji = await getValue<string>(input.db, guildId, 'point_award_emoji');
  if (!emojiMatches(reaction, configuredEmoji)) return;

  const recipient = message.author;
  if (!recipient) return;

  try {
    await applyAward({
      client: input.client,
      db: input.db,
      guildId,
      giverUserId: user.id,
      message,
      recipient,
      emojiKey: emojiKey(reaction),
    });
  } catch (err) {
    if (err instanceof PointAwardRejectedError) {
      log.debug({ reason: err.reason, guildId, giver: user.id }, 'point award rejected');
      await logAuditEvent(input.db, {
        guildId,
        eventType: 'point_award_rejected',
        actorUserId: user.id,
        targetUserId: recipient.id,
        payload: { reason: err.reason, messageId: message.id, channelId: message.channelId },
      }, input.client);
    } else {
      log.error({ err }, 'unexpected error processing reaction add');
    }
  }
}

interface ApplyAwardInput {
  client: Client;
  db: Db;
  guildId: string;
  giverUserId: string;
  message: import('discord.js').Message;
  recipient: import('discord.js').User;
  emojiKey: string;
}

async function applyAward(input: ApplyAwardInput): Promise<void> {
  const { client, db, guildId, giverUserId, message, recipient, emojiKey } = input;

  if (giverUserId === recipient.id) {
    throw reject('self_award', 'You cannot award points to yourself.');
  }
  if (recipient.bot) {
    throw reject('bot_recipient', 'Points cannot be awarded to bots.');
  }

  const allowedChannels = await getValue<string[]>(db, guildId, 'point_allowed_channels');
  const deniedChannels = await getValue<string[]>(db, guildId, 'point_denied_channels');
  if (deniedChannels.includes(message.channelId)) {
    throw reject('excluded_channel', 'Points cannot be awarded in this channel.');
  }
  if (allowedChannels.length > 0 && !allowedChannels.includes(message.channelId)) {
    throw reject('excluded_channel', 'Points are only awarded in approved channels.');
  }

  await checkRoleGate({
    client,
    guildId,
    userId: giverUserId,
    requiredKey: 'point_granting_required_roles',
    excludedKey: 'point_granting_excluded_roles',
    failureReason: 'missing_required_role',
    db,
  });
  await checkRoleGate({
    client,
    guildId,
    userId: recipient.id,
    requiredKey: 'point_earning_required_roles',
    excludedKey: 'point_earning_excluded_roles',
    failureReason: 'excluded_role',
    db,
  });

  const perUserBudget = await getValue<number>(db, guildId, 'point_budget_per_user');
  const periodType = await getValue<PeriodType>(db, guildId, 'point_budget_period_type');
  const rollingHours = await getValue<number>(db, guildId, 'point_rolling_period_hours');
  const budget = await getRemainingBudget(db, {
    guildId,
    giverUserId,
    perUserBudget,
    period: { type: periodType, rollingHours },
  });
  if (budget.remaining <= 0) {
    throw reject(
      'budget_exhausted',
      `You have used all ${perUserBudget} of your award points for ${budget.period.label}.`,
    );
  }

  try {
    await db.insert(schema.pointAwards).values({
      guildId,
      giverUserId,
      receiverUserId: recipient.id,
      messageId: message.id,
      channelId: message.channelId,
      emoji: emojiKey,
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw reject('duplicate', 'You have already awarded a point on this message.');
    }
    throw err;
  }

  const notificationMode = await getValue<PointAwardNotificationMode>(
    db,
    guildId,
    'point_award_notification_mode',
  );
  await notifyGiver({
    client,
    guildId,
    giverUserId,
    recipient,
    remainingAfter: budget.remaining - 1,
    periodLabel: budget.period.label,
    mode: notificationMode,
    channelId: message.channelId,
  });

  log.info(
    {
      guildId,
      giver: giverUserId,
      receiver: recipient.id,
      messageId: message.id,
    },
    'point awarded',
  );
}

interface NotifyInput {
  client: Client;
  guildId: string;
  giverUserId: string;
  recipient: User;
  remainingAfter: number;
  periodLabel: string;
  mode: PointAwardNotificationMode;
  channelId: string;
}

async function notifyGiver(input: NotifyInput): Promise<void> {
  if (input.mode === 'disabled') return;

  const recipientName =
    input.recipient.globalName ?? input.recipient.username ?? `<@${input.recipient.id}>`;
  const text =
    `You awarded a point to ${recipientName}. ` +
    `You have ${input.remainingAfter} point(s) left for ${input.periodLabel}.`;

  if (input.mode === 'dm') {
    try {
      const u = await input.client.users.fetch(input.giverUserId);
      await u.send(text);
    } catch (err) {
      log.debug({ err, giver: input.giverUserId }, 'DM delivery failed');
    }
    return;
  }

  if (input.mode === 'public_channel') {
    try {
      const channel = await input.client.channels.fetch(input.channelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        await channel.send(`<@${input.giverUserId}> ${text}`);
      }
    } catch (err) {
      log.debug({ err }, 'public confirmation failed');
    }
  }
}

interface RoleGateInput {
  client: Client;
  db: Db;
  guildId: string;
  userId: string;
  requiredKey: string;
  excludedKey: string;
  failureReason: PointRejectReason;
}

async function checkRoleGate(input: RoleGateInput): Promise<void> {
  const requiredRoles = await getValue<string[]>(input.db, input.guildId, input.requiredKey);
  const excludedRoles = await getValue<string[]>(input.db, input.guildId, input.excludedKey);
  if (requiredRoles.length === 0 && excludedRoles.length === 0) return;

  const member = await fetchMember(input.client, input.guildId, input.userId);
  if (!member) return; // can't enforce role gate without a guild member

  const roleIds = member.roles.cache.map((r) => r.id);
  if (excludedRoles.some((r) => roleIds.includes(r))) {
    throw reject(input.failureReason, 'A role on your account blocks this action.');
  }
  if (requiredRoles.length > 0 && !requiredRoles.some((r) => roleIds.includes(r))) {
    throw reject(input.failureReason, 'You do not have a required role for this action.');
  }
}

async function fetchMember(client: Client, guildId: string, userId: string): Promise<GuildMember | null> {
  try {
    const guild = await client.guilds.fetch(guildId);
    return await guild.members.fetch(userId);
  } catch {
    return null;
  }
}

function reject(reason: PointRejectReason, msg: string): PointAwardRejectedError {
  return new PointAwardRejectedError(reason, msg);
}

async function ensureFullReaction(
  r: MessageReaction | PartialMessageReaction,
): Promise<MessageReaction | null> {
  if (!r.partial) return r;
  try {
    return await r.fetch();
  } catch {
    return null;
  }
}

async function ensureFullUser(u: User | PartialUser): Promise<User | null> {
  if (!u.partial) return u;
  try {
    return await u.fetch();
  } catch {
    return null;
  }
}

export function emojiKey(reaction: MessageReaction | PartialMessageReaction): string {
  if (reaction.emoji.id) {
    return `${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name ?? ''}:${reaction.emoji.id}`;
  }
  return reaction.emoji.name ?? '';
}

export function emojiMatches(
  reaction: MessageReaction | PartialMessageReaction,
  configured: string,
): boolean {
  const direct = emojiKey(reaction);
  if (direct === configured) return true;
  if (reaction.emoji.name === configured) return true;
  // Allow configured strings like <:name:id> or <a:name:id> (Discord raw form).
  const m = configured.match(/^<a?:([^:]+):(\d+)>$/);
  if (m && reaction.emoji.id === m[2]) return true;
  return false;
}

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err) && typeof err === 'object' && (err as { code?: string }).code === '23505';
}

// Re-export the budget query for callers that want to read remaining budget
// without awarding.
export { getRemainingBudget } from './budget.js';
