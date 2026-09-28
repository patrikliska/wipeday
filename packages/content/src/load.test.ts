import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ContentError, formatProblem, loadContent, loadLocale } from "./load";
import { Locale } from "./locale";
import { contentPaths as paths } from "./paths";

const locale = loadLocale();

/** A private copy of the real data dir with one file patched. */
function dataWith(file: string, patch: (text: string) => string): string {
  const dir = mkdtempSync(join(tmpdir(), "wipe-day-data-"));
  cpSync(paths.data, dir, { recursive: true });
  writeFileSync(join(dir, file), patch(readFileSync(join(dir, file), "utf8")));
  return dir;
}

function problemsOf(dir: string, withLocale = locale): string[] {
  try {
    loadContent(dir, withLocale);
    return [];
  } catch (error) {
    if (error instanceof ContentError) return error.problems.map(formatProblem);
    throw error;
  }
}

describe("the shipped data files", () => {
  it("load with no problems", () => {
    const content = loadContent(paths.data, locale);
    expect(content.resources.map((resource) => resource.id)).toContain("sulfur_ore");
    expect(content.nodes.map((node) => node.id)).toContain("tree_1");
    expect(content.baseRules.craftQueueSize).toBeGreaterThan(0);
  });
});

describe("validation", () => {
  it("reports every problem at once, with file and id", () => {
    const dir = dataWith("resources.json5", (text) =>
      text
        .replace('id: "stone"', 'id: "timber"')
        .replace('id: "fibre"', 'id: "Bad-Id"')
        .replace('kind: "currency"', 'kind: "gold", cost: -5'),
    );
    const problems = problemsOf(dir);
    expect(problems).toContain("resources.json5 `timber`: id is used more than once");
    expect(problems.some((p) => p.includes("`Bad-Id`") && p.includes("snake_case"))).toBe(true);
    expect(problems.some((p) => p.includes("`scrap`") && p.includes("kind"))).toBe(true);
    expect(problems.some((p) => p.includes("`scrap`") && p.includes("cost"))).toBe(true);
  });

  it("requires a locale name for every entity and an effect for every item", () => {
    const problems = problemsOf(paths.data, Locale.fromObject({}));
    expect(problems).toContain(
      "resources.json5 `timber`: missing locale key `resource.timber.name`",
    );
    expect(problems).toContain("base_tiers.json5 `hqm`: missing locale key `base_tier.hqm.name`");
    expect(problems).toContain("items.json5 `crate`: missing locale key `item.crate.effect`");
    expect(problems).toContain("nodes.json5 `tree`: missing locale key `node.tree.name`");
  });

  it("requires tool rates and costs to name real resources", () => {
    const dir = dataWith("tools.json5", (text) =>
      text.replace("stone: 80 }", "stone: 80, gold: 1 }"),
    );
    expect(problemsOf(dir)).toContain("tools.json5 `rock`: rates names unknown resource `gold`");
  });

  it("requires base tiers to match the fixed tier list", () => {
    const dir = dataWith("base_tiers.json5", (text) => text.replace('id: "twig"', 'id: "mud"'));
    expect(problemsOf(dir).some((p) => p.includes("must list exactly [twig, wood"))).toBe(true);
  });

  it("requires every placed node to have a known kind, and every item a recipe", () => {
    const nodes = dataWith("nodes.json5", (text) =>
      text.replace('{ id: "ore_1", kind: "ore" }', '{ id: "ore_1", kind: "gold" }'),
    );
    expect(problemsOf(nodes)).toContain("nodes.json5 `ore_1`: unknown node kind `gold`");
    const recipes = dataWith("recipes.json5", (text) => text.replace(/\{ item: "spear".*\n/, ""));
    expect(problemsOf(recipes)).toContain("recipes.json5 `spear`: item has no recipe");
  });
});
