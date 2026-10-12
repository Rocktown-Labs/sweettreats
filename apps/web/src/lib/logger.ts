// @ts-expect-error pino/browser declaration
import pino from "pino/browser";

type LogLevel = "info" | "warn" | "error";
type LogMeta = Record<string, unknown>;

function logLevel() {
  if (typeof process === "undefined") {
    return "info";
  }

  return process.env.LOG_LEVEL || "info";
}

export const pinoLogger = pino({
  base: {
    app: "sweettreats-web",
  },
  browser: {
    asObject: true,
  },
  level: logLevel(),
});

function write(level: LogLevel, event: string, meta: LogMeta = {}) {
  pinoLogger[level]({ event, ...meta });
}

export const logger = {
  info: (event: string, meta?: LogMeta) => write("info", event, meta),
  warn: (event: string, meta?: LogMeta) => write("warn", event, meta),
  error: (event: string, meta?: LogMeta) => write("error", event, meta),
};
