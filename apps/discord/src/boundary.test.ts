/**
 * W8's contract, checked mechanically: the bot has no game logic and no store of its own.
 * It may read bases with the shared domain's helpers (what is waiting, the advisor) and
 * describe them; every change goes through the API's commands.
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
const RULEBOOK = ["commands", "settle", "nodes", "missions", "market", "casino", "raids"];

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
          // Read-only lookups are fine: a raid's warning, nothing that returns a new state.
          const values = names
            .split(",")
            .map((name) => name.trim())
            .filter((name) => name && !name.startsWith("type "));
          expect(
            values.filter((name) => name !== "raidWarned"),
            `${path}: ${module}`,
          ).toEqual([]);
        }
      }
      expect(text, path).not.toMatch(/applyCommand|settleAll/);
    }
  });
});
