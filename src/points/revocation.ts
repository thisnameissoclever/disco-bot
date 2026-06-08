import { and, eq, isNull } from 'drizzle-orm';
import type { Client, MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import type { Db } from '../db/client.js';
import { schema } from '../db/client.js';
import { getValue } from '../config/service.js';
import type { ReactionRemovalBehavior } from '../config/types.js';
import { childLogger } from '../util/logger.js';
import { emojiKey, emojiMatches } from './awards.js';
import { isWithinHours } from '../util/time.js';
import { logAuditEvent } from '../audit/log.js';

const log = childLogger({ component: 'points.revocation' });

export interface ProcessReactionRemoveInput {
  client: Client;
  db: Db;
  reaction: MessageReaction | PartialMessageReaction;
  user: User | PartialUser;
}

export async function processReactionRemove(input: ProcessReactionRemoveInput): Promise<void> {
  const { client, db, reaction, user } = input;

  if (user.id === client.user?.id) return;
  const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
  const guildId = message.guildId;
  if (!guildId) return;

  const configuredEmoji = await getValue<string>(db, guildId, 'point_award_emoji');
  if (!emojiMatches(reaction, configuredEmoji)) return;

  const behavior = await getValue<ReactionRemovalBehavior>(db, guildId, 'reaction_removal_behavior');
  if (behavior === 'never_revoke') return;

  const award = await db
    .select()
    .from(schema.pointAwards)
    .where(
      and(
        eq(schema.pointAwards.guildId, guildId),
        eq(schema.pointAwards.giverUserId, user.id),
        eq(schema.pointAwards.messageId, message.id),
        eq(schema.pointAwards.emoji, emojiKey(reaction)),
        isNull(schema.pointAwards.revokedAt),
      ),
    );
  if (!award[0]) return;

  if (behavior === 'revoke_within_1_hour' && !isWithinHours(award[0].awardedAt, new Date(), 1)) {
    return;
  }

  await db
    .update(schema.pointAwards)
    .set({ revokedAt: new Date(), revocationReason: 'reaction_removed' })
    .where(eq(schema.pointAwards.id, award[0].id));

  log.info(
    { guildId, giver: user.id, messageId: message.id },
    'point revoked due to reaction removal',
  );

  await logAuditEvent(
    db,
    {
      guildId,
      eventType: 'point_revoked',
      actorUserId: user.id,
      targetUserId: award[0].receiverUserId,
      payload: { messageId: message.id, channelId: message.channelId },
    },
    client,
  );
}
