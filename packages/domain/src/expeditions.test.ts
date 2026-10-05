/** W4b on the island: the radio mast's range, the sea, keycodes, trip events and bonds. */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { type BaseState, newBase, newSurvivor } from "./base";
import { bondKey } from "./crew";
import {
  type Mission,
  scoutRange,
  scoutStatus,
  settleMissions,
  siteOf,
  sitesFinding,
  startScout,
  startTrip,
  tripOdds,
  tripStatus,
} from "./missions";
import { normalizeState } from "./normalize";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;

const ALL_LAND = [
  "landing",
  "tidal_flats",
  "pine_ridge",
  "ferry_point",
  "rust_bay",
  "quarry_hills",
  "stormcap",
  "sulfur_springs",
  "signal_hill",
];

const base = (seed = 1): BaseState => ({
  ...newBase(content, T0, seed),
  tier: "metal",
  known: ALL_LAND,
  stock: { food: 5000, scrap: 5000, fuel: 1000, timber: 100, stone: 100 },
});

function site(id: string) {
  const found = siteOf(content, id);
  if (!found) throw new Error(`no site ${id}`);
  return found;
}

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

/** Sends a party, overrides the odds it left with, and lands it. */
function land(state: BaseState, siteId: string, crew: string[], odds: Partial<Mission["odds"]>) {
  const left = ok(startTrip(content, state, siteId, crew, T0));
  const fixed: BaseState = {
    ...left.state,
    missions: left.state.missions.map((m) => ({ ...m, odds: { ...m.odds, ...odds } })),
  };
  return settleMissions(content, fixed, left.mission.endsAt);
}

describe("range", () => {
  it("the radio mast reaches one ring further", () => {
    expect(scoutRange(content, base())).toBe(3);
    expect(scoutRange(content, { ...base(), buildings: { radio_mast: 1 } })).toBe(4);
    expect(scoutRange(content, { ...base(), tier: "hqm", buildings: { radio_mast: 1 } })).toBe(5);
    expect(scoutStatus(content, base(), "rail_yards", T0)).toEqual({
      code: "far",
      ring: 4,
      range: 3,
    });
    const masted = { ...base(), buildings: { radio_mast: 1 } };
    expect(scoutStatus(content, masted, "rail_yards", T0)).toEqual({ code: "ok" });
  });
});

describe("the sea", () => {
  it("needs the dock and a navigator", () => {
    const masted = { ...base(), tier: "hqm" as const, buildings: { radio_mast: 1 } };
    expect(scoutStatus(content, masted, "the_narrows", T0)).toEqual({
      code: "no_dock",
      building: "dock",
      level: 2,
    });
    const docked = { ...masted, buildings: { radio_mast: 1, dock: 2 } };
    // Mara is no navigator; Ivo is.
    expect(scoutStatus(content, docked, "the_narrows", T0, "mara")).toEqual({
      code: "no_navigator",
      trait: "navigator",
    });
    expect(ok(startScout(content, docked, "the_narrows", "ivo", T0)).mission.target).toBe(
      "the_narrows",
    );
    const atSea = {
      ...docked,
      known: [...ALL_LAND, "the_narrows"],
      items: { brass_keycode: 2 },
    };
    expect(tripStatus(content, atSea, "submarine_pen", ["mara", "dax"], T0)).toEqual({
      code: "no_navigator",
      trait: "navigator",
    });
    expect(tripStatus(content, atSea, "submarine_pen", ["mara", "ivo"], T0)).toEqual({
      code: "ok",
    });
    // The open sea needs a bigger dock.
    const further = { ...atSea, known: [...atSea.known] };
    expect(scoutStatus(content, further, "open_water", T0, "ivo")).toEqual({
      code: "no_dock",
      building: "dock",
      level: 3,
    });
  });
});

describe("keycodes", () => {
  it("gate the upper sites, are spent on the way in, and say where to look", () => {
    const state = base();
    expect(tripStatus(content, state, "weather_station", ["mara"], T0)).toEqual({
      code: "keycode",
      item: "tin_keycode",
    });
    expect(sitesFinding(content, "tin_keycode").map((s) => s.id)).toContain("ferry_terminal");
    const keyed = { ...state, items: { tin_keycode: 1 } };
    const left = ok(startTrip(content, keyed, "weather_station", ["mara"], T0));
    expect(left.state.items.tin_keycode).toBeUndefined();
    expect(left.events[0]).toMatchObject({ type: "trip_started", keycode: "tin_keycode" });
  });

  it("a success can bring one home", () => {
    // Find a seed where the weather station's copper turns up on a sure success.
    for (let seed = 1; seed < 50; seed++) {
      const keyed = { ...base(seed), items: { tin_keycode: 1 } };
      const back = land(keyed, "weather_station", ["mara"], { success: 100, partial: 100 });
      if (!back.state.items.copper_keycode) continue;
      expect(back.events).toContainEqual(
        expect.objectContaining({ type: "item_found", item: "copper_keycode" }),
      );
      expect(back.state.reports[0]?.found).toEqual(["copper_keycode"]);
      return;
    }
    throw new Error("no seed found a copper keycode in 50 tries at 50%");
  });
});

describe("bad luck is capped", () => {
  it("after findPity dry successes the next success brings the find", () => {
    // A copy of the content where the weather station almost never finds copper.
    const stingy = {
      ...content,
      sites: content.sites.map((s) =>
        s.id === "weather_station" ? { ...s, finds: [{ item: "copper_keycode", chance: 1 }] } : s,
      ),
    };
    let state: BaseState = { ...base(), items: { tin_keycode: 10 } };
    const found: number[] = [];
    for (let trip = 1; trip <= content.mapRules.findPity + 1; trip++) {
      const left = startTrip(stingy, state, "weather_station", ["mara"], T0 + trip * 86400);
      if (!left.ok) throw new Error("expected ok");
      const sure = {
        ...left.state,
        missions: left.state.missions.map((m) => ({
          ...m,
          odds: { ...m.odds, success: 100, partial: 100, injury: [0] },
        })),
      };
      state = settleMissions(stingy, sure, left.mission.endsAt).state;
      if (state.items.copper_keycode) found.push(trip);
    }
    expect(found).toEqual([content.mapRules.findPity + 1]);
    expect(state.dry.weather_station).toBe(0);
  });
});

describe("trip events", () => {
  const sure = { success: 100, partial: 100, injury: [0, 0] };

  it("the odds carry each event's chance; weapons and marksmen lower an ambush", () => {
    const odds = tripOdds(content, base(), site("cannery"), ["mara", "dax"]);
    expect(Object.keys(odds.events ?? {})).toEqual(["ambush", "cache", "stranger"]);
    const armed = {
      ...base(),
      crew: base().crew.map((m) => ({ ...m, gear: { weapon: "bow", armor: null } })),
    };
    const lower = tripOdds(content, armed, site("cannery"), ["mara", "dax"]);
    expect(lower.events?.ambush).toBeLessThan(odds.events?.ambush ?? 0);
  });

  it("an ambush costs part of the haul; a cache adds hauls", () => {
    const plain = land(base(), "quarry", ["mara", "dax"], { ...sure, events: { ambush: 0 } });
    const ambushed = land(base(), "quarry", ["mara", "dax"], { ...sure, events: { ambush: 100 } });
    const total = (amounts: Record<string, number>) =>
      Object.values(amounts).reduce((sum, value) => sum + value, 0);
    expect(ambushed.state.reports[0]?.events).toEqual(["ambush"]);
    expect(total(ambushed.state.reports[0]?.gained ?? {})).toBeLessThan(
      total(plain.state.reports[0]?.gained ?? {}),
    );
    const cached = land(base(), "quarry", ["mara", "dax"], { ...sure, events: { cache: 100 } });
    expect(cached.state.reports[0]?.events).toEqual(["cache"]);
    expect(cached.events).toContainEqual(
      expect.objectContaining({ type: "trip_event", event: "cache" }),
    );
  });

  it("a stranger joins when there is room", () => {
    const back = land(base(), "beach_wreck", ["mara"], { ...sure, events: { stranger: 100 } });
    expect(back.state.crew.map((m) => m.id)).toContain("rook");
    expect(back.state.reports[0]?.rescued).toBe("rook");
    expect(back.events).toContainEqual(
      expect.objectContaining({ type: "survivor_arrived", survivor: "rook", from: "rescue" }),
    );
    // With no bunk free, nobody is promised: the confirm shows 0%.
    const full = { ...base(), crew: [...base().crew, newSurvivor(content, "rook", T0)] };
    expect(tripOdds(content, full, site("beach_wreck"), ["mara"]).events?.stranger).toBe(0);
  });

  it("missions sent before W4b roll as they did, with no events", () => {
    const left = ok(startTrip(content, base(), "beach_wreck", ["mara"], T0));
    const old: BaseState = {
      ...left.state,
      missions: left.state.missions.map((m) => {
        const { events: _events, ...odds } = m.odds;
        return { ...m, odds };
      }),
    };
    const back = settleMissions(content, old, left.mission.endsAt);
    expect(back.state.reports[0]?.events).toEqual([]);
    expect(back.events.some((event) => event.type === "trip_event")).toBe(false);
  });
});

describe("bonds and coming home", () => {
  it("pairs bond on trips together and then go out with better odds", () => {
    let state = base();
    for (let trip = 0; trip < content.crewRules.bonds.trips; trip++) {
      state = land(state, "beach_wreck", ["mara", "dax"], { injury: [0, 0] }).state;
    }
    expect(state.bonds[bondKey("dax", "mara")]).toBe(content.crewRules.bonds.trips);
    const before = tripOdds(content, base(), site("observatory"), ["mara", "dax"]);
    const after = tripOdds(content, state, site("observatory"), ["mara", "dax"]);
    expect(after.success - before.success).toBe(content.crewRules.bonds.success);
  });

  it("workers pick up their job from the moment they are home", () => {
    const state = {
      ...base(),
      crew: base().crew.map((m) =>
        m.id === "mara" ? { ...m, job: { kind: "node" as const, node: "tree" } } : m,
      ),
    };
    const back = land(state, "beach_wreck", ["mara"], { injury: [0] });
    const end = back.state.reports[0]?.at ?? 0;
    expect(back.state.crew.find((m) => m.id === "mara")?.shift.since).toBe(end);
  });

  it("level ups are events", () => {
    const state = {
      ...base(),
      crew: base().crew.map((m) => (m.id === "mara" ? { ...m, xp: 99 } : m)),
    };
    const back = land(state, "beach_wreck", ["mara"], { success: 100, partial: 100, injury: [0] });
    expect(back.events).toContainEqual(
      expect.objectContaining({ type: "level_up", survivor: "mara", level: 2 }),
    );
  });

  it("old bases get free, rested survivors and no bonds", () => {
    const { bonds: _bonds, ...stored } = base();
    const old = {
      ...stored,
      crew: stored.crew.map(({ job: _job, shift: _shift, ...rest }) => rest),
    };
    const state = normalizeState(content, old);
    expect(state.bonds).toEqual({});
    expect(state.crew[0]).toMatchObject({ job: null, shift: { sleepUntil: null } });
  });
});
