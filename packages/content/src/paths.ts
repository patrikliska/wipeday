/**
 * Where this package keeps its files on disk. Node only: the browser gets the
 * data through the API (or a bundler import of the JSON), never through paths.
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

export const contentPaths = {
  root,
  data: join(root, "data"),
  locale: join(root, "locale"),
  localeFile: join(root, "locale", "en.json"),
  icons: join(root, "icons"),
} as const;
