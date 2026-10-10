/**
 * Words and numbers for every client (W8, D130): the web and the Discord bot print the same
 * thing because both call this module. Strings come from the locale; nothing here reads a clock.
 *
 * The formatter (docs/redesign/09-architecture.md 2.4; owner decision 20):
 * - `fmt(x, "held")` for what you hold (floors: never claim what you lack), `fmt(x, "cost")` for
 *   prices, rates and gains (rounds half up). Below 1,000 a whole number; from 1,000 three
 *   significant digits with a suffix from `format.suffixes` (k … Dc), trailing zeros kept so a
 *   ticking counter keeps its width; from 1e36 scientific (`1.23e36`). A mantissa that rounds
 *   to 1,000 promotes (`999,999` costs `1.00M`).
 * - `fmtRate`: below 10 up to three significant digits, trimmed (`0.4/s`); from 10 as a cost.
 * - `fmtCount`: below a million, digits with separators (`2,154`); from there as held.
 * - Scientific notation (a setting) switches everything from 1e6 to `1.23e6`.
 * - NaN and Infinity print `—`.
 */
import type { Locale, LocaleArgs } from "@wipe-day/content/locale";
import type { Content } from "@wipe-day/content/schema";
import type { FeedEvent } from "./feed";

export type FmtMode = "held" | "cost";

export interface NumberFormat {
  fmt: (value: number, mode?: FmtMode) => string;
  fmtRate: (value: number) => string;
  fmtCount: (value: number) => string;
}

const DASH = "—";

/** Three significant digits of `value` (≥ 1): the digits 100-999 and the power of ten. */
function sig3(value: number, mode: FmtMode): { digits: number; exp: number } {
  let exp = Math.floor(Math.log10(value));
  let mantissa = value / 10 ** exp;
  if (mantissa >= 10) {
    mantissa /= 10;
    exp += 1;
  } else if (mantissa < 1) {
    mantissa *= 10;
    exp -= 1;
  }
  const scaled = mantissa * 100;
  // The epsilon absorbs float error at the edges (9.995 × 100 is 999.4999…).
  let digits = mode === "held" ? Math.floor(scaled + 1e-7) : Math.round(scaled + 1e-7);
  if (digits >= 1000) {
    digits = 100;
    exp += 1;
  }
  return { digits, exp };
}

/** The 3 digits with the decimal point after `whole` of them: (124, 2) → "12.4". */
function place(digits: number, whole: number): string {
  const text = String(digits);
  return whole >= 3 ? text : `${text.slice(0, whole)}.${text.slice(whole)}`;
}

export function numberFormat(suffixes: readonly string[], scientific = false): NumberFormat {
  const top = 3 * (suffixes.length + 1);
  const fmt = (value: number, mode: FmtMode = "held"): string => {
    if (!Number.isFinite(value)) return DASH;
    if (value < 0) return `-${fmt(-value, mode)}`;
    if (value < 1000) {
      const whole = mode === "held" ? Math.floor(value + 1e-9) : Math.round(value);
      if (whole < 1000) return String(whole);
    }
    const { digits, exp } = sig3(Math.max(value, 1000), mode);
    if ((scientific && exp >= 6) || exp >= top) return `${place(digits, 1)}e${exp}`;
    const group = Math.floor(exp / 3);
    return `${place(digits, exp - 3 * group + 1)}${suffixes[group - 1] ?? ""}`;
  };
  const fmtRate = (value: number): string => {
    if (!Number.isFinite(value)) return DASH;
    if (value < 0) return `-${fmtRate(-value)}`;
    if (value === 0) return "0/s";
    const short = Number(value.toPrecision(3));
    if (short < 10) return `${short}/s`;
    return `${fmt(value, "cost")}/s`;
  };
  const fmtCount = (value: number): string => {
    if (!Number.isFinite(value)) return DASH;
    if (Math.abs(value) >= 1e6) return fmt(value, "held");
    const whole = Math.trunc(value);
    return `${whole < 0 ? "-" : ""}${String(Math.abs(whole)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };
  return { fmt, fmtRate, fmtCount };
}

/** `2d 4h`, `3h 20m`, `45s`. */
export function duration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.trunc(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor(seconds / 3_600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return minutes > 0 ? `${minutes}m` : `${seconds}s`;
}

export interface Words extends NumberFormat {
  t: (key: string, args?: LocaleArgs) => string;
  resourceName: (id: string) => string;
  crewName: (id: string) => string;
  lineName: (id: string) => string;
  tierName: (id: string) => string;
  toolName: (id: string) => string;
  islandName: (id: string) => string;
  targetName: (id: string) => string;
  /** A shelf row's name: a Grip rung is its tool. */
  upgradeName: (id: string) => string;
  flotsamName: (id: string) => string;
  buffName: (id: string) => string;
  /** One line of the feed, about `who` (a player's name, or "You"). */
  feedLine: (event: FeedEvent, who: string) => string;
}

/** The suffixes from the locale (`format.suffixes`, space separated). */
export function suffixesOf(locale: Locale): string[] {
  return locale.t("format.suffixes").split(/\s+/).filter(Boolean);
}

export function words(
  locale: Locale,
  content: Content,
  options: { scientific?: boolean } = {},
): Words {
  const t = (key: string, args?: LocaleArgs): string => locale.t(key, args);
  return {
    ...numberFormat(suffixesOf(locale), options.scientific ?? false),
    t,
    resourceName: (id) => t(`resource.${id}.name`),
    crewName: (id) => t(`crew.${id}.name`),
    lineName: (id) => t(`line.${id}.name`),
    tierName: (id) => t(`base_tier.${id}.name`),
    toolName: (id) => t(`tool.${id}.name`),
    islandName: (id) => t(`island.${id}.name`),
    targetName: (id) => t(`target.${id}.name`),
    upgradeName: (id) =>
      content.tools.some((tool) => tool.id === id) ? t(`tool.${id}.name`) : t(`upgrade.${id}.name`),
    flotsamName: (id) => t(`flotsam.${id}.name`),
    buffName: (id) => t(`buff.${id}.name`),
    // The feed has no event types until R2: every line is `feed.<type>`.
    feedLine: (event, who) => t(`feed.${(event as { type: string }).type}`, { who }),
  };
}
