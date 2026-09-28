/**
 * Construction: the base tier and the buildings around it, put up by builders.
 * A builder takes one job at a time (the tier has `builders` of them); paying
 * starts the timer, and the level lands in `settle` when it runs out (or at
 * once for a 0-minute build). Every "can I build this, and if not why" answer
 * the build panel shows comes from `buildStatus`.
 */
import type { Amounts, Building, Content } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import {
  type BaseState,
  type Construction,
  nextTier,
  shortfall,
  subtract,
  type Target,
  tierAtLeast,
  tierOf,
} from "./base";
import type { GameEvent } from "./events";

/** What to build: the next base tier, or a building by id. */
export type BuildWhat = "tier" | string;

export function buildingOf(content: Content, id: string): Building | null {
  return content.buildings.find((building) => building.id === id) ?? null;
}

export function buildingLevel(state: BaseState, id: string): number {
  return state.buildings[id] ?? 0;
}

/** Buildings standing (level 1 or more). */
export function buildingCount(state: BaseState): number {
  return Object.values(state.buildings).filter((level) => level > 0).length;
}

export function builderSlots(content: Content, state: BaseState): number {
  return tierOf(content, state.tier).builders;
}

/** The next level of `what`: its target, cost, minutes and the tier it needs. */
export interface NextBuild {
  target: Target;
  cost: Amounts;
  minutes: number;
  needsTier: Tier;
}

export function nextBuild(content: Content, state: BaseState, what: BuildWhat): NextBuild | null {
  if (what === "tier") {
    const tier = nextTier(state.tier);
    if (!tier) return null;
    const info = tierOf(content, tier);
    return {
      target: { kind: "tier", tier },
      cost: info.cost,
      minutes: info.buildMinutes,
      needsTier: state.tier,
    };
  }
  const building = buildingOf(content, what);
  if (!building) return null;
  const level = buildingLevel(state, what) + 1;
  const def = building.levels[level - 1];
  if (!def) return null;
  return {
    target: { kind: "building", building: what, level },
    cost: def.cost,
    minutes: def.minutes,
    needsTier: def.minTier ?? building.unlockTier,
  };
}

export type BuildStatus =
  | { code: "ok" }
  | { code: "unknown" }
  | { code: "maxed" }
  /** The base tier this needs. */
  | { code: "tier"; tier: Tier }
  /** Already going up; lands at `endsAt`. */
  | { code: "in_progress"; endsAt: number }
  /** Every builder is busy; the first is free at `endsAt`. */
  | { code: "builders"; endsAt: number }
  | { code: "unaffordable"; missing: Amounts };

const sameThing = (a: Target, what: BuildWhat): boolean =>
  what === "tier" ? a.kind === "tier" : a.kind === "building" && a.building === what;

export function buildStatus(content: Content, state: BaseState, what: BuildWhat): BuildStatus {
  if (what !== "tier" && !buildingOf(content, what)) return { code: "unknown" };
  const running = state.construction.find((job) => sameThing(job.target, what));
  if (running) return { code: "in_progress", endsAt: running.endsAt };
  const next = nextBuild(content, state, what);
  if (!next) return { code: "maxed" };
  if (!tierAtLeast(state, next.needsTier)) return { code: "tier", tier: next.needsTier };
  if (state.construction.length >= builderSlots(content, state)) {
    const endsAt = Math.min(...state.construction.map((job) => job.endsAt));
    return { code: "builders", endsAt };
  }
  const missing = shortfall(next.cost, state.stock);
  if (Object.keys(missing).length > 0) return { code: "unaffordable", missing };
  return { code: "ok" };
}

export type ConstructionResult =
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; status: Exclude<BuildStatus, { code: "ok" }> };

/**
 * Pays for the next level of `what` and puts a builder on it. A 0-minute
 * build lands at once (the first workbench, the twig-to-timber upgrade).
 */
export function startConstruction(
  content: Content,
  state: BaseState,
  now: number,
  what: BuildWhat,
): ConstructionResult {
  const status = buildStatus(content, state, what);
  if (status.code !== "ok") return { ok: false, status };
  const next = nextBuild(content, state, what);
  if (!next) return { ok: false, status: { code: "maxed" } };
  const endsAt = now + next.minutes * 60;
  const paid: BaseState = { ...state, stock: subtract(state.stock, next.cost) };
  const events: GameEvent[] = [];
  const { target } = next;
  if (target.kind === "tier") {
    events.push({ type: "build_started", tier: target.tier, endsAt, paid: next.cost });
  } else {
    events.push({
      type: "building_started",
      building: target.building,
      level: target.level,
      endsAt,
      paid: next.cost,
    });
  }
  if (next.minutes > 0) {
    const job: Construction = { target, startedAt: now, endsAt };
    return { ok: true, state: { ...paid, construction: [...paid.construction, job] }, events };
  }
  // At once: land it here, exactly as settling would.
  if (target.kind === "tier") {
    events.push({ type: "build_done", tier: target.tier });
    return {
      ok: true,
      state: { ...paid, tier: target.tier, upkeepPaidUntil: Math.max(paid.upkeepPaidUntil, now) },
      events,
    };
  }
  events.push({ type: "building_done", building: target.building, level: target.level });
  return {
    ok: true,
    state: { ...paid, buildings: { ...paid.buildings, [target.building]: target.level } },
    events,
  };
}
