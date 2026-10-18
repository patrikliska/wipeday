import { type BaseState, newBase } from "@wipe-day/domain/state";
import { describe, expect, it } from "vitest";
import { computeAdvisor } from "../state/advisor";
import { seedPace } from "../state/pace";
import { content } from "../state/world";
import {
  affordIn,
  cardCrowned,
  crownPick,
  crownTab,
  linesTab,
  milestoneNote,
  milestoneSpan,
  pickPlace,
  type Row,
  upgradesTab,
} from "./rows";

const T0 = 1_700_000_000;
const MS = T0 * 1000;

const base = (patch: Partial<BaseState["run"]> = {}): BaseState => {
  const fresh = newBase(content, T0, 7);
  return { ...fresh, run: { ...fresh.run, startedAt: T0 - 60, ...patch } };
};

/** The advisor's view for a player tapping `pace` a second. */
const viewOf = (patch: Partial<BaseState["run"]> = {}, pace = 6) => {
  seedPace(pace, MS);
  return computeAdvisor(base(patch), T0, MS);
};

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
  it("lists the lines by rung, the next era's card after them, then its lines locked", () => {
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
      "era:metal",
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
        expect(keys(crownTab(linesTab(view, 10), view))).toEqual(order);
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
    const loom = before.indexOf("line:loom");
    expect(after.indexOf("line:loom")).toBe(loom - 1);
  });

  it("orders the Shelf by price", () => {
    const view = viewOf(STONE);
    const rows = upgradesTab(view).rows;
    expect(rows.length).toBeGreaterThan(1);
    const again = upgradesTab(viewOf({ ...STONE, supplies: 1 })).rows;
    expect(keys(again)).toEqual(keys(rows));
  });
});

describe("the crown on the cards (CLAUDE.md 6.3 rule 1)", () => {
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

  it("an expanded tab crowns exactly one button, even when the island crowns the hint", () => {
    for (const patch of [{ supplies: 2, lines: { beachcomber: 1 } }, STONE]) {
      const view = viewOf(patch);
      expect(crowns(crownTab(linesTab(view, 1), view))).toBe(1);
      const shelf = upgradesTab(view).rows;
      if (shelf.some((row) => row.command)) expect(crowns(crownTab(shelf, view))).toBe(1);
    }
  });

  it("carries a line's hire on its card, and crowns the hire there", () => {
    const view = viewOf({ era: "wood", supplies: 4e3, lines: { beachcomber: 12 } });
    const rows = crownPick(linesTab(view, 1), view);
    const card = rows.find((row) => row.key === "line:beachcomber");
    expect(card?.hire?.command).toEqual({ type: "hire_hand", line: "beachcomber" });
    expect(card?.hire?.button.top).toBe("Hire Mara");
    expect(pickPlace(view)).toEqual({ tab: "lines", key: "line:beachcomber" });
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

  it("names where the pick lives, for the Best buy chip", () => {
    expect(pickPlace(viewOf({ supplies: 2, lines: { beachcomber: 1 } }))).toBeNull();
    const place = pickPlace(viewOf(STONE));
    expect(place?.tab === "lines" || place?.tab === "upgrades").toBe(true);
  });
});

describe("cards", () => {
  it("never shows the Armored era before its Wipe Day (D140)", () => {
    const view = viewOf({ ...STONE, era: "metal" });
    expect(linesTab(view, 1).some((row) => row.key.startsWith("era:"))).toBe(false);
    expect(linesTab(view, 1).some((row) => row.key === "line:reactor")).toBe(false);
  });

  it("shows a Line Mk short of units with its real reason and how far along it is", () => {
    const view = viewOf(STONE);
    const mk = upgradesTab(view).rows.find((row) => row.key === "upgrade:furnace_mk2");
    expect(mk?.locked).toBe(true);
    expect(mk?.note).toBe("Needs 25 Furnaces (12 now)");
    expect(mk?.progress).toBeCloseTo(12 / 25);
    expect(mk?.button.enabled).toBe(false);
    expect(mk?.art).toBe("line/furnace_1");
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
