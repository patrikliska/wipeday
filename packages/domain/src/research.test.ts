/**
 * The Workshop (game-design 5.12; D185, D194, D195): `buy_research`, its gates and prices, how its
 * levels fold into the rates, and how the crown scores them.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import type { ResearchDef } from "@wipe-day/content/schema";
import { describe, expect, it } from "vitest";
import { choices, sameRow } from "./advisor";
import { applyCommand, type Command, type CommandResult } from "./commands";
import { cycleOf, rates, unitRate } from "./effects";
import { lineOf } from "./lines";
import { levelsCost, maxResearch, researchGate, researchOf, workshopOpensAt } from "./research";
import { rng } from "./rng";
import { type BaseState, newBase } from "./state";
import { tapParts } from "./taps";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
/** The run started ten minutes ago: the Workshop is open. */
const STARTED = T0 - 600;

const fresh = (patch: Partial<BaseState["run"]> = {}): BaseState => {
  const base = newBase(content, T0, 5);
  return { ...base, run: { ...base.run, startedAt: STARTED, ...patch } };
};

const run = (state: BaseState, command: Command, at = T0 + 1): CommandResult =>
  applyCommand(content, state, command, at);

function ok(result: CommandResult): BaseState {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.refusal)}`);
  return result.state;
}

function item(id: string): ResearchDef {
  const def = researchOf(content, id);
  if (!def) throw new Error(id);
  return def;
}

const line = (id: string) => {
  const found = lineOf(content, id);
  if (!found) throw new Error(id);
  return found;
};

const buy = (id: string, count: 1 | "max" = 1): Command => ({
  type: "buy_research",
  item: id,
  count,
});

describe("Workshop prices", () => {
  it("'max' is the largest affordable count, by brute force, never past the top level", () => {
    const random = rng(17);
    for (let i = 0; i < 2_000; i++) {
      const def = content.research[random.int(0, 19)] ?? item("sharper_hooks");
      const n = random.int(0, def.levels);
      const supplies = random.next() * levelsCost(def, 0, def.levels) * 1.2;
      let brute = 0;
      while (n + brute < def.levels && levelsCost(def, n, brute + 1) <= supplies) brute += 1;
      expect(maxResearch(def, n, supplies), `${def.id} ${n} ${supplies}`).toBe(brute);
    }
  });

  it("stops a Line Mk at the level its units do not reach", () => {
    const mk = item("beachcomber_mk");
    expect(maxResearch(mk, 0, 1e12, 30)).toBe(1);
    expect(maxResearch(mk, 0, 1e12, 60)).toBe(2);
    expect(maxResearch(mk, 0, 1e12, 10)).toBe(0);
    expect(maxResearch(mk, 0, 7e4, 60)).toBe(1);
  });
});

describe("buy_research", () => {
  it("refuses in order: unknown, maxed, not open yet, era, units, supplies", () => {
    const check = (state: BaseState, command: Command, refusal: object, at = T0 + 1) => {
      const result = run(state, command, at);
      expect(result).toMatchObject({ ok: false, refusal });
      expect(result.state.run.research).toEqual(state.run.research);
      expect(result.state.meta.stats.research).toBe(state.meta.stats.research);
    };
    const rich = fresh({ supplies: 1e15, lines: { beachcomber: 24 } });
    check(rich, buy("nope"), { reason: "unknown", what: "nope" });
    check(fresh({ research: { spare_wicks: 6 } }), buy("spare_wicks"), {
      reason: "max_owned",
      have: 6,
    });
    // Two minutes after the run's clock starts, not one second sooner.
    const young = fresh({ supplies: 1e3, startedAt: T0 });
    check(
      young,
      buy("sharper_hooks"),
      { reason: "locked", gate: { kind: "opens", value: T0 + 120 } },
      T0 + 119,
    );
    expect(run(young, buy("sharper_hooks"), T0 + 120).ok).toBe(true);
    check(rich, buy("tarred_twine"), { reason: "locked", gate: { kind: "era", value: "wood" } });
    check(rich, buy("beachcomber_mk"), {
      reason: "locked",
      gate: { kind: "owned", value: 25, line: "beachcomber", have: 24 },
    });
    check(fresh({ supplies: 10 }), buy("sharper_hooks"), {
      reason: "supplies",
      need: 40,
      have: 10,
    });
    check(fresh({ supplies: 10 }), buy("sharper_hooks", "max"), {
      reason: "supplies",
      need: 40,
      have: 10,
    });
  });

  it("opens with the run's first tap, two minutes later, before any command", () => {
    const base = newBase(content, T0, 5);
    expect(workshopOpensAt(content, base)).toBeNull();
    expect(researchGate(content, base, item("sharper_hooks"), T0)).toEqual({
      kind: "opens",
      value: T0 + 120,
    });
  });

  it("buys a level: the price, the level, the counter, the event and the Night Shift restarted", () => {
    const state = fresh({ supplies: 100 });
    const result = run(state, buy("sharper_hooks"), T0 + 5);
    const next = ok(result);
    expect(next.run.supplies).toBe(60);
    expect(next.run.research).toEqual({ sharper_hooks: 1 });
    expect(next.meta.stats.research).toBe(1);
    expect(next.run.activeAt).toBe(T0 + 5);
    expect(result.events).toContainEqual({
      type: "researched",
      item: "sharper_hooks",
      level: 1,
      count: 1,
      cost: 40,
    });
    // The same command again buys the next level at the next price; never the same twice.
    const again = ok(run(next, buy("sharper_hooks"), T0 + 6));
    expect(again.run.research).toEqual({ sharper_hooks: 2 });
    expect(again.run.supplies).toBeCloseTo(60 - 40 * 1.35, 9);
  });

  it("'max' buys every level the supplies reach, at the closed-form price", () => {
    const def = item("dry_kindling");
    const supplies = levelsCost(def, 0, 7) + 1;
    const result = run(fresh({ supplies }), buy("dry_kindling", "max"));
    const next = ok(result);
    expect(next.run.research).toEqual({ dry_kindling: 7 });
    expect(next.run.supplies).toBeCloseTo(1, 6);
    expect(next.meta.stats.research).toBe(7);
    expect(result.events).toContainEqual(expect.objectContaining({ level: 7, count: 7 }));
  });

  it("buys a Line Mk's levels as its units allow, each ×3", () => {
    let state = fresh({ supplies: 1e12, lines: { beachcomber: 60 }, hands: ["beachcomber"] });
    const unit = () => unitRate(content, state, line("beachcomber"), T0, { online: true });
    const before = unit();
    state = ok(run(state, buy("beachcomber_mk"), T0));
    expect(state.run.supplies).toBe(1e12 - 6e4);
    expect(unit()).toBeCloseTo(before * 3, 6);
    state = ok(run(state, buy("beachcomber_mk"), T0));
    expect(unit()).toBeCloseTo(before * 9, 6);
    expect(run(state, buy("beachcomber_mk"))).toMatchObject({
      refusal: { reason: "max_owned", have: 2 },
    });
  });
});

describe("the Workshop in the rates", () => {
  it("adds an inc to its line's (1 + Σinc), its era's lines only, never the flat tap's fold (E23)", () => {
    const state = fresh({ era: "wood", lines: { beachcomber: 5, campfire: 5, loom: 5 } });
    const at = (s: BaseState, id: string) => unitRate(content, s, line(id), T0, { online: true });
    const hooks = { ...state, run: { ...state.run, research: { sharper_hooks: 4 } } };
    expect(at(hooks, "beachcomber") / at(state, "beachcomber")).toBeCloseTo(1.2, 12);
    expect(at(hooks, "campfire")).toBe(at(state, "campfire"));
    const twig = {
      ...hooks,
      run: { ...hooks.run, research: { sharper_hooks: 4, camp_routine: 5 } },
    };
    // Incs sum: (1 + 0.2 + 0.2) on the Beachcomber, 1.2 on the Campfire, nothing on the Loom.
    expect(at(twig, "beachcomber") / at(state, "beachcomber")).toBeCloseTo(1.4, 12);
    expect(at(twig, "campfire") / at(state, "campfire")).toBeCloseTo(1.2, 12);
    expect(at(twig, "loom")).toBe(at(state, "loom"));
    expect(rates(content, twig).tapGlobal).toBe(rates(content, state).tapGlobal);
  });

  it("shortens cycles with speed, lengthens the Night Shift 20 min a level, pays away-only", () => {
    const state = fresh({ lines: { beachcomber: 5 }, hands: ["beachcomber"] });
    const axles = { ...state, run: { ...state.run, research: { greased_axles: 10 } } };
    const cycle = (s: BaseState) => cycleOf(content, s, line("garden"), T0);
    expect(cycle(axles)).toBe(
      Math.max(content.formula.cycleFloor, line("garden").cycle / 1.01 ** 10),
    );
    expect(rates(content, state).nightShift).toBe(7200);
    for (const n of [1, 3, 6]) {
      const wicks = { ...state, run: { ...state.run, research: { spare_wicks: n } } };
      expect(rates(content, wicks).nightShift).toBe(7200 + 1200 * n);
    }
    const coals = { ...state, run: { ...state.run, research: { banked_coals: 10 } } };
    const b = line("beachcomber");
    expect(unitRate(content, coals, b, T0, { online: true })).toBe(
      unitRate(content, state, b, T0, { online: true }),
    );
    expect(
      unitRate(content, coals, b, T0, { online: false }) /
        unitRate(content, state, b, T0, { online: false }),
    ).toBeCloseTo(1.05 ** 10, 12);
  });

  it("adds Calloused Thumbs to the tap's flat part, which Grip then doubles", () => {
    const state = fresh({ upgrades: ["stone_tools"] });
    const thumbs = { ...state, run: { ...state.run, research: { calloused_thumbs: 3 } } };
    expect(tapParts(content, thumbs, T0).flatValue / tapParts(content, state, T0).flatValue).toBe(
      4,
    );
  });
});

describe("the crown scores the Workshop", () => {
  /** A mid-run state: Timber, four hands, every open line owned. */
  const mid = fresh({
    era: "wood",
    supplies: 1e5,
    upgrades: ["stone_tools", "iron_tools"],
    lines: { beachcomber: 60, campfire: 40, garden: 30, loom: 20, workbench: 10, kiln: 5 },
    hands: ["beachcomber", "campfire", "garden", "loom"],
  });

  it("offers every open item one level at a time, each with a gain", () => {
    const offered = choices(content, mid, T0, 1e3, 1, 6).filter(
      (choice) => choice.command.type === "buy_research",
    );
    const items = offered.map((choice) =>
      choice.command.type === "buy_research" ? choice.command.item : "",
    );
    // Tiers 1-4 (Twig and Timber), the Mks whose units are there: Beachcomber 60, Campfire 40, Garden 30.
    expect(items).toEqual(
      expect.arrayContaining(["sharper_hooks", "timber_frames", "beachcomber_mk", "garden_mk"]),
    );
    expect(items).not.toContain("loom_mk");
    expect(items).not.toContain("furnace_mk");
    for (const choice of offered) {
      expect(choice.command).toMatchObject({ count: 1 });
      expect(choice.gain, JSON.stringify(choice.command)).toBeGreaterThan(0);
    }
    expect(offered).toHaveLength(20 + 3);
  });

  it("offers nothing before the Workshop opens", () => {
    const young = { ...mid, run: { ...mid.run, startedAt: T0 } };
    const offered = choices(content, young, T0 + 60, 1e3, 1, 6);
    expect(offered.some((choice) => choice.command.type === "buy_research")).toBe(false);
  });

  it("scores an inc, a Mk and a wick as the income they add", () => {
    // An idle player: manned lines only, no tap share.
    const gainOf = (id: string) =>
      choices(content, mid, T0, 1e3, 0, 0).find(
        (choice) => choice.command.type === "buy_research" && choice.command.item === id,
      )?.gain ?? Number.NaN;
    const income = (s: BaseState, id: string) =>
      (s.run.lines[id] ?? 0) * unitRate(content, s, line(id), T0, { online: true });
    const after = (id: string) =>
      ok(run({ ...mid, run: { ...mid.run, supplies: 1e9 } }, buy(id), T0));
    for (const [id, lineId] of [
      ["sharper_hooks", "beachcomber"],
      ["campfire_mk", "campfire"],
    ] as const) {
      const delta = income(after(id), lineId) - income(mid, lineId);
      expect(gainOf(id) / delta, id).toBeCloseTo(1, 9);
    }
    // A wick: the manned lines away, over 20 more minutes of a 12-hour absence a day.
    let away = 0;
    for (const id of mid.run.hands)
      away += (mid.run.lines[id] ?? 0) * unitRate(content, mid, line(id), T0, { online: false });
    expect(gainOf("spare_wicks") / ((away * 1200) / 86_400)).toBeCloseTo(1, 9);
  });

  it("tells Workshop rows apart by item", () => {
    expect(sameRow(buy("sharper_hooks"), buy("sharper_hooks", "max"))).toBe(true);
    expect(sameRow(buy("sharper_hooks"), buy("dry_kindling"))).toBe(false);
  });
});
