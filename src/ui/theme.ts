/**
 * The visual language, defined exactly once. Cards and Discord component
 * colours both read from here; nothing else in the project contains a hex.
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
  /** Rust orange. Brand accent and the primary action. */
  accent: "#CD412B",
  success: "#7FA043",
  warning: "#E3A32F",
  /** Deliberately brighter and pinker than `accent` so the two never read as one colour. */
  danger: "#F05252",
} as const;

/** Base tiers, which double as the rarity scale for items and blueprints. */
export const TIERS = ["twig", "wood", "stone", "metal", "hqm"] as const;
export type Tier = (typeof TIERS)[number];

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
  /** Design width: every card is laid out in these units. Discord shows ~550 px on desktop, ~400 on phones. */
  cardWidth: 800,
  /**
   * Rasterisation factor. Phones and most desktops are HiDPI, so an 800 px PNG
   * shown at 550 CSS px gets *upscaled* and looks soft; 2x keeps it crisp.
   */
  renderScale: 2,
  /** What a phone shows. Used by the preview's @mobile renders. */
  mobileWidth: 400,
  /** Outer padding. Nothing but the background touches the card edge. */
  pad: 32,
  /** Smallest font size allowed on a card (legible at 400 px). */
  minFont: 22,
} as const;

export const FONT_FAMILY = "Roboto Condensed";
