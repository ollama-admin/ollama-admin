type LogLevel = "info" | "warn" | "error" | "debug";

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? " " + JSON.stringify(meta) : "";
  return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(formatLog("info", message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(formatLog("warn", message, meta));
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(formatLog("error", message, meta));
  },
  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.LOG_LEVEL === "debug") {
      console.log(formatLog("debug", message, meta));
    }
  },
};
