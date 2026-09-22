/** Runtime configuration from the environment (`.env` in development). */
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { z } from "zod";

const snowflake = z
  .string({ error: "is missing" })
  .regex(/^\d{17,20}$/, "must be a Discord id (17 to 20 digits)");

const schema = z.object({
  DISCORD_TOKEN: z.string({ error: "is missing: the bot token from the developer portal" }).min(1),
  DISCORD_GUILD_ID: snowflake,
  /** Used from Phase 3. */
  FEED_CHANNEL_ID: snowflake.optional(),
  /** Members with this role may use admin commands, besides server Administrators. */
  ADMIN_ROLE_ID: snowflake.optional(),
  DATABASE_PATH: z.string().min(1).default("var/wipe-day.db"),
});

export interface Config {
  token: string;
  guildId: string;
  feedChannelId: string | undefined;
  adminRoleId: string | undefined;
  databasePath: string;
}

/** Reads `.env` (if present) and validates. Throws one error listing every problem. */
export function loadConfig(root: string): Config {
  const envFile = join(root, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  // An empty `FEED_CHANNEL_ID=` line in .env means "not set", not "invalid".
  const env = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ""));
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join(".")} ${issue.message}`,
    );
    throw new Error(
      `configuration is incomplete (copy .env.example to .env and fill it in):\n${lines.join("\n")}`,
    );
  }
  const { DISCORD_TOKEN, DISCORD_GUILD_ID, FEED_CHANNEL_ID, ADMIN_ROLE_ID, DATABASE_PATH } =
    parsed.data;
  return {
    token: DISCORD_TOKEN,
    guildId: DISCORD_GUILD_ID,
    feedChannelId: FEED_CHANNEL_ID,
    adminRoleId: ADMIN_ROLE_ID,
    databasePath: isAbsolute(DATABASE_PATH) ? DATABASE_PATH : join(root, DATABASE_PATH),
  };
}
