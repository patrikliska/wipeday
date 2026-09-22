/** `pnpm start` / `pnpm dev`: the bot process. */
import { Client, Events, GatewayIntentBits } from "discord.js";
import { type App, loadStatic } from "../app";
import { type EmojiApi, Emojis, syncEmojis } from "../assets/emojiSync";
import { loadConfig } from "../config";
import { log } from "../log";
import { discoverPaths } from "../paths";
import { openDb } from "../store/db";
import { commands, handleInteraction } from "../ui/interactions";

async function main(): Promise<void> {
  const paths = discoverPaths();
  const config = loadConfig(paths.root);
  const app: App = {
    paths,
    config,
    ...loadStatic(paths),
    db: openDb(config.databasePath, paths.migrations),
    emojis: new Emojis(),
  };
  app.assets.logSummary();

  // Interactions arrive over the gateway without any privileged intent.
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async (ready) => {
    log.info("logged in", { user: ready.user.tag });
    try {
      await ready.application.commands.set(commands, config.guildId);
      log.info("slash commands registered", { guild: config.guildId, count: commands.length });
    } catch (error) {
      log.error("could not register slash commands: is the bot in the guild?", {
        guild: config.guildId,
        error: (error as Error).message,
      });
    }

    const manager = ready.application.emojis;
    const api: EmojiApi = {
      list: async () =>
        (await manager.fetch()).map((emoji) => ({ id: emoji.id, name: emoji.name ?? "" })),
      create: async (name, png) => {
        const emoji = await manager.create({ attachment: png, name });
        return { id: emoji.id, name: emoji.name ?? name };
      },
      delete: async (id) => {
        await manager.delete(id);
      },
    };
    app.emojis = await syncEmojis(api, app.assets, app.db, Math.floor(Date.now() / 1000));
  });

  client.on(Events.InteractionCreate, (interaction) => void handleInteraction(app, interaction));

  const stop = () => {
    log.info("shutting down");
    void client.destroy().finally(() => process.exit(0));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await client.login(config.token);
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
