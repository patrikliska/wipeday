/**
 * Brings a stored base up to the current shape. W1 bases kept stations as
 * items (workbench_1-3, campfire, kiln, press, lantern), the furnace as
 * `furnaceId` and a tier build as `build`; W2 made them buildings and
 * constructions. Players keep everything they built. Idempotent: a current
 * state passes through unchanged.
 */
import type { Content } from "@wipe-day/content/schema";
import type { BaseState, Construction, FurnaceJob, NodeRun } from "./base";

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
      items[id] = count;
    }
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
  const { furnaceId: _furnaceId, build: _build, ...rest } = raw;
  return {
    ...(rest as BaseState),
    buildings,
    construction,
    items,
    furnaceJobs,
    haul: raw.haul ?? { day: -1, minutes: 0 },
    wear: raw.wear ?? {},
    nodeRun: raw.nodeRun ? { ...raw.nodeRun, from: raw.nodeRun.from ?? 0 } : null,
    hints: raw.hints ?? {},
  };
}
