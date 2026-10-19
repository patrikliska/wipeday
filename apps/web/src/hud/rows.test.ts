import { type BaseState, newBase } from "@wipe-day/domain/state";
import { describe, expect, it } from "vitest";
import { computeAdvisor } from "../state/advisor";
import { seedPace } from "../state/pace";
import { content } from "../state/world";
import {
  affordIn,
  cardCrowned,
  crownPick,
  crownPlace,
  eraPlate,
  linesTab,
  milestoneNote,
  milestoneSpan,
  type Row,
  researchTab,
  upgradesTab,
  workshopShown,
} from "./rows";

const T0 = 1_700_000_000;
const MS = T0 * 1000;

type Stats = BaseState["meta"]["stats"];

const base = (patch: Partial<BaseState["run"]> = {}, stats: Partial<Stats> = {}): BaseState => {
  const fresh = newBase(content, T0, 7);
  return {
    ...fresh,
    run: { ...fresh.run, startedAt: T0 - 60, ...patch },
    meta: { ...fresh.meta, stats: { ...fresh.meta.stats, ...stats } },
  };
};

/** The advisor's view for a player tapping `pace` a second, new to everything unless `stats`. */
const viewOf = (patch: Partial<BaseState["run"]> = {}, pace = 6, stats: Partial<Stats> = {}) => {
  seedPace(pace, MS);
  return computeAdvisor(base(patch, stats), T0, MS);
};

/** A player who has bought every kind of purchase before: past onboarding (D244). */
const VETERAN: Partial<Stats> = { units: 500, hands: 20, research: 50, upgrades: 10, eras: 6 };

/** Crowned buttons, a card's Buy and its hire counted apart. */
const crowns = (rows: Row[]) =>
  rows.filter((row) => row.crowned).length + rows.filter((row) => row.hire?.crowned).length;

const keys = (rows: Row[]) => rows.map((row) => row.key);

const STONE = {
  era: "stone" as const,
  supplies: 31.2e6,
  lines: {
    beachcomber: 62,
    campfire: 48,
    garden: 36,
    loom: 26,
    workbench: 14,
    kiln: 9,
    furnace: 12,
  },
  hands: ["beachcomber", "campfire", "garden", "loom", "workbench", "kiln"],
  upgrades: ["stone_tools", "sorting_tables", "iron_tools"],
};

describe("the shop's fixed order (D186)", () => {
  it("lists the lines by rung, then the next era's lines locked (the era is the plate)", () => {
    const rows = linesTab(viewOf(STONE), 1);
    expect(keys(rows)).toEqual([
      "line:beachcomber",
      "line:campfire",
      "line:garden",
      "line:loom",
      "line:workbench",
      "line:kiln",
      "line:furnace",
      "line:tannery",
      "line:press",
      "line:dock",
      "line:generator",
      "line:radio_mast",
    ]);
    const locked = rows.filter((row) => row.locked).map((row) => row.key);
    expect(locked).toEqual(["line:dock", "line:generator", "line:radio_mast"]);
    expect(rows.find((row) => row.key === "line:dock")?.note).toBe("Opens in the Sheet Metal era");
  });

  it("never moves a card when the supplies, the pace or the crown change", () => {
    const order = keys(linesTab(viewOf(STONE), 1));
    for (const supplies of [0, 1e3, 4e5, 3e7, 9e9])
      for (const pace of [0, 2, 12]) {
        const view = viewOf({ ...STONE, supplies }, pace);
        expect(keys(crownPick(linesTab(view, 1), view))).toEqual(order);
        expect(keys(crownPick(linesTab(view, 10), view))).toEqual(order);
      }
  });

  it("keeps the order through three purchases", () => {
    let run = { ...STONE, lines: { ...STONE.lines } };
    const order = keys(linesTab(viewOf(run), 1));
    for (const line of ["kiln", "beachcomber", "furnace"] as const) {
      run = { ...run, lines: { ...run.lines, [line]: run.lines[line] + 1 } };
      expect(keys(linesTab(viewOf(run), 1))).toEqual(order);
    }
  });

  it("an era bought unlocks its lines where they already stood", () => {
    const twig = viewOf({ supplies: 2e3, lines: { beachcomber: 12, campfire: 3 } });
    const before = keys(linesTab(twig, 1));
    const timber = viewOf({ era: "wood", supplies: 0, lines: { beachcomber: 12, campfire: 3 } });
    const after = keys(linesTab(timber, 1));
    expect(before.slice(0, 3)).toEqual(after.slice(0, 3));
    expect(after.indexOf("line:loom")).toBe(before.indexOf("line:loom"));
  });

  it("orders the Shelf by price", () => {
    const view = viewOf(STONE);
    const rows = upgradesTab(view).rows;
    expect(rows.length).toBeGreaterThan(1);
    const again = upgradesTab(viewOf({ ...STONE, supplies: 1 })).rows;
    expect(keys(again)).toEqual(keys(rows));
  });
});

describe("the onboarding crown on the cards (CLAUDE.md 6.3 rule 1; D244)", () => {
  it("lights the island's pick in place, and nothing while the crown is on the tap hint", () => {
    const start = viewOf({ supplies: 7 });
    const rows = crownPick(linesTab(start, 1), start);
    expect(rows[0]?.key).toBe("line:beachcomber");
    expect(rows[0]?.crowned).toBe(true);
    expect(crowns(rows)).toBe(1);

    const hint = viewOf({ supplies: 2, lines: { beachcomber: 1 } });
    expect(hint.pick.kind).toBe("tap");
    expect(crowns(crownPick(linesTab(hint, 1), hint))).toBe(0);
  });

  it("lights nothing once every kind has been bought twice: the game never advises", () => {
    for (const patch of [{ supplies: 7 }, { supplies: 2, lines: { beachcomber: 1 } }, STONE]) {
      const view = viewOf(patch, 6, VETERAN);
      expect(view.crown).toBeNull();
      expect(view.tapHint).toBe(false);
      expect(crowns(crownPick(linesTab(view, 1), view))).toBe(0);
      expect(crowns(crownPick(upgradesTab(view).rows, view))).toBe(0);
      expect(crowns(crownPick(researchTab(view, 1).rows, view))).toBe(0);
    }
  });

  it("stops lighting a kind after its second purchase, while others still light", () => {
    // Two units bought: the first line is no longer lit, and the tap hint is gone.
    const lines = viewOf({ supplies: 7 }, 6, { units: 2 });
    expect(lines.pick.kind).toBe("purchase");
    expect(lines.crown).toBeNull();
    expect(lines.tapHint).toBe(false);
    // ...but the first hire still is.
    const hire = viewOf({ era: "wood", supplies: 4e3, lines: { beachcomber: 12 } }, 6, {
      units: 12,
    });
    if (hire.pick.kind === "purchase" && hire.pick.choice.command.type === "hire_hand")
      expect(hire.crown?.command).toEqual({ type: "hire_hand", line: "beachcomber" });
  });

  it("carries a line's hire on its card, and crowns the hire there", () => {
    const view = viewOf({ era: "wood", supplies: 4e3, lines: { beachcomber: 12 } });
    const rows = crownPick(linesTab(view, 1), view);
    const card = rows.find((row) => row.key === "line:beachcomber");
    expect(card?.hire?.command).toEqual({ type: "hire_hand", line: "beachcomber" });
    expect(card?.hire?.button.top).toBe("Hire Mara");
    expect(crownPlace(view)).toEqual({ tab: "lines", key: "line:beachcomber" });
    if (view.pick.kind === "purchase" && view.pick.choice.command.type === "hire_hand") {
      expect(card?.hire?.crowned).toBe(true);
      expect(card?.crowned).toBe(false);
    }
    expect(card ? cardCrowned(card) : false).toBe(true);
    // A manned line has no hire; an unowned one neither.
    const manned = linesTab(viewOf(STONE), 1);
    expect(manned.find((row) => row.key === "line:loom")?.hire).toBeUndefined();
    expect(manned.find((row) => row.key === "line:tannery")?.hire).toBeUndefined();
    expect(manned.find((row) => row.key === "line:furnace")?.hire).toBeDefined();
  });

  it("an idle player is never crowned more of an unmanned line", () => {
    // Three Beachcombers and no Mara: another one would only run while tapping. (A first unit
    // of a new line may be crowned, as the way to its hand; D177.)
    const view = viewOf({ supplies: 30, lines: { beachcomber: 3 } }, 0);
    const rows = crownPick(linesTab(view, 1), view);
    expect(rows.find((row) => row.crowned)?.key ?? "none").not.toBe("line:beachcomber");
  });

  it("names where the lit purchase lives, so the collapsed drawer keeps it in sight", () => {
    expect(crownPlace(viewOf({ supplies: 2, lines: { beachcomber: 1 } }))).toBeNull();
    expect(crownPlace(viewOf({ supplies: 7 }))).toEqual({ tab: "lines", key: "line:beachcomber" });
    expect(crownPlace(viewOf(STONE, 6, VETERAN))).toBeNull();
  });
});

describe("cards", () => {
  it("never shows the Armored era before its Wipe Day (D140)", () => {
    const view = viewOf({ ...STONE, era: "metal" });
    expect(eraPlate(view)).toBeNull();
    expect(linesTab(view, 1).some((row) => row.key === "line:reactor")).toBe(false);
  });

  it("shows a Line Mk short of units in the Workshop, with its real reason and how far along", () => {
    const view = viewOf({ ...STONE, startedAt: T0 - 600 });
    const mk = researchTab(view, 1).rows.find((row) => row.key === "research:furnace_mk");
    expect(mk?.locked).toBe(true);
    expect(mk?.name).toBe("Bellows");
    expect(mk?.mk).toBe("Mk II");
    expect(mk?.note).toBe("Needs 25 Furnaces (12 now)");
    expect(mk?.progress).toBeCloseTo(12 / 25);
    expect(mk?.button.enabled).toBe(false);
    // The shelf keeps Grip, the eras and the island upgrades (D194).
    expect(upgradesTab(view).rows.some((row) => row.key.endsWith("_mk2"))).toBe(false);
  });

  it("lays the Workshop out by era in a fixed order, the next era locked with its reason", () => {
    const view = viewOf({
      era: "wood",
      supplies: 5e4,
      startedAt: T0 - 600,
      lines: { beachcomber: 30 },
    });
    const { groups } = researchTab(view, 1);
    expect(groups.map((group) => [group.era, group.locked ?? null])).toEqual([
      ["twig", null],
      ["wood", null],
      ["stone", "Opens in the Stone era"],
    ]);
    const twig = groups[0]?.rows ?? [];
    expect(twig.map((row) => row.key).slice(0, 5)).toEqual([
      "research:sharper_hooks",
      "research:dry_kindling",
      "research:raised_beds",
      "research:spare_wicks",
      "research:calloused_thumbs",
    ]);
    const hooks = twig[0];
    expect(hooks?.sub).toBe("+5% Beachcomber");
    expect(hooks?.level).toEqual({ n: 0, of: 25 });
    expect(hooks?.gain).toMatch(/^\+/);
    expect(twig.find((row) => row.key === "research:spare_wicks")?.gain).toBe("2h → 2h 20m");
    expect(twig.find((row) => row.key === "research:camp_routine")?.sub).toBe("Twig lines +4%");
    expect(twig.find((row) => row.key === "research:tally_sticks")?.sub).toBe("Every line +1%");
    // Buying levels changes prices, never places.
    const after = viewOf({
      era: "wood",
      supplies: 5e4,
      startedAt: T0 - 600,
      lines: { beachcomber: 30 },
      research: { sharper_hooks: 25, raised_beds: 3 },
    });
    const again = researchTab(after, 1);
    expect(again.rows.map((row) => row.key)).toEqual(
      researchTab(view, 1).rows.map((row) => row.key),
    );
    expect(again.rows[0]?.button).toMatchObject({ top: "Done", enabled: false });
    expect(
      crownPlace({
        ...after,
        crown: {
          command: { type: "buy_research", item: "dry_kindling", count: 1 },
          cost: 40,
          gain: 1,
          score: 1,
          affordable: true,
        },
      }),
    ).toEqual({ tab: "research", key: "research:dry_kindling" });
  });

  it("keeps the Workshop shut for the first two minutes", () => {
    expect(workshopShown(viewOf({ startedAt: T0 - 60 }))).toBe(false);
    expect(workshopShown(viewOf({ startedAt: T0 - 120 }))).toBe(true);
  });

  it("draws a line at the stage the island shows", () => {
    const rows = linesTab(viewOf(STONE), 1);
    expect(rows.find((row) => row.key === "line:beachcomber")?.art).toBe("line/beachcomber_2");
    expect(rows.find((row) => row.key === "line:kiln")?.art).toBe("line/kiln_1");
    expect(rows.find((row) => row.key === "line:tannery")?.note).toBe("Makes Leather");
  });

  it("fills the bar from the last milestone to the next", () => {
    const loom = content.lines.find((line) => line.id === "loom");
    if (!loom) throw new Error("loom");
    expect(milestoneSpan(loom, 4)).toEqual({ from: 0, at: 10 });
    expect(milestoneSpan(loom, 17)).toEqual({ from: 10, at: 25 });
    expect(milestoneSpan(loom, 450)).toEqual({ from: 400, at: 500 });
    expect(milestoneSpan(loom, 1050)).toEqual({ from: 1000, at: 1100 });
    const card = linesTab(viewOf(STONE), 1).find((row) => row.key === "line:loom");
    expect(card?.progress).toBeCloseTo((26 - 25) / (50 - 25));
  });
});

describe("card words", () => {
  it("names the next milestone", () => {
    const loom = content.lines.find((line) => line.id === "loom");
    if (!loom) throw new Error("loom");
    expect(milestoneNote(loom, 4)).toBe("4/10 → ×2");
    expect(milestoneNote(loom, 17)).toBe("17/25 → speed ×2");
    expect(milestoneNote(loom, 999)).toBe("999/1,000 → ×5");
    expect(milestoneNote(loom, 1050)).toBe("×2 every 100 · next at 1,100");
  });

  it("buys ×10 at ten units' price, Max as many as the supplies allow", () => {
    const view = viewOf({ supplies: 5000, lines: { beachcomber: 10 } });
    const ten = linesTab(view, 10).find((row) => row.key === "line:beachcomber");
    expect(ten?.button.top).toBe("Buy ×10");
    const max = linesTab(view, "max").find((row) => row.key === "line:beachcomber");
    expect(max?.button.top).toMatch(/^Buy \d+$/);
    expect(max?.command).toEqual({ type: "buy_line", line: "beachcomber", count: "max" });
  });

  it("says how long until a price is reached, or to tap", () => {
    const view = viewOf({ supplies: 0 }, 0);
    expect(affordIn(100, view)).toBe("tap to earn");
    const earning = { ...view, income: 10 };
    expect(affordIn(100, earning)).toBe("in 10s");
    expect(affordIn(0, earning)).toBe("");
  });
});

describe("the era plate and its sheet (D245)", () => {
  it("tells the next era's price, how far along, and what it brings", () => {
    const view = viewOf({ ...STONE, startedAt: T0 - 600 }, 6, VETERAN);
    const plate = eraPlate(view);
    expect(plate?.era).toBe("metal");
    expect(plate?.name).toBe("Sheet Metal era");
    expect(plate?.command).toEqual({ type: "buy_era", era: "metal" });
    expect(plate?.price).toBe("20.0B");
    expect(plate?.ready).toBe(false);
    expect(plate?.progress).toBeCloseTo(31.2e6 / 2e10);
    expect(plate?.eta).toMatch(/^in /);
    expect(plate?.factor).toBe("2");
    expect(plate?.lines.map((line) => line.id)).toEqual(["dock", "generator", "radio_mast"]);
    expect(plate?.target).toEqual({ id: "sulfur", name: "Sulfur Vent" });
    expect(plate?.house).toEqual({ from: "stone house", to: "shed" });
    expect(plate?.workshop).toBe(content.research.filter((def) => def.era === "metal").length);
    expect(plate?.left).toBeNull();
    expect(plate?.need).toBe("20.0B");
    expect(plate?.crowned).toBe(false);
  });

  it("says Build and what is left once the supplies reach the price", () => {
    const view = viewOf({ era: "wood", supplies: 4e6, lines: { beachcomber: 40 } }, 6, VETERAN);
    const plate = eraPlate(view);
    expect(plate?.era).toBe("stone");
    expect(plate?.ready).toBe(true);
    expect(plate?.progress).toBe(1);
    expect(plate?.eta).toBe("");
    expect(plate?.left).toBe("1.00M");
    expect(plate?.need).toBeNull();
    expect(plate?.label).toContain("ready to build");
  });

  it("counts the Workshop's items only once the Workshop is open", () => {
    expect(eraPlate(viewOf({ supplies: 10, startedAt: T0 - 60 }))?.workshop).toBe(0);
    expect(eraPlate(viewOf({ supplies: 10, startedAt: T0 - 600 }))?.workshop).toBeGreaterThan(0);
  });

  it("is lit only while it is the onboarding pick (D244)", () => {
    const view = viewOf({ supplies: 2e3, lines: { beachcomber: 12 } }, 6, VETERAN);
    expect(eraPlate(view)?.crowned).toBe(false);
    const lit = {
      ...view,
      crown: {
        command: { type: "buy_era" as const, era: "wood" },
        cost: 1.5e3,
        gain: 1,
        score: 1,
        affordable: true,
      },
    };
    expect(eraPlate(lit)?.crowned).toBe(true);
    // The plate is always in sight: the collapsed drawer has nothing to follow.
    expect(crownPlace(lit)).toBeNull();
  });
});
