import { EmbedBuilder } from 'discord.js';
import type { UserLeaderboardRow } from './users.js';
import type { MessageLeaderboardRow } from './messages.js';

export function renderUserLeaderboard(
  rows: UserLeaderboardRow[],
  windows: number[],
): EmbedBuilder {
  const lines = rows.length === 0
    ? ['_No points awarded yet._']
    : rows.map((row, index) => {
        const windowParts = windows.map((d) => `${d}d:${row.windows[d] ?? 0}`).join(' • ');
        return `**${index + 1}.** <@${row.userId}> - ${row.total} total (${windowParts})`;
      });
  return new EmbedBuilder()
    .setTitle('User leaderboard')
    .setDescription(lines.join('\n'))
    .setColor(0x2ecc71);
}

export function renderMessageLeaderboard(
  rows: MessageLeaderboardRow[],
  windowDays: number,
): EmbedBuilder {
  const lines = rows.length === 0
    ? ['_No helpful messages yet._']
    : rows.map((row, i) => {
        const preview = row.preview ? `: ${row.preview}` : '';
        return `**${i + 1}.** [${row.points} pts](${row.jumpUrl}) - by <@${row.authorUserId ?? '0'}>${preview}`;
      });
  return new EmbedBuilder()
    .setTitle(`Helpful messages - last ${windowDays}d`)
    .setDescription(lines.join('\n'))
    .setColor(0x9b59b6);
}
