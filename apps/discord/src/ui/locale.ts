/**
 * The bot's locale (its frozen copy in `legacy/content`, D57): the same strings,
 * with missing keys logged instead of silently rendered as `⟦key⟧`.
 */
import { loadLocale as loadFrom } from "../legacy/content/load";
import type { Locale } from "../legacy/content/locale";
import { log } from "../log";

export { Locale, type LocaleArgs } from "../legacy/content/locale";

export function loadLocale(file?: string): Locale {
  return loadFrom(file, (key) => log.warn("missing locale key", { key }));
}
