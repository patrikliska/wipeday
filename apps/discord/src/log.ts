/** The one place that writes to the console. Structured: message + fields. */

type Fields = Record<string, unknown>;

function write(level: "info" | "warn" | "error", message: string, fields?: Fields): void {
  const suffix = fields && Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : "";
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}${suffix}`;
  // biome-ignore lint/suspicious/noConsole: this module is the logger.
  (level === "info" ? console.log : console.error)(line);
}

export const log = {
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};
