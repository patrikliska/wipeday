import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { lineOf } from "@wipe-day/domain/lines";
import { type BaseState, newBase } from "@wipe-day/domain/state";
import { describe, expect, it } from "vitest";
import { milestoneAt, milestoneCrossed, plotShown } from "./reveal";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;

const run = (patch: Partial<BaseState["run"]>): BaseState => {
  const base = newBase(content, T0, 3);
  return { ...base, run: { ...base.run, ...patch } };
};

const line = (id: string) => {
  const def = lineOf(content, id);
  if (!def) throw new Error(`no line ${id}`);
  return def;
};

describe("plots on the island", () => {
  it("show nothing on a new island: the beach and the pine (rule 6.3.6)", () => {
    const fresh = run({});
    for (const id of ["beachcomber", "campfire", "garden"]) {
      expect(plotShown(content, fresh, line(id))).toBe(false);
    }
  });

  it("reveal Twig's lines one by one, as the run first makes each price", () => {
    const state = run({ made: 100 });
    expect(plotShown(content, state, line("beachcomber"))).toBe(true);
    expect(plotShown(content, state, line("campfire"))).toBe(true);
    expect(plotShown(content, state, line("garden"))).toBe(false);
  });

  it("show a later era's three together the moment it opens, and nothing beyond it", () => {
    const state = run({ era: "wood", made: 1500 });
    for (const id of ["loom", "workbench", "kiln"]) {
      expect(plotShown(content, state, line(id))).toBe(true);
    }
    expect(plotShown(content, state, line("furnace"))).toBe(false);
  });
});

describe("milestones in the scene", () => {
  it("name each milestone of milestones.json5 at exactly its count", () => {
    expect(milestoneAt(content, 10)).toEqual({ factor: 2, speed: false });
    expect(milestoneAt(content, 25)).toEqual({ factor: 2, speed: true });
    expect(milestoneAt(content, 11)).toBeNull();
  });

  it("follow lineEvery past the list, with its specials", () => {
    expect(milestoneAt(content, 600)).toEqual({ factor: 2, speed: false });
    expect(milestoneAt(content, 1000)).toEqual({ factor: 5, speed: false });
    expect(milestoneAt(content, 650)).toBeNull();
  });

  it("report the highest one a bulk purchase crossed, and none for a plain buy", () => {
    expect(milestoneCrossed(content, 8, 26)).toEqual({ factor: 2, speed: true });
    expect(milestoneCrossed(content, 11, 12)).toBeNull();
  });
});
