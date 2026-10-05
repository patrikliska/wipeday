import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { accrued, type BaseState, newBase, newSurvivor, storageCap } from "./base";
import { applyCommand } from "./commands";
import { queueCraft, unitsDone } from "./craft";
import { crewOutput, defence, isAsleep, isTired, stationBoost } from "./crew";
import { assign, rest, restTired, tiredWorkers } from "./jobs";
import { startTrip } from "./missions";
import { rng } from "./rng";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const HOUR = 3600;
const { nodePercent, awakeHours, sleepHours, tiredPercent } = content.crewRules.jobs;
/** Rock tools make 120 timber an hour; a node worker adds `nodePercent` of that. */
const WORKER_TIMBER = (120 * nodePercent) / 100;

const base = (): BaseState => ({
  ...newBase(content, T0, 1),
  stock: { timber: 0, stone: 0, food: 1000, scrap: 1000, fuel: 100 },
});

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

function working(at = T0): BaseState {
  return ok(assign(content, base(), "mara", { kind: "node", node: "tree" }, at)).state;
}

describe("node work", () => {
  it("adds a share of the tool's rate, lazily", () => {
    const state = working();
    expect(crewOutput(content, state, T0, T0 + 4 * HOUR)).toEqual({ timber: 4 * WORKER_TIMBER });
    // The tool's own production and the worker's land together, under the cap.
    expect(accrued(content, state, T0 + 4 * HOUR).timber).toBe(4 * 120 + 4 * WORKER_TIMBER);
  });

  it("drops to the tired pace after the hours awake, and stops while asleep", () => {
    const state = working();
    const end = T0 + (awakeHours + 4) * HOUR;
    expect(crewOutput(content, state, T0, end).timber).toBe(
      awakeHours * WORKER_TIMBER + (4 * WORKER_TIMBER * tiredPercent) / 100,
    );
    expect(isTired(state.crew[0] ?? newSurvivor(content, "x", 0), end)).toBe(true);
    const rested = ok(rest(content, state, "mara", end)).state;
    const mara = rested.crew[0];
    if (!mara) throw new Error("no mara");
    expect(isAsleep(mara, end + HOUR)).toBe(true);
    // Banked at bedtime; asleep for the rest, then two hours at full pace.
    expect(rested.lastCollectedAt).toBe(end);
    const after = end + (sleepHours + 2) * HOUR;
    expect(crewOutput(content, rested, end, after).timber).toBe(2 * WORKER_TIMBER);
  });

  it("pauses for an injury and for a trip away", () => {
    const state = working();
    const hurt = {
      ...state,
      crew: state.crew.map((m) => (m.id === "mara" ? { ...m, injuredUntil: T0 + 2 * HOUR } : m)),
    };
    expect(crewOutput(content, hurt, T0, T0 + 4 * HOUR).timber).toBe(2 * WORKER_TIMBER);
    const away = ok(startTrip(content, state, "beach_wreck", ["mara"], T0 + HOUR)).state;
    // The hour before leaving was banked; nothing accrues while away.
    expect(away.lastCollectedAt).toBe(T0 + HOUR);
    expect(crewOutput(content, away, T0 + HOUR, T0 + 3 * HOUR)).toEqual({});
  });

  it("a served meal lifts the crew's work while it lasts", () => {
    const state = { ...working(), wellFed: { percent: 20, until: T0 + 2 * HOUR } };
    expect(crewOutput(content, state, T0, T0 + 4 * HOUR).timber).toBe(
      Math.floor(4 * WORKER_TIMBER + (2 * WORKER_TIMBER * 20) / 100),
    );
  });

  it("a mule works a node harder", () => {
    const state = { ...base(), crew: [...base().crew, newSurvivor(content, "rook", T0)] };
    const assigned = ok(assign(content, state, "rook", { kind: "node", node: "tree" }, T0)).state;
    expect(crewOutput(content, assigned, T0, T0 + HOUR).timber).toBe(
      Math.floor((120 * (nodePercent + 15)) / 100),
    );
  });

  it("never pushes stock past the cap (property)", () => {
    const random = rng(42);
    for (let run = 0; run < 200; run++) {
      const cap = storageCap(content, base());
      const start = random.int(0, cap);
      let state: BaseState = { ...working(), stock: { timber: start, stone: start } };
      if (random.next() < 0.5)
        state = ok(assign(content, state, "dax", { kind: "node", node: "stone" }, T0)).state;
      if (random.next() < 0.5) state = { ...state, wellFed: { percent: 30, until: T0 + HOUR } };
      const later = T0 + random.int(0, 72) * HOUR;
      const got = accrued(content, state, later);
      for (const [id, amount] of Object.entries(got)) {
        expect((state.stock[id] ?? 0) + amount).toBeLessThanOrEqual(cap);
      }
    }
  });
});

describe("assigning", () => {
  it("explains what is not possible", () => {
    const state = base();
    expect(assign(content, state, "mara", { kind: "node", node: "sulfur" }, T0)).toEqual({
      ok: false,
      refusal: { code: "no_yield", node: "sulfur" },
    });
    expect(assign(content, state, "mara", { kind: "station", station: "workbench" }, T0)).toEqual({
      ok: false,
      refusal: { code: "no_station", station: "workbench" },
    });
    const built = { ...state, buildings: { workbench: 1 } };
    const taken = ok(
      assign(content, built, "mara", { kind: "station", station: "workbench" }, T0),
    ).state;
    expect(assign(content, taken, "dax", { kind: "station", station: "workbench" }, T0)).toEqual({
      ok: false,
      refusal: { code: "station_taken", station: "workbench", by: "mara" },
    });
    expect(assign(content, state, "nobody", null, T0)).toMatchObject({ ok: false });
  });

  it("the same job twice changes nothing", () => {
    const state = working();
    const again = ok(assign(content, state, "mara", { kind: "node", node: "tree" }, T0 + HOUR));
    expect(again.state).toBe(state);
    expect(again.events).toEqual([]);
  });

  it("time free counts as rest once it is a full rest long", () => {
    const later = T0 + (sleepHours + 1) * HOUR;
    const fresh = ok(assign(content, base(), "mara", { kind: "guard" }, later)).state;
    expect(fresh.crew[0]?.shift.tiredAt).toBe(later + awakeHours * HOUR);
    const soon = T0 + HOUR;
    const notYet = ok(assign(content, base(), "mara", { kind: "guard" }, soon)).state;
    expect(notYet.crew[0]?.shift.tiredAt).toBe(T0 + awakeHours * HOUR);
  });

  it("a station worker speeds the queue at once, keeping what landed", () => {
    const state = { ...base(), stock: { timber: 5000 }, buildings: { workbench: 1 } };
    const queued = ok(queueCraft(content, state, "planks", 10, T0)).state;
    const job = queued.production.workbench?.[0];
    if (!job) throw new Error("no job");
    const now = T0 + Math.floor(2.5 * job.unitSeconds);
    // Otto is a tinkerer: the station share plus the trait's `any`.
    const withOtto = { ...queued, crew: [...queued.crew, newSurvivor(content, "otto", T0)] };
    const sped = ok(
      assign(content, withOtto, "otto", { kind: "station", station: "workbench" }, now),
    ).state;
    expect(stationBoost(content, sped, "workbench")).toBe(
      content.crewRules.jobs.stationPercent + 30,
    );
    const moved = sped.production.workbench?.[0];
    if (!moved) throw new Error("no job");
    expect(moved.unitSeconds).toBeLessThan(job.unitSeconds);
    expect(unitsDone(moved, now)).toBe(2);
    expect(moved.startedAt + moved.count * moved.unitSeconds).toBeLessThan(
      job.startedAt + job.count * job.unitSeconds,
    );
  });
});

describe("rest", () => {
  it("rest the tired puts every tired worker at home to bed, once", () => {
    let state = working();
    state = ok(assign(content, state, "dax", { kind: "guard" }, T0)).state;
    const late = T0 + (awakeHours + 1) * HOUR;
    expect(tiredWorkers(state, late).map((m) => m.id)).toEqual(["mara", "dax"]);
    const rested = ok(restTired(content, state, late));
    expect(rested.events.map((event) => event.type)).toEqual(["rested", "rested"]);
    expect(restTired(content, rested.state, late)).toEqual({
      ok: false,
      refusal: { code: "nobody_tired" },
    });
    expect(rest(content, rested.state, "mara", late + HOUR)).toMatchObject({
      ok: false,
      refusal: { code: "asleep" },
    });
  });

  it("someone woken for a trip keeps the share of the rest they had", () => {
    const asleep = ok(rest(content, working(), "mara", T0)).state;
    const half = T0 + (sleepHours / 2) * HOUR;
    const gone = ok(startTrip(content, asleep, "beach_wreck", ["mara"], half)).state;
    const mara = gone.crew.find((m) => m.id === "mara");
    expect(mara?.shift.sleepUntil).toBeNull();
    expect(mara?.shift.tiredAt).toBe(half + (awakeHours / 2) * HOUR);
  });
});

describe("guards", () => {
  it("defence counts guards at their post", () => {
    const state = { ...base(), crew: [...base().crew, newSurvivor(content, "rook", T0)] };
    let guarded = ok(assign(content, state, "mara", { kind: "guard" }, T0)).state;
    guarded = ok(assign(content, guarded, "rook", { kind: "guard" }, T0)).state;
    const score = content.crewRules.jobs.guardScore;
    expect(defence(content, guarded, T0 + HOUR)).toBe(score + score + 5);
    const away = ok(startTrip(content, guarded, "beach_wreck", ["rook"], T0 + HOUR)).state;
    expect(defence(content, away, T0 + 2 * HOUR)).toBe(score);
  });
});

describe("commands", () => {
  it("assign and rest go through applyCommand; replays refuse or change nothing", () => {
    const job = { kind: "node" as const, node: "tree" };
    const first = applyCommand(content, base(), { type: "assign", survivor: "mara", job }, T0);
    if (!first.ok) throw new Error("expected ok");
    const again = applyCommand(content, first.state, { type: "assign", survivor: "mara", job }, T0);
    expect(again).toMatchObject({ ok: true, events: [] });
    const late = T0 + (awakeHours + 1) * HOUR;
    const rested = applyCommand(content, first.state, { type: "rest_tired" }, late);
    expect(rested.ok).toBe(true);
    const replay = applyCommand(content, rested.state, { type: "rest_tired" }, late);
    expect(replay).toMatchObject({ ok: false, refusal: { code: "nobody_tired" } });
    // A stale view that still shows Mara awake gets a clear refusal, not a second rest.
    const stale = applyCommand(content, rested.state, { type: "rest", survivor: "mara" }, late);
    expect(stale).toMatchObject({ ok: false, refusal: { code: "asleep" } });
  });
});
