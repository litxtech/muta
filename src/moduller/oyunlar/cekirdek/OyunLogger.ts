/**
 * Merkezi oyun logger — [oyunlar] öneki.
 */

type LogMeta = Record<string, unknown>;

function format(level: string, message: string, meta?: LogMeta): string {
  const base = `[oyunlar] ${level}: ${message}`;
  if (!meta || Object.keys(meta).length === 0) return base;
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch {
    return base;
  }
}

export const GameLogger = {
  info(message: string, meta?: LogMeta): void {
    console.log(format('info', message, meta));
  },
  warn(message: string, meta?: LogMeta): void {
    console.warn(format('warn', message, meta));
  },
  error(message: string, meta?: LogMeta): void {
    console.error(format('error', message, meta));
  },
} as const;

export const OyunLogger = GameLogger;
