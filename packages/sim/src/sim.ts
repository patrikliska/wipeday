/**
 * Headless balance simulator: drives `@wipe-day/domain` with a manual clock and
 * scripted players. `pnpm sim` prints a per-day table (and CSV), `pnpm sim
 * check` asserts the pacing targets in `data/pacing.json5`.
 *
 * Archetypes are decision policies run at each check-in; the domain does the
 * rest. Deterministic: every roll is seeded from the check-in time.
 */
import type { Content } from "@wipe-day/content/schema";
import { TIERS, type Tier } from "@wipe-day/content/tiers";
import {
  type BaseState,
  canAfford,
  furnaceReady,
  furnaceSlots,
  isEmpty,
  newBase,
  nextTier,
  nextTool,
  smeltable,
  storageCap,
  storageFill,
  tierOf,
  total,
  upkeepOf,
} from "@wipe-day/domain/base";
import { buildingCount, buildStatus, nextBuild } from "@wipe-day/domain/buildings";
import { manualClock } from "@wipe-day/domain/clock";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import { craftStatus } from "@wipe-day/domain/craft";
import { nodeStatus } from "@wipe-day/domain/nodes";
import { settleAll } from "@wipe-day/domain/settle";

export const ARCHETYPES = ["casual", "active", "optimal"] as const;
export type Archetype = (typeof ARCHETYPES)[number];

/** Check-in moments within a day, in hours. */
const SCHEDULE: Record<Archetype, number[]> = {
  casual: [8, 13, 21],
  active: [7, 9, 12, 15, 17, 19, 21, 23],
  optimal: Array.from({ length: 24 }, (_, hour) => hour),
};

const HOUR = 3600;
const DAY = 86400;

export interface DayRow {
  day: number;
  tier: Tier;
  tool: string;
  /** Fullest resource and its fill, what the storage bar would show. */
  fill: string;
  cap: number;
  ingots: number;
  fuel: number;
  scrap: number;
  items: number;
  /** Buildings standing (level 1 or more). */
  buildings: number;
  building: boolean;
}

export interface Run {
  archetype: Archetype;
  rows: DayRow[];
  /** Season day on which each tier was first reached. */
  reached: Partial<Record<Tier, number>>;
}

/** Applies one command the way the server would; a refusal keeps the settled state. */
function act(content: Content, state: BaseState, command: Command, now: number): BaseState {
  return applyCommand(content, state, command, now).state;
}

/** Nodes an active player works after a gather, most valuable first. */
const NODE_PREFERENCE = ["ore_1", "sulfur_1", "stone_1", "tree_1"];

/** One check-in: collect, gather, work a node, then spend greedily. Every step is a command. */
export function checkIn(
  content: Content,
  state: BaseState,
  now: number,
  archetype: Archetype,
): BaseState {
  let s = act(content, state, { type: "collect" }, now);
  const gathered = applyCommand(content, s, { type: "gather" }, now);
  s = gathered.state;
  // Active players work a node after every gather, perfectly.
  if (gathered.ok && archetype !== "casual") {
    const node = NODE_PREFERENCE.find((id) => nodeStatus(content, s, id, now).code === "ready");
    if (node) {
      for (let hit = 1; hit <= content.active.node.maxHits; hit++) {
        s = act(content, s, { type: "hit_node", node, run: `sim-${now}`, hit }, now + hit);
      }
    }
  }
  if (s.barrel) s = act(content, s, { type: "break_barrel" }, now);
  if (!isEmpty(furnaceReady(s, now))) s = act(content, s, { type: "take_out" }, now);

  // Spend, most valuable first. Loop because one purchase can enable another.
  for (let guard = 0; guard < 8; guard++) {
    const before = s;

    s = act(content, s, { type: "build", what: "tier" }, now);

    // Keep the base fed: never spend below the next 24 h of upkeep (48 h for casual).
    const reserveHours = archetype === "casual" ? 48 : 24;
    const spendable = { ...s.stock };
    for (const [id, perHour] of Object.entries(upkeepOf(content, s))) {
      spendable[id] = (spendable[id] ?? 0) - perHour * reserveHours;
    }
    const affordable = (what: string): boolean => {
      const next = nextBuild(content, s, what);
      return (
        next !== null &&
        buildStatus(content, s, what).code === "ok" &&
        canAfford(next.cost, spendable)
      );
    };

    const tool = nextTool(content, s);
    if (tool && canAfford(tool.cost, spendable)) s = act(content, s, { type: "upgrade_tool" }, now);

    // Furnace: build it as soon as ore is being gathered; upgrade when affordable.
    const gathersOre = Object.keys(s.stock).some((id) =>
      content.resources.some((resource) => resource.id === id && resource.smeltsInto),
    );
    if (gathersOre && affordable("furnace"))
      s = act(content, s, { type: "build", what: "furnace" }, now);
    // The workbench next (it opens crafting), then the cheapest other building a builder can take.
    if (affordable("workbench")) s = act(content, s, { type: "build", what: "workbench" }, now);
    // Other buildings only from what is left after saving for the next tier: half its cost
    // while it is far off, all of it once it is within reach (70% affordable).
    const saving = { ...spendable };
    const upcoming = nextBuild(content, s, "tier");
    if (upcoming && !s.construction.some((job) => job.target.kind === "tier")) {
      const nearlyThere = Object.entries(upcoming.cost).every(
        ([id, amount]) => (s.stock[id] ?? 0) >= amount * 0.7,
      );
      for (const [id, amount] of Object.entries(upcoming.cost)) {
        saving[id] = (saving[id] ?? 0) - (nearlyThere ? amount : amount / 2);
      }
    }
    const spare = (what: string): boolean => {
      const next = nextBuild(content, s, what);
      return (
        next !== null && buildStatus(content, s, what).code === "ok" && canAfford(next.cost, saving)
      );
    };
    const others = content.buildings
      .map((building) => building.id)
      .filter((id) => id !== "furnace" && id !== "workbench" && spare(id))
      .sort(
        (a, b) =>
          total(nextBuild(content, s, a)?.cost ?? {}) - total(nextBuild(content, s, b)?.cost ?? {}),
      );
    const cheapest = others[0];
    if (cheapest) s = act(content, s, { type: "build", what: cheapest }, now);

    if (storageFill(content, s, now).fraction > 0.7) {
      const crates = content.items
        .filter((item) => item.category === "storage")
        .sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0));
      const crate = crates.find((item) => craftStatus(content, s, item.id).code === "ok");
      if (crate) s = act(content, s, { type: "craft", item: crate.id }, now);
    }

    if (s === before) break;
  }

  // Smelt whatever ore is waiting, the ore the next tier needs first.
  const wanted = nextTier(s.tier)
    ? Object.keys(tierOf(content, nextTier(s.tier) ?? s.tier).cost)
    : [];
  const ores = content.resources
    .filter((resource) => resource.smeltsInto)
    .sort(
      (a, b) =>
        Number(wanted.includes(b.smeltsInto ?? "")) - Number(wanted.includes(a.smeltsInto ?? "")),
    );
  for (const ore of ores) {
    while (s.furnaceJobs.length < furnaceSlots(content, s) && smeltable(content, s, ore.id) > 0) {
      const result = applyCommand(content, s, { type: "smelt", ore: ore.id }, now);
      s = result.state;
      if (!result.ok) break;
    }
  }
  return s;
}

export function simulate(content: Content, archetype: Archetype, days: number): Run {
  const start = 1_700_000_000;
  const clock = manualClock(start);
  let state = newBase(content, clock.now(), 1);
  const rows: DayRow[] = [];
  const reached: Partial<Record<Tier, number>> = { twig: 1 };

  for (let day = 1; day <= days; day++) {
    for (const hour of SCHEDULE[archetype]) {
      clock.set(start + (day - 1) * DAY + hour * HOUR);
      state = checkIn(content, state, clock.now(), archetype);
      if (reached[state.tier] === undefined) reached[state.tier] = day;
    }
    clock.set(start + day * DAY - 1);
    const endOfDay = clock.now();
    const settledState = settleAll(content, state, endOfDay).state;
    if (reached[settledState.tier] === undefined) reached[settledState.tier] = day;
    rows.push({
      day,
      tier: settledState.tier,
      tool: settledState.toolId,
      fill: `${Math.round(storageFill(content, settledState, endOfDay).fraction * 100)}% ${storageFill(content, settledState, endOfDay).resource}`,
      cap: storageCap(content, settledState),
      ingots: settledState.stock.ingots ?? 0,
      fuel: settledState.stock.fuel ?? 0,
      scrap: settledState.stock.scrap ?? 0,
      items: Object.values(settledState.items).reduce((sum, count) => sum + count, 0),
      buildings: buildingCount(settledState),
      building: settledState.construction.length > 0,
    });
  }
  return { archetype, rows, reached };
}

export interface CheckFailure {
  message: string;
  /** Advisory: printed, but does not fail the check. */
  warning?: boolean;
}

/** Asserts `data/pacing.json5` against fresh runs. Empty result = pass. */
export function checkPacing(content: Content, days = 35): CheckFailure[] {
  const failures: CheckFailure[] = [];
  const casual = simulate(content, "casual", days);
  const optimal = simulate(content, "optimal", days);
  const { pacing } = content;

  for (const tier of ["stone", "metal", "hqm"] as const) {
    const window = pacing.casual[tier];
    const day = casual.reached[tier];
    if (day === undefined) {
      failures.push({
        message: `casual never reached ${tier} in ${days} days (target day ${window.earliestDay}-${window.latestDay})`,
      });
    } else if (day < window.earliestDay || day > window.latestDay) {
      failures.push({
        message: `casual reached ${tier} on day ${day}, target day ${window.earliestDay}-${window.latestDay}`,
      });
    }
  }
  const { day: buildDay, count: buildTarget } = pacing.casual.buildings;
  const built = casual.rows[buildDay - 1]?.buildings ?? 0;
  if (built < buildTarget) {
    failures.push({
      message: `casual has ${built} buildings on day ${buildDay}, target at least ${buildTarget}`,
    });
  }
  const optimalHqm = optimal.reached.hqm;
  if (optimalHqm !== undefined && optimalHqm < pacing.optimal.hqmNotBeforeDay) {
    failures.push({
      message: `optimal reached hqm on day ${optimalHqm}, must not be before day ${pacing.optimal.hqmNotBeforeDay}`,
    });
  }

  // Tier cost ratio, in resource-hours at the tool tier a player has when buying it.
  const hours = (tierId: Tier, toolIndex: number): number => {
    const cost = tierOf(content, tierId).cost;
    const tool = content.tools[toolIndex];
    if (!tool) return 0;
    let sum = 0;
    for (const [id, amount] of Object.entries(cost)) {
      // Refined resources come from ore 1:1; value them at the ore's rate.
      const ore = content.resources.find((resource) => resource.smeltsInto === id)?.id ?? id;
      const rate = tool.rates[ore] ?? 1;
      sum += amount / rate;
    }
    return sum;
  };
  const costHours = TIERS.slice(1).map((tier, index) =>
    hours(tier, Math.min(index + 1, content.tools.length - 1)),
  );
  for (let index = 1; index < costHours.length; index++) {
    const ratio = (costHours[index] ?? 0) / Math.max(1, costHours[index - 1] ?? 1);
    const tier = TIERS[index + 1];
    if (ratio < pacing.tierCostRatio.min || ratio > pacing.tierCostRatio.max) {
      failures.push({
        warning: true,
        message: `${tier} costs ${ratio.toFixed(1)}x the previous tier in resource-hours (guideline ${pacing.tierCostRatio.min}-${pacing.tierCostRatio.max}x); the day targets are the gate`,
      });
    }
  }
  return failures;
}
