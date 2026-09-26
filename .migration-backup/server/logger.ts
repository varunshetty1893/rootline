/**
 * Standard structured logger for Rootline.
 * Prevents side-effect logs during module imports and formats logs with timestamp and level.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "test" ? "error" : "info");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export const logger = {
  debug(message: string, ...meta: any[]) {
    if (shouldLog("debug")) {
      console.debug(`[${new Date().toISOString()}] [DEBUG] [Rootline] ${message}`, ...meta);
    }
  },
  info(message: string, ...meta: any[]) {
    if (shouldLog("info")) {
      console.info(`[${new Date().toISOString()}] [INFO] [Rootline] ${message}`, ...meta);
    }
  },
  warn(message: string, ...meta: any[]) {
    if (shouldLog("warn")) {
      console.warn(`[${new Date().toISOString()}] [WARN] [Rootline] ${message}`, ...meta);
    }
  },
  error(message: string, ...meta: any[]) {
    if (shouldLog("error")) {
      console.error(`[${new Date().toISOString()}] [ERROR] [Rootline] ${message}`, ...meta);
    }
  },
};
