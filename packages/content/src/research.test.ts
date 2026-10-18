import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ContentError, formatProblem, loadContent, loadLocale } from "./load";
import { RESEARCH_TREE_MAX, TAP_COEFFICIENT_MAX, tapCoefficient } from "./parse";
import { contentPaths as paths } from "./paths";
import { levelEffect, levelsCost, tierEra } from "./research";

const locale = loadLocale();
const content = loadContent(paths.data, locale);
const byId = new Map(content.research.map((def) => [def.id, def]));

function problemsWith(patch: (text: string) => string): string[] {
  const dir = mkdtempSync(join(tmpdir(), "wipe-day-research-"));
  cpSync(paths.data, dir, { recursive: true });
  const file = join(dir, "research.json5");
  writeFileSync(file, patch(readFileSync(file, "utf8")));
  try {
    loadContent(dir, locale);
    return [];
  } catch (error) {
    if (error instanceof ContentError) return error.problems.map(formatProblem);
    throw error;
  }
}

describe("the Workshop's shipped data (game-design 5.12; D194)", () => {
  it("has four tiers of five items and one Line Mk per line", () => {
    const tiers = content.research.filter((def) => def.kind === "tier");
    expect(tiers).toHaveLength(20);
    for (const k of [1, 2, 3, 4]) {
      const items = tiers.filter((def) => def.tier === k);
      expect(items).toHaveLength(5);
      for (const def of items) expect(def.era).toBe(tierEra(k));
    }
    const mks = content.research.filter((def) => def.kind === "mk");
    expect(mks.map((def) => def.line)).toEqual(content.lines.map((line) => line.id));
    expect(content.workshop.opensAfterSeconds).toBe(120);
  });

  it("prices tier k level n at 40 × 20^(k−1) × 1.35^n", () => {
    const hooks = byId.get("sharper_hooks");
    const frames = byId.get("timber_frames");
    if (!hooks || !frames) throw new Error("missing items");
    expect(levelsCost(hooks, 0, 1)).toBe(40);
    expect(levelsCost(hooks, 3, 1)).toBeCloseTo(40 * 1.35 ** 3, 9);
    expect(levelsCost(frames, 0, 1)).toBe(320_000);
    // The closed form equals the sum of the levels.
    let sum = 0;
    for (let n = 4; n < 11; n += 1) sum += levelsCost(hooks, n, 1);
    expect(levelsCost(hooks, 4, 7) / sum).toBeCloseTo(1, 12);
  });

  it("derives the Line Mks from the line's price: ×1e4 at 25 owned, ×1e8 at 50 (D194)", () => {
    const mk = byId.get("beachcomber_mk");
    expect(mk).toMatchObject({
      kind: "mk",
      era: "twig",
      levels: 2,
      costs: [6e4, 6e8],
      needOwned: [25, 50],
      effect: { stat: "output", op: "more", value: 3, scope: "beachcomber" },
    });
    if (!mk) throw new Error("missing");
    expect(levelsCost(mk, 0, 2)).toBe(6e4 + 6e8);
    expect(levelEffect(mk.effect, 2).value).toBe(9);
    expect(byId.get("furnace_mk")?.era).toBe("stone");
  });

  it("stays under its budgets: the tree under 1e18, the tap's c under 0.6, +2 h of Night Shift", () => {
    const tree = content.research
      .filter((def) => def.kind === "tier")
      .reduce((total, def) => total + levelsCost(def, 0, def.levels), 0);
    expect(tree).toBeLessThan(RESEARCH_TREE_MAX);
    expect(tapCoefficient(content)).toBeLessThanOrEqual(TAP_COEFFICIENT_MAX);
    const wicks = byId.get("spare_wicks");
    if (!wicks) throw new Error("missing");
    expect(levelEffect(wicks.effect, wicks.levels).value * 3600).toBeCloseTo(7200, 6);
  });
});

describe("the Workshop's checks", () => {
  it("refuses a stat the crown cannot score, or a bad scope", () => {
    const problems = problemsWith((text) =>
      text
        .replace(
          '{ stat: "tap_flat", op: "add", value: 1 } },\n      ],\n    },\n    {\n      era: "twig"',
          '{ stat: "flotsam_effect", op: "inc", value: 0.1 } },\n      ],\n    },\n    {\n      era: "twig"',
        )
        .replace('scope: "beachcomber" }', 'scope: "nowhere" }'),
    );
    expect(problems.some((p) => p.includes("`calloused_thumbs`: the crown cannot score"))).toBe(
      true,
    );
    expect(problems).toContain(
      "research.json5 `sharper_hooks`: `output` needs a scope: a line, an era or `all`",
    );
  });

  it("keeps tap items to the flat part: a share of the full rate fails c", () => {
    const problems = problemsWith((text) =>
      text.replace(
        '{ stat: "hustle_max", op: "add", value: 0.05 }',
        '{ stat: "tap_flat", op: "more", value: 1.5 }',
      ),
    );
    // A flat tap is outside c; a share of the full rate is not.
    expect(problems).toEqual([]);
    const share = problemsWith((text) =>
      text.replace(
        '{ stat: "hustle_max", op: "add", value: 0.05 }',
        '{ stat: "tap_share", op: "add", value: 0.01 }',
      ),
    );
    expect(share.some((p) => p.includes("the crown cannot score `tap_share add`"))).toBe(true);
    expect(share.some((p) => p.includes("steady coefficient"))).toBe(true);
  });

  it("refuses a tier on the wrong era, a tree over 1e18, and more than 2 h of wicks", () => {
    const problems = problemsWith((text) =>
      text
        .replace(
          'era: "wood",\n      items: [\n        { id: "tarred_twine"',
          'era: "twig",\n      items: [\n        { id: "tarred_twine"',
        )
        .replace("tierRatio: 20", "tierRatio: 1e6")
        .replace("value: 0.3333333333333333", "value: 0.5"),
    );
    expect(problems).toContain(
      "research.json5 `tarred_twine`: tier 3 opens with the wood era, not twig",
    );
    expect(problems.some((p) => p.includes("keep the tree under 1e18"))).toBe(true);
    expect(problems).toContain(
      "research.json5: the Workshop may add at most 2 h to the Night Shift (D195)",
    );
  });

  it("refuses a `per`, a `when`, too many levels, an id used elsewhere, or a missing name", () => {
    const problems = problemsWith((text) =>
      text
        .replace(
          'value: 0.05, scope: "campfire" }',
          'value: 0.05, scope: "campfire", when: "rain" }',
        )
        .replace('{ id: "raised_beds", levels: 25', '{ id: "garden", levels: 26'),
    );
    const all = problems.join("\n");
    expect(all).toMatch(/no `per` and no `when`/);
    expect(all).toMatch(/levels/);
  });

  it("names every item and every Mk level", () => {
    const problems = problemsWith((text) =>
      text.replace('{ id: "tool_ledger"', '{ id: "tool_tally"'),
    );
    expect(problems).toContain(
      "research.json5 `tool_tally`: missing locale key `research.tool_tally.name`",
    );
  });
});
