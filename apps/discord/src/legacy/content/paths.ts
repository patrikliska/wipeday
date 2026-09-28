/**
 * Where the bot's frozen content lives: `data/` and `locale/` next to this file.
 * Frozen with the rest of `legacy/` until W8 (D57).
 */
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export const contentPaths = {
  root,
  data: join(root, "data"),
  locale: join(root, "locale"),
  localeFile: join(root, "locale", "en.json"),
} as const;
