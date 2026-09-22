/**
 * Headless balance simulator: drives `domain/base.ts` with a fake clock and
 * scripted players. `pnpm sim` prints a per-day table (and CSV), `pnpm sim
 * check` asserts the pacing targets in `data/pacing.json5`.
 *
 * Archetypes are decision policies run at each check-in; the domain does the
 * rest. Deterministic: no randomness yet (Phase 3 adds seeded RNG).
 */
import type { Content } from "../content/schema";
import { breakBarrel, hitNode, progressTasks, settleAll, startNodeRun } from "../domain/active";
import {
  type BaseState,
  buyFurnace,
  canAfford,
  collect,
  collectFurnaces,
  craft,
  furnaceReady,
  furnaceSlots,
  gather,
  isEmpty,
  newBase,
  nextFurnace,
  nextTier,
  nextTool,
  smelt,
  smeltable,
  startBuild,
  storageCap,
  storageFill,
  tierOf,
  total,
  upgradeTool,
  workbenchLevel,
} from "../domain/base";
import { seedOf } from "../domain/rng";
import { TIERS, type Tier } from "../ui/theme";

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
  metalFragments: number;
  hqm: number;
  scrap: number;
  items: number;
  building: boolean;
}

export interface Run {
  archetype: Archetype;
  rows: DayRow[];
  /** Season day on which each tier was first reached. */
  reached: Partial<Record<Tier, number>>;
}

/** One check-in: settle, collect, gather, then spend greedily. */
export function checkIn(
  content: Content,
  state: BaseState,
  now: number,
  archetype: Archetype,
): BaseState {
  let s = settleAll(content, state, now).state;
  const collected = collect(content, s, now);
  s = collected.state;
  if (total(collected.gained) > 0) s = progressTasks(content, s, "collect", 1).state;
  const gathered = gather(content, s, now);
  if (gathered.ok) {
    s = progressTasks(content, gathered.state, "gather", 1).state;
    // Active players work the node after every gather, perfectly.
    if (archetype !== "casual") {
      s = startNodeRun(content, s, now, seedOf(now));
      for (let hit = 0; hit < content.active.node.maxHits; hit++) {
        const result = hitNode(content, s, now + hit, s.nodeRun?.marker ?? 0);
        if (!result.ok) break;
        s = progressTasks(content, result.state, "node_hits", 1).state;
      }
    }
  }
  if (s.barrel) {
    const broken = breakBarrel(content, s, now);
    if (broken.ok) s = progressTasks(content, broken.state, "barrel", 1).state;
  }
  if (!isEmpty(furnaceReady(content, s, now))) {
    const out = collectFurnaces(content, s, now);
    s = progressTasks(content, out.state, "furnace_collect", total(out.gained)).state;
  }

  // Spend, most valuable first. Loop because one purchase can enable another.
  for (let guard = 0; guard < 8; guard++) {
    const before = s;

    const build = startBuild(content, s, now);
    if (build.ok) s = build.state;

    // Keep the base fed: never spend below the next 24 h of upkeep (48 h for casual).
    const reserveHours = archetype === "casual" ? 48 : 24;
    const reserve: Record<string, number> = {};
    for (const [id, perHour] of Object.entries(tierOf(content, s.tier).upkeep)) {
      reserve[id] = perHour * reserveHours;
    }
    const spendable = { ...s.stock };
    for (const [id, keep] of Object.entries(reserve)) spendable[id] = (spendable[id] ?? 0) - keep;

    const tool = nextTool(content, s);
    if (tool && canAfford(tool.cost, spendable)) {
      const result = upgradeTool(content, s, now);
      if (result.ok) s = result.state;
    }

    // Furnace: buy the first one as soon as ore is being gathered; upgrade when affordable.
    const gathersOre = Object.keys(s.stock).some((id) =>
      content.resources.some((resource) => resource.id === id && resource.smeltsInto),
    );
    const furnace = nextFurnace(content, s);
    if (furnace && gathersOre && canAfford(furnace.cost, spendable)) {
      const result = buyFurnace(content, s);
      if (result.ok) s = result.state;
    }

    // Workbench, then boxes when storage is getting tight.
    const level = workbenchLevel(content, s);
    const benchItem = content.items.find((item) => item.workbenchLevel === level + 1);
    const benchRecipe = benchItem && content.recipes.find((recipe) => recipe.item === benchItem.id);
    if (
      benchRecipe &&
      level < tierOf(content, s.tier).workbenchLevel &&
      canAfford(benchRecipe.cost, spendable)
    ) {
      const result = craft(content, s, benchRecipe.item);
      if (result.ok) s = progressTasks(content, result.state, "craft", 1).state;
    }
    if (storageFill(content, s, now).fraction > 0.7) {
      const boxes = content.recipes
        .filter(
          (recipe) => content.items.find((item) => item.id === recipe.item)?.category === "storage",
        )
        .sort((a, b) => b.workbench - a.workbench);
      for (const recipe of boxes) {
        const result = craft(content, s, recipe.item);
        if (result.ok) {
          s = progressTasks(content, result.state, "craft", 1).state;
          break;
        }
      }
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
      const result = smelt(content, s, now, ore.id);
      if (!result.ok) break;
      s = progressTasks(content, result.state, "smelt", result.job.amount).state;
    }
  }
  return s;
}

export function simulate(content: Content, archetype: Archetype, days: number): Run {
  const start = 1_700_000_000;
  let state = newBase(content, start);
  const rows: DayRow[] = [];
  const reached: Partial<Record<Tier, number>> = { twig: 1 };

  for (let day = 1; day <= days; day++) {
    for (const hour of SCHEDULE[archetype]) {
      const now = start + (day - 1) * DAY + hour * HOUR;
      state = checkIn(content, state, now, archetype);
      if (reached[state.tier] === undefined) reached[state.tier] = day;
    }
    const endOfDay = start + day * DAY - 1;
    const settledState = settleAll(content, state, endOfDay).state;
    if (reached[settledState.tier] === undefined) reached[settledState.tier] = day;
    rows.push({
      day,
      tier: settledState.tier,
      tool: settledState.toolId,
      fill: `${Math.round(storageFill(content, settledState, endOfDay).fraction * 100)}% ${storageFill(content, settledState, endOfDay).resource}`,
      cap: storageCap(content, settledState),
      metalFragments: settledState.stock.metal_fragments ?? 0,
      hqm: settledState.stock.hqm ?? 0,
      scrap: settledState.stock.scrap ?? 0,
      items: Object.values(settledState.items).reduce((sum, count) => sum + count, 0),
      building: settledState.build !== null,
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
