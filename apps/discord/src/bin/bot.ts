/**
 * `pnpm start` / `pnpm bot:dev`: the Discord companion (W8). A thin client of the API: it
 * registers `/base`, answers buttons through the API's commands, and follows the API's
 * stream for the feed channel, DMs and season news. It keeps no state of its own.
 */
import { loadGame } from "@wipe-day/content/load";
import { systemClock } from "@wipe-day/domain/clock";
import type { FeedItem } from "@wipe-day/domain/feed";
import type { DmNote, SeasonNews } from "@wipe-day/domain/wire";
import { words } from "@wipe-day/domain/words";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { httpApi } from "../api";
import { loadConfig } from "../config";
import { log } from "../log";
import { Renderer } from "../render/renderer";
import { followStream } from "../stream";
import { type Bot, commandsOf, handleInteraction, Island } from "../ui/interactions";

async function main(): Promise<void> {
  const config = loadConfig();
  const { content, locale } = loadGame((key) => log.warn("missing locale key", { key }));
  const lexicon = { content, words: words(locale, content) };
  const bot: Bot = {
    api: httpApi(config.apiUrl, config.apiToken),
    lexicon,
    renderer: new Renderer({ locale }),
  };

  // Interactions arrive over the gateway without any privileged intent.
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  let stopStream = () => {};

  client.once(Events.ClientReady, async (ready) => {
    log.info("logged in", { user: ready.user.tag, api: config.apiUrl });
    try {
      // Replaces whatever the guild had (the old bot's commands go with it).
      await ready.application.commands.set(commandsOf(lexicon), config.guildId);
      log.info("slash commands registered", { guild: config.guildId });
    } catch (error) {
      log.error("could not register slash commands: is the bot in the guild?", {
        guild: config.guildId,
        error: (error as Error).message,
      });
    }
    if (!config.feedChannelId) log.warn("FEED_CHANNEL_ID is not set: no feed or season news");

    const island = new Island(bot, client, config.feedChannelId);
    const follow = followStream(bot.api.stream, async ({ event, data }) => {
      if (event === "feed") await island.feed(JSON.parse(data) as FeedItem[], systemClock.now());
      else if (event === "dm") await island.dm(JSON.parse(data) as DmNote);
      else if (event === "news") await island.news(JSON.parse(data) as SeasonNews);
    });
    stopStream = follow.stop;
  });

  client.on(Events.InteractionCreate, (interaction) => void handleInteraction(bot, interaction));

  const stop = () => {
    log.info("shutting down");
    stopStream();
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
