import {
  Client,
  GatewayIntentBits,
  Partials,
  type ClientOptions,
} from 'discord.js';

export function createDiscordClient(): Client {
  const options: ClientOptions = {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
    ],
    // Reactions and messages may arrive for objects that are not cached
    // (especially on cold start). Partials let us still process them.
    partials: [
      Partials.Message,
      Partials.Reaction,
      Partials.User,
      Partials.Channel,
      Partials.GuildMember,
    ],
  };
  return new Client(options);
}
