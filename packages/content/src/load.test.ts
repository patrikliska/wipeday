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
      rate: 1.5,
      cycle: 0.6,
      growth: 1.15,
    });
    expect(first?.handPrice).toBe(1800);
    expect(loom?.cost).toBe(6 * 16 ** 3);
    expect(loom?.rate).toBeCloseTo(1.5 * 4.75 ** 3, 9);
    expect(loom?.growth).toBeCloseTo(1.132, 12);
    const reactor = lines[13];
    // The plan's table rounds: 27Qa and 940M.
    expect((reactor?.cost ?? 0) / 27e15).toBeCloseTo(1, 2);
    expect((reactor?.rate ?? 0) / 940e6).toBeCloseTo(1, 2);
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

  it("holds the Night Shift to 12-48 h (N18)", () => {
    const dir = dataWith("lines.json5", (text) =>
      text.replace("windowHours: 12, maxHours: 48", "windowHours: 8, maxHours: 72"),
    );
    const problems = problemsOf(dir);
    expect(problems).toContain("lines.json5: the Night Shift must start at 12 h or more (N18)");
    expect(problems).toContain("lines.json5: the Night Shift must never pass 48 h (N18)");
  });

  it("keeps Hustle's peak under its ceiling", () => {
    const dir = dataWith("targets.json5", (text) => text.replace("peak: 2,", "peak: 3,"));
    expect(problemsOf(dir)).toContain("targets.json5: Hustle's peak must not pass its ceiling");
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
