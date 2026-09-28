/**
 * Reads `data/*.json5` and `locale/en.json` from disk (Node only) and hands
 * them to `parseContent`, which validates everything and reports every problem
 * at once. The browser gets the same files from its bundler instead.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import JSON5 from "json5";
import { Locale } from "./locale";
import { type Problem, parseContent } from "./parse";
import { contentPaths } from "./paths";
import { type Content, DATA_FILES, type DataFile } from "./schema";

export { ContentError, formatProblem, type Identity, identities, type Problem } from "./parse";

/** Reads `locale/en.json` (or `file`). Throws with the file name if it is not valid JSON. */
export function loadLocale(
  file: string = contentPaths.localeFile,
  onMissing?: (key: string) => void,
): Locale {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`could not load locale file ${file}: ${(error as Error).message}`);
  }
  return Locale.fromObject(parsed, onMissing);
}

/** Reads and validates everything. Throws `ContentError` listing all problems. */
export function loadContent(dataDir: string, locale: Locale): Content {
  const raw: Partial<Record<DataFile, unknown>> = {};
  const problems: Problem[] = [];
  for (const file of DATA_FILES) {
    try {
      raw[file] = JSON5.parse(readFileSync(join(dataDir, file), "utf8"));
    } catch (error) {
      problems.push({ file, id: "", message: `cannot be read: ${(error as Error).message}` });
    }
  }
  return parseContent(raw, locale, problems);
}

/** The shipped content and locale, as every server process loads them. */
export function loadGame(onMissing?: (key: string) => void): { content: Content; locale: Locale } {
  const locale = loadLocale(contentPaths.localeFile, onMissing);
  return { locale, content: loadContent(contentPaths.data, locale) };
}
