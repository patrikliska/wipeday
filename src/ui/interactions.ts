/**
 * Slash commands and the component router: the only module that talks to
 * discord.js interactions. Screens stay plain data (`ui/screen`); this file
 * sends them.
 */
import {
  AttachmentBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  ComponentType,
  type Interaction,
  type InteractionEditReplyOptions,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { App } from "../app";
import { log } from "../log";
import { demoCard } from "../render/cards/demo";
import { demoFixtures } from "../render/fixtures/demo";
import { allows, type DebugState, parseCustomId, type Route } from "./customId";
import { type Screen, toComponents } from "./screen";
import { debugCardScreen } from "./screens/debugCard";

/** Registered to the one guild at startup, so changes appear instantly. */
export const commands = [
  new SlashCommandBuilder()
    .setName("idle-debug")
    .setDescription("Wipe Day diagnostics (admins only)")
    .addSubcommand((sub) =>
      sub.setName("card").setDescription("Render the demo card to check the image pipeline"),
    )
    .toJSON(),
];

/** A screen as a message edit: Components V2 tree plus the card as an attachment. */
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

/** One private sentence, as Components V2 like everything else. */
function notice(text: string) {
  return {
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    components: [{ type: ComponentType.TextDisplay as const, content: text }],
  } as const;
}

async function showDebugCard(app: App, state: DebugState): Promise<Screen> {
  const fixture = demoFixtures.find((candidate) => candidate.state === state);
  if (!fixture) throw new Error(`no demo fixture for state ${state}`);
  const rendered = await app.renderer.render(demoCard, fixture.props);
  return debugCardScreen(app.locale, { state, rendered, assets: app.assets.counts() });
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

async function onCommand(app: App, interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName === "idle-debug" && interaction.options.getSubcommand() === "card") {
    if (!isAdmin(app, interaction)) {
      await interaction.reply(notice(app.locale.t("error.admin_only")));
      return;
    }
    // Rendering may take longer than the 3 s ack window on a cold start: defer first.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(toMessage(await showDebugCard(app, "normal")));
  }
}

async function onRoute(
  app: App,
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  route: Route,
): Promise<void> {
  switch (route.screen) {
    case "debug":
      await interaction.deferUpdate();
      await interaction.editReply(toMessage(await showDebugCard(app, route.state)));
      return;
  }
}

async function onComponent(
  app: App,
  interaction: ButtonInteraction | StringSelectMenuInteraction,
): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (parsed.kind === "foreign") return;
  if (parsed.kind === "unknown") {
    // A message from before a deploy. Phase 1 re-renders the home screen here.
    await interaction.reply(notice(app.locale.t("error.stale_message")));
    return;
  }
  if (!allows(parsed.id, interaction.user.id)) {
    await interaction.reply(notice(app.locale.t("error.not_your_message")));
    return;
  }
  await onRoute(app, interaction, parsed.id.route);
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
