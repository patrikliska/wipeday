/**
 * The Den's contracts (W5): its buy orders. Each UTC day a base that deals with
 * the Den gets a few (`den.json5` `contracts`), picked for its tier and the same
 * for everyone at that tier. Delivering one hands over the goods for scrap (below
 * what the Den sells the same goods for, so nothing loops) and sometimes a
 * blueprint. They close when the day ends. Deterministic: predicted like any command.
 */
import type { Content } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import { utcDay } from "./active";
import type { BaseState } from "./base";
import { denOpen } from "./den";
import type { GameEvent } from "./events";
import { giveScrap, held, takeGood } from "./goods";
import { rollBlueprint } from "./recipes";
import { rng, seedOf } from "./rng";

export interface DailyContracts {
  /** UTC day index; -1 before the first roll. */
  day: number;
  /** The tier they were picked for: it sets how much each one wants. */
  tier: Tier;
  ids: string[];
  done: string[];
}

export type Contract = Content["den"]["contracts"]["pool"][number];

export function newContracts(): DailyContracts {
  return { day: -1, tier: "twig", ids: [], done: [] };
}

export function contractOf(content: Content, id: string): Contract | undefined {
  return content.den.contracts.pool.find((contract) => contract.id === id);
}

/** The day's contracts for a base at `tier`: the same picks for everyone at that tier. */
export function rollContracts(content: Content, day: number, tier: Tier): string[] {
  const random = rng(seedOf(day, 0xc047));
  return content.den.contracts.pool
    .map((contract, index) => ({ contract, key: random.next(), index }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map((entry) => entry.contract)
    .filter((contract) => contract.amount[tier] !== undefined)
    .slice(0, content.den.contracts.perDay)
    .map((contract) => contract.id);
}

/** New contracts when the day changes (once the Den deals with the base). Part of settling. */
export function settleContracts(content: Content, state: BaseState, now: number): BaseState {
  if (!denOpen(content, state)) return state;
  const day = utcDay(now);
  // A day's contracts keep their terms, even if the base moves up a tier during it.
  if (state.contracts.day === day) return state;
  return {
    ...state,
    contracts: { day, tier: state.tier, ids: rollContracts(content, day, state.tier), done: [] },
  };
}

export interface Terms {
  good: string;
  amount: number;
  pay: number;
  /** Percent chance of a blueprint on delivery. */
  blueprint: number;
}

/** What `contract` asks of a base at `tier`, and what it pays. */
export function termsOf(content: Content, contract: Contract, tier: Tier): Terms {
  const amount = contract.amount[tier] ?? 0;
  const per100 = content.den.market.refPer100[contract.good] ?? 0;
  return {
    good: contract.good,
    amount,
    pay: Math.max(1, Math.floor((amount * per100 * content.den.contracts.payPercent) / 10_000)),
    blueprint: contract.blueprint ?? 0,
  };
}

export type DeliverStatus =
  | { code: "ok"; terms: Terms }
  | { code: "den_closed"; tier: Tier }
  | { code: "no_contract" }
  | { code: "unaffordable"; missing: Record<string, number> };

export function deliverStatus(content: Content, state: BaseState, id: string): DeliverStatus {
  if (!denOpen(content, state)) return { code: "den_closed", tier: content.den.open.tier };
  const contract = contractOf(content, id);
  if (!contract || !state.contracts.ids.includes(id) || state.contracts.done.includes(id))
    return { code: "no_contract" };
  const terms = termsOf(content, contract, state.contracts.tier);
  const have = held(content, state, terms.good);
  if (have < terms.amount)
    return { code: "unaffordable", missing: { [terms.good]: terms.amount - have } };
  return { code: "ok", terms };
}

/** Hands a contract's goods over: scrap in, and now and then a blueprint. */
export function deliver(
  content: Content,
  state: BaseState,
  id: string,
):
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; status: Exclude<DeliverStatus, { code: "ok" }> } {
  const status = deliverStatus(content, state, id);
  if (status.code !== "ok") return { ok: false, status };
  const { terms } = status;
  let next = giveScrap(takeGood(content, state, terms.good, terms.amount), terms.pay);
  next = { ...next, contracts: { ...next.contracts, done: [...next.contracts.done, id] } };
  const blueprint = rollBlueprint(
    content,
    next,
    terms.blueprint,
    next.contracts.day,
    next.contracts.ids.indexOf(id),
  );
  const events: GameEvent[] = [
    {
      type: "contract_done",
      contract: id,
      good: terms.good,
      amount: terms.amount,
      pay: terms.pay,
    },
  ];
  if (blueprint) {
    next = { ...next, blueprints: [...next.blueprints, blueprint] };
    events.push({ type: "blueprint_found", recipe: blueprint, from: "contract" });
  }
  return { ok: true, state: next, events };
}
