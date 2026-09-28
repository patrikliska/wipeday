import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { type BaseState, newBase } from "./base";
import { applyCommand } from "./commands";
import {
  crewCap,
  equip,
  isFit,
  levelFor,
  lootRange,
  readReport,
  scoutStatus,
  settleArrivals,
  settleMissions,
  siteOf,
  startScout,
  startTrip,
  treat,
  tripOdds,
  tripStatus,
} from "./missions";
import { normalizeState } from "./normalize";
import { settleAll } from "./settle";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const HOUR = 3600;

const base = (seed = 1): BaseState => ({
  ...newBase(content, T0, seed),
  stock: { food: 1000, scrap: 1000, fuel: 100, timber: 100, stone: 100 },
});

function site(id: string) {
  const found = siteOf(content, id);
  if (!found) throw new Error(`no site ${id}`);
  return found;
}

describe("the crew", () => {
  it("starts with the start crew; the next ones arrive when there is room", () => {
    const state = base();
    expect(state.crew.map((member) => member.id)).toEqual(content.crewRules.start);
    const every = content.crewRules.arrivalHours * HOUR;
    // Room for one more: the first boat brings the next survivor in the pool.
    const one = settleArrivals(content, state, state.nextArrivalAt);
    expect(one.events).toMatchObject([{ type: "survivor_arrived", survivor: "rook" }]);
    expect(one.state.crew).toHaveLength(content.crewRules.baseCap);
    // Full: the boat waits, and comes one interval after room appears.
    const full = settleArrivals(content, one.state, one.state.nextArrivalAt + 10);
    expect(full.events).toEqual([]);
    expect(full.state.nextArrivalAt).toBe(one.state.nextArrivalAt + 10 + every);
    const roomy = { ...full.state, buildings: { bunkhouse: 2 } };
    expect(crewCap(content, roomy)).toBe(content.crewRules.baseCap + 2);
    const later = settleArrivals(content, roomy, full.state.nextArrivalAt + every + 1);
    expect(later.events.map((event) => event.type)).toEqual([
      "survivor_arrived",
      "survivor_arrived",
    ]);
  });

  it("gear goes on at home and swaps back into the inventory", () => {
    const state = { ...base(), items: { bow: 1, spear: 1, leather_vest: 1 } };
    const armed = equip(content, state, "mara", "weapon", "bow");
    if (!armed.ok) throw new Error("expected ok");
    expect(armed.state.items.bow).toBeUndefined();
    const swapped = equip(content, armed.state, "mara", "weapon", "spear");
    if (!swapped.ok) throw new Error("expected ok");
    expect(swapped.state.items).toEqual({ bow: 1, leather_vest: 1 });
    expect(equip(content, state, "mara", "armor", "bow")).toEqual({
      ok: false,
      refusal: { code: "wrong_slot" },
    });
    expect(equip(content, state, "nobody", "weapon", "bow")).toMatchObject({ ok: false });
  });

  it("treatment takes hours off an injury, and can heal it", () => {
    const hurt: BaseState = {
      ...base(),
      items: { bandage: 2 },
      crew: base().crew.map((member) =>
        member.id === "dax" ? { ...member, injuredUntil: T0 + 3 * HOUR } : member,
      ),
    };
    const once = treat(content, hurt, "dax", "bandage", T0);
    if (!once.ok) throw new Error("expected ok");
    expect(once.state.crew.find((m) => m.id === "dax")?.injuredUntil).toBe(T0 + HOUR);
    const twice = treat(content, once.state, "dax", "bandage", T0);
    if (!twice.ok) throw new Error("expected ok");
    expect(twice.state.crew.find((m) => m.id === "dax")?.injuredUntil).toBeNull();
    expect(treat(content, twice.state, "dax", "bandage", T0)).toMatchObject({ ok: false });
  });

  it("levels come from cumulative XP", () => {
    expect(levelFor(content, 0)).toBe(1);
    expect(levelFor(content, content.crewRules.levels[0] ?? 0)).toBe(2);
  });
});

describe("the fog", () => {
  it("only neighbours of known regions within range can be scouted", () => {
    const state = base();
    expect(state.known).toEqual(["landing"]);
    expect(scoutStatus(content, state, "pine_ridge", T0)).toEqual({ code: "ok" });
    expect(scoutStatus(content, state, "signal_hill", T0)).toEqual({ code: "hidden" });
    expect(scoutStatus(content, state, "landing", T0)).toEqual({ code: "known" });
    const broke = { ...state, stock: {} };
    expect(scoutStatus(content, broke, "pine_ridge", T0)).toMatchObject({ code: "unaffordable" });
  });

  it("a scout pays the fee, is away, and the region is known when they are back", () => {
    const started = startScout(content, base(), "pine_ridge", "ivo", T0);
    if (!started.ok) throw new Error("expected ok");
    const { mission } = started;
    // Ivo is a navigator: 15% quicker.
    expect(mission.endsAt).toBe(T0 + Math.round(30 * 0.85) * 60);
    expect(started.state.stock.food).toBe(1000 - 20);
    expect(started.state.crew.find((m) => m.id === "ivo")?.away).toBe(mission.id);
    expect(scoutStatus(content, started.state, "pine_ridge", T0)).toEqual({ code: "scouting" });

    const back = settleMissions(content, started.state, mission.endsAt);
    expect(back.state.known).toContain("pine_ridge");
    expect(back.state.missions).toEqual([]);
    expect(back.state.crew.find((m) => m.id === "ivo")?.away).toBeNull();
    expect(back.events.map((event) => event.type)).toEqual(["mission_back", "region_revealed"]);
    expect(back.state.reports[0]).toMatchObject({ id: mission.id, kind: "scout", read: false });
    expect(readReport(back.state, mission.id).reports[0]?.read).toBe(true);
  });
});

describe("trips", () => {
  it("odds add up levels, traits, companions and gear; armour lowers injury", () => {
    const wreck = site("beach_wreck");
    const alone = tripOdds(content, base(), wreck, ["ivo"]);
    const pair = tripOdds(content, base(), wreck, ["ivo", "mara"]);
    // A companion adds points; Mara is cautious (unstable hazard +10, injury -25%).
    expect(pair.success).toBeGreaterThan(alone.success);
    expect(pair.injury[0] ?? 100).toBeLessThan(alone.injury[0] ?? 0);
    const cannery = site("cannery");
    const bare = tripOdds(content, base(), cannery, ["dax"]);
    const armed = equip(
      content,
      { ...base(), items: { bow: 1, leather_vest: 1 } },
      "dax",
      "weapon",
      "bow",
    );
    if (!armed.ok) throw new Error("expected ok");
    const vested = equip(content, armed.state, "dax", "armor", "leather_vest");
    if (!vested.ok) throw new Error("expected ok");
    const geared = tripOdds(content, vested.state, cannery, ["dax"]);
    expect(geared.success).toBe(bare.success + 10);
    expect(geared.injury[0]).toBeLessThan(bare.injury[0] ?? 0);
    expect(lootRange(cannery, bare).scrap?.min).toBe(10);
  });

  it("checks the party and pays the rations; unknown regions' sites are hidden", () => {
    const state = base();
    expect(tripStatus(content, state, "beach_wreck", [], T0)).toEqual({ code: "no_party" });
    expect(tripStatus(content, state, "beach_wreck", ["mara", "dax", "ivo"], T0)).toEqual({
      code: "party_size",
      most: 2,
    });
    expect(tripStatus(content, state, "cannery", ["mara"], T0)).toEqual({ code: "hidden" });
    const known = { ...state, known: ["landing", "tidal_flats"] };
    const trip = startTrip(content, known, "old_campground", ["mara"], T0);
    if (!trip.ok) throw new Error("expected ok");
    expect(trip.state.stock.food).toBe(1000 - 10);
    expect(tripStatus(content, trip.state, "beach_wreck", ["mara"], T0)).toEqual({
      code: "unfit",
      survivor: "mara",
    });
  });

  it("the outcome comes from the seed: the same every settle, and applied once", () => {
    let successes = 0;
    let injuries = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const trip = startTrip(content, base(seed), "beach_wreck", ["dax", "mara"], T0);
      if (!trip.ok) throw new Error("expected ok");
      const end = trip.mission.endsAt;
      const once = settleMissions(content, trip.state, end);
      expect(settleMissions(content, trip.state, end + 50)).toEqual(once);
      expect(settleMissions(content, once.state, end + 100).events).toEqual([]);
      const report = once.state.reports[0];
      if (report?.outcome === "success") successes++;
      injuries += report?.injured.length ?? 0;
      if (report?.outcome === "fail") expect(report.gained).toEqual({});
      for (const member of once.state.crew) expect(member.away).toBeNull();
    }
    const promised = tripOdds(content, base(), site("beach_wreck"), ["dax", "mara"]).success;
    expect(Math.abs(successes / 120 - promised / 100)).toBeLessThan(0.12);
    expect(injuries).toBeGreaterThan(0);
  });

  it("an injured survivor stays home until healed", () => {
    const hurt: BaseState = {
      ...base(),
      crew: base().crew.map((m) => (m.id === "dax" ? { ...m, injuredUntil: T0 + HOUR } : m)),
    };
    const dax = hurt.crew.find((m) => m.id === "dax");
    if (!dax) throw new Error("no dax");
    expect(isFit(dax, T0)).toBe(false);
    expect(isFit(dax, T0 + HOUR)).toBe(true);
  });
});

describe("commands and old saves", () => {
  it("scout and trips go through applyCommand; a trip counts for the trip task", () => {
    const scout = applyCommand(
      content,
      base(),
      { type: "scout", region: "tidal_flats", survivor: "mara" },
      T0,
    );
    expect(scout.ok).toBe(true);
    const again = applyCommand(
      content,
      scout.ok ? scout.state : base(),
      { type: "scout", region: "tidal_flats", survivor: "dax" },
      T0 + 1,
    );
    expect(again).toMatchObject({ ok: false, refusal: { code: "scouting" } });
    const trip = applyCommand(
      content,
      base(),
      { type: "send_trip", site: "beach_wreck", crew: ["dax"] },
      T0,
    );
    if (!trip.ok) throw new Error("expected ok");
    expect(trip.state.missions).toHaveLength(1);
    const landed = settleAll(content, trip.state, T0 + 10 * HOUR);
    expect(landed.events.some((event) => event.type === "mission_back")).toBe(true);
  });

  it("a W3 base gets the start crew, the home shore and empty missions", () => {
    const {
      crew: _c,
      known: _k,
      missions: _m,
      reports: _r,
      missionSeq: _s,
      nextArrivalAt: _n,
      ...old
    } = base();
    const state = normalizeState(content, old);
    expect(state.crew.map((member) => member.id)).toEqual(content.crewRules.start);
    expect(state.known).toEqual(["landing"]);
    expect(state.missions).toEqual([]);
    expect(state.missionSeq).toBe(0);
  });
});
