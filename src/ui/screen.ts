/**
 * The screen model: what a message looks like, as plain data.
 *
 * Every screen is built as a `Screen` and turned into a Components V2 tree in
 * exactly one place (`toComponents`). That gives three things for free:
 * the fixed layout order (title, status, card, details, hint, actions) cannot
 * be broken by an individual screen; `lintScreen` can enforce the
 * zero-tutorial rules (CLAUDE.md 4.3) mechanically; and `outlineScreen` gives
 * the text rendering `pnpm preview` writes for review.
 */
import {
  type APIActionRowComponent,
  type APIButtonComponentWithCustomId,
  type APIComponentInContainer,
  type APIContainerComponent,
  type APIMessageComponentEmoji,
  type APIStringSelectComponent,
  ComponentType,
  ButtonStyle as DiscordButtonStyle,
  SeparatorSpacingSize,
} from "discord.js";
import { type Tone, toInt, toneColor } from "./theme";

/** Mobile-first limits (CLAUDE.md 4.3 rule 9). */
export const MAX_BUTTONS_PER_ROW = 5;
export const MAX_ROWS = 3;
export const MAX_LABEL_CHARS = 19;
/** A locked button's label carries its reason (rule 3), so it may run longer. */
export const MAX_LOCKED_LABEL_CHARS = 38;
const MAX_CUSTOM_ID = 100;
const MAX_SELECT_OPTIONS = 25;

/** primary: the one most useful action right now. danger: destructive or PvP only. */
export type ButtonStyle = "primary" | "secondary" | "danger";

export interface Button {
  customId: string;
  /** Already localised. When `disabled`, it includes the reason: `Upgrade · need 2.1k stone`. */
  label: string;
  emoji?: APIMessageComponentEmoji;
  style: ButtonStyle;
  disabled?: boolean;
  /** Marks the two navigation buttons every sub-screen must carry. */
  nav?: "back" | "home";
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  emoji?: APIMessageComponentEmoji;
}

export interface Select {
  customId: string;
  placeholder: string;
  options: SelectOption[];
}

export type ActionRow = { kind: "buttons"; buttons: Button[] } | { kind: "select"; select: Select };

export interface CardImage {
  /** Attachment file name, e.g. `demo.png`. */
  fileName: string;
  png: Buffer;
}

export interface Screen {
  /** Screen name, as in `docs/screens/{id}.md` and the customId scheme. */
  id: string;
  /** `root`: the home message or a standalone screen. `sub`: must carry Back and Home. */
  kind: "root" | "sub";
  tone: Tone;
  title: string;
  /** One line. */
  status: string;
  card?: CardImage;
  details: string[];
  /** One-line onboarding hint shown under the card. */
  hint?: string;
  rows: ActionRow[];
}

const buttonsOf = (screen: Screen): Button[] =>
  screen.rows.flatMap((row) => (row.kind === "buttons" ? row.buttons : []));

/** Violations of the zero-tutorial rules. Empty means the screen may ship. */
export function lintScreen(screen: Screen): string[] {
  const problems: string[] = [];
  const buttons = buttonsOf(screen);

  const primaries = buttons.filter((button) => button.style === "primary");
  if (primaries.length !== 1) {
    problems.push(`needs exactly one primary button, has ${primaries.length}`);
  }
  if (primaries.some((button) => button.disabled)) {
    problems.push("the primary button is disabled: the advisor must pick a usable action");
  }

  if (screen.rows.length > MAX_ROWS) problems.push(`${screen.rows.length} rows, max ${MAX_ROWS}`);
  screen.rows.forEach((row, index) => {
    const at = `row ${index + 1}`;
    if (row.kind === "buttons") {
      if (row.buttons.length === 0) problems.push(`${at} is empty`);
      if (row.buttons.length > MAX_BUTTONS_PER_ROW) {
        problems.push(`${at} has ${row.buttons.length} buttons, max ${MAX_BUTTONS_PER_ROW}`);
      }
    } else {
      const count = row.select.options.length;
      if (count === 0) problems.push(`select in ${at} has no options`);
      if (count > MAX_SELECT_OPTIONS) {
        problems.push(`select in ${at} has ${count} options, Discord allows ${MAX_SELECT_OPTIONS}`);
      }
    }
  });

  for (const button of buttons) {
    const limit = button.disabled ? MAX_LOCKED_LABEL_CHARS : MAX_LABEL_CHARS;
    const length = [...button.label].length;
    if (length > limit) problems.push(`label \`${button.label}\` is ${length} chars, max ${limit}`);
    if (button.customId.length > MAX_CUSTOM_ID) {
      problems.push(`customId \`${button.customId}\` is over ${MAX_CUSTOM_ID} chars`);
    }
  }
  const ids = buttons.map((button) => button.customId);
  if (new Set(ids).size !== ids.length) problems.push("two buttons share a customId");

  if (screen.kind === "sub") {
    for (const nav of ["back", "home"] as const) {
      if (!buttons.some((button) => button.nav === nav)) {
        problems.push(`sub-screen without a ${nav === "back" ? "Back" : "Home"} button`);
      }
    }
  }

  if (screen.title.trim() === "") problems.push("no title");
  if (screen.status.includes("\n")) problems.push("status must be one line");
  return problems;
}

const STYLE: Record<
  ButtonStyle,
  DiscordButtonStyle.Primary | DiscordButtonStyle.Secondary | DiscordButtonStyle.Danger
> = {
  primary: DiscordButtonStyle.Primary,
  secondary: DiscordButtonStyle.Secondary,
  danger: DiscordButtonStyle.Danger,
};

function toButton(button: Button): APIButtonComponentWithCustomId {
  return {
    type: ComponentType.Button,
    custom_id: button.customId,
    label: button.label,
    style: STYLE[button.style],
    ...(button.emoji ? { emoji: button.emoji } : {}),
    ...(button.disabled ? { disabled: true } : {}),
  };
}

function toSelect(select: Select): APIStringSelectComponent {
  return {
    type: ComponentType.StringSelect,
    custom_id: select.customId,
    placeholder: select.placeholder,
    options: select.options.map((option) => ({
      value: option.value,
      label: option.label,
      ...(option.description ? { description: option.description } : {}),
      ...(option.emoji ? { emoji: option.emoji } : {}),
    })),
  };
}

/**
 * The Components V2 tree: one container, always in the same order.
 * Send with `MessageFlags.IsComponentsV2` and the card as an attachment.
 */
export function toComponents(screen: Screen): APIContainerComponent {
  const children: APIComponentInContainer[] = [
    { type: ComponentType.TextDisplay, content: `## ${screen.title}\n${screen.status}` },
  ];
  if (screen.card) {
    children.push({
      type: ComponentType.MediaGallery,
      items: [{ media: { url: `attachment://${screen.card.fileName}` } }],
    });
  }
  if (screen.details.length > 0) {
    children.push({ type: ComponentType.TextDisplay, content: screen.details.join("\n") });
  }
  if (screen.hint) {
    children.push({ type: ComponentType.TextDisplay, content: `-# ${screen.hint}` });
  }
  if (screen.rows.length > 0) {
    children.push({
      type: ComponentType.Separator,
      divider: true,
      spacing: SeparatorSpacingSize.Small,
    });
  }
  for (const row of screen.rows) {
    const actionRow: APIActionRowComponent<
      APIButtonComponentWithCustomId | APIStringSelectComponent
    > = {
      type: ComponentType.ActionRow,
      components: row.kind === "buttons" ? row.buttons.map(toButton) : [toSelect(row.select)],
    };
    children.push(actionRow);
  }
  return {
    type: ComponentType.Container,
    accent_color: toInt(toneColor[screen.tone]),
    components: children,
  };
}

/** Plain-text outline for `preview/screens/{screen}.txt`. */
export function outlineScreen(screen: Screen): string {
  const lines = [
    `SCREEN  ${screen.id} (${screen.kind}, tone ${screen.tone})`,
    `TITLE   ${screen.title}`,
    `STATUS  ${screen.status}`,
    screen.card
      ? `CARD    ${screen.card.fileName} (${Math.round(screen.card.png.length / 1024)} KB)`
      : "CARD    none",
    ...screen.details.map((line) => `DETAIL  ${line}`),
    ...(screen.hint ? [`HINT    ${screen.hint}`] : []),
  ];
  screen.rows.forEach((row, index) => {
    if (row.kind === "buttons") {
      lines.push(`ROW ${index + 1}`);
      for (const button of row.buttons) {
        const emoji = button.emoji?.name ? `${button.emoji.name} ` : "";
        const state = button.disabled ? "   (disabled)" : "";
        lines.push(`  [${button.style.padEnd(9)}] ${emoji}${button.label}${state}`);
      }
    } else {
      lines.push(`ROW ${index + 1}  select: ${row.select.placeholder}`);
      for (const option of row.select.options) {
        lines.push(`  - ${option.label}${option.description ? `  (${option.description})` : ""}`);
      }
    }
  });
  const problems = lintScreen(screen);
  lines.push(
    ...(problems.length === 0 ? ["LINT    ok"] : problems.map((p) => `LINT    FAIL: ${p}`)),
  );
  return `${lines.join("\n")}\n`;
}
