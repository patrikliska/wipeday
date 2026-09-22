/**
 * Player names on cards. Roboto Condensed covers Latin (with all its accents),
 * Greek and Cyrillic; anything else (emoji, CJK, symbols) would rasterise as
 * missing-glyph boxes. Those characters are dropped, and a name with nothing
 * left becomes the locale's anonymous name.
 */
import type { Locale } from "./locale";

const UNSUPPORTED = /[^\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Nd}\p{P}\x20-\x7E]/gu;

export function cardSafeName(name: string, locale: Locale): string {
  const cleaned = name.replace(UNSUPPORTED, "").replace(/\s+/g, " ").trim();
  return cleaned === "" ? locale.t("player.anonymous") : cleaned;
}
