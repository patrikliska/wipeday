/**
 * W8's contract, checked mechanically: the bot has no game logic and no store of its own.
 * It may read bases with the shared domain's read-only helpers and describe them; every
 * change goes through the API's commands. From R4 (docs/redesign/06-friends.md 10.6; errata
 * E18) this is an allowlist: value imports from `@wipe-day/domain/*` only from `glance`,
 * `advisor`, `words` and `clock` (the preview fixtures may also call `newBase`), everything
 * else type-only; and the bot sends exactly one command type, `collect`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOT_COMMANDS } from "./api";

const SRC = join(import.meta.dirname, ".");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Domain modules the bot may import values from: read-only views, the shared words, a clock. */
const ALLOWED = ["glance", "advisor", "words", "clock"];
/** The preview's fixtures build sample bases with the domain's own constructor. */
const FIXTURE_IMPORTS: Record<string, string[]> = { "render/fixtures.ts": ["state:newBase"] };

describe("the bot is a thin client", () => {
  const files = sources(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));
  const relative = (path: string) => path.slice(SRC.length + 1).replace(/\\/g, "/");

  it("keeps no database of its own", () => {
    for (const { path, text } of files) {
      expect(text, path).not.toMatch(/better-sqlite3|drizzle-orm/);
    }
  });

  it("imports values only from the domain's read-only modules", () => {
    for (const { path, text } of files) {
      const imports = text.matchAll(
        /import\s+(type\s+)?\{([^}]*)\}\s+from\s+"@wipe-day\/domain\/([a-z]+)"/g,
      );
      for (const [, typeOnly, names = "", module = ""] of imports) {
        if (typeOnly || ALLOWED.includes(module)) continue;
        const values = names
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name && !name.startsWith("type "))
          .map((name) => `${module}:${name}`);
        const allowed = FIXTURE_IMPORTS[relative(path)] ?? [];
        expect(
          values.filter((value) => !allowed.includes(value)),
          `${path}: ${module}`,
        ).toEqual([]);
      }
      expect(text, path).not.toMatch(/applyCommand|applyTaps|\bsettle\(|\bnuke\(/);
    }
  });

  it("sends exactly one command type, collect, and names no other", () => {
    expect(BOT_COMMANDS).toEqual(["collect"]);
    const others = [
      "taps",
      "ping",
      "nuke",
      "buy_node",
      "buy_line",
      "hire_hand",
      "buy_upgrade",
      "buy_research",
      "buy_era",
      "claim_flotsam",
      "claim_gull",
      "open_drop",
      "buy_boost",
      "buy_drop",
    ];
    for (const { path, text } of files) {
      for (const type of others)
        expect(text, `${path} sends ${type}`).not.toMatch(new RegExp(`type:\\s*"${type}"`));
    }
  });
});
