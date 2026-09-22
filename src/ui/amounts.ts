/**
 * Resource amounts as message text: `🪵 +214 · 🪨 +160`, with the application
 * emoji once supplied. Order follows `resources.json5`, so the same list reads
 * the same everywhere.
 */
import type { Emojis } from "../assets/emojiSync";
import type { Amounts, Content } from "../content/schema";
import { abbrev, delta, perHour } from "./format";
import type { Locale } from "./locale";

export interface TextContext {
  content: Content;
  locale: Locale;
  emojis: Emojis;
}

export type AmountStyle = "plain" | "delta" | "rate";

const FORMAT: Record<AmountStyle, (amount: number) => string> = {
  plain: abbrev,
  delta,
  rate: perHour,
};

/** Non-zero entries of `amounts`, in display order. */
export function amountsText(
  ctx: TextContext,
  amounts: Amounts,
  style: AmountStyle = "plain",
): string {
  const parts: string[] = [];
  for (const resource of ctx.content.resources) {
    const amount = amounts[resource.id];
    if (amount === undefined || amount === 0) continue;
    parts.push(`${ctx.emojis.text("resource", resource)} ${FORMAT[style](amount)}`);
  }
  return parts.join(" · ");
}

/**
 * For button labels, which cannot hold custom emoji: `240 wood, 120 stone`.
 * At most two entries; a third becomes `…`.
 */
export function amountsLabel(ctx: TextContext, amounts: Amounts): string {
  const parts: string[] = [];
  for (const resource of ctx.content.resources) {
    const amount = amounts[resource.id];
    if (amount === undefined || amount === 0) continue;
    parts.push(`${abbrev(amount)} ${ctx.locale.t(`resource.${resource.id}.name`).toLowerCase()}`);
  }
  return parts.length > 2 ? `${parts.slice(0, 2).join(", ")}…` : parts.join(", ");
}
