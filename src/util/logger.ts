import { pino, type Logger } from 'pino';
import { loadEnv } from '../env.js';

let cachedLogger: Logger | undefined;

export function getLogger(): Logger {
  if (cachedLogger) return cachedLogger;
  const env = loadEnv();
  const isDev = env.NODE_ENV !== 'production';
  cachedLogger = pino({
    level: env.LOG_LEVEL,
    base: { service: 'disco-stew' },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname,service',
          },
        }
      : undefined,
  });
  return cachedLogger;
}

export function childLogger(bindings: Record<string, unknown>): Logger {
  return getLogger().child(bindings);
}
