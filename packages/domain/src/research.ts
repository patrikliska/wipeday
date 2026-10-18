/**
 * The Workshop (docs/game-design.md 5.12; D185, D194): when it opens, what keeps an item shut,
 * and what levels cost. The command, the advisor and the shop's tiles share these, so a tile's
 * reason and the server's refusal never disagree.
 */
import { levelEffect, levelsCost } from "@wipe-day/content/research";
import type { Content, ResearchDef } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import type { Amount } from "./amount";
import type { Effect } from "./effects";
import type { Gate } from "./shelf";
import type { BaseState } from "./state";

export { levelEffect, levelsCost };

const byId = new WeakMap<Content, Map<string, ResearchDef>>();

export function researchOf(content: Content, id: string): ResearchDef | undefined {
  let items = byId.get(content);
  if (!items) {
    items = new Map(content.research.map((def) => [def.id, def]));
    byId.set(content, items);
  }
  return items.get(id);
}

/** The levels of `id` bought this run. */
export const levelOf = (state: BaseState, id: string): number => state.run.research[id] ?? 0;

/** When the Workshop opens this run (unix seconds); null before the run's clock starts. */
export function workshopOpensAt(content: Content, state: BaseState): number | null {
  const started = state.run.startedAt;
  return started === null ? null : started + content.workshop.opensAfterSeconds;
}

/** Whether the Workshop is open at `now`. */
export function workshopOpen(content: Content, state: BaseState, now: number): boolean {
  const at = workshopOpensAt(content, state);
  return at !== null && now >= at;
}

/**
 * Why the next level of `def` cannot be bought at `now`, the price aside; null when only the
 * price is left. In order: the Workshop not open yet, the item's era, a Line Mk's units.
 */
export function researchGate(
  content: Content,
  state: BaseState,
  def: ResearchDef,
  now: number,
): Gate | null {
  const opens = workshopOpensAt(content, state);
  if (opens === null || now < opens)
    return { kind: "opens", value: opens ?? now + content.workshop.opensAfterSeconds };
  if (TIERS.indexOf(def.era) > TIERS.indexOf(state.run.era)) return { kind: "era", value: def.era };
  if (def.kind === "mk" && def.line !== undefined) {
    const need = def.needOwned[levelOf(state, def.id)];
    const have = state.run.lines[def.line] ?? 0;
    if (need !== undefined && have < need)
      return { kind: "owned", value: need, line: def.line, have };
  }
  return null;
}

/** The price of the next level of `def`. */
export function researchCost(state: BaseState, def: ResearchDef): Amount {
  return levelsCost(def, levelOf(state, def.id), 1);
}

/**
 * How many more levels `supplies` buys from level `n` (at most to the top). Closed form for tier
 * items, stepped when floating point overshoots; a Line Mk also stops at a level its units do not
 * reach yet.
 */
export function maxResearch(def: ResearchDef, n: number, supplies: Amount, owned = 0): number {
  const room = Math.max(0, def.levels - n);
  if (room === 0 || supplies <= 0) return 0;
  if (def.kind === "mk") {
    let k = 0;
    while (
      k < room &&
      owned >= (def.needOwned[n + k] ?? Number.POSITIVE_INFINITY) &&
      levelsCost(def, n, k + 1) <= supplies
    ) {
      k += 1;
    }
    return k;
  }
  const g = def.growth;
  const first = def.base * g ** n;
  let k =
    g === 1
      ? Math.floor(supplies / first)
      : Math.floor(Math.log(1 + (supplies * (g - 1)) / first) / Math.log(g));
  k = Math.min(Math.max(0, k), room);
  while (k > 0 && levelsCost(def, n, k) > supplies) k -= 1;
  while (k < room && levelsCost(def, n, k + 1) <= supplies) k += 1;
  return k;
}

/**
 * The Workshop's effects in force: each item's effect at the levels bought, in content order (so
 * the fold's sums never depend on the order things were bought in).
 */
export function researchEffects(content: Content, state: BaseState): Effect[] {
  const out: Effect[] = [];
  const levels = state.run.research;
  for (const def of content.research) {
    const n = levels[def.id] ?? 0;
    if (n > 0) out.push(levelEffect(def.effect, Math.min(n, def.levels)));
  }
  return out;
}
