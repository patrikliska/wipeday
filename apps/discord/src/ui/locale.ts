/**
 * The bot's view of the shared locale (`@wipe-day/content`): the same strings,
 * with missing keys logged instead of silently rendered as `⟦key⟧`.
 */
import { loadLocale as loadFrom } from "@wipe-day/content/load";
import type { Locale } from "@wipe-day/content/locale";
import { log } from "../log";

export { Locale, type LocaleArgs } from "@wipe-day/content/locale";

export function loadLocale(file?: string): Locale {
  return loadFrom(file, (key) => log.warn("missing locale key", { key }));
}
