import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { type BaseState, effectiveRates, newBase, smeltRate, storageCap } from "./base";
import { applyCommand } from "./commands";
import { unitSeconds } from "./craft";
import {
  buyPerk,
  type Carry,
  carryFor,
  carryOver,
  type Legacy,
  newLegacy,
  seasonPoints,
} from "./legacy";
import { tripOdds } from "./missions";
import { modifiers } from "./modifiers";
import { planRaid } from "./raids";
import { rng } from "./rng";
import { addGift, giveStatus, newSignal, type SignalView, signalOpen, stillNeeded } from "./signal";

const content = loadContent(contentPaths.data, loadLocale());
const DAY = 86400;
const T0 = 19_675 * DAY + 12 * 3600;
const season = { number: 2, startedAt: T0, modifier: null };

/** A Stone base with buildings that give every rate a perk can raise. */
const fort = (perks: Record<string, number> = {}, extra: Partial<BaseState> = {}): BaseState => ({
  ...newBase(content, T0, 3),
  tier: "stone",
  toolId: "iron_tools",
  buildings: { campfire: 2, lights: 2, workbench: 2, furnace: 2, kiln: 1 },
  items: { crate: 2 },
  perks,
  ...extra,
});

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

/** Every combination of perk ranks, from none to all at the top. */
function* combinations(): Generator<Record<string, number>> {
  const perks = content.legacy.perks;
  const ranks = perks.map(() => 0);
  for (;;) {
    yield Object.fromEntries(perks.map((perk, index) => [perk.id, ranks[index] ?? 0]));
    let index = 0;
    while (index < perks.length) {
      const top = perks[index]?.cost.length ?? 0;
      if ((ranks[index] ?? 0) < top) {
        ranks[index] = (ranks[index] ?? 0) + 1;
        break;
      }
      ranks[index] = 0;
      index += 1;
    }
    if (index === perks.length) return;
  }
}

describe("the 25% cap (CLAUDE.md section 8)", () => {
  const cap = 1 + content.legacy.capPercent / 100;
  const plain = fort();
  const rates = effectiveRates(content, plain);
  const room = storageCap(content, plain);
  const planks = content.recipes.find((recipe) => recipe.output === "planks");
  const furnace = content.furnaces[1];
  // The weakest site, by its base chance: where a few points of luck weigh the most.
  const weakest = [...content.sites].sort((a, b) => a.chance - b.chance)[0];
  if (!planks || !furnace || !weakest) throw new Error("content changed");
  const slow = unitSeconds(content, plain, planks);
  const smelt = smeltRate(content, plain, furnace);
  const odds = tripOdds(content, plain, weakest, ["mara"]).success;

  it("holds for every combination of perks, in every rate", () => {
    let count = 0;
    for (const perks of combinations()) {
      count += 1;
      const vet = fort(perks);
      const label = JSON.stringify(perks);
      for (const [id, perHour] of Object.entries(effectiveRates(content, vet))) {
        // Whole units: a rate is floored, so allow one unit of rounding.
        expect(perHour, `${id} ${label}`).toBeLessThanOrEqual((rates[id] ?? 0) * cap + 1);
      }
      expect(storageCap(content, vet), label).toBeLessThanOrEqual(room * cap);
      expect(slow / unitSeconds(content, vet, planks), label).toBeLessThanOrEqual(cap + 0.01);
      expect(smeltRate(content, vet, furnace) / smelt, label).toBeLessThanOrEqual(cap + 0.01);
      expect(tripOdds(content, vet, weakest, ["mara"]).success / odds, label).toBeLessThanOrEqual(
        cap,
      );
      expect(modifiers(content, vet).xpPercent, label).toBeLessThanOrEqual(
        content.legacy.capPercent,
      );
    }
    expect(count).toBe(
      content.legacy.perks.reduce((product, perk) => product * (perk.cost.length + 1), 1),
    );
  });
});

describe("a new season's base", () => {
  const legacy: Legacy = {
    ...newLegacy(),
    blueprints: ["strongbox", "crossbow"],
    levels: {
      mara: { level: 4, xp: 500 },
      rook: { level: 3, xp: 300 },
      hale: { level: 2, xp: 120 },
    },
    perks: { steady_hands: 2, old_friend: 1, packed_crate: 1 },
    skin: "driftwood",
  };
  const carry: Carry = carryFor(legacy, season);

  it("keeps the blueprints, the crew's levels, the perks and the skin; nothing else", () => {
    const base = newBase(content, T0, 9, carry);
    const plain = newBase(content, T0, 9);
    expect(base.blueprints).toEqual(["strongbox", "crossbow"]);
    expect(base.crew.find((member) => member.id === "mara")).toMatchObject({ level: 4, xp: 500 });
    expect(base.crew.find((member) => member.id === "dax")).toMatchObject({ level: 1, xp: 0 });
    // The old friend: the best veteran not in the starting crew is home on day one.
    expect(base.crew.map((member) => member.id)).toEqual(["mara", "dax", "ivo", "rook"]);
    expect(base.items.crate).toBe(1);
    expect(base.perks).toEqual({ steady_hands: 2, old_friend: 1, packed_crate: 1 });
    expect(base.season).toEqual(season);
    expect(base.skin).toBe("driftwood");
    expect(base.stock).toEqual(plain.stock);
    expect(base.tier).toBe("twig");
    expect(base.stats).toEqual(plain.stats);
  });

  it("newcomers arrive at their kept level", () => {
    const base = newBase(content, T0, 9, carry);
    const later = applyCommand(content, base, { type: "collect" }, T0 + 5 * DAY).state;
    const hale = later.crew.find((member) => member.id === "hale");
    if (hale) expect(hale).toMatchObject({ level: 2, xp: 120 });
  });
});

describe("the reset folds the season in", () => {
  it("keeps the best level per survivor and every blueprint; earns titles, skins, points", () => {
    const before: Legacy = {
      ...newLegacy(),
      points: 2,
      blueprints: ["strongbox"],
      levels: { mara: { level: 5, xp: 800 }, dax: { level: 1, xp: 40 } },
    };
    const final: BaseState = {
      ...fort(),
      blueprints: ["crossbow", "strongbox"],
      crew: fort().crew.map((member) =>
        member.id === "dax" ? { ...member, level: 3, xp: 300 } : { ...member, level: 2, xp: 150 },
      ),
      stats: { ...fort().stats, defended: 12 },
    };
    const result = {
      season: 1,
      ranks: { wealth: 1, builder: 2, explorer: 3, trader: 4, lucky: 5, guard: 1 },
      signalShare: 0.4,
      signalLit: true,
      signalTop: true,
    };
    const after = carryOver(content, before, final, result);
    expect(after.blueprints).toEqual(["crossbow", "strongbox"]);
    expect(after.levels.mara).toEqual({ level: 5, xp: 800 });
    expect(after.levels.dax).toEqual({ level: 3, xp: 300 });
    expect(after.titles.sort()).toEqual(["guard:1", "signal:1", "wealth:1"]);
    expect(after.skins.sort()).toEqual(["beacon", "driftwood", "rust"]);
    const { played, place, signal } = content.legacy.points;
    const expected =
      played +
      (place[0] ?? 0) * 2 +
      (place[1] ?? 0) +
      (place[2] ?? 0) +
      (place[3] ?? 0) +
      Math.round(0.4 * signal);
    expect(seasonPoints(content, result)).toBe(expected);
    expect(after.points).toBe(2 + expected);
    expect(after.seasons).toBe(1);
  });
});

describe("buying perks", () => {
  const view = (points: number) => ({ points, titles: [], skins: [] });

  it("buys rank by rank while the points last, and applies at once", () => {
    const base = fort();
    const bought = ok(buyPerk(content, base, "steady_hands", view(20), T0));
    expect(bought.state.perks.steady_hands).toBe(1);
    expect(bought.events).toEqual([
      { type: "perk_bought", perk: "steady_hands", rank: 1, cost: 3 },
    ]);
    expect(effectiveRates(content, bought.state).timber).toBeGreaterThan(
      effectiveRates(content, base).timber ?? 0,
    );
    expect(buyPerk(content, bought.state, "steady_hands", view(1), T0)).toMatchObject({
      ok: false,
      status: { code: "no_points", need: 4 },
    });
    const top = { ...base, perks: { steady_hands: 3 } };
    expect(buyPerk(content, top, "steady_hands", view(99), T0)).toMatchObject({
      ok: false,
      status: { code: "perk_maxed" },
    });
  });

  it("is server-only: the client cannot see the points", () => {
    expect(
      applyCommand(content, fort(), { type: "buy_perk", perk: "hot_coals" }, T0),
    ).toMatchObject({
      ok: false,
      refusal: { code: "server_only" },
    });
    const done = applyCommand(content, fort(), { type: "buy_perk", perk: "hot_coals" }, T0, {
      legacy: view(5),
    });
    expect(done.ok).toBe(true);
  });

  it("an old friend bought mid-season walks in when there is room", () => {
    const base = { ...fort(), veterans: { rook: { level: 3, xp: 300 } } };
    const bought = ok(buyPerk(content, base, "old_friend", view(6), T0));
    expect(bought.state.crew.find((member) => member.id === "rook")).toMatchObject({ level: 3 });
  });

  it("wears only what was earned", () => {
    const command = { type: "set_cosmetic" as const, skin: "rust" };
    expect(applyCommand(content, fort(), command, T0, { legacy: view(0) })).toMatchObject({
      ok: false,
      refusal: { code: "not_earned" },
    });
    const worn = applyCommand(content, fort(), command, T0, {
      legacy: { points: 0, titles: [], skins: ["rust"] },
    });
    expect(worn.state.skin).toBe("rust");
  });
});

describe("season modifiers", () => {
  const withModifier = (modifier: string) => ({ ...fort(), season: { ...season, modifier } });

  it("storm season wrecks the gardens; quiet raiders come a day later", () => {
    const garden = { ...fort(), buildings: { garden: 2 } };
    const storm = { ...garden, season: { ...season, modifier: "storm_season" } };
    expect(effectiveRates(content, storm).food).toBe(
      Math.floor(((effectiveRates(content, garden).food ?? 0) * 70) / 100),
    );
    const reached = { ...fort().stats, reached: { stone: T0 - 9 * DAY } };
    const normal = planRaid(content, { ...fort(), stats: reached }, T0).raid?.at ?? 0;
    const quiet =
      planRaid(content, { ...withModifier("quiet_raiders"), stats: reached }, T0).raid?.at ?? 0;
    expect(Math.floor(quiet / DAY) - Math.floor(normal / DAY)).toBe(1);
    expect(modifiers(content, withModifier("long_nights")).raidStrength).toBe(20);
    expect(modifiers(content, withModifier("rich_tides")).barrelRolls).toBe(1);
  });
});

describe("the Signal", () => {
  const open = (progress = newSignal()): SignalView => ({ ...progress, open: true });

  it("opens on its day, or once the end is announced", () => {
    const { opensOnDay } = content.seasons.signal;
    expect(signalOpen(content, season, T0 + (opensOnDay - 2) * DAY, false)).toBe(false);
    expect(signalOpen(content, season, T0 + (opensOnDay - 1) * DAY, false)).toBe(true);
    expect(signalOpen(content, season, T0, true)).toBe(true);
    const closed = { ...open(), open: false };
    expect(giveStatus(content, fort(), closed, "stone", 10)).toEqual({
      code: "signal_closed",
      day: opensOnDay,
    });
    expect(
      applyCommand(content, fort(), { type: "signal_give", good: "stone", amount: 5 }, T0),
    ).toMatchObject({
      ok: false,
      refusal: { code: "server_only" },
    });
  });

  it("takes only what the open stage still needs, and never more than the base holds", () => {
    const base = { ...fort(), stock: { stone: 500, planks: 99_999, gears: 40 } };
    expect(giveStatus(content, base, open(), "stone", 10_000)).toEqual({ code: "ok", amount: 500 });
    expect(giveStatus(content, base, open(), "gears", 10)).toEqual({ code: "not_needed" });
    const need = content.seasons.signal.stages[0]?.needs.planks ?? 0;
    expect(giveStatus(content, base, open(), "planks", 99_999)).toEqual({
      code: "ok",
      amount: need,
    });
  });

  it("fills stage by stage, lights at the end, and never overfills (property)", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const random = rng(seed);
      let progress = newSignal();
      const given: Record<string, number> = {};
      for (let step = 0; step < 5000 && progress.litAt === null; step++) {
        const needed = Object.entries(stillNeeded(content, progress));
        const [good] = needed[random.int(0, needed.length - 1)] ?? [];
        if (!good) break;
        const base = { ...fort(), stock: { [good]: random.int(1, 50_000) } };
        const status = giveStatus(content, base, open(progress), good, random.int(1, 50_000));
        if (status.code !== "ok") throw new Error(JSON.stringify(status));
        given[good] = (given[good] ?? 0) + status.amount;
        progress = addGift(content, progress, good, status.amount, T0 + step);
      }
      expect(progress.litAt).not.toBeNull();
      const total: Record<string, number> = {};
      for (const stage of content.seasons.signal.stages) {
        for (const [good, need] of Object.entries(stage.needs))
          total[good] = (total[good] ?? 0) + need;
      }
      expect(given).toEqual(total);
    }
  });
});
