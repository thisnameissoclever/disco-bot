import { Events, type Client } from 'discord.js';
import type { Db } from '../../db/client.js';
import { schema } from '../../db/client.js';
import { eq } from 'drizzle-orm';
import type { AssistantRegistry } from '../../assistants/registry.js';
import { respondAsAssistant } from '../orchestrator.js';
import { isDiscoError } from '../../util/errors.js';
import { getValue } from '../../config/service.js';
import { isThread } from '../context/thread-helpers.js';
import { childLogger } from '../../util/logger.js';

const log = childLogger({ component: 'event.messageCreate' });

export function registerMessageCreate(
  client: Client,
  db: Db,
  registry: AssistantRegistry,
): void {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.inGuild()) return;
      const me = client.user;
      if (!me) return;

      const mentioned = message.mentions.has(me, { ignoreEveryone: true, ignoreRoles: false });

      // Two trigger paths: explicit mention, or thread continuation when the
      // bot is already participating in this thread.
      let assistantId: string | undefined;
      let trigger: 'mention' | 'thread_continuation' | null = null;

      if (mentioned) {
        trigger = 'mention';
        assistantId = await resolveMentionedAssistant(db, registry, message.guildId!, message.content);
      } else if (isThread(message.channel)) {
        const existing = await db
          .select()
          .from(schema.conversations)
          .where(eq(schema.conversations.threadId, message.channelId));
        if (existing[0]) {
          trigger = 'thread_continuation';
          assistantId = existing[0].assistantId;
        }
      }

      if (!trigger || !assistantId) return;
      const assistant = registry.get(assistantId);
      if (!assistant) return;
      if (!assistant.allowedInvocationModes.includes(trigger)) return;

      await respondAsAssistant({
        client,
        db,
        registry,
        assistant,
        guildId: message.guildId!,
        userId: message.author.id,
        source: { kind: 'message', message },
      });
    } catch (err) {
      if (isDiscoError(err)) {
        try {
          await message.reply(err.userMessage);
        } catch {}
        return;
      }
      log.error({ err }, 'messageCreate failed');
    }
  });
}

async function resolveMentionedAssistant(
  db: Db,
  registry: AssistantRegistry,
  guildId: string,
  content: string,
): Promise<string | undefined> {
  const enabled = await getValue<string[]>(db, guildId, 'enabled_assistants');
  const candidates = enabled.length > 0
    ? enabled.map((id) => registry.get(id)).filter((a): a is NonNullable<typeof a> => Boolean(a))
    : registry.list();

  if (candidates.length === 0) return undefined;

  // If the message names an assistant explicitly ("@bot servicenow ..." or
  // "@bot ServiceNow Development ..."), prefer that match.
  const lower = content.toLowerCase();
  for (const c of candidates) {
    if (lower.includes(c.id.toLowerCase()) || lower.includes(c.displayName.toLowerCase())) {
      return c.id;
    }
  }
  // Otherwise default to the first enabled assistant.
  return candidates[0]!.id;
}
