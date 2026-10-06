import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import type { Amounts } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import { describe, expect, it } from "vitest";
import { type BaseState, newBase, newSurvivor, storageCap } from "./base";
import { applyCommand } from "./commands";
import {
  atRisk,
  defenceOf,
  holdChance,
  nextRaidAt,
  type PendingRaid,
  planRaid,
  raidWarned,
  repair,
  repairStatus,
  resolveRaid,
  warnAt,
} from "./raids";
import { rng } from "./rng";
import { nextEventAt, settleAll } from "./settle";

const content = loadContent(contentPaths.data, loadLocale());
const HOUR = 3600;
const DAY = 86400;
/** Noon UTC, so a plan made "today" is unambiguous. */
const T0 = 19_675 * DAY + 12 * HOUR;
const { npc, capPercent, scrapCeiling } = content.raids;

/** A Stone base that reached the tier days ago, with walls and a full yard. */
const fort = (seed: number, extra: Partial<BaseState> = {}): BaseState => {
  const base = newBase(content, T0, seed);
  return {
    ...base,
    tier: "stone",
    toolId: "iron_tools",
    buildings: { walls: 1 },
    stock: { timber: 8000, stone: 9000, ingots: 2000, sulfur: 300, scrap: 900, planks: 400 },
    items: { bow: 1 },
    upkeepPaidUntil: T0 + 30 * DAY,
    stats: { ...base.stats, reached: { stone: T0 - 5 * DAY } },
    ...extra,
  };
};

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

const planned = (state: BaseState): PendingRaid => {
  if (!state.raid) throw new Error("no raid planned");
  return state.raid;
};

describe("planning a raid", () => {
  it("a command plans one for the night two UTC days on; a plain settle never does", () => {
    expect(settleAll(content, fort(1), T0).state.raid).toBeNull();
    const state = applyCommand(content, fort(1), { type: "collect" }, T0).state;
    const raid = planned(state);
    const day = Math.floor(T0 / DAY) + npc.planDays;
    expect(raid.at).toBeGreaterThanOrEqual(day * DAY + npc.windowStartHour * HOUR);
    expect(raid.at).toBeLessThan(day * DAY + (npc.windowStartHour + npc.windowHours) * HOUR);
    expect(raid).toMatchObject({ n: 1, warned: false });
    expect(state.raidSeq).toBe(1);
  });

  it("depends on the UTC day only, so the client predicts the server's plan", () => {
    const early = planRaid(content, fort(3), T0 - 11 * HOUR);
    const late = planRaid(content, fort(3), T0 + 11 * HOUR);
    expect(planned(early).at).toBe(planned(late).at);
    // A refused command plans too: the player was there.
    const refused = applyCommand(content, fort(3), { type: "repair" }, T0);
    expect(refused.ok).toBe(false);
    expect(planned(refused.state).at).toBe(planned(early).at);
  });

  it("waits for the starting tier and the grace after reaching it", () => {
    expect(planRaid(content, fort(1, { tier: "wood" }), T0).raid).toBeNull();
    const fresh = fort(1, { stats: { ...fort(1).stats, reached: { stone: T0 } } });
    expect(planned(planRaid(content, fresh, T0)).at).toBeGreaterThanOrEqual(
      T0 + npc.firstAfterHours * HOUR,
    );
    // A base that reached Stone before raids existed counts from its first command since.
    const old = fort(1, { stats: { ...fort(1).stats, reached: {} } });
    expect(planned(planRaid(content, old, T0)).at).toBeGreaterThanOrEqual(
      T0 + npc.firstAfterHours * HOUR,
    );
  });

  it("lands exactly one raid however long the player stays away", () => {
    const state = applyCommand(content, fort(5), { type: "collect" }, T0).state;
    const away = settleAll(content, state, T0 + 30 * DAY);
    expect(away.events.filter((event) => event.type === "raid_landed")).toHaveLength(1);
    expect(away.state.raid).toBeNull();
    expect(settleAll(content, away.state, T0 + 60 * DAY).events).not.toContainEqual(
      expect.objectContaining({ type: "raid_landed" }),
    );
  });
});

describe("settling across a landing", () => {
  it("lands at the raid's second, and settling in steps gives the same base", () => {
    const state = applyCommand(content, fort(7), { type: "collect" }, T0).state;
    const at = planned(state).at;
    const exact = settleAll(content, state, at);
    expect(exact.events.some((event) => event.type === "raid_landed")).toBe(true);
    const later = at + 5 * HOUR;
    const once = settleAll(content, state, later).state;
    const before = settleAll(content, state, at - 1).state;
    const stepped = settleAll(content, settleAll(content, before, at).state, later).state;
    // (A waiting boat's arrival time can differ by a second between paths, as before W6.)
    const { nextArrivalAt: _a, ...steppedRest } = stepped;
    const { nextArrivalAt: _b, ...onceRest } = once;
    expect(steppedRest).toEqual(onceRest);
    // Idempotent.
    expect(settleAll(content, once, later).state).toEqual(once);
  });

  it("warns once, sooner with a watchtower, and the timers include both moments", () => {
    const state = applyCommand(content, fort(9), { type: "collect" }, T0).state;
    const raid = planned(state);
    const warning = warnAt(content, state) ?? 0;
    expect(warning).toBe(raid.at - npc.warnBaseHours * HOUR);
    expect(nextRaidAt(content, state)).toBe(warning);
    expect(nextEventAt(content, state)).toBeLessThanOrEqual(warning);
    expect(raidWarned(content, state, warning - 1)).toBe(false);
    const warned = settleAll(content, state, warning);
    expect(warned.events).toContainEqual({ type: "raid_warned", at: warning, lands: raid.at });
    expect(nextRaidAt(content, warned.state)).toBe(raid.at);
    expect(settleAll(content, warned.state, warning + HOUR).events).not.toContainEqual(
      expect.objectContaining({ type: "raid_warned" }),
    );
    const tower = { ...state, buildings: { ...state.buildings, watchtower: 1 } };
    expect(warnAt(content, tower)).toBeLessThan(warning);
  });

  it("drops a raid on a base that decayed below Stone", () => {
    const state = {
      ...fort(1),
      tier: "wood" as Tier,
      raid: { at: T0, seed: 1, n: 1, warned: false },
    };
    const landed = resolveRaid(content, state);
    expect(landed.state.raid).toBeNull();
    expect(landed.events).toEqual([]);
  });
});

/** A base with the raid landing right now and nothing waiting to be collected. */
const landing = (state: BaseState, seed: number): BaseState => ({
  ...state,
  lastCollectedAt: T0,
  raid: { at: T0, seed, n: 1, warned: true },
});

/** Seeds that make `state`'s raid hold, and breach. */
function outcomes(state: BaseState): { held: BaseState; breached: BaseState } {
  let held: BaseState | null = null;
  let breached: BaseState | null = null;
  for (let seed = 1; (!held || !breached) && seed < 500; seed++) {
    const raid = landing(state, seed);
    const report = resolveRaid(content, raid).state.raidReports[0];
    if (report?.outcome === "held") held ??= raid;
    else breached ??= raid;
  }
  if (!held || !breached) throw new Error("no seed for both outcomes");
  return { held, breached };
}

describe("a raid lands", () => {
  it("held: the raiders leave loot from the tier's table", () => {
    const { held } = outcomes(fort(11));
    const landed = resolveRaid(content, held);
    const report = landed.state.raidReports[0];
    expect(report).toMatchObject({ id: "r1", kind: "npc", outcome: "held", lost: {}, read: false });
    for (const line of npc.held.stone ?? []) {
      expect(report?.gained[line.resource]).toBeGreaterThanOrEqual(line.min);
      expect(report?.gained[line.resource]).toBeLessThanOrEqual(line.max);
    }
    expect(landed.state.damaged).toBe(false);
  });

  it("breached: they take the share at risk and damage the defences", () => {
    const { breached } = outcomes(fort(11));
    const risk = atRisk(content, breached, npc.lossPercent);
    const landed = resolveRaid(content, breached);
    expect(landed.state.raidReports[0]).toMatchObject({ outcome: "breached", lost: risk });
    expect(landed.state.stock.timber).toBe(8000 - (risk.timber ?? 0));
    expect(landed.state.stock.planks).toBe(400);
    expect(landed.state.damaged).toBe(true);
    expect(landed.events.at(-1)).toMatchObject({ type: "raid_landed" });
  });

  it("puts what was waiting in the yard first", () => {
    const state = {
      ...fort(13),
      lastCollectedAt: T0 - 2 * HOUR,
      raid: { at: T0, seed: 4, n: 1, warned: true },
    };
    const landed = resolveRaid(content, state);
    expect(landed.events[0]).toMatchObject({ type: "auto_collect" });
    expect(landed.state.lastCollectedAt).toBe(T0);
  });

  it("scales with the yard and with the defence", () => {
    const empty = { ...fort(1), stock: {} };
    expect(atRisk(content, empty, npc.lossPercent)).toEqual({});
    expect(holdChance(content, 0, 0)).toBe(content.raids.maxChance);
    expect(holdChance(content, 0, 50)).toBe(content.raids.minChance);
    expect(holdChance(content, 1000, 1)).toBe(content.raids.maxChance);
    expect(holdChance(content, 20, 20)).toBe(50);
  });
});

describe("damage and repair", () => {
  it("halves the buildings' defence until repaired, never the guards'", () => {
    const guard = { ...newSurvivor(content, "dax", T0), job: { kind: "guard" as const } };
    const state = fort(1, { crew: [guard], damaged: true });
    const defence = defenceOf(content, state, T0);
    expect(defence.damaged).toBe(true);
    expect(defence.buildings).toBe(Math.floor((10 * content.raids.damagedPercent) / 100));
    expect(defence.guards).toBe(content.crewRules.jobs.guardScore + 3);
    const fixed = ok(repair(content, state));
    expect(fixed.state.damaged).toBe(false);
    expect(fixed.state.stock.scrap).toBe(900 - (content.raids.repair.stone?.scrap ?? 0));
    expect(defenceOf(content, fixed.state, T0).buildings).toBe(10);
  });

  it("refuses with nothing to repair, or what is missing", () => {
    expect(repairStatus(content, fort(1))).toEqual({ code: "no_damage" });
    expect(repairStatus(content, fort(1, { damaged: true, stock: {} }))).toMatchObject({
      code: "unaffordable",
    });
    const result = applyCommand(content, fort(1), { type: "repair" }, T0);
    expect(result).toMatchObject({ ok: false, refusal: { code: "no_damage" } });
  });
});

describe("a raid never takes more than the cap (property)", () => {
  const TIERS_AT_RISK: Tier[] = ["stone", "metal", "hqm"];
  const STOCKED = [
    "timber",
    "stone",
    "ore",
    "ingots",
    "sulfur",
    "fibre",
    "food",
    "scrap",
    "planks",
    "gears",
  ];

  it("holds over random bases, defences and seeds", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const random = rng(seed);
      for (let round = 0; round < 20; round++) {
        const tier = TIERS_AT_RISK[random.int(0, 2)] as Tier;
        const stock: Amounts = {};
        for (const id of STOCKED) if (random.next() < 0.8) stock[id] = random.int(0, 90_000);
        const guards = Array.from({ length: random.int(0, 3) }, (_, index) => ({
          ...newSurvivor(content, content.crew[index]?.id ?? "dax", T0),
          job: { kind: "guard" as const },
        }));
        const before = landing(
          fort(seed * 100 + round, {
            tier,
            stock,
            crew: guards,
            damaged: random.next() < 0.3,
            buildings: { walls: random.int(0, 2), traps: random.int(0, 2) },
          }),
          random.int(1, 1_000_000),
        );
        const after = resolveRaid(content, before).state;
        const report = after.raidReports[0];
        const cap = storageCap(content, before);
        for (const id of Object.keys({ ...before.stock, ...after.stock })) {
          const had = before.stock[id] ?? 0;
          const lost = Math.max(0, had - (after.stock[id] ?? 0));
          const limit =
            id === "scrap"
              ? Math.min(Math.floor((had * capPercent) / 100), scrapCeiling[tier] ?? 0)
              : Math.floor((had * capPercent) / 100);
          expect(lost, `${id} at ${tier}, seed ${seed}/${round}`).toBeLessThanOrEqual(limit);
          if (report?.outcome === "held") expect(after.stock[id] ?? 0).toBeGreaterThanOrEqual(had);
          // Loot never overflows storage.
          if (id !== "scrap" && content.resources.find((r) => r.id === id)?.kind === "refined")
            expect(after.stock[id] ?? 0).toBeLessThanOrEqual(Math.max(cap, had));
        }
        // Parts, items, blueprints, crew and escrow are never touched by a breach.
        expect(after.stock.planks ?? 0).toBeGreaterThanOrEqual(before.stock.planks ?? 0);
        expect(after.stock.gears ?? 0).toBe(before.stock.gears ?? 0);
        expect(after.items).toEqual(before.items);
        expect(after.blueprints).toEqual(before.blueprints);
        expect(after.crew).toEqual(before.crew);
        expect(after.listings).toEqual(before.listings);
      }
    }
  });
});
