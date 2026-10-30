/**
 * The Big Red and the Blast Map (R4; docs/redesign/03-the-big-red.md, 04-blast-map.md): the
 * yield, the press (N21, N22), the crown's rules, Afterglow (N20), the map's paths and refusals,
 * the admin's grant and respec.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { crown, type Player } from "./advisor";
import { affordablePrefix, nodeEffects, nodePick, nodeState, pathCost, pathTo } from "./blastmap";
import { applyCommand, type Command, type CommandResult } from "./commands";
import { afterglowAt, rates } from "./effects";
import {
  bigRedCrown,
  glassYield,
  keptHands,
  kettleStage,
  lifetimeFor,
  nuke,
  rollFlight,
} from "./prestige";
import { rng } from "./rng";
import { type BaseState, type Meta, newBase } from "./state";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const p = content.prestige;

const base = (meta: Partial<Meta> = {}, run: Partial<BaseState["run"]> = {}): BaseState => {
  const fresh = newBase(content, T0, 5);
  return { ...fresh, meta: { ...fresh.meta, ...meta }, run: { ...fresh.run, ...run } };
};

const ok = (result: CommandResult): BaseState => {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.refusal)}`);
  return result.state;
};
const run = (state: BaseState, command: Command, now = T0): CommandResult =>
  applyCommand(content, state, command, now);

/** A run that made `made` supplies, started `age` seconds ago. */
const ran = (made: number, age = 3600, meta: Partial<Meta> = {}): BaseState =>
  base(meta, { made, startedAt: T0 - age, firstBuyAt: T0 - age, afterglowFrom: T0 - age });

describe("the yield (03 1)", () => {
  it("needs a delta of 10 for the first nuke, then a gain of 1", () => {
    expect(glassYield(content, ran(lifetimeFor(content, 9)), T0).pressable).toBe(false);
    const first = glassYield(content, ran(lifetimeFor(content, 10)), T0);
    expect(first).toMatchObject({ pressable: true, counts: true, first: true, gain: 10 });
    expect(first.glowAfter).toBeCloseTo(1 + p.glowK * Math.sqrt(10), 12);
    const later = ran(0, 3600, {
      wipeDays: 1,
      nukes: 1,
      lifetime: lifetimeFor(content, 11),
      glass: { ever: 10, held: 10, level: 10, spent: 0 },
    });
    expect(glassYield(content, later, T0)).toMatchObject({
      pressable: true,
      gain: 1,
      counts: false,
    });
  });

  it("counts a Wipe Day at countShare of glass ever, never under countMinGlass (N22)", () => {
    const meta = { wipeDays: 3, nukes: 3, glass: { ever: 200, held: 50, level: 200, spent: 150 } };
    const small = glassYield(
      content,
      ran(0, 3600, { ...meta, lifetime: lifetimeFor(content, 215) }),
      T0,
    );
    expect(small).toMatchObject({ gain: 15, counts: false, threshold: 20 });
    const counted = glassYield(
      content,
      ran(0, 3600, { ...meta, lifetime: lifetimeFor(content, 220) }),
      T0,
    );
    expect(counted).toMatchObject({ gain: 20, counts: true, doubling: false });
    const tiny = { wipeDays: 1, nukes: 1, glass: { ever: 11, held: 11, level: 11, spent: 0 } };
    expect(
      glassYield(content, ran(0, 3600, { ...tiny, lifetime: lifetimeFor(content, 13) }), T0),
    ).toMatchObject({ gain: 2, counts: false, threshold: p.countMinGlass });
  });

  it("pays the delta times the glass multiplier, never clawed back", () => {
    const state = ran(lifetimeFor(content, 30), 3600, {
      wipeDays: 1,
      nukes: 1,
      glass: { ever: 10, held: 1, level: 10, spent: 9 },
      nodes: ["ground_zero", "bigger_payload"],
    });
    const y = glassYield(content, state, T0);
    expect(y.multiplier).toBeCloseTo(1.1, 12);
    expect(y.gain).toBe(22);
    const pressed = nuke(content, state, T0).state;
    expect(pressed.meta.glass).toEqual({ ever: 32, held: 23, level: 30, spent: 9 });
  });
});

describe("the press (03 11; N21)", () => {
  it("keeps exactly meta, grants exactly the formula's glass and starts a fresh run, over 10,000 states", () => {
    const random = rng(42);
    for (let i = 0; i < 10_000; i++) {
      const level = Math.floor(random.next() * 400);
      const ever = Math.floor(level * (1 + random.next() * 0.3));
      const delta = 1 + Math.floor(random.next() * 60);
      const nukes = Math.floor(random.next() * 30);
      const state = ran(0, 1 + Math.floor(random.next() * 86_400), {
        wipeDays: Math.min(nukes, Math.floor(random.next() * 30)),
        nukes,
        lifetime: lifetimeFor(content, level + delta) + random.next() * 1e6,
        glass: { ever, held: Math.floor(ever * random.next()), level, spent: 0 },
        scrap: Math.floor(random.next() * 50),
      });
      const y = glassYield(content, state, T0);
      if (!y.pressable) continue;
      const { state: next, events } = nuke(content, state, T0);
      expect(next.meta.glass.ever).toBe(ever + y.gain);
      expect(next.meta.glass.held).toBe(state.meta.glass.held + y.gain);
      expect(next.meta.glass.level).toBe(level + delta);
      expect(next.meta.nukes).toBe(nukes + 1);
      expect(next.meta.wipeDays).toBe(state.meta.wipeDays + (y.counts ? 1 : 0));
      expect(next.meta.lifetime).toBe(state.meta.lifetime + state.run.made);
      // Kept: cards, drops, badges, hints, stats (scrap and drops only ever rise).
      expect(next.meta.cards).toBe(state.meta.cards);
      expect(next.meta.badges).toBe(state.meta.badges);
      expect(next.meta.scrap).toBeGreaterThanOrEqual(state.meta.scrap);
      // Lost: the run.
      expect(next.run.n).toBe(next.meta.nukes + 1);
      expect(next.run.supplies).toBe(0);
      expect(next.run.made).toBe(0);
      expect(next.run.startedAt).toBeNull();
      expect(next.run.afterglowFrom).toBeNull();
      expect(next.run.activeAt).toBe(T0);
      const event = events.find((e) => e.type === "nuked");
      expect(event?.type === "nuked" && event.gain).toBe(y.gain);
    }
  });

  it("a small blast pays its glass and moves no count, news or agenda (N22)", () => {
    const state = ran(lifetimeFor(content, 215), 3600, {
      wipeDays: 3,
      nukes: 3,
      lifetime: 0,
      glass: { ever: 200, held: 50, level: 200, spent: 150 },
      news: { at: T0 - 100, folded: 0, glass: 0 },
      flights: ["u_turn"],
    });
    const { state: next, events } = nuke(content, state, T0);
    expect(next.meta.wipeDays).toBe(3);
    expect(next.meta.glass.ever).toBe(215);
    expect(next.meta.news).toEqual(state.meta.news);
    const event = events.find((e) => e.type === "nuked");
    expect(event).toMatchObject({ wipeDay: null, news: null, flight: p.flights.small, gain: 15 });
    expect(event?.type === "nuked" && event.pays).toEqual(p.pays.small);
  });

  it("grants Ground Zero with the first Wipe Day and rolls the U-Turn", () => {
    const state = ran(lifetimeFor(content, 10));
    const { state: next, events } = nuke(content, state, T0);
    expect(next.meta.nodes).toEqual(["ground_zero"]);
    expect(next.meta.wipeDays).toBe(1);
    expect(next.meta.flights).toEqual(["u_turn"]);
    const event = events.find((e) => e.type === "nuked");
    expect(event).toMatchObject({ wipeDay: 1, doubling: true, news: { folded: 0, glass: 0 } });
    expect(next.meta.scrap).toBe(p.pays.doubling.scrap);
    expect(next.meta.drops.held[p.pays.doubling.drop]).toBe(1);
  });

  it("folds news inside the throttle and tells a milestone at once (06 2.2)", () => {
    const meta = {
      wipeDays: 4,
      nukes: 4,
      glass: { ever: 100, held: 100, level: 100, spent: 0 },
      news: { at: T0 - 60, folded: 0, glass: 0 },
    };
    const held = nuke(content, ran(lifetimeFor(content, 120), 3600, meta), T0);
    expect(held.state.meta.news).toEqual({ at: T0 - 60, folded: 1, glass: 20 });
    const later = nuke(
      content,
      ran(lifetimeFor(content, 150), 3600, { ...held.state.meta, lifetime: 0 }),
      T0 + 31 * 60,
    );
    const event = later.events.find((e) => e.type === "nuked");
    expect(event).toMatchObject({ news: { folded: 1, glass: 20 } });
    expect(later.state.meta.news).toEqual({ at: T0 + 31 * 60, folded: 0, glass: 0 });
    // Wipe Day #10 is a milestone: news even a minute after the last.
    const tenth = nuke(
      content,
      ran(lifetimeFor(content, 200), 3600, {
        ...later.state.meta,
        wipeDays: 9,
        lifetime: 0,
        news: { at: T0 + 31 * 60, folded: 0, glass: 0 },
      }),
      T0 + 32 * 60,
    );
    expect(tenth.events.find((e) => e.type === "nuked")).toMatchObject({
      wipeDay: 10,
      news: { folded: 0, glass: 0 },
    });
  });

  it("keeps the agenda's and the nodes' hands, and applies the start nodes", () => {
    const state = ran(lifetimeFor(content, 400), 3600, {
      wipeDays: 2,
      nukes: 2,
      glass: { ever: 100, held: 100, level: 100, spent: 0 },
      nodes: ["ground_zero", "old_friend", "packed_crate", "tool_bag", "prefab_walls"],
    });
    const withHands = {
      ...state,
      run: { ...state.run, hands: ["beachcomber", "campfire", "garden", "loom", "furnace"] },
    };
    // Wipe Day #3 keeps lines 1-3 (the agenda); Old Friend keeps Mara anyway.
    expect(keptHands(content, withHands)).toEqual(["beachcomber", "campfire", "garden"]);
    const next = nuke(content, withHands, T0).state;
    expect(next.run.hands).toEqual(["beachcomber", "campfire", "garden"]);
    expect(next.run.lines).toEqual({ beachcomber: 10, campfire: 5 });
    expect(next.run.upgrades).toEqual(["stone_tools"]);
    expect(next.run.era).toBe("wood");
  });

  it("rolls a new flight the first time it unlocks, then weighs unseen ones", () => {
    const second = ran(0, 3600, { wipeDays: 1, nukes: 1, flights: ["u_turn"] });
    const flight = rollFlight(content, second, true);
    expect(["loop_the_loop", "sputter_drop"]).toContain(flight);
    expect(rollFlight(content, second, false)).toBe("fizzle");
  });
});

describe("the command (03 7.7)", () => {
  it("refuses a stale run, an unready press, and presses once per key", () => {
    const state = ran(lifetimeFor(content, 10));
    const stale = run(state, { type: "nuke", run: 2 });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.refusal).toEqual({ reason: "stale_run" });
    const early = run(ran(lifetimeFor(content, 9)), { type: "nuke", run: 1 });
    if (!early.ok)
      expect(early.refusal).toMatchObject({ reason: "not_ready", need: lifetimeFor(content, 10) });
    else throw new Error("an unready press went through");
    const pressed = ok(run(state, { type: "nuke", run: 1 }));
    expect(pressed.run.n).toBe(2);
    // The same hold again is a stale run now: one hold never becomes two nukes.
    const again = run(pressed, { type: "nuke", run: 1 });
    expect(again.ok).toBe(false);
  });

  it("stage by stage, the Kettle (03 3.2)", () => {
    expect(kettleStage(content, ran(p.kettle.padAt - 1), T0)).toBe("hidden");
    expect(kettleStage(content, ran(p.kettle.padAt), T0)).toBe("pad");
    expect(kettleStage(content, ran(lifetimeFor(content, 5)), T0)).toBe("frame");
    expect(kettleStage(content, ran(lifetimeFor(content, 10)), T0)).toBe("fuel");
    const later = ran(lifetimeFor(content, 10), 3600, {
      wipeDays: 1,
      nukes: 1,
      lifetime: 0,
      glass: { ever: 10, held: 10, level: 10, spent: 0 },
    });
    expect(kettleStage(content, later, T0)).toBe("pad");
    expect(
      kettleStage(content, { ...later, run: { ...later.run, made: lifetimeFor(content, 11) } }, T0),
    ).toBe("frame");
    // A counting press: the warhead; crowned (here a doubling), fuel and steam.
    const doubling = { ...later, run: { ...later.run, made: lifetimeFor(content, 20) } };
    expect(kettleStage(content, doubling, T0, false)).toBe("warhead");
    expect(kettleStage(content, doubling, T0)).toBe("fuel");
  });
});

describe("the crown (03 2.2, D255)", () => {
  const player: Player = { income: 1, tapShare: 0, tapRate: 0 };
  const meta = { wipeDays: 2, nukes: 2, glass: { ever: 100, held: 100, level: 100, spent: 0 } };

  it("the first nuke at a delta of 10, a doubling, a fuelled set, a day's run; else nothing", () => {
    expect(bigRedCrown(content, ran(lifetimeFor(content, 10)), T0)).toBe("first");
    expect(bigRedCrown(content, ran(lifetimeFor(content, 9)), T0)).toBeNull();
    expect(bigRedCrown(content, ran(lifetimeFor(content, 200), 3600, meta), T0)).toBe("doubling");
    const counting = ran(lifetimeFor(content, 120), 3600, meta);
    expect(bigRedCrown(content, counting, T0)).toBeNull();
    const fuelled = {
      ...counting,
      run: {
        ...counting.run,
        orders: {
          ...counting.run.orders,
          claimed: counting.run.orders.ids.slice(0, content.orders.fuel),
        },
      },
    };
    expect(bigRedCrown(content, fuelled, T0)).toBe("fuelled");
    expect(bigRedCrown(content, ran(lifetimeFor(content, 120), p.crown.ageSeconds, meta), T0)).toBe(
      "day",
    );
    // A small blast is never crowned, fuelled or old.
    const small = ran(lifetimeFor(content, 105), p.crown.ageSeconds, meta);
    expect(bigRedCrown(content, small, T0)).toBeNull();
  });

  it("comes first in the advisor's list, waits for a buff and never while welcome back is open", () => {
    const state = ran(lifetimeFor(content, 200), 3600, meta);
    expect(crown(content, state, T0, player)).toEqual({ kind: "nuke", rule: "doubling" });
    const buffed = { ...state, run: { ...state.run, buffs: [{ kind: "rally", until: T0 + 30 }] } };
    expect(crown(content, buffed, T0, player).kind).not.toBe("nuke");
    expect(crown(content, state, T0, player, undefined, { welcomeOpen: true }).kind).not.toBe(
      "nuke",
    );
    // The web scores a buff-stripped copy and says so (D270): the Big Red still waits.
    expect(crown(content, state, T0, player, undefined, { buffRunning: true }).kind).not.toBe(
      "nuke",
    );
  });
});

describe("Afterglow (N20)", () => {
  it("is ×3 at the first tap, halves every 5 minutes and ends at 30", () => {
    const state = ran(0, 3600, { nukes: 1, wipeDays: 1 });
    const from = state.run.afterglowFrom ?? 0;
    expect(afterglowAt(content, state, from)).toBeCloseTo(3, 12);
    expect(afterglowAt(content, state, from + 300)).toBeCloseTo(2, 12);
    expect(afterglowAt(content, state, from + 600)).toBeCloseTo(1.5, 12);
    expect(afterglowAt(content, state, from + 1800)).toBe(1);
    expect(afterglowAt(content, base({ nukes: 0 }), T0)).toBe(1);
    // Souvenir Jar: the half-life +60 s.
    const jar = { ...state, meta: { ...state.meta, nodes: ["ground_zero", "souvenir_jar"] } };
    expect(afterglowAt(content, jar, from + 360)).toBeCloseTo(2, 12);
  });
});

describe("the Blast Map (04 5, 8)", () => {
  const owner = (held: number, nodes: string[] = ["ground_zero"], wipeDays = 1) =>
    base({ wipeDays, nukes: wipeDays, glass: { ever: held, held, level: held, spent: 0 }, nodes });

  it("says why a node is shut, in order: hidden, the ring's gate, a parent, the glass", () => {
    const state = owner(3);
    expect(nodeState(content, state.meta, "steady_hands")).toEqual({ kind: "affordable" });
    expect(nodeState(content, state.meta, "whetstone")).toEqual({ kind: "no_parent" });
    expect(nodeState(content, state.meta, "lucky_swing")).toMatchObject({
      kind: "ring_gate",
      ring: 3,
      at: 3,
      toGo: 2,
    });
    expect(nodeState(content, state.meta, "nope")).toEqual({ kind: "hidden" });
    expect(nodeState(content, owner(1).meta, "second_wind")).toEqual({
      kind: "glass",
      need: 2,
      have: 1,
    });
    expect(nodeState(content, state.meta, "ground_zero")).toEqual({ kind: "owned" });
  });

  it("builds the path through owned or cheapest parents, and the affordable prefix", () => {
    const state = owner(100, ["ground_zero"], 3);
    const path = pathTo(content, state.meta, "lucky_swing").map((node) => node.id);
    expect(path).toEqual(["steady_hands", "quick_fingers", "lucky_swing"]);
    expect(pathCost(pathTo(content, state.meta, "lucky_swing"))).toBe(83);
    expect(
      affordablePrefix(pathTo(content, state.meta, "lucky_swing"), 7).map((n) => n.id),
    ).toEqual(["steady_hands", "quick_fingers"]);
    expect(pathTo(content, owner(100).meta, "lucky_swing")).toEqual([]);
  });

  it("buys a path whole or not at all, in glass held, and the nodes take effect at once", () => {
    const state = owner(100, ["ground_zero"], 3);
    const bought = ok(
      run(state, { type: "buy_node", path: ["steady_hands", "quick_fingers", "lucky_swing"] }),
    );
    expect(bought.meta.nodes).toEqual([
      "ground_zero",
      "steady_hands",
      "quick_fingers",
      "lucky_swing",
    ]);
    expect(bought.meta.glass).toEqual({ ever: 100, held: 17, level: 100, spent: 83 });
    expect(nodeEffects(content, bought.meta).some((e) => e.stat === "crit_chance")).toBe(true);
    expect(rates(content, bought).glow).toBe(rates(content, state).glow);
    const short = run(owner(50, ["ground_zero"], 3), {
      type: "buy_node",
      path: ["steady_hands", "quick_fingers", "lucky_swing"],
    });
    if (!short.ok) expect(short.refusal).toEqual({ reason: "glass", need: 83, have: 50 });
    else throw new Error("a short path went through");
    const orphan = run(state, { type: "buy_node", path: ["lucky_swing"] });
    if (!orphan.ok) expect(orphan.refusal).toEqual({ reason: "no_parent", what: "lucky_swing" });
    const gated = run(owner(100), {
      type: "buy_node",
      path: ["steady_hands", "quick_fingers", "lucky_swing"],
    });
    if (!gated.ok)
      expect(gated.refusal).toEqual({ reason: "locked", gate: { kind: "wipe_day", value: 3 } });
    const twice = run(bought, { type: "buy_node", path: ["steady_hands"] });
    if (!twice.ok) expect(twice.refusal).toEqual({ reason: "owned" });
  });

  it("picks Go Bag first after the first nuke, then the cheapest toy, then the best gain", () => {
    const first = owner(10);
    expect(nodePick(content, first)?.node.id).toBe("packed_crate");
    const next = owner(8, ["ground_zero", "packed_crate"]);
    const pick = nodePick(content, next, (node) => (node.id === "steady_hands" ? 10 : 1));
    expect(pick?.node.type === "unlock" || pick?.node.type === "automation").toBe(true);
    const broke = owner(0, ["ground_zero"]);
    expect(nodePick(content, broke)).toMatchObject({ state: { kind: "glass" } });
  });

  it("grants to held only, and a respec refunds every node but Ground Zero", () => {
    const state = owner(0, ["ground_zero", "steady_hands", "hot_coals"]);
    const spent = { ...state, meta: { ...state.meta, glass: { ...state.meta.glass, spent: 2 } } };
    const gifted = ok(run(spent, { type: "grant", glass: 5, skin: "founder", note: "founders" }));
    expect(gifted.meta.glass).toEqual({ ever: 0, held: 5, level: 0, spent: 2 });
    expect(gifted.meta.skin).toBe("founder");
    expect(rates(content, gifted).glow).toBe(1);
    const respecced = ok(run(gifted, { type: "respec" }));
    expect(respecced.meta.nodes).toEqual(["ground_zero"]);
    expect(respecced.meta.glass).toEqual({ ever: 0, held: 7, level: 0, spent: 0 });
  });
});
