import { askCommand } from './ask.js';
import { stewConfigCommand } from './stew-config.js';
import { leaderboardCommand } from './leaderboard.js';
import { pointsCommand } from './points.js';
import { adminPointsCommand } from './admin-points.js';
import { askMessageContextCommand } from '../contextMenus/ask-message.js';
import type { AnyCommand, SlashCommand, MessageContextCommand } from './types.js';

const SLASH: SlashCommand[] = [askCommand, stewConfigCommand, leaderboardCommand, pointsCommand, adminPointsCommand];
const MSG_CTX: MessageContextCommand[] = [askMessageContextCommand];

export function getSlashCommandByName(name: string): SlashCommand | undefined {
  return SLASH.find((c) => c.data.name === name);
}

export function getMessageContextByName(name: string): MessageContextCommand | undefined {
  return MSG_CTX.find((c) => c.data.name === name);
}

export const ALL_COMMANDS: AnyCommand[] = [...SLASH, ...MSG_CTX];
