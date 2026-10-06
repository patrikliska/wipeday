/**
 * Brings a stored base up to the current shape. W1 bases kept stations as
 * items (workbench_1-3, campfire, kiln, press, lantern), the furnace as
 * `furnaceId` and a tier build as `build`; W2 made them buildings and
 * constructions. W3 replaced the one crafting queue with a queue per station:
 * whatever was still waiting in the old one lands at once, and the hide vest
 * became the leather vest. Players keep everything they built. Idempotent: a
 * current state passes through unchanged.
 */
import type { Content } from "@wipe-day/content/schema";
import {
  type BaseState,
  type Construction,
  type FurnaceJob,
  type NodeRun,
  newSurvivor,
} from "./base";
import type { Survivor } from "./missions";
import { newPvp } from "./raids";
import { newStats } from "./stats";

/** Items that were renamed, old id -> new id. */
const RENAMED: Record<string, string> = { hide_vest: "leather_vest" };

/** W1 station items and the building (and level) each became. */
const STATION_ITEMS: Record<string, [string, number]> = {
  workbench_1: ["workbench", 1],
  workbench_2: ["workbench", 2],
  workbench_3: ["workbench", 3],
  campfire: ["campfire", 1],
  kiln: ["kiln", 1],
  press: ["press", 1],
  lantern: ["lights", 1],
};

type Stored = Partial<BaseState> & {
  furnaceId?: string | null;
  build?: { tier: BaseState["tier"]; endsAt: number } | null;
  furnaceJobs?: Array<Omit<FurnaceJob, "perHour"> & { perHour?: number }>;
  nodeRun?: (Omit<NodeRun, "from"> & { from?: number }) | null;
  /** W1-W2: one queue of single items. */
  craftQueue?: Array<{ item: string; endsAt: number }>;
};

export function normalizeState(content: Content, stored: unknown): BaseState {
  const raw = stored as Stored;
  const buildings: Record<string, number> = { ...(raw.buildings ?? {}) };
  const items: Record<string, number> = {};
  for (const [id, count] of Object.entries(raw.items ?? {})) {
    const station = STATION_ITEMS[id];
    if (station && count > 0) {
      const [building, level] = station;
      buildings[building] = Math.max(buildings[building] ?? 0, level);
    } else if (!station) {
      const current = RENAMED[id] ?? id;
      items[current] = (items[current] ?? 0) + count;
    }
  }
  for (const job of raw.craftQueue ?? []) {
    const current = RENAMED[job.item] ?? job.item;
    items[current] = (items[current] ?? 0) + 1;
  }
  if (raw.furnaceId) {
    const index = content.furnaces.findIndex((furnace) => furnace.id === raw.furnaceId);
    if (index >= 0) buildings.furnace = Math.max(buildings.furnace ?? 0, index + 1);
  }
  const construction: Construction[] = [...(raw.construction ?? [])];
  if (raw.build) {
    const minutes =
      content.baseTiers.find((tier) => tier.id === raw.build?.tier)?.buildMinutes ?? 0;
    construction.push({
      target: { kind: "tier", tier: raw.build.tier },
      startedAt: raw.build.endsAt - minutes * 60,
      endsAt: raw.build.endsAt,
    });
  }
  const furnace = content.furnaces[(buildings.furnace ?? 1) - 1] ?? content.furnaces[0];
  const furnaceJobs: FurnaceJob[] = (raw.furnaceJobs ?? []).map((job) => ({
    ...job,
    perHour: job.perHour ?? furnace?.orePerHour ?? 1,
  }));
  const { furnaceId: _furnaceId, build: _build, craftQueue: _craftQueue, ...rest } = raw;
  return {
    ...(rest as BaseState),
    buildings,
    construction,
    items,
    furnaceJobs,
    haul: raw.haul ?? { day: -1, minutes: 0 },
    wear: raw.wear ?? {},
    production: raw.production ?? {},
    blueprints: raw.blueprints ?? [],
    wellFed: raw.wellFed ?? null,
    // W4: the crew stops being scenery. W3 bases get the starting crew and the home shore;
    // W4b gives every survivor a job slot (free) and a rested shift.
    crew: (raw.crew ?? content.crewRules.start.map((id) => ({ id }) as Partial<Survivor>)).map(
      (member) => ({
        ...newSurvivor(content, member.id ?? "", raw.lastCollectedAt ?? 0),
        ...member,
      }),
    ),
    bonds: raw.bonds ?? {},
    dry: raw.dry ?? {},
    nextArrivalAt:
      raw.nextArrivalAt ?? (raw.lastCollectedAt ?? 0) + content.crewRules.arrivalHours * 3600,
    known: raw.known ?? content.regions.filter((region) => region.ring === 0).map((r) => r.id),
    missions: raw.missions ?? [],
    reports: raw.reports ?? [],
    missionSeq: raw.missionSeq ?? 0,
    nodeRun: raw.nodeRun ? { ...raw.nodeRun, from: raw.nodeRun.from ?? 0 } : null,
    hints: raw.hints ?? {},
    // W5: the Den. A W4 base starts with nothing listed and fresh season counters (the
    // tiers it already holds count as reached now).
    listings: raw.listings ?? [],
    listingSeq: raw.listingSeq ?? 0,
    den: raw.den ?? { day: -1, tier: "twig", offers: [], bought: {} },
    contracts: raw.contracts ?? { day: -1, tier: "twig", ids: [], done: [] },
    casino: raw.casino ?? { day: -1, wagered: 0, won: 0 },
    wheelBets: raw.wheelBets ?? [],
    stats: { ...newStats(), ...raw.stats },
    // W6: raids. The first one is planned at the first command after the update, and lands
    // no sooner than `firstAfterHours` after it for a base that reached Stone before W6.
    raid: raw.raid ?? null,
    raidSeq: raw.raidSeq ?? 0,
    raidReports: raw.raidReports ?? [],
    damaged: raw.damaged ?? false,
    pvp: { ...newPvp(), ...raw.pvp },
  };
}
