import { type BaseState, newBase } from "@wipe-day/domain/state";
import { describe, expect, it } from "vitest";
import { computeAdvisor } from "../state/advisor";
import { seedPace } from "../state/pace";
import { content } from "../state/world";
import {
  affordIn,
  collapsedRows,
  crownTab,
  linesTab,
  milestoneNote,
  pickRow,
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

const crowned = (rows: { crowned: boolean }[]) => rows.filter((row) => row.crowned).length;

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

describe("the collapsed drawer (08-screens.md 1.4)", () => {
  it("shows the crowned row first, then the next two by score", () => {
    const view = viewOf({ supplies: 7 });
    const rows = collapsedRows(view, 1);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.key).toBe("line:beachcomber");
    expect(rows[0]?.crowned).toBe(true);
    expect(crowned(rows)).toBe(1);
  });

  it("has no orange row while the crown is on the tap hint (resolution 3.25)", () => {
    const view = viewOf({ supplies: 2, lines: { beachcomber: 1 } });
    expect(view.pick.kind).toBe("tap");
    expect(crowned(collapsedRows(view, 1))).toBe(0);
  });

  it("an idle player is never crowned an unmanned line", () => {
    const view = viewOf({ supplies: 7 }, 0);
    const rows = collapsedRows(view, 1);
    expect(rows.find((row) => row.crowned)?.kind ?? "none").not.toBe("line");
  });
});

describe("the expanded drawer, a view of its own", () => {
  it("crowns exactly one row on each tab, even when the island crowns the hint", () => {
    for (const patch of [{ supplies: 2, lines: { beachcomber: 1 } }, STONE]) {
      const view = viewOf(patch);
      expect(crowned(crownTab(linesTab(view, 1), view))).toBe(1);
      const shelf = upgradesTab(view).rows;
      if (shelf.some((row) => row.command)) expect(crowned(crownTab(shelf, view))).toBe(1);
    }
  });

  it("lists the era first, lines in order with their hand rows, the next era's lines locked", () => {
    const view = viewOf(STONE);
    const rows = linesTab(view, 1);
    expect(rows[0]?.key).toBe("era:metal");
    const keys = rows.map((row) => row.key);
    expect(keys.indexOf("hand:furnace")).toBe(keys.indexOf("line:furnace") + 1);
    const locked = rows.filter((row) => row.locked).map((row) => row.key);
    expect(locked).toEqual(["line:dock", "line:generator", "line:radio_mast"]);
    expect(rows.find((row) => row.key === "line:dock")?.note).toBe("Opens in the Sheet Metal era");
  });

  it("never shows the Armored era before its Wipe Day (D140)", () => {
    const view = viewOf({ ...STONE, era: "metal" });
    expect(linesTab(view, 1).some((row) => row.key.startsWith("era:"))).toBe(false);
    expect(linesTab(view, 1).some((row) => row.key === "line:reactor")).toBe(false);
  });

  it("shows a Line Mk short of units with its real reason", () => {
    const view = viewOf(STONE);
    const mk = upgradesTab(view).rows.find((row) => row.key === "upgrade:furnace_mk2");
    expect(mk?.locked).toBe(true);
    expect(mk?.note).toBe("Needs 25 Furnaces (12 now)");
    expect(mk?.button.enabled).toBe(false);
  });

  it("the desktop column pins the island's pick, and nothing while the hint has the crown", () => {
    expect(pickRow(viewOf({ supplies: 2, lines: { beachcomber: 1 } }), 1)).toBeNull();
    const pinned = pickRow(viewOf(STONE), 1);
    expect(pinned?.crowned).toBe(true);
    expect(pinned?.command).not.toBeNull();
  });
});

describe("row words", () => {
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
