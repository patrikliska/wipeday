/**
 * The only module that talks to discord.js: the `/base` command, the button router, DMs and
 * the feed channel. Screens stay plain data (`ui/screen`). The bot's one command is Collect
 * (06-friends.md 10.3), keyed by the interaction id so a double click runs once; the API
 * refuses everything else (`not_on_discord`).
 *
 * `/base` answers privately (ephemeral), updated in place by its buttons. A DM's "Show my
 * island" answers with the same message.
 */
import type { FeedItem } from "@wipe-day/domain/feed";
import { nightShiftGlance } from "@wipe-day/domain/glance";
import type { DmNote } from "@wipe-day/domain/wire";
import {
  AttachmentBuilder,
  type ButtonInteraction,
  type Client,
  ComponentType,
  type Interaction,
  type InteractionEditReplyOptions,
  MessageFlags,
  type SendableChannels,
  SlashCommandBuilder,
  type User,
} from "discord.js";
import { type Api, ApiError, type DiscordUser } from "../api";
import { log } from "../log";
import { allows, parseCustomId, type Route } from "./customId";
import { homeScreen, type Last, type Lexicon } from "./home";
import { feedMessages, noteScreen } from "./island";
import { type Screen, toComponents } from "./screen";

export interface Bot {
  api: Api;
  lexicon: Lexicon;
}

/** The one slash command, registered to the guild at startup (so changes show at once). */
export function commandsOf(lexicon: Lexicon) {
  return [
    new SlashCommandBuilder()
      .setName("base")
      .setDescription(lexicon.words.t("discord.command"))
      .toJSON(),
  ];
}

/** A screen as a message: the Components V2 tree, plus the card as an attachment. */
export function toMessage(screen: Screen, card?: { png: Buffer; name: string }) {
  return {
    flags: MessageFlags.IsComponentsV2 as const,
    components: [toComponents(screen)],
    files: card ? [new AttachmentBuilder(card.png, { name: card.name })] : [],
  };
}

/** One private sentence, as Components V2 like everything else. */
function notice(text: string) {
  return {
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    components: [{ type: ComponentType.TextDisplay as const, content: text }],
  } as const;
}

/** The player behind an interaction, named as the web's Discord login names them. */
export function userOf(user: User): DiscordUser {
  return {
    id: user.id,
    name: user.displayName,
    avatarUrl: user.avatarURL({ extension: "png", size: 128 }),
  };
}

/** The `/base` message for `user`, after `last`. */
export async function baseMessage(
  bot: Bot,
  user: DiscordUser,
  last?: Last,
): Promise<InteractionEditReplyOptions> {
  const home = await bot.api.home(user);
  // Card v2 is text (D271): drop any picture an older message carried.
  return { ...toMessage(homeScreen(bot.lexicon, home, last)), attachments: [] };
}

/** Runs a `/base` button and says what happened (nothing, for Refresh). */
async function runBase(
  bot: Bot,
  user: DiscordUser,
  action: Extract<Route, { screen: "base" }>["action"],
  interactionId: string,
): Promise<Last | undefined> {
  switch (action) {
    case "collect": {
      // What the hands made since the last command, read before Collect restarts the window.
      const before = await bot.api.home(user);
      const shift = nightShiftGlance(bot.lexicon.content, before.state, before.serverNow);
      const response = await bot.api.command(user, `discord:${interactionId}`, {
        type: "collect",
      });
      if (!response.ok) return undefined;
      return {
        kind: "collected",
        seconds: shift.used,
        gain: Math.max(0, before.state.run.made - before.state.run.madeAtActive),
        hands: before.state.run.hands.length,
      };
    }
    case "dm_on":
    case "dm_off": {
      const on = action === "dm_on";
      await bot.api.setDm(user, on);
      return { kind: "dm", on };
    }
    case "refresh":
      return undefined;
  }
}

async function onButton(bot: Bot, interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (parsed.kind === "foreign") return;
  const t = bot.lexicon.words.t;
  const user = userOf(interaction.user);

  if (parsed.kind === "unknown") {
    // A button from the old bot: show the base as it is now, in its place.
    await interaction.deferUpdate();
    await interaction.editReply(await baseMessage(bot, user, { kind: "stale" }));
    return;
  }
  const { id } = parsed;
  if (!allows(id, interaction.user.id)) {
    await interaction.reply(notice(t("discord.status.stale")));
    return;
  }

  if (id.route.screen === "note") {
    if (id.route.action === "dm_off") {
      await bot.api.setDm(user, false);
      await interaction.reply(notice(t("discord.dm_sent_off")));
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(await baseMessage(bot, user));
    return;
  }

  await interaction.deferUpdate();
  const last = await runBase(bot, user, id.route.action, interaction.id);
  await interaction.editReply(await baseMessage(bot, user, last));
}

/** Every interaction lands here; nothing throws past it. */
export async function handleInteraction(bot: Bot, interaction: Interaction): Promise<void> {
  const t = bot.lexicon.words.t;
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "base") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.editReply(await baseMessage(bot, userOf(interaction.user)));
    } else if (interaction.isButton()) {
      await onButton(bot, interaction);
    }
  } catch (error) {
    const offline = error instanceof ApiError;
    log[offline ? "warn" : "error"]("interaction failed", {
      user: interaction.user.id,
      error: (error as Error).message,
    });
    if (!interaction.isRepliable()) return;
    const text = t(offline ? "discord.status.offline" : "discord.error");
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp(notice(text));
      else await interaction.reply(notice(text));
    } catch {
      // The interaction expired meanwhile; nothing more to say.
    }
  }
}

/**
 * What the API's stream brings: feed items to the channel (then acked, so a restart never
 * posts them twice or skips them) and DMs to players.
 */
export class Island {
  private channel: SendableChannels | null = null;
  /** Feed items already posted, by id: a reconnect may bring one twice. */
  private posted = 0;

  constructor(
    private readonly bot: Bot,
    private readonly client: Client,
    private readonly channelId: string | null,
  ) {}

  private async feedChannel(): Promise<SendableChannels | null> {
    if (!this.channelId) return null;
    if (this.channel) return this.channel;
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel?.isSendable()) {
      log.error("FEED_CHANNEL_ID is not a channel the bot can post in", { id: this.channelId });
      return null;
    }
    this.channel = channel;
    return channel;
  }

  async feed(items: FeedItem[], now: number): Promise<void> {
    const fresh = items.filter((item) => item.id > this.posted);
    const channel = await this.feedChannel();
    if (!channel || fresh.length === 0) return;
    for (const content of feedMessages(this.bot.lexicon.words, fresh, now))
      await channel.send({ content, allowedMentions: { parse: [] } });
    this.posted = Math.max(this.posted, ...fresh.map((item) => item.id));
    await this.bot.api.ackFeed(this.posted);
  }

  async dm(note: DmNote): Promise<void> {
    try {
      const user = await this.client.users.fetch(note.discordId);
      await user.send(toMessage(noteScreen(this.bot.lexicon.words, note)));
    } catch (error) {
      // Closed DMs or a user who left: nothing to do but note it.
      log.warn("dm not delivered", { user: note.discordId, error: (error as Error).message });
    }
  }
}
