/**
 * Work Orders (docs/redesign/13-adventure.md 3; D255, D256): the run's checklist. Eight orders
 * are rolled at the start of every run from `orders.json5`'s pools, so many per era in era order,
 * on `seedOf(base seed, SEED.order, run number)`: the client predicts the list the server rolls,
 * and nothing re-rolls it. The list never reorders (D186): it reads era by era in the pools'
 * order. Each order is a state predicate in the badges' vocabulary (run-scoped states included),
 * claimed with `claim_order` once met; any `fuel` claims fuel the Kettle and crown the Big Red
 * (R4), and never lock it: the glass formula does not read them.
 */
import type { Content, OrderDef } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import { whenMet, whenProgress } from "./badges";
import { rng, SEED, seedOf } from "./rng";
import type { BaseState } from "./state";

const byId = new WeakMap<Content, Map<string, OrderDef>>();

/** The order with `id`, if the content lists it. */
export function orderOf(content: Content, id: string): OrderDef | undefined {
  let map = byId.get(content);
  if (!map) {
    map = new Map(content.orders.orders.map((order) => [order.id, order]));
    byId.set(content, map);
  }
  return map.get(id);
}

/**
 * The orders of run `n` for a base with `baseSeed`: `spread` of each era's pool, drawn without
 * replacement, at most `activeMax` of the ones marked `active` and at least `idleMin` of the
 * ones marked `idle` (so an idler can always fuel the set, N32), kept in era then pool order.
 */
export function rollOrders(content: Content, baseSeed: number, n: number): string[] {
  const { spread, activeMax, idleMin, orders } = content.orders;
  const roll = rng(seedOf(baseSeed, SEED.order, n));
  const eraIndex = (era: string): number => TIERS.indexOf(era as (typeof TIERS)[number]);
  let active = 0;
  const eras: { pool: OrderDef[]; picked: OrderDef[] }[] = [];
  for (const row of [...spread].sort((a, b) => eraIndex(a.era) - eraIndex(b.era))) {
    const pool = orders.filter((order) => order.era === row.era);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = roll.int(0, i);
      const a = shuffled[i] as OrderDef;
      shuffled[i] = shuffled[j] as OrderDef;
      shuffled[j] = a;
    }
    const picked: OrderDef[] = [];
    for (const order of shuffled) {
      if (picked.length >= row.count) break;
      if (order.active && active >= activeMax) continue;
      picked.push(order);
      if (order.active) active++;
    }
    eras.push({ pool, picked });
  }
  // Too few idle orders: swap a non-idle pick for an unpicked idle one, era by era.
  const idleCount = () =>
    eras.reduce((sum, era) => sum + era.picked.filter((o) => o.idle).length, 0);
  while (idleCount() < idleMin) {
    const era = eras.find(
      (row) =>
        row.picked.some((order) => !order.idle) &&
        row.pool.some((order) => order.idle && !row.picked.includes(order)),
    );
    if (!era) break;
    const outgoing = era.picked.findIndex((order) => !order.idle);
    const incoming = era.pool.find((order) => order.idle && !era.picked.includes(order));
    if (outgoing < 0 || !incoming) break;
    era.picked[outgoing] = incoming;
  }
  const out: string[] = [];
  for (const era of eras) {
    era.picked.sort((a, b) => era.pool.indexOf(a) - era.pool.indexOf(b));
    out.push(...era.picked.map((order) => order.id));
  }
  return out;
}

/** The run's orders in their fixed order (ids the content no longer knows are skipped). */
export function ordersOf(content: Content, state: BaseState): OrderDef[] {
  const out: OrderDef[] = [];
  for (const id of state.run.orders.ids) {
    const order = orderOf(content, id);
    if (order) out.push(order);
  }
  return out;
}

export const orderClaimed = (state: BaseState, id: string): boolean =>
  state.run.orders.claimed.includes(id);

/** Whether `order` is met on `state` now. */
export function orderMet(content: Content, state: BaseState, order: OrderDef): boolean {
  return whenMet(content, order.when, state, [], 0);
}

/** How far an order has come, or null for a one-off condition (an era). */
export function orderProgress(
  content: Content,
  state: BaseState,
  order: OrderDef,
): { value: number; goal: number } | null {
  return whenProgress(content, order.when, state);
}

/** The orders met and not yet claimed, in list order. */
export function readyOrders(content: Content, state: BaseState): OrderDef[] {
  return ordersOf(content, state).filter(
    (order) => !orderClaimed(state, order.id) && orderMet(content, state, order),
  );
}

/** Whether the run's set is fuelled: `fuel` orders claimed (the Big Red's crown, R4). */
export const fuelled = (content: Content, state: BaseState): boolean =>
  state.run.orders.claimed.length >= content.orders.fuel;
