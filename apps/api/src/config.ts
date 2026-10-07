/**
 * The API's configuration, from the environment (`.env` at the repo root in
 * development, the container's env file on the server). Discord login is
 * optional: without a client id and secret the login card says it is not set
 * up (and, outside production, the dev test players still work), so a server
 * can go up before its secrets are in place.
 */
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** Repo root in development; `/app` in the container (same layout). */
export const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  /** Where players open the game; the OAuth redirect and cookies are built from it. */
  PUBLIC_URL: z.url().default("http://localhost:5173"),
  DISCORD_CLIENT_ID: z.string().min(1).optional(),
  DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
  // Not DATABASE_PATH: that one is the Discord bot's database in the same .env.
  GAME_DATABASE_PATH: z.string().min(1).default("var/wipeday.db"),
  BACKUP_DIR: z.string().min(1).default("var/backups"),
  WEB_DIST: z.string().min(1).default("apps/web/dist"),
  /** The admin routes' bearer token (W7: announcing and ending seasons). Unset: dev only. */
  ADMIN_TOKEN: z.string().min(16).optional(),
  /** The Discord bot's bearer token for `/api/bot/*` (W8). Unset: dev only. */
  BOT_API_TOKEN: z.string().min(32).optional(),
});

export interface Config {
  production: boolean;
  port: number;
  publicUrl: string;
  discord: { clientId: string; clientSecret: string } | null;
  databasePath: string;
  backupDir: string;
  webDist: string;
  /** The passwordless test login (dev only, never in production). */
  devLogin: boolean;
  /** Bearer token for `/api/admin/*`; null leaves them to development only. */
  adminToken: string | null;
  /** Bearer token for `/api/bot/*`; null leaves them to development only. */
  botToken: string | null;
}

const fromRoot = (path: string) => (isAbsolute(path) ? path : join(ROOT, path));

export function loadConfig(env: NodeJS.ProcessEnv = process.env, root = ROOT): Config {
  const envFile = join(root, ".env");
  if (env === process.env && existsSync(envFile)) process.loadEnvFile(envFile);
  // An empty `KEY=` line in .env means "not set".
  const clean = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
  const parsed = schema.safeParse(clean);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`API configuration is invalid:\n${lines.join("\n")}`);
  }
  const data = parsed.data;
  const production = data.NODE_ENV === "production";
  const discord =
    data.DISCORD_CLIENT_ID && data.DISCORD_CLIENT_SECRET
      ? { clientId: data.DISCORD_CLIENT_ID, clientSecret: data.DISCORD_CLIENT_SECRET }
      : null;
  return {
    production,
    port: data.API_PORT,
    publicUrl: data.PUBLIC_URL.replace(/\/$/, ""),
    discord,
    databasePath: fromRoot(data.GAME_DATABASE_PATH),
    backupDir: fromRoot(data.BACKUP_DIR),
    webDist: fromRoot(data.WEB_DIST),
    devLogin: !production,
    adminToken: data.ADMIN_TOKEN ?? null,
    botToken: data.BOT_API_TOKEN ?? null,
  };
}
