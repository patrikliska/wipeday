import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../content/load";
import { discoverPaths } from "../paths";
import { Locale } from "../ui/locale";
import {
  accrued,
  clampToCap,
  collect,
  gather,
  gatherReadyAt,
  isStorageFull,
  newBase,
  nextTool,
  shortfall,
  storageCap,
  total,
  upgradeTool,
} from "./base";

const paths = discoverPaths();
const content = loadContent(paths.data, Locale.load(join(paths.locale, "en.json")));
const T0 = 1_700_000_000;
const rock = content.tools[0];
const stoneTools = content.tools[1];
if (!rock || !stoneTools) throw new Error("need two tools");

describe("a new base", () => {
  it("starts on twig with the first tool and a zero slot per gathered resource", () => {
    const base = newBase(content, T0);
    expect(base.tier).toBe("twig");
    expect(base.toolId).toBe(rock.id);
    expect(base.stock).toEqual(Object.fromEntries(Object.keys(rock.rates).map((id) => [id, 0])));
    expect(accrued(content, base, T0)).toEqual({ wood: 0, stone: 0 });
  });
});

describe("accrual", () => {
  it("is linear in time and rounds down", () => {
    const base = newBase(content, T0);
    expect(accrued(content, base, T0 + 3600)).toEqual({
      wood: rock.rates.wood,
      stone: rock.rates.stone,
    });
    expect(accrued(content, base, T0 + 1800)).toEqual({ wood: 60, stone: 40 });
    expect(accrued(content, base, T0 + 1)).toEqual({ wood: 0, stone: 0 });
  });

  it("never goes backwards in time", () => {
    const base = newBase(content, T0);
    expect(total(accrued(content, base, T0 - 3600))).toBe(0);
  });

  it("stops each resource at its own cap", () => {
    const base = newBase(content, T0);
    const cap = storageCap(content, base);
    const week = accrued(content, base, T0 + 7 * 86400);
    expect(week).toEqual({ wood: cap, stone: cap });
    expect(isStorageFull(content, base, T0 + 7 * 86400)).toBe(true);
    expect(isStorageFull(content, base, T0 + 3600)).toBe(false);
    // Wood fills first at 120/h vs 80/h; stone keeps accruing after wood is capped.
    const later = accrued(content, base, T0 + 15 * 3600);
    expect(later.wood).toBe(cap);
    expect(later.stone).toBe(80 * 15);
  });

  it("clampToCap never overflows and handles no room", () => {
    expect(clampToCap(100, { a: 90 }, { a: 30, b: 30 })).toEqual({ a: 10, b: 30 });
    expect(clampToCap(100, { a: 100 }, { a: 3 })).toEqual({ a: 0 });
    expect(clampToCap(100, { a: 150 }, { a: 3 })).toEqual({ a: 0 });
  });
});

describe("collect", () => {
  it("banks the accrual and restarts the window", () => {
    const base = newBase(content, T0);
    const first = collect(content, base, T0 + 3600);
    expect(first.gained).toEqual({ wood: 120, stone: 80 });
    expect(first.state.stock).toEqual({ wood: 120, stone: 80 });
    expect(first.state.lastCollectedAt).toBe(T0 + 3600);

    const again = collect(content, first.state, T0 + 3600);
    expect(again.gained).toEqual({ wood: 0, stone: 0 });
    expect(again.state.stock).toEqual(first.state.stock);
  });

  it("is deterministic: same inputs, same result, as after a restart", () => {
    const base = newBase(content, T0);
    expect(collect(content, base, T0 + 5000)).toEqual(
      collect(content, structuredClone(base), T0 + 5000),
    );
  });
});

describe("gather", () => {
  it("is ready at once for a new base and grants the bonus", () => {
    const base = newBase(content, T0);
    expect(gatherReadyAt(content, base)).toBeLessThanOrEqual(T0);
    const result = gather(content, base, T0);
    if (!result.ok) throw new Error("expected ok");
    expect(result.bonus).toEqual({ wood: 60, stone: 40 });
    expect(result.gained).toEqual({ wood: 0, stone: 0 });
    expect(result.state.stock).toEqual({ wood: 60, stone: 40 });
    expect(result.state.lastGatherAt).toBe(T0);
  });

  it("refuses during the cooldown and says when", () => {
    const base = newBase(content, T0);
    const first = gather(content, base, T0);
    if (!first.ok) throw new Error("expected ok");
    const readyAt = T0 + rock.cooldownMinutes * 60;
    expect(gather(content, first.state, T0 + 60)).toEqual({
      ok: false,
      reason: "cooldown",
      readyAt,
    });
    expect(gather(content, first.state, readyAt).ok).toBe(true);
  });

  it("banks the accrual before adding the bonus, both within the cap", () => {
    const base = newBase(content, T0);
    const result = gather(content, base, T0 + 30 * 86400);
    if (!result.ok) throw new Error("expected ok");
    const cap = storageCap(content, base);
    expect(result.state.stock).toEqual({ wood: cap, stone: cap });
    expect(total(result.bonus)).toBe(0);
  });
});

describe("tool upgrade", () => {
  it("reports what is missing", () => {
    const base = newBase(content, T0);
    expect(upgradeTool(content, base, T0)).toEqual({
      ok: false,
      reason: "unaffordable",
      tool: stoneTools,
      missing: stoneTools.cost,
    });
    expect(shortfall({ wood: 240 }, { wood: 200 })).toEqual({ wood: 40 });
    expect(shortfall({ wood: 240 }, { wood: 240 })).toEqual({});
  });

  it("pays, switches tool, banks the old-rate accrual and reveals new resources", () => {
    const base = { ...newBase(content, T0), stock: { wood: 1000, stone: 1000 } };
    const result = upgradeTool(content, base, T0 + 3600);
    if (!result.ok) throw new Error("expected ok");
    expect(result.tool.id).toBe(stoneTools.id);
    expect(result.gained).toEqual({ wood: 120, stone: 80 });
    expect(result.state.stock).toMatchObject({
      wood: 1000 + 120 - (stoneTools.cost.wood ?? 0),
      stone: 1000 + 80 - (stoneTools.cost.stone ?? 0),
      metal_ore: 0,
      sulfur_ore: 0,
    });
    expect(result.state.lastCollectedAt).toBe(T0 + 3600);
    expect(nextTool(content, result.state)?.id).toBe(content.tools[2]?.id);
  });

  it("stops at the top tier", () => {
    const top = content.tools.at(-1);
    if (!top) throw new Error("no tools");
    const base = { ...newBase(content, T0), toolId: top.id, stock: { wood: 1e9 } };
    expect(upgradeTool(content, base, T0)).toEqual({ ok: false, reason: "maxed" });
  });
});
