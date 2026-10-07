/**
 * The bot's visual language, defined once: a mirror of the web's `styles/tokens.css`
 * (same background, text, accent and tier colours), so a card in Discord looks like a
 * panel of the game. Resource tiles come from `@wipe-day/content/look`, as on the web.
 */

export const color = {
  /** Card background: dark warm charcoal. */
  bg: "#1B1A18",
  /** Raised surface (cells, bar tracks). */
  panel: "#272521",
  /** Hairlines and cell outlines. */
  border: "#3B3832",
  /** Primary text: off-white. */
  text: "#ECE8DF",
  /** Secondary text. Still passes 4.5:1 on `bg`. */
  muted: "#A49E93",
  /** Ember orange. Brand accent and the primary action. */
  accent: "#CD412B",
  success: "#7FA043",
  warning: "#E3A32F",
  /** Deliberately brighter and pinker than `accent` so the two never read as one colour. */
  danger: "#F05252",
} as const;

import type { Tier } from "@wipe-day/content/tiers";

/** Base tiers, which double as the rarity scale for items and blueprints. Ids live in content. */
export { TIERS, type Tier } from "@wipe-day/content/tiers";

/** The one fixed colour each tier has everywhere. */
export const tierColor: Record<Tier, string> = {
  twig: "#C2A868",
  wood: "#B07840",
  stone: "#9AA0A6",
  metal: "#6C97BC",
  hqm: "#45C2C0",
};

/** Semantic state of a bar, label or whole screen. Mapped to a colour only here. */
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export const toneColor: Record<Tone, string> = {
  neutral: color.muted,
  accent: color.accent,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
};

/** Tone for "how full is this" bars where full is bad (storage). */
export function toneForFill(fraction: number): Tone {
  if (fraction >= 1) return "danger";
  return fraction >= 0.8 ? "warning" : "success";
}

/** Tone for "how much is left" bars where empty is bad (upkeep, health, durability). */
export function toneForRemaining(fraction: number): Tone {
  if (fraction <= 0.15) return "danger";
  return fraction <= 0.4 ? "warning" : "success";
}

/** `#RRGGBB` -> the integer Discord wants for a container accent. */
export function toInt(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

/** `#RRGGBB` + alpha -> `rgba(...)` for tinted card surfaces. */
export function withAlpha(hex: string, alpha: number): string {
  const value = toInt(hex);
  return `rgba(${(value >> 16) & 0xff}, ${(value >> 8) & 0xff}, ${value & 0xff}, ${alpha})`;
}

/** Card geometry shared by every template. */
export const layout = {
  /**
   * Design width: every card is laid out in these units. Discord shows a card about 520 px
   * wide on desktop but only about 290 px on a phone (avatar, margins and the container's
   * padding take the rest), so the card is designed for the phone: 600 units, nothing
   * smaller than `minFont`.
   */
  cardWidth: 600,
  /**
   * Rasterisation factor. Phones and most desktops are HiDPI, so a 600 px PNG shown at
   * 520 CSS px gets *upscaled* and looks soft; 2x keeps it crisp.
   */
  renderScale: 2,
  /** What a phone shows of a card: the preview's @phone renders. */
  mobileWidth: 290,
  /** Outer padding. Nothing but the background touches the card edge. */
  pad: 24,
  /** Smallest font size allowed on a card: about 10.6 px on a phone, small print only. */
  minFont: 22,
} as const;

export const FONT_FAMILY = "Roboto Condensed";
