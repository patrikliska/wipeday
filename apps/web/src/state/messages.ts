/**
 * Words for what the domain reports: why a command was refused (one sentence,
 * with where to go next: CLAUDE.md 6.3 rule 5) and which happenings deserve a
 * toast. Every string comes from the locale.
 */
import type { Refusal } from "@wipe-day/domain/commands";
import type { FeedEvent } from "@wipe-day/domain/feed";
import { sitesFinding } from "@wipe-day/domain/missions";
import type { GameEvent } from "./events";
import {
  content,
  duration,
  gainLines,
  itemName,
  missingLabel,
  outputName,
  regionName,
  siteName,
  stationName,
  survivorName,
  t,
  taskName,
  tierName,
  toolName,
} from "./world";

export type Panel =
  | "build"
  | "craft"
  | "furnace"
  | "inventory"
  | "tasks"
  | "squad"
  | "map"
  | "feed"
  | null;
export type Tone = "neutral" | "success" | "warning" | "danger";

export interface Message {
  text: string;
  tone: Tone;
  /** Where the player gets what was missing; the toast offers a button to it. */
  panel?: Panel;
  /** A recipe that makes what was missing: the button opens it ("Make planks"). */
  recipe?: string;
  /** A report to read: the button opens its card. */
  report?: string;
}

/** Refined resources come out of the furnace; everything else from gathering. */
const refined = new Set(
  content.resources.filter((resource) => resource.kind === "refined").map((r) => r.id),
);
const made = new Set(content.recipes.map((recipe) => recipe.output));

/** The lowest base tier whose scouts reach `ring`. */
function tierForRange(ring: number): string {
  const tiers = ["twig", "wood", "stone", "metal", "hqm"] as const;
  return tiers.find((tier) => (content.mapRules.range[tier] ?? 0) >= ring) ?? "hqm";
}

/** The building that adds scout range (the radio mast), and how much its first level adds. */
const rangeBuilding = content.buildings.find((b) => (b.levels[0]?.effects.scoutRange ?? 0) > 0);

/** Where a keycode turns up: the likeliest site. */
function keycodeSource(item: string): string | null {
  const site = sitesFinding(content, item)[0];
  return site ? siteName(site.id) : null;
}

export function refusalMessage(refusal: Refusal, now: number): Message | null {
  switch (refusal.code) {
    case "cooldown":
      return {
        text: t("refusal.cooldown", { time: duration(refusal.readyAt - now) }),
        tone: "neutral",
      };
    case "maxed":
      return { text: t("refusal.maxed"), tone: "neutral" };
    case "in_progress":
      return {
        text: t("refusal.in_progress", { time: duration(refusal.endsAt - now) }),
        tone: "neutral",
      };
    case "builders":
      return {
        text: t("refusal.builders", { time: duration(refusal.endsAt - now) }),
        tone: "neutral",
        panel: "build",
      };
    case "tier":
      return {
        text: t("refusal.tier", { tier: tierName(refusal.tier) }),
        tone: "warning",
        panel: "build",
      };
    case "unaffordable": {
      const first = Object.keys(refusal.missing)[0] ?? "";
      const text = t("refusal.unaffordable", { need: missingLabel(refusal.missing) ?? "" });
      if (made.has(first)) return { text, tone: "warning", panel: "craft", recipe: first };
      return { text, tone: "warning", panel: refined.has(first) ? "furnace" : null };
    }
    case "no_furnace":
      return { text: t("refusal.no_furnace"), tone: "warning", panel: "furnace" };
    case "no_slot":
      return { text: t("refusal.no_slot"), tone: "neutral", panel: "furnace" };
    case "nothing_to_smelt":
      return { text: t("refusal.nothing_to_smelt"), tone: "neutral" };
    case "not_ore":
    case "unknown":
      return { text: t("refusal.unknown"), tone: "danger" };
    case "no_barrel":
      return { text: t("refusal.no_barrel"), tone: "neutral" };
    case "workbench":
      return {
        text: t("refusal.workbench", {
          level: refusal.needed,
          station: stationName(refusal.station).toLowerCase(),
        }),
        tone: "warning",
        panel: "build",
      };
    case "station":
      return {
        text: t("refusal.station", { station: stationName(refusal.station) }),
        tone: "warning",
        panel: "build",
      };
    case "blueprint":
      return { text: t("refusal.blueprint"), tone: "neutral" };
    case "batch":
      return {
        text: t("refusal.batch", {
          size: refusal.size,
          station: stationName(refusal.station).toLowerCase(),
        }),
        tone: "neutral",
      };
    case "no_job":
      return { text: t("refusal.no_job"), tone: "neutral" };
    case "not_owned":
      return { text: t("refusal.not_owned"), tone: "neutral" };
    case "not_meal":
      return { text: t("refusal.not_meal"), tone: "danger" };
    case "known":
      return { text: t("refusal.known"), tone: "neutral" };
    case "scouting":
      return { text: t("refusal.scouting"), tone: "neutral" };
    case "hidden":
      return { text: t("refusal.hidden"), tone: "neutral" };
    case "far": {
      const mast = rangeBuilding?.levels[0]?.effects.scoutRange ?? 0;
      if (rangeBuilding && refusal.ring <= refusal.range + mast) {
        return {
          text: t("refusal.far_building", { building: stationName(rangeBuilding.id) }),
          tone: "warning",
          panel: "build",
        };
      }
      return {
        text: t("refusal.far", { tier: tierName(tierForRange(refusal.ring)) }),
        tone: "warning",
        panel: "build",
      };
    }
    case "no_dock":
      return {
        text:
          refusal.level > 1
            ? t("refusal.no_dock_level", {
                building: stationName(refusal.building),
                level: refusal.level,
              })
            : t("refusal.no_dock", { building: stationName(refusal.building) }),
        tone: "warning",
        panel: "build",
      };
    case "no_navigator":
      return { text: t("refusal.no_navigator"), tone: "neutral" };
    case "keycode": {
      const source = keycodeSource(refusal.item);
      return {
        text: source
          ? t("refusal.keycode", { item: itemName(refusal.item), site: source })
          : t("refusal.keycode_nowhere", { item: itemName(refusal.item) }),
        tone: "warning",
        panel: "map",
      };
    }
    case "no_yield":
      return { text: t("refusal.no_yield"), tone: "neutral", panel: "build" };
    case "no_station":
      return {
        text: t("refusal.no_station", { station: stationName(refusal.station) }),
        tone: "warning",
        panel: "build",
      };
    case "station_taken":
      return {
        text: t("refusal.station_taken", {
          name: survivorName(refusal.by),
          station: stationName(refusal.station).toLowerCase(),
        }),
        tone: "neutral",
      };
    case "asleep":
      return {
        text: t("refusal.asleep", { time: duration(refusal.until - now) }),
        tone: "neutral",
      };
    case "nobody_tired":
      return { text: t("refusal.nobody_tired"), tone: "neutral" };
    case "no_survivor":
      return { text: t("refusal.no_survivor"), tone: "neutral", panel: "squad" };
    case "unfit":
      return {
        text: t("refusal.unfit", { name: survivorName(refusal.survivor) }),
        tone: "neutral",
        panel: "squad",
      };
    case "no_party":
      return { text: t("refusal.no_party"), tone: "neutral" };
    case "party_size":
      return { text: t("refusal.party_size", { most: refusal.most }), tone: "neutral" };
    case "away":
      return { text: t("refusal.away"), tone: "neutral" };
    case "wrong_slot":
    case "not_injured":
      return { text: t("refusal.unknown"), tone: "neutral" };
    case "fed_better":
      return {
        text: t("refusal.fed_better", { time: duration(refusal.until - now) }),
        tone: "neutral",
      };
    case "owned":
      return { text: t("refusal.owned"), tone: "neutral" };
    case "box_slots":
      return {
        text: t("refusal.box_slots", { slots: refusal.slots }),
        tone: "warning",
        panel: "build",
      };
    case "queue_full":
      return {
        text: t("refusal.queue_full", { station: stationName(refusal.station).toLowerCase() }),
        tone: "neutral",
        panel: "craft",
      };
    case "depleted":
      return {
        text: t("refusal.depleted", { time: duration(refusal.until - now) }),
        tone: "neutral",
      };
    case "tool":
      return { text: t("refusal.tool"), tone: "warning", panel: "build" };
    case "out_of_order":
    case "run_over":
      // The node run lost sync with the server (a slow network): nothing to tell.
      return null;
  }
}

/** One line of the feed, about `who` (a player's name, or "You"). */
export function feedLine(event: FeedEvent, who: string): string {
  switch (event.type) {
    case "mission_back":
      return t(`feed.trip_${event.outcome === "success" ? "success" : "partial"}`, {
        who,
        site: siteName(event.target),
      });
    case "survivor_arrived":
      return t("feed.rescued", { who, name: survivorName(event.survivor) });
    case "build_done":
      return t("feed.tier", { who, tier: tierName(event.tier) });
    case "level_up":
      return t("feed.level_up", { who, name: survivorName(event.survivor), level: event.level });
    case "blueprint_found":
      return t("feed.blueprint", { who, item: outputName(event.recipe) });
    case "item_found":
      return t("feed.found", { who, item: itemName(event.item), site: siteName(event.from) });
  }
}

/** The happenings worth a toast; effects in the scene cover the rest. */
export function eventMessage(event: GameEvent): Message | null {
  switch (event.type) {
    case "task_done":
      return { text: t("toast.task_done", { task: taskName(event.task) }), tone: "success" };
    case "build_done":
      return { text: t("toast.build_done", { tier: tierName(event.tier) }), tone: "success" };
    case "crafted":
      // Units land one by one; the toast waits for the job's last.
      if (!event.done) return null;
      return { text: t("toast.crafted", { item: outputName(event.recipe) }), tone: "success" };
    case "mission_back":
      return {
        text:
          event.kind === "scout"
            ? t("toast.scout_back", {
                name: survivorName(event.crew[0] ?? ""),
                region: regionName(event.target),
              })
            : t(`toast.trip_${event.outcome}`, { site: siteName(event.target) }),
        tone: event.outcome === "fail" ? "warning" : "success",
        report: event.mission,
      };
    case "survivor_arrived":
      return {
        text: t(event.from === "rescue" ? "toast.rescued" : "toast.arrived", {
          name: survivorName(event.survivor),
        }),
        tone: "success",
        panel: "squad",
      };
    case "item_found":
      return {
        text: t("toast.found", { item: itemName(event.item), site: siteName(event.from) }),
        tone: "success",
        panel: "map",
      };
    case "blueprint_found":
      return {
        text: t("toast.blueprint", { item: outputName(event.recipe) }),
        tone: "success",
        panel: "craft",
        recipe: event.recipe,
      };
    case "served":
      return {
        text: t("toast.served", { meal: outputName(event.meal), percent: event.percent }),
        tone: "success",
      };
    case "salvaged":
      return {
        text: t("toast.salvaged", {
          item: outputName(event.item),
          gains: gainLines(event.gained, 3).join(", "),
        }),
        tone: "neutral",
      };
    case "barrel_spawned":
      return { text: t("toast.barrel"), tone: "warning" };
    case "tool_upgraded":
      return { text: t("toast.tool", { tool: toolName(event.tool) }), tone: "success" };
    case "building_done":
      return {
        text:
          event.level === 1
            ? t("toast.building_done", { building: t(`building.${event.building}.name`) })
            : t("toast.building_level", {
                building: t(`building.${event.building}.name`),
                level: event.level,
              }),
        tone: "success",
      };
    case "building_decayed":
      return {
        text: t("toast.building_decayed", { building: t(`building.${event.building}.name`) }),
        tone: "danger",
        panel: "build",
      };
    case "decayed":
      return {
        text: t("toast.decayed", { tier: tierName(event.to) }),
        tone: "danger",
        panel: "build",
      };
    default:
      return null;
  }
}
