/**
 * R1's purchases beyond lines and hands (docs/redesign/02-the-run.md 2.5, 4, 5 and 6): Grip,
 * Line Mks, island upgrades and eras, their refusals, milestones and the roster, and the tap's
 * global fold (errata E23), with 02's worked numbers.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { applyCommand, type Command, type CommandResult } from "./commands";
import { milestoneFactors, rates } from "./effects";
import { costOf, lineOf, maxAffordable } from "./lines";
import { mannedRate } from "./settle";
import { type BaseState, newBase } from "./state";
import { tapParts } from "./taps";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;

const fresh = (patch: Partial<BaseState["run"]> = {}): BaseState => {
  const base = newBase(content, T0, 5);
  return { ...base, run: { ...base.run, ...patch } };
};

const run = (state: BaseState, command: Command, at = T0 + 1): CommandResult =>
  applyCommand(content, state, command, at);

function ok(result: CommandResult): BaseState {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.refusal)}`);
  return result.state;
}

const line = (id: string) => {
  const found = lineOf(content, id);
  if (!found) throw new Error(id);
  return found;
};

describe("02's price vectors (2.4, 2.5)", () => {
  it("prices the 10th Loom at 75.0k and buys the most supplies allow", () => {
    const loom = line("loom");
    expect(costOf(loom, 9, 1) / 75.0e3).toBeCloseTo(1, 2);
    // Owning 10 Looms with 1M: Max buys 7 for 889k.
    expect(maxAffordable(loom, 10, 1e6)).toBe(7);
    expect(costOf(loom, 10, 7) / 889e3).toBeCloseTo(1, 2);
    // Owning 40 Furnaces with 1T: Max buys 25 for 919B.
    const furnace = line("furnace");
    expect(maxAffordable(furnace, 40, 1e12)).toBe(25);
    expect(costOf(furnace, 40, 25) / 919e9).toBeCloseTo(1, 2);
  });
});

describe("milestones (02 4.1)", () => {
  it("multiply payout and speed by the table, then every 100 from 500", () => {
    expect(milestoneFactors(content, 9)).toEqual({ payout: 1, speed: 1 });
    expect(milestoneFactors(content, 10)).toEqual({ payout: 2, speed: 1 });
    expect(milestoneFactors(content, 50)).toEqual({ payout: 2, speed: 4 });
    expect(milestoneFactors(content, 400)).toEqual({ payout: 2 * 2 * 3 * 3 * 4, speed: 4 });
    expect(milestoneFactors(content, 999).payout).toBe(144 * 2 ** 5);
    expect(milestoneFactors(content, 1000).payout).toBe(144 * 2 ** 5 * 5);
    expect(milestoneFactors(content, 1250).payout).toBe(144 * 2 ** 5 * 5 * 2 ** 2);
    // Closed form: a huge count never loops.
    expect(Number.isFinite(milestoneFactors(content, 1e308).payout)).toBe(false);
  });

  it("halve a line's cycle at 25 and 50 owned, never under the floor", () => {
    const at = (n: number) =>
      mannedRate(content, fresh({ lines: { beachcomber: n }, hands: ["beachcomber"] }), T0);
    // 50 owned: ×2 (10) and speed ×4 (25, 50): 50 × 1.5 × 2 × 4 a second.
    expect(at(50)).toBeCloseTo(50 * 1.5 * 2 * 4, 9);
  });

  it("reach roster tiers when every open line has the count, and keep them for the run", () => {
    let state = fresh({ supplies: 1e12 });
    for (const id of ["beachcomber", "campfire", "garden"]) {
      state = ok(run(state, { type: "buy_line", line: id, count: 10 }));
      state = ok(run(state, { type: "buy_line", line: id, count: 10 }));
    }
    expect(state.run.roster).toBe(0);
    for (const id of ["beachcomber", "campfire"]) {
      state = ok(run(state, { type: "buy_line", line: id, count: 1 }));
      for (let i = 0; i < 4; i++) state = ok(run(state, { type: "buy_line", line: id, count: 1 }));
    }
    expect(state.run.roster).toBe(0);
    for (let i = 0; i < 5; i++)
      state = ok(run(state, { type: "buy_line", line: "garden", count: 1 }));
    expect(state.run.roster).toBe(1);
    // The Timber era opens three lines at 0: the tier stays, and income never falls.
    const hands = { ...state, run: { ...state.run, hands: ["beachcomber", "campfire", "garden"] } };
    const before = mannedRate(content, hands, T0 + 2);
    const after = ok(run(hands, { type: "buy_era", era: "wood" }, T0 + 2));
    expect(after.run.roster).toBe(1);
    expect(mannedRate(content, after, T0 + 2)).toBeCloseTo(before * 2, 6);
  });
});

describe("buy_upgrade (02 5.2-5.4)", () => {
  it("buys Grip in order, doubling the flat tap and adding 0.4% of the full rate", () => {
    let state = fresh({ supplies: 1e5 });
    const iron = run(state, { type: "buy_upgrade", upgrade: "iron_tools" });
    expect(iron.ok || iron.refusal).toEqual({
      reason: "locked",
      gate: { kind: "previous", value: "stone_tools" },
    });
    expect(tapParts(content, state, T0).base).toBe(1);
    state = ok(run(state, { type: "buy_upgrade", upgrade: "stone_tools" }));
    expect(state.run.supplies).toBe(1e5 - 60);
    expect(tapParts(content, state, T0 + 1).base).toBe(2);
    expect(run(state, { type: "buy_upgrade", upgrade: "stone_tools" })).toMatchObject({
      ok: false,
      refusal: { reason: "owned" },
    });
    // With 10 Beachcombers (×2 at 10): the full rate is 10 × 1.5 × 2 = 30, 0.4% of it 0.12.
    state = ok(run(state, { type: "buy_line", line: "beachcomber", count: 10 }));
    expect(tapParts(content, state, T0 + 2).base).toBeCloseTo(2 + 0.004 * 30, 12);
  });

  it("needs 25 of a line for its Mk II, then Mk II for its Mk III, each ×3", () => {
    let state = fresh({ supplies: 1e12, lines: { beachcomber: 24 }, hands: ["beachcomber"] });
    expect(run(state, { type: "buy_upgrade", upgrade: "beachcomber_mk2" })).toMatchObject({
      ok: false,
      refusal: {
        reason: "locked",
        gate: { kind: "owned", value: 25, line: "beachcomber", have: 24 },
      },
    });
    state = { ...state, run: { ...state.run, lines: { beachcomber: 60 } } };
    expect(run(state, { type: "buy_upgrade", upgrade: "beachcomber_mk3" })).toMatchObject({
      ok: false,
      refusal: { reason: "locked", gate: { kind: "previous", value: "beachcomber_mk2" } },
    });
    const before = mannedRate(content, state, T0);
    state = ok(run(state, { type: "buy_upgrade", upgrade: "beachcomber_mk2" }, T0));
    expect(state.run.supplies).toBe(1e12 - 6e4);
    expect(mannedRate(content, state, T0)).toBeCloseTo(before * 3, 6);
    expect(run(state, { type: "buy_upgrade", upgrade: "loom_mk2" })).toMatchObject({
      ok: false,
      refusal: { reason: "locked", gate: { kind: "era", value: "wood" } },
    });
  });

  it("keeps a Line Mk to its era, and refuses unknown rows and short supplies", () => {
    const state = fresh({ supplies: 10 });
    expect(run(state, { type: "buy_upgrade", upgrade: "nope" })).toMatchObject({
      refusal: { reason: "unknown", what: "nope" },
    });
    expect(run(state, { type: "buy_upgrade", upgrade: "sorting_tables" })).toMatchObject({
      refusal: { reason: "supplies", need: 1e6, have: 10 },
    });
  });

  it("doubles every line and the flat tap with an island upgrade, never a Line Mk (E23)", () => {
    const state = fresh({ supplies: 2e6, lines: { beachcomber: 5 } });
    const tables = ok(run(state, { type: "buy_upgrade", upgrade: "sorting_tables" }));
    expect(rates(content, tables).tapGlobal).toBe(2);
    const mk = { ...state, run: { ...state.run, upgrades: ["beachcomber_mk2"] } };
    expect(rates(content, mk).tapGlobal).toBe(1);
  });
});

describe("buy_era (02 6)", () => {
  it("goes in order, records when, resets the fell count and logs era_reached", () => {
    let state = fresh({ supplies: 1e7, startedAt: T0 - 36, target: { taps: 33, felled: 2 } });
    expect(run(state, { type: "buy_era", era: "stone" })).toMatchObject({
      refusal: { reason: "not_next", era: "wood" },
    });
    expect(run(state, { type: "buy_era", era: "twig" })).toMatchObject({
      refusal: { reason: "owned" },
    });
    const result = run(state, { type: "buy_era", era: "wood" }, T0);
    state = ok(result);
    expect(state.run.era).toBe("wood");
    expect(state.run.eraAt).toEqual({ wood: 36 });
    expect(state.run.target).toEqual({ taps: 0, felled: 2 });
    expect(state.run.supplies).toBe(1e7 - 1.5e3);
    expect(result.events).toContainEqual({ type: "era_reached", era: "wood", at: 36 });
    expect(rates(content, state).tapGlobal).toBe(2);
  });

  it("opens the era's lines", () => {
    const state = fresh({ supplies: 1e9 });
    expect(run(state, { type: "buy_line", line: "loom", count: 1 })).toMatchObject({
      refusal: { reason: "locked", gate: { kind: "era", value: "wood" } },
    });
    const timber = ok(run(state, { type: "buy_era", era: "wood" }));
    expect(run(timber, { type: "buy_line", line: "loom", count: 1 }).ok).toBe(true);
  });

  it("keeps Armored shut until Wipe Day #2", () => {
    const state = fresh({ era: "metal", supplies: 1e15 });
    expect(run(state, { type: "buy_era", era: "hqm" })).toMatchObject({
      refusal: { reason: "locked", gate: { kind: "wipe_day", value: 2 } },
    });
    const veteran = { ...state, meta: { ...state.meta, wipeDays: 2 } };
    expect(ok(run(veteran, { type: "buy_era", era: "hqm" })).run.era).toBe("hqm");
  });
});
