/**
 * Slash commands and the component router: the only module that talks to
 * discord.js interactions. Screens stay plain data (`ui/screen`); this file
 * sends them and keeps the one home message per player in order.
 */
import {
  AttachmentBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  ComponentType,
  GuildMember,
  type Interaction,
  type InteractionEditReplyOptions,
  MessageFlags,
  PermissionFlagsBits,
  type RepliableInteraction,
  SlashCommandBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { App } from "../app";
import {
  collectAction,
  gatherAction,
  type Loaded,
  loadPlayer,
  startPlayer,
  upgradeToolAction,
} from "../game/actions";
import { log } from "../log";
import { baseCard } from "../render/cards/base";
import { baseFixtures } from "../render/fixtures/base";
import { homeMessagesRepo } from "../store/repo";
import { allows, type DebugState, parseCustomId, type Route } from "./customId";
import { type Screen, toComponents } from "./screen";
import { type BaseScreenInput, baseCardProps, baseScreen, type LastAction } from "./screens/base";
import { debugCardScreen } from "./screens/debugCard";
import { toolsDoneScreen, toolsScreen } from "./screens/tools";

type ComponentInteraction = ButtonInteraction | StringSelectMenuInteraction;

/** Registered to the one guild at startup, so changes appear instantly. */
export const commands = [
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("Build your base and start playing Wipe Day")
    .toJSON(),
  new SlashCommandBuilder().setName("base").setDescription("Open your base").toJSON(),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("What Wipe Day is, in three lines")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("idle-debug")
    .setDescription("Wipe Day diagnostics (admins only)")
    .addSubcommand((sub) =>
      sub.setName("card").setDescription("Render the base card to check the image pipeline"),
    )
    .toJSON(),
];

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** A screen as a message payload: Components V2 tree plus the card as an attachment. */
function toMessage(screen: Screen): InteractionEditReplyOptions {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [toComponents(screen)],
    files: screen.card
      ? [new AttachmentBuilder(screen.card.png, { name: screen.card.fileName })]
      : [],
    // Drop the previous card; only the new attachment is referenced.
    attachments: [],
  };
}

/** A screen as a new ephemeral reply (sub-screens only concern the player). */
function toEphemeral(screen: Screen) {
  return {
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    components: [toComponents(screen)],
    files: screen.card
      ? [new AttachmentBuilder(screen.card.png, { name: screen.card.fileName })]
      : [],
  } as const;
}

/** One private sentence, as Components V2 like everything else. */
function notice(text: string) {
  return {
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    components: [{ type: ComponentType.TextDisplay as const, content: text }],
  } as const;
}

function displayNameOf(interaction: RepliableInteraction): string {
  return interaction.member instanceof GuildMember
    ? interaction.member.displayName
    : interaction.user.displayName;
}

/**
 * Admin-only commands stay visible to everyone (no hidden features) and refuse
 * politely. Server Administrators qualify, as does the configured admin role.
 */
function isAdmin(app: App, interaction: ChatInputCommandInteraction): boolean {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roleId = app.config.adminRoleId;
  if (!roleId || !interaction.member) return false;
  const roles = interaction.member.roles;
  // A cached GuildMember carries a role manager; a raw API member carries ids.
  return Array.isArray(roles) ? roles.includes(roleId) : roles.cache.has(roleId);
}

// --- the home message -------------------------------------------------------

async function renderBase(
  app: App,
  loaded: Loaded,
  now: number,
  last?: LastAction,
): Promise<Screen> {
  const props = baseCardProps(
    app,
    loaded.player.displayName,
    loaded.state,
    loaded.seasonStartedAt,
    now,
  );
  const rendered = await app.renderer.render(baseCard, props);
  const input: BaseScreenInput = {
    ownerId: loaded.player.discordId,
    playerName: loaded.player.displayName,
    state: loaded.state,
    seasonStartedAt: loaded.seasonStartedAt,
    now,
    hintUses: loaded.hintUses,
    card: rendered.png,
    ...(last ? { last } : {}),
  };
  return baseScreen(app, input);
}

/**
 * `/start` and `/base`: the home message is (re)posted where the command was
 * used and the previous one is removed, so there is never more than one.
 */
async function postHome(app: App, interaction: ChatInputCommandInteraction): Promise<void> {
  const now = nowSeconds();
  await interaction.deferReply();
  const loaded = startPlayer(app, interaction.user.id, displayNameOf(interaction), now);
  const message = await interaction.editReply(toMessage(await renderBase(app, loaded, now)));

  const previous = homeMessagesRepo.get(app.db, loaded.player.id);
  homeMessagesRepo.set(
    app.db,
    loaded.player.id,
    { channelId: message.channelId, messageId: message.id },
    now,
  );
  if (previous && previous.messageId !== message.id) {
    await deleteMessage(interaction.client, previous.channelId, previous.messageId);
  }
}

async function deleteMessage(client: Client, channelId: string, messageId: string): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased()) await channel.messages.delete(messageId);
  } catch (error) {
    log.warn("could not delete the previous home message", {
      messageId,
      error: (error as Error).message,
    });
  }
}

/** Re-renders the stored home message after a change made from an ephemeral screen. */
async function refreshHome(
  app: App,
  client: Client,
  loaded: Loaded,
  now: number,
  last?: LastAction,
): Promise<void> {
  const home = homeMessagesRepo.get(app.db, loaded.player.id);
  if (!home) return;
  try {
    const channel = await client.channels.fetch(home.channelId);
    if (!channel?.isTextBased()) return;
    await channel.messages.edit(
      home.messageId,
      toMessage(await renderBase(app, loaded, now, last)),
    );
  } catch (error) {
    log.warn("home message is gone, forgetting it", {
      messageId: home.messageId,
      error: (error as Error).message,
    });
    homeMessagesRepo.clear(app.db, loaded.player.id);
  }
}

// --- commands ----------------------------------------------------------------

async function showDebugCard(app: App, state: DebugState): Promise<Screen> {
  const fixture = baseFixtures.find((candidate) => candidate.state === state);
  if (!fixture) throw new Error(`no base fixture for state ${state}`);
  const rendered = await app.renderer.render(baseCard, fixture.props);
  return debugCardScreen(app.locale, { state, rendered, assets: app.assets.counts() });
}

async function onCommand(app: App, interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case "start":
    case "base":
      await postHome(app, interaction);
      return;
    case "help":
      await interaction.reply(
        notice(`## ${app.locale.t("screen.help.title")}\n${app.locale.t("screen.help.body")}`),
      );
      return;
    case "idle-debug":
      if (!isAdmin(app, interaction)) {
        await interaction.reply(notice(app.locale.t("error.admin_only")));
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.editReply(toMessage(await showDebugCard(app, "normal")));
      return;
  }
}

// --- components --------------------------------------------------------------

async function onBaseRoute(
  app: App,
  interaction: ComponentInteraction,
  loaded: Loaded,
  action: Extract<Route, { screen: "base" }>["action"],
): Promise<void> {
  const now = nowSeconds();
  if (action === "tools") {
    await interaction.reply(toEphemeral(toolsScreen(app, loaded.state)));
    return;
  }
  await interaction.deferUpdate();
  let last: LastAction | undefined;
  if (action === "collect") {
    last = { kind: "collect", gained: collectAction(app, loaded.player.id, now).gained };
  } else if (action === "gather") {
    const result = gatherAction(app, loaded.player.id, now);
    last = result.ok
      ? { kind: "gather", gained: result.gained, bonus: result.bonus }
      : { kind: "cooldown", readyAt: result.readyAt };
  }
  const fresh = loadPlayer(app, interaction.user.id, now) ?? loaded;
  await interaction.editReply(toMessage(await renderBase(app, fresh, now, last)));
}

async function onToolsRoute(
  app: App,
  interaction: ComponentInteraction,
  loaded: Loaded,
  action: Extract<Route, { screen: "tools" }>["action"],
): Promise<void> {
  const now = nowSeconds();
  await interaction.deferUpdate();
  switch (action) {
    case "back":
      await interaction.editReply(toMessage(toolsScreen(app, loaded.state)));
      return;
    case "home":
      await interaction.deleteReply();
      await refreshHome(app, interaction.client, loaded, now);
      return;
    case "upgrade": {
      const result = upgradeToolAction(app, loaded.player.id, now);
      if (!result.ok) {
        // Stale screen (already upgraded, or spent meanwhile): show the current truth.
        const fresh = loadPlayer(app, interaction.user.id, now) ?? loaded;
        await interaction.editReply(toMessage(toolsScreen(app, fresh.state)));
        return;
      }
      await interaction.editReply(toMessage(toolsDoneScreen(app, result.tool, result.paid)));
      const fresh = loadPlayer(app, interaction.user.id, now) ?? loaded;
      await refreshHome(app, interaction.client, fresh, now, {
        kind: "upgrade",
        toolId: result.tool.id,
      });
      return;
    }
  }
}

async function onComponent(app: App, interaction: ComponentInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (parsed.kind === "foreign") return;
  if (parsed.kind === "unknown") {
    await interaction.reply(notice(app.locale.t("error.stale_message")));
    return;
  }
  if (!allows(parsed.id, interaction.user.id)) {
    await interaction.reply(notice(app.locale.t("error.not_your_message")));
    return;
  }
  const { route } = parsed.id;
  if (route.screen === "debug") {
    await interaction.deferUpdate();
    await interaction.editReply(toMessage(await showDebugCard(app, route.state)));
    return;
  }
  const loaded = loadPlayer(app, interaction.user.id, nowSeconds());
  if (!loaded) {
    await interaction.reply(notice(app.locale.t("error.no_base")));
    return;
  }
  if (route.screen === "base") await onBaseRoute(app, interaction, loaded, route.action);
  else await onToolsRoute(app, interaction, loaded, route.action);
}

/** The single entry point wired to `interactionCreate`. Never throws. */
export async function handleInteraction(app: App, interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      log.info("command", { name: interaction.commandName, user: interaction.user.tag });
      await onCommand(app, interaction);
    } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
      log.info("component", { customId: interaction.customId, user: interaction.user.tag });
      await onComponent(app, interaction);
    }
  } catch (error) {
    log.error("interaction failed", {
      id: interaction.id,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
    if (!interaction.isRepliable()) return;
    const message = notice(app.locale.t("error.unexpected"));
    await (interaction.deferred || interaction.replied
      ? interaction.followUp(message)
      : interaction.reply(message)
    ).catch(() => {});
  }
}
