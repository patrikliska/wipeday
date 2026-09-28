/**
 * The API process: load and validate content, open the database, start the
 * minute scheduler (which also runs once at boot, so everything that ended
 * while the server was down lands at once) and serve HTTP.
 */
import { serve } from "@hono/node-server";
import { loadGame } from "@wipe-day/content/load";
import { systemClock } from "@wipe-day/domain/clock";
import { createApp } from "./app";
import { discordAuth } from "./auth";
import { backupOnce } from "./backup";
import { loadConfig } from "./config";
import { Game } from "./game";
import { EventHub } from "./hub";
import { log } from "./log";
import { openDb } from "./store/db";

const TICK_MS = 60_000;

const config = loadConfig();
const clock = systemClock;
const { content } = loadGame((key) => log.warn("missing locale key", { key }));
const db = openDb(config.databasePath);
const hub = new EventHub();
const game = new Game({ db, content, clock, hub });
const discord = config.discord
  ? discordAuth(
      config.discord.clientId,
      config.discord.clientSecret,
      `${config.publicUrl}/api/auth/callback`,
    )
  : null;
const app = createApp({ db, game, hub, clock, config, discord });
if (!discord)
  log.warn("Discord login is not configured: set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET");

const tick = () => {
  try {
    const changed = game.tick();
    if (changed.length > 0) log.info("scheduler: settled bases", { players: changed.length });
  } catch (error) {
    log.error("scheduler failed", { error: (error as Error).message });
  }
  if (config.production) {
    backupOnce(db, config.backupDir, clock.now())
      .then((file) => file && log.info("backup written", { file }))
      .catch((error: Error) => log.error("backup failed", { error: error.message }));
  }
};
tick();
setInterval(tick, TICK_MS);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  log.info("api listening", {
    port: info.port,
    login: discord ? "discord" : config.devLogin ? "dev only" : "none",
    devLogin: config.devLogin,
    resources: content.resources.length,
  });
});
