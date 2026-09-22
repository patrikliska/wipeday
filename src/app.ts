/** Everything a handler needs, built once at startup. */
import { join } from "node:path";
import type { Emojis } from "./assets/emojiSync";
import { AssetRegistry } from "./assets/registry";
import type { Config } from "./config";
import { loadContent } from "./content/load";
import type { Content } from "./content/schema";
import type { Paths } from "./paths";
import { Renderer } from "./render/renderer";
import type { Db } from "./store/db";
import { Locale } from "./ui/locale";

export interface App {
  paths: Paths;
  config: Config;
  locale: Locale;
  content: Content;
  assets: AssetRegistry;
  renderer: Renderer;
  db: Db;
  /** Replaced once the emoji sync has run; Unicode fallbacks until then. */
  emojis: Emojis;
}

/** Loads locale, data, assets and the renderer. Throws with a readable list if data is invalid. */
export function loadStatic(paths: Paths): Pick<App, "locale" | "content" | "assets" | "renderer"> {
  const locale = Locale.load(join(paths.locale, "en.json"));
  const content = loadContent(paths.data, locale);
  const assets = AssetRegistry.load(paths.assets);
  return { locale, content, assets, renderer: new Renderer({ assets, locale }) };
}
