/**
 * Words for what the domain reports: why a command was refused (one sentence,
 * with where to go next: CLAUDE.md 6.3 rule 5) and which happenings deserve a
 * toast. Every string comes from the locale.
 */
import type { Refusal } from "@wipe-day/domain/commands";
import type { GameEvent } from "./events";
import {
  content,
  duration,
  itemName,
  missingLabel,
  t,
  taskName,
  tierName,
  toolName,
} from "./world";

export type Panel = "build" | "craft" | "furnace" | "inventory" | "tasks" | "squad" | null;
export type Tone = "neutral" | "success" | "warning" | "danger";

export interface Message {
  text: string;
  tone: Tone;
  /** Where the player gets what was missing; the toast offers a button to it. */
  panel?: Panel;
}

/** Refined resources come out of the furnace; everything else from gathering. */
const refined = new Set(
  content.resources.filter((resource) => resource.kind === "refined").map((r) => r.id),
);

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
      return {
        text: t("refusal.unaffordable", { need: missingLabel(refusal.missing) ?? "" }),
        tone: "warning",
        panel: refined.has(first) ? "furnace" : null,
      };
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
        text: t("refusal.workbench", { level: refusal.needed }),
        tone: "warning",
        panel: "craft",
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
        text: t("refusal.queue_full", { size: refusal.size }),
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

/** The happenings worth a toast; effects in the scene cover the rest. */
export function eventMessage(event: GameEvent): Message | null {
  switch (event.type) {
    case "task_done":
      return { text: t("toast.task_done", { task: taskName(event.task) }), tone: "success" };
    case "build_done":
      return { text: t("toast.build_done", { tier: tierName(event.tier) }), tone: "success" };
    case "crafted":
      return { text: t("toast.crafted", { item: itemName(event.item) }), tone: "success" };
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
