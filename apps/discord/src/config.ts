/**
 * The bot's configuration, from the environment (`.env` at the repo root in development,
 * the container's env file on the server). The bot keeps no state of its own (W8): it
 * needs its Discord token, the guild for its slash command, and the API to talk to.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** `apps/discord`: the fonts live here. */
export const APP_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
/** The repo root in development (`.env`, `preview/`); `/app` in the container. */
export const ROOT = resolve(APP_DIR, "..", "..");

const snowflake = z
  .string({ error: "is missing" })
  .regex(/^\d{17,20}$/, "must be a Discord id (17 to 20 digits)");

const schema = z.object({
  DISCORD_TOKEN: z.string({ error: "is missing: the bot token from the developer portal" }).min(1),
  DISCORD_GUILD_ID: snowflake,
  /** Where the island's feed and season news are posted; without it, nothing is. */
  FEED_CHANNEL_ID: snowflake.optional(),
  /** The game server. In the container, the API's service name on the Docker network. */
  API_URL: z.url().default("http://localhost:8787"),
  /** The API's BOT_API_TOKEN; a development API takes the bot without one. */
  BOT_API_TOKEN: z.string().min(32).optional(),
});

export interface Config {
  token: string;
  guildId: string;
  feedChannelId: string | null;
  apiUrl: string;
  apiToken: string | null;
}

/** Reads `.env` (if present) and validates. Throws one error listing every problem. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, root = ROOT): Config {
  const envFile = join(root, ".env");
  if (env === process.env && existsSync(envFile)) process.loadEnvFile(envFile);
  // An empty `FEED_CHANNEL_ID=` line in .env means "not set", not "invalid".
  const clean = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
  const parsed = schema.safeParse(clean);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join(".")} ${issue.message}`,
    );
    throw new Error(`bot configuration is incomplete (see .env.example):\n${lines.join("\n")}`);
  }
  const data = parsed.data;
  return {
    token: data.DISCORD_TOKEN,
    guildId: data.DISCORD_GUILD_ID,
    feedChannelId: data.FEED_CHANNEL_ID ?? null,
    apiUrl: data.API_URL.replace(/\/$/, ""),
    apiToken: data.BOT_API_TOKEN ?? null,
  };
}
