import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ContentError, formatProblem, loadContent, loadLocale } from "./load";
import { Locale } from "./locale";
import { contentPaths as paths } from "./paths";
import { effectSchema } from "./schema";

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
    expect(content.lines.map((line) => line.id)).toHaveLength(14);
    expect(content.island).toBe("saltmarsh");
  });

  it("derive the lines from the formula (docs/redesign/02-the-run.md 2.2)", () => {
    const { lines } = loadContent(paths.data, locale);
    const [first, , , loom] = lines;
    expect(first).toMatchObject({
      id: "beachcomber",
      cost: 6,
      rate: 0.34,
      cycle: 0.6,
      growth: 1.15,
    });
    expect(first?.handPrice).toBe(1800);
    expect(loom?.cost).toBe(6 * 16 ** 3);
    expect(loom?.rate).toBeCloseTo(0.34 * 4.5 ** 3, 9);
    expect(loom?.growth).toBeCloseTo(1.132, 12);
    const reactor = lines[13];
    // The table rounds: 27Qa and 105M (base output 0.34 × 4.5 a rung, D233, D240).
    expect((reactor?.cost ?? 0) / 27e15).toBeCloseTo(1, 2);
    expect((reactor?.rate ?? 0) / 105e6).toBeCloseTo(1, 2);
  });

  it("build the shelf: 4 Grip rungs and 8 island upgrades (02-the-run.md 5; D194)", () => {
    const { upgrades } = loadContent(paths.data, locale);
    const count = (kind: string) => upgrades.filter((upgrade) => upgrade.kind === kind).length;
    expect([count("grip"), count("island")]).toEqual([4, 8]);
    expect(upgrades).toHaveLength(12);
    const byId = new Map(upgrades.map((upgrade) => [upgrade.id, upgrade]));
    expect(byId.get("stone_tools")?.after).toBeUndefined();
    expect(byId.get("iron_tools")).toMatchObject({ cost: 6e3, after: "stone_tools" });
    expect(byId.get("handcarts")).toMatchObject({ cost: 5e9, after: "sorting_tables" });
  });

  it("hold eras, targets, flotsam buffs and the island's clock", () => {
    const content = loadContent(paths.data, locale);
    expect(content.eras.map((era) => [era.id, era.cost, era.target])).toEqual([
      ["twig", 0, "tree"],
      ["wood", 1.5e3, "stone"],
      ["stone", 3e6, "ore"],
      ["metal", 2e10, "sulfur"],
      ["hqm", 4e14, "wreck"],
    ]);
    expect(content.eras.at(-1)?.requires).toEqual({ wipeDays: 2 });
    expect(content.targets.map((target) => target.fellTaps)).toEqual([40, 60, 80, 100, 120]);
    expect(Object.keys(content.buffs).sort()).toEqual(["adrenaline", "frenzy", "rally"]);
    expect(content.islandClock).toMatchObject({ id: "saltmarsh", utcOffsetMinutes: 60 });
  });
});

describe("validation", () => {
  it("reports every problem at once, with file and id", () => {
    const dir = dataWith("resources.json5", (text) =>
      text
        .replace('{ id: "glass", kind: "currency" }', '{ id: "supplies", kind: "currency" }')
        .replace('{ id: "scrap", kind: "currency" }', '{ id: "Bad-Id", kind: "gold" }'),
    );
    const problems = problemsOf(dir);
    expect(problems.some((p) => p.includes("`Bad-Id`") && p.includes("snake_case"))).toBe(true);
    expect(problems.some((p) => p.includes("`Bad-Id`") && p.includes("kind"))).toBe(true);
  });

  it("reports a duplicated id", () => {
    const dir = dataWith("crew.json5", (text) => text.replace('{ id: "dax" }', '{ id: "mara" }'));
    const problems = problemsOf(dir);
    expect(problems).toContain("crew.json5 `mara`: id is used more than once");
  });

  it("requires a locale name for every entity", () => {
    const problems = problemsOf(paths.data, Locale.fromObject({}));
    expect(problems).toContain(
      "resources.json5 `supplies`: missing locale key `resource.supplies.name`",
    );
    expect(problems).toContain("lines.json5 `reactor`: missing locale key `line.reactor.name`");
    expect(problems).toContain("lines.json5: missing locale key `island.saltmarsh.name`");
  });

  it("rejects a non-finite or negative amount (D130)", () => {
    const dir = dataWith("prestige.json5", (text) => text.replace("l0: 5e5", "l0: Infinity"));
    expect(problemsOf(dir).join("\n")).toMatch(/prestige\.json5: l0/);
    const negative = dataWith("lines.json5", (text) => text.replace("costBase: 6", "costBase: -6"));
    expect(problemsOf(negative).join("\n")).toMatch(/formula\.costBase/);
  });

  it("checks the formula: costs, output and payback rise with the rung", () => {
    const dir = dataWith("lines.json5", (text) =>
      text.replace(
        'rung: 5, era: "wood", hand: "sela", product: "planks" }',
        'rung: 5, era: "wood", hand: "sela", product: "planks", cost: 10 }',
      ),
    );
    const problems = problemsOf(dir);
    expect(problems).toContain("lines.json5 `workbench`: cost must rise with the rung");
  });

  it("checks growth, unreachable prices and hands", () => {
    const dir = dataWith("lines.json5", (text) =>
      text.replace("growthBase: 1.15", "growthBase: 1.3").replace('hand: "dax"', 'hand: "mara"'),
    );
    const problems = problemsOf(dir);
    expect(problems).toContain("lines.json5 `beachcomber`: growth must be in (1, 1.2]");
    expect(problems).toContain("lines.json5 `campfire`: hand `mara` already runs another line");
    expect(problems.some((p) => p.includes("keep it under 1e200"))).toBe(true);
  });

  it("holds the Night Shift to 2-24 h (N18; D183)", () => {
    const dir = dataWith("lines.json5", (text) =>
      text.replace("windowHours: 2, maxHours: 24", "windowHours: 1, maxHours: 30"),
    );
    const problems = problemsOf(dir);
    expect(problems).toContain("lines.json5: the Night Shift must start at 2 h or more (N18)");
    expect(problems).toContain("lines.json5: the Night Shift must never pass 24 h (N18)");
    const tight = dataWith("lines.json5", (text) =>
      text.replace("windowHours: 2, maxHours: 24", "windowHours: 2, maxHours: 3"),
    );
    expect(problemsOf(tight)).toContain(
      "research.json5: the Night Shift with the Workshop's hours passes its ceiling (N18)",
    );
  });

  it("folds Frenzy into one buff: taps and lines ×mult (D237)", () => {
    const { buffs, tap } = loadContent(paths.data, locale);
    const [taps, speed, output] = buffs.frenzy ?? [];
    expect(taps).toMatchObject({ stat: "tap", op: "more", value: tap.frenzy.mult });
    expect((speed?.value ?? 0) * (output?.value ?? 0)).toBeCloseTo(tap.frenzy.mult, 12);
    const loud = dataWith("targets.json5", (text) => text.replace("mult: 6,", "mult: 9,"));
    expect(problemsOf(loud)).toContain(
      "targets.json5 `frenzy`: Hustle's ceiling × Frenzy must stay within multCeiling",
    );
  });

  it("keeps crows at least 120 s apart, and a Magpie faster and richer (D238)", () => {
    const dir = dataWith("flotsam.json5", (text) =>
      text.replace("jitter: 60,", "jitter: 90,").replace("eliteSeconds: 180", "eliteSeconds: 10"),
    );
    expect(problemsOf(dir)).toEqual(
      expect.arrayContaining([
        "flotsam.json5 `gulls`: crows must never cross under 120 s apart (every − jitter)",
        "flotsam.json5 `gulls`: a Magpie pays more than a crow",
      ]),
    );
  });

  it("checks badges: names, conditions and the things they name (D239)", () => {
    const content = loadContent(paths.data, locale);
    expect(content.achievements.badges.length).toBeGreaterThanOrEqual(55);
    expect(content.achievements.badges[0]?.when).toEqual({ kind: "state", state: "era", gte: 1 });
    expect(content.achievements.badges[3]?.when).toEqual({
      kind: "event",
      event: "era_reached",
      filters: { era: "wood", atLte: 60 },
    });
    const dir = dataWith("achievements.json5", (text) =>
      text
        .replace('kind: "fuel_drum" }', 'kind: "barrel" }')
        .replace('{ state: "supplies_digits", eq: 777 }', '{ state: "supplies_digits", gte: 777 }')
        .replace('{ buffs: ["frenzy", "rally"] }', '{ buffs: ["frenzy", "rush"] }'),
    );
    expect(problemsOf(dir)).toEqual(
      expect.arrayContaining([
        "achievements.json5 `first_rally`: unknown kind `barrel`",
        "achievements.json5 `lucky_sevens`: `supplies_digits` takes `eq`",
        "achievements.json5 `frenzy_rally`: unknown buff `rush`",
      ]),
    );
    const unnamed = problemsOf(paths.data, Locale.fromObject({}));
    expect(unnamed).toContain(
      "achievements.json5 `first_line`: missing locale key `badge.first_line.name`",
    );
  });

  it("keeps Hustle's peak under its ceiling", () => {
    const dir = dataWith("targets.json5", (text) => text.replace("peak: 2,", "peak: 3,"));
    expect(problemsOf(dir)).toContain("targets.json5: Hustle's peak must not pass its ceiling");
  });

  it("checks eras, the shelf, milestones, flotsam and the weather", () => {
    const eras = dataWith("eras.json5", (text) =>
      text.replace('cost: 3e6, target: "ore"', 'cost: 1e3, target: "tree"'),
    );
    expect(problemsOf(eras)).toEqual(
      expect.arrayContaining([
        "eras.json5 `stone`: each era must cost more than the one before",
        "eras.json5 `stone`: target `tree` belongs to the twig era",
        "targets.json5 `tree`: each target belongs to exactly one era",
      ]),
    );
    const shelf = dataWith("upgrades.json5", (text) =>
      text.replace('id: "handcarts", cost: 5e9', 'id: "loom", cost: 1e5'),
    );
    expect(problemsOf(shelf)).toEqual(
      expect.arrayContaining([
        "upgrades.json5 `loom`: each island upgrade must cost more than the one before",
        "upgrades.json5 `loom`: this upgrade id must not be used by any other entity",
      ]),
    );
    const milestones = dataWith("milestones.json5", (text) =>
      text.replace("{ at: 50, speed: 2 }", "{ at: 20, speed: 2, payout: 2 }"),
    );
    expect(problemsOf(milestones).join("\n")).toMatch(/exactly one/);
    const flotsam = dataWith("flotsam.json5", (text) =>
      text.replace("seconds: 60,", "seconds: 200,").replace('kind: "crate"', 'kind: "barrel"'),
    );
    expect(problemsOf(flotsam)).toEqual(
      expect.arrayContaining([
        "flotsam.json5: the shortest rainy gap must outlast the longest buff",
        "flotsam.json5: unknown first-run kind `barrel`",
      ]),
    );
    const island = dataWith("island.json5", (text) => text.replace("fog: 10", "fog: 15"));
    expect(problemsOf(island)).toContain(
      "island.json5 `saltmarsh`: weather shares must sum to 100",
    );
  });

  it("reports a missing file", () => {
    const dir = dataWith("pacing.json5", () => "{ nope");
    expect(problemsOf(dir).some((p) => p.startsWith("pacing.json5: cannot be read"))).toBe(true);
  });
});

describe("effects", () => {
  it("need a max with `per`, a registered stat, and an op the stat allows", () => {
    expect(effectSchema.safeParse({ stat: "output", op: "more", value: 2 }).success).toBe(true);
    expect(
      effectSchema.safeParse({ stat: "output", op: "inc", value: 0.1, per: "owned" }).success,
    ).toBe(false);
    expect(effectSchema.safeParse({ stat: "lucky", op: "add", value: 1 }).success).toBe(false);
    expect(effectSchema.safeParse({ stat: "speed", op: "add", value: 1 }).success).toBe(false);
    expect(effectSchema.safeParse({ stat: "output", op: "more", value: Number.NaN }).success).toBe(
      false,
    );
  });
});
