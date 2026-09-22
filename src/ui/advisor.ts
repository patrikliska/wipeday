/**
 * Picks the one primary action on the home screen (CLAUDE.md 4.3 rule 1):
 * the most useful thing the player can do right now. The onboarding hint
 * explains the same action, so the glowing button and the hint always agree.
 */
import type { Content } from "../content/schema";
import { type BaseState, canAfford, gatherReadyAt, isStorageFull, nextTool } from "../domain/base";

export type Advice = "tools" | "gather" | "collect";

export function advise(content: Content, state: BaseState, now: number): Advice {
  // The status line says "collect now" when full; the button must agree.
  if (isStorageFull(content, state, now)) return "collect";
  const next = nextTool(content, state);
  if (next && canAfford(next.cost, state.stock)) return "tools";
  if (gatherReadyAt(content, state) <= now) return "gather";
  return "collect";
}
