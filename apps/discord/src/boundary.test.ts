/**
 * W8's contract, checked mechanically: the bot has no game logic and no store of its own.
 * It may read bases with the shared domain's helpers and describe them; every change goes
 * through the API's commands. R2 turns this blocklist into an allowlist (glance, advisor,
 * words, clock; docs/redesign/09-architecture.md 11).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, ".");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Domain modules whose values change a base: the bot may only import their types. */
const RULEBOOK = ["commands", "settle", "taps", "lines", "effects", "normalize", "prestige"];

describe("the bot is a thin client", () => {
  const files = sources(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));

  it("keeps no database of its own", () => {
    for (const { path, text } of files) {
      expect(text, path).not.toMatch(/better-sqlite3|drizzle-orm/);
    }
  });

  it("never runs a rule that changes a base", () => {
    for (const { path, text } of files) {
      for (const module of RULEBOOK) {
        const imports = text.matchAll(
          new RegExp(
            `import\\s+(type\\s+)?\\{([^}]*)\\}\\s+from\\s+"@wipe-day/domain/${module}"`,
            "g",
          ),
        );
        for (const [, typeOnly, names = ""] of imports) {
          if (typeOnly) continue;
          const values = names
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name && !name.startsWith("type "));
          expect(values, `${path}: ${module}`).toEqual([]);
        }
      }
      expect(text, path).not.toMatch(/applyCommand|applyTaps|\bsettle\(/);
    }
  });
});
