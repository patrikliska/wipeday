/**
 * Values the HUD derives from the base every frame, through the domain, cached
 * per (base, second) so a dozen selectors do not recompute them.
 */
import type { Amounts } from "@wipe-day/content/schema";
import { accrued, type BaseState } from "@wipe-day/domain/base";
import type { WorldState } from "../state/store";
import { content } from "../state/world";

let cached: { base: BaseState; at: number; pending: Amounts } | null = null;

/** What has piled up and waits to be collected. */
export function pendingOf(state: Pick<WorldState, "base" | "now">): Amounts {
  const at = Math.floor(state.now);
  if (cached && cached.base === state.base && cached.at === at) return cached.pending;
  const pending = accrued(content, state.base, at);
  cached = { base: state.base, at, pending };
  return pending;
}

/**
 * Gathered and smelted resources in display order that the base has met so far (they
 * appear as they are found). Parts live in the inventory, not the top bar.
 */
export function knownResources(base: BaseState): string[] {
  return content.resources
    .filter((resource) => resource.kind !== "part" && base.stock[resource.id] !== undefined)
    .map((resource) => resource.id);
}

/** Parts the base has had, in display order. */
export function knownParts(base: BaseState): string[] {
  return content.resources
    .filter((resource) => resource.kind === "part" && base.stock[resource.id] !== undefined)
    .map((resource) => resource.id);
}
