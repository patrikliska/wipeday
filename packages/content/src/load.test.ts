import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ContentError, formatProblem, loadContent, loadLocale } from "./load";
import { Locale } from "./locale";
import { parseContent } from "./parse";
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
    expect(content.crafting.batchSize.length).toBeGreaterThanOrEqual(3);
    expect(content.recipes.find((recipe) => recipe.output === "planks")?.amount).toBe(10);
    // `amount` defaults to one.
    expect(content.recipes.find((recipe) => recipe.output === "bow")?.amount).toBe(1);
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
    const recipes = dataWith("recipes.json5", (text) => text.replace(/\{ output: "spear".*\n/, ""));
    expect(problemsOf(recipes)).toContain("recipes.json5 `spear`: item has no recipe");
  });
});

describe("the crafting web", () => {
  const recipesWith = (edit: (text: string) => string) =>
    problemsOf(dataWith("recipes.json5", edit));

  it("requires a recipe for every part, and a use for it", () => {
    expect(recipesWith((text) => text.replace(/\{ output: "rope".*\n/, ""))).toContain(
      "recipes.json5 `rope`: part has no recipe",
    );
    // Charcoal only goes into springs and gunpowder.
    const unused = recipesWith((text) =>
      text
        .replace("cost: { ingots: 16, charcoal: 10 }", "cost: { ingots: 16 }")
        .replace("cost: { sulfur: 20, charcoal: 5 }", "cost: { sulfur: 20 }"),
    );
    expect(unused).toContain("recipes.json5 `charcoal`: part is made but nothing uses it");
  });

  it("requires a real station and level, and no blueprint on a part", () => {
    const problems = recipesWith((text) =>
      text
        .replace(
          'output: "rope", amount: 5, station: "loom"',
          'output: "rope", amount: 5, station: "mill"',
        )
        .replace(
          'output: "cloth", amount: 5, station: "loom", level: 1',
          'output: "cloth", amount: 5, station: "loom", level: 7',
        )
        .replace("cost: { timber: 50 } },", "cost: { timber: 50 }, blueprint: true },"),
    );
    expect(problems).toContain("recipes.json5 `rope`: station `mill` is not a building");
    expect(problems).toContain("recipes.json5 `cloth`: loom has no level 7");
    expect(problems).toContain("recipes.json5 `charcoal`: a part cannot need a blueprint");
  });

  it("finds recipes nothing on the island can feed", () => {
    // With no tool gathering sulfur ore, nothing gives sulfur: a roast that needs it cannot be made.
    const dir = dataWith("recipes.json5", (text) =>
      text.replace("cost: { food: 30 } }", "cost: { food: 30, sulfur: 1 } }"),
    );
    const tools = join(dir, "tools.json5");
    writeFileSync(tools, readFileSync(tools, "utf8").replaceAll(/sulfur_ore: \d+, /g, ""));
    expect(problemsOf(dir)).toContain(
      "recipes.json5 `roast`: cannot be made: nothing on the island gives sulfur",
    );
  });
});

describe("parseContent", () => {
  it("reports a data file that did not arrive (a bundler that forgot one)", () => {
    expect(() => parseContent({}, locale)).toThrow(/crafting\.json5: file is missing/);
  });
});

describe("the Den's checks (W5)", () => {
  it("keeps every bet option at a 5-10% edge and whole-scrap payouts", () => {
    const dir = dataWith("den.json5", (text) =>
      text.replace(
        '{ id: "crab", weight: 12, pays: 380 }',
        '{ id: "crab", weight: 12, pays: 470 }',
      ),
    );
    const problems = problemsOf(dir);
    expect(problems.some((p) => p.includes("`crab`") && p.includes("outside 90-95%"))).toBe(true);
    expect(problems.some((p) => p.includes("`crab`") && p.includes("not whole scrap"))).toBe(true);
  });

  it("refuses contracts that pay more than the Den sells for", () => {
    const dir = dataWith("den.json5", (text) =>
      text
        .replace("payPercent: 40", "payPercent: 100")
        .replace("markupPercent: 250", "markupPercent: 100"),
    );
    expect(problemsOf(dir)).toContain(
      "den.json5 `contracts`: payPercent must be below the stock's markupPercent (no arbitrage)",
    );
  });

  it("needs a price for every tradeable good", () => {
    const dir = dataWith("den.json5", (text) => text.replace("gears: 400, ", ""));
    expect(problemsOf(dir)).toContain("den.json5 `gears`: tradeable good has no refPer100");
  });
});

describe("the raids' checks (W6)", () => {
  it("keeps NPC losses inside the cap and every tier covered", () => {
    const dir = dataWith("raids.json5", (text) =>
      text.replace("lossPercent: 5", "lossPercent: 25").replace("hqm: { base: 35, max: 120 },", ""),
    );
    const problems = problemsOf(dir);
    expect(problems).toContain("raids.json5 `npc`: lossPercent is above capPercent");
    expect(problems).toContain("raids.json5 `hqm`: npc needs a strength");
  });

  it("needs charges in every camp's rations", () => {
    const dir = dataWith("sites.json5", (text) =>
      text.replace("rations: { food: 30, charge: 2 }", "rations: { food: 30 }"),
    );
    expect(problemsOf(dir)).toContain(
      "sites.json5 `driftwood_camp`: a camp's rations need charges",
    );
  });
});
