/**
 * Line prices (docs/redesign/02-the-run.md 2.4-2.5). The n-th unit costs
 * cost × d × growth^(n−1), `d` the line_cost discount; buying k owning n costs
 * C(n, k) = cost × d × g^n × (g^k − 1) / (g − 1), and "max" is that sum solved for k, stepped
 * down when floating point overshoots.
 */
import type { Content, LineDef } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import type { Amount } from "./amount";
import { foldStat, rates } from "./effects";
import type { BaseState } from "./state";

export function lineOf(content: Content, id: string): LineDef | undefined {
  return content.lines.find((line) => line.id === id);
}

/** Whether the run's era has opened `line`. */
export function eraOpen(state: BaseState, line: LineDef): boolean {
  return TIERS.indexOf(line.era) <= TIERS.indexOf(state.run.era);
}

/** The line_cost discount `d` (1 without nodes). */
export function costFactor(content: Content, state: BaseState, line: LineDef): number {
  return foldStat("line_cost", rates(content, state).effects, 1, { line });
}

/** The price of `k` more units of `line` when `n` are owned. */
export function costOf(line: LineDef, n: number, k: number, factor = 1): Amount {
  if (k <= 0) return 0;
  const g = line.growth;
  return (line.cost * factor * g ** n * (g ** k - 1)) / (g - 1);
}

/** How many more units `supplies` buys owning `n` (at most up to `maxOwned`). */
export function maxAffordable(line: LineDef, n: number, supplies: Amount, factor = 1): number {
  const room = Math.max(0, line.maxOwned - n);
  if (room === 0 || supplies <= 0) return 0;
  const g = line.growth;
  const first = line.cost * factor * g ** n;
  let k = Math.floor(Math.log(1 + (supplies * (g - 1)) / first) / Math.log(g));
  k = Math.min(Math.max(0, k), room);
  while (k > 0 && costOf(line, n, k, factor) > supplies) k -= 1;
  while (k < room && costOf(line, n, k + 1, factor) <= supplies) k += 1;
  return k;
}

/** The hand's price for `line`, after hand_cost discounts. */
export function handPriceOf(content: Content, state: BaseState, line: LineDef): Amount {
  return line.handPrice * foldStat("hand_cost", rates(content, state).effects, 1, { line });
}
