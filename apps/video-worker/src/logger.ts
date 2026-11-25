// Structured logs: one JSON object per line on stdout (stderr for errors), easy to grep locally
// and to filter with `docker compose logs`. Never pass secrets in `fields`.

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function isLevel(value: string | undefined): value is LogLevel {
  return value !== undefined && value in order;
}

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

export type Logger = {
  [Level in LogLevel]: (message: string, fields?: LogFields) => void;
} & { child: (fields: LogFields) => Logger };

export function createLogger(
  base: LogFields = {},
  minLevel: LogLevel = isLevel(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : "info",
): Logger {
  const write = (level: LogLevel, message: string, fields: LogFields = {}) => {
    if (order[level] < order[minLevel]) return;
    const entry: LogFields = { time: new Date().toISOString(), level, message, ...base };
    for (const [key, value] of Object.entries(fields)) entry[key] = serialize(value);
    const line = `${JSON.stringify(entry)}\n`;
    if (level === "error") process.stderr.write(line);
    else process.stdout.write(line);
  };

  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
    child: (fields) => createLogger({ ...base, ...fields }, minLevel),
  };
}
