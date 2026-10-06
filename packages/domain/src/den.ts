/**
 * The Den (W5), the smugglers' trading post: whether it deals with a base yet,
 * and its own counter. Every UTC day it puts out a handful of offers from
 * `den.json5` (the same for everyone at the same tier, seeded by the day like the
 * daily tasks), each sold in lots at a markup, with a daily limit per player.
 * Deterministic, so the client predicts a purchase like any other command.
 */
import type { Content } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import { utcDay } from "./active";
import { type BaseState, tierAtLeast } from "./base";
import type { GameEvent } from "./events";
import { giveGood, isItem, roomFor } from "./goods";
import { drawBlueprint, unknownBlueprints } from "./recipes";
import { rng, seedOf } from "./rng";

const DAY = 86400;

/** The Den's counter today, as this base sees it. */
export interface DenDay {
  /** UTC day index; -1 before the Den first opened for this base. */
  day: number;
  /** The base tier the offers were picked for (a new tier mid-day re-picks them). */
  tier: Tier;
  /** Offer ids (den.json5 `stock.pool`), in display order. */
  offers: string[];
  /** Lots bought today, by offer id. */
  bought: Record<string, number>;
}

export type Offer = Content["den"]["stock"]["pool"][number];

export function newDenDay(): DenDay {
  return { day: -1, tier: "twig", offers: [], bought: {} };
}

/** Whether the Den deals with this base (its tier). */
export function denOpen(content: Content, state: Pick<BaseState, "tier">): boolean {
  return tierAtLeast(state, content.den.open.tier);
}

/** When the Den restocks (and the contracts and the wager caps reset): the next UTC midnight. */
export function denResetAt(now: number): number {
  return (utcDay(now) + 1) * DAY;
}

/** The day's offers for a base at `tier`: the same picks for everyone at that tier. */
export function rollStock(content: Content, day: number, tier: Tier): string[] {
  const random = rng(seedOf(day, 0xd3e5));
  return content.den.stock.pool
    .map((offer, index) => ({ offer, key: random.next(), index }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map((entry) => entry.offer)
    .filter((offer) => tierAtLeast({ tier }, offer.minTier))
    .slice(0, content.den.stock.perDay)
    .map((offer) => offer.id);
}

/** Restocks at the day's change (or for a new tier). Part of settling. */
export function settleDen(content: Content, state: BaseState, now: number): BaseState {
  if (!denOpen(content, state)) return state;
  const day = utcDay(now);
  if (state.den.day === day && state.den.tier === state.tier) return state;
  return {
    ...state,
    den: {
      day,
      tier: state.tier,
      offers: rollStock(content, day, state.tier),
      // A new tier mid-day keeps what was bought today.
      bought: state.den.day === day ? state.den.bought : {},
    },
  };
}

export function offerOf(content: Content, id: string): Offer | undefined {
  return content.den.stock.pool.find((offer) => offer.id === id);
}

/** Scrap for one lot of `offer`: the reference price times the markup, or the blueprint price. */
export function offerPrice(content: Content, offer: Offer): number {
  if (offer.good === "blueprint") return content.den.stock.blueprintPrice;
  const per100 = content.den.market.refPer100[offer.good] ?? 0;
  return Math.max(1, Math.ceil((offer.lot * per100 * content.den.stock.markupPercent) / 10_000));
}

/** Lots of `offer` this base may still buy today. */
export function lotsLeft(state: BaseState, offer: Offer): number {
  return Math.max(0, offer.lotsPerDay - (state.den.bought[offer.id] ?? 0));
}

export type DenBuyStatus =
  | { code: "ok"; price: number }
  | { code: "den_closed"; tier: Tier }
  | { code: "no_offer" }
  | { code: "sold_out"; resetAt: number }
  | { code: "all_known" }
  | { code: "no_room"; room: number }
  | { code: "unaffordable"; missing: { scrap: number } };

/** Whether `lots` of today's `offerId` can be bought now; `price` is what they cost. */
export function denBuyStatus(
  content: Content,
  state: BaseState,
  offerId: string,
  lots: number,
  now: number,
): DenBuyStatus {
  if (!denOpen(content, state)) return { code: "den_closed", tier: content.den.open.tier };
  const offer = offerOf(content, offerId);
  if (!offer || !state.den.offers.includes(offerId) || lots < 1) return { code: "no_offer" };
  if (lots > lotsLeft(state, offer)) return { code: "sold_out", resetAt: denResetAt(now) };
  if (offer.good === "blueprint") {
    if (unknownBlueprints(content, state).length === 0) return { code: "all_known" };
  } else if (!isItem(content, offer.good)) {
    const room = roomFor(content, state, offer.good);
    if (offer.lot * lots > room) return { code: "no_room", room };
  }
  const price = offerPrice(content, offer) * lots;
  const scrap = state.stock.scrap ?? 0;
  if (scrap < price) return { code: "unaffordable", missing: { scrap: price - scrap } };
  return { code: "ok", price };
}

export type DenBuyResult =
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; status: Exclude<DenBuyStatus, { code: "ok" }> };

/** Buys `lots` of a Den offer: scrap out, the goods (or a blueprint) in at once. */
export function denBuy(
  content: Content,
  state: BaseState,
  offerId: string,
  lots: number,
  now: number,
): DenBuyResult {
  const status = denBuyStatus(content, state, offerId, lots, now);
  if (status.code !== "ok") return { ok: false, status };
  const offer = offerOf(content, offerId) as Offer;
  let next: BaseState = {
    ...state,
    stock: { ...state.stock, scrap: (state.stock.scrap ?? 0) - status.price },
    den: {
      ...state.den,
      bought: { ...state.den.bought, [offerId]: (state.den.bought[offerId] ?? 0) + lots },
    },
  };
  const events: GameEvent[] = [];
  if (offer.good === "blueprint") {
    // Which one: seeded by the base and the day, so a replay draws the same.
    const recipe = drawBlueprint(
      content,
      next,
      rng(seedOf(state.seed, 0xb10e, state.den.day, state.den.bought[offerId] ?? 0)),
    );
    if (recipe) next = { ...next, blueprints: [...next.blueprints, recipe] };
    events.push({
      type: "den_bought",
      offer: offerId,
      good: offer.good,
      amount: lots,
      price: status.price,
    });
    if (recipe) events.push({ type: "blueprint_found", recipe, from: "den" });
  } else {
    const amount = offer.lot * lots;
    next = giveGood(content, next, offer.good, amount);
    events.push({
      type: "den_bought",
      offer: offerId,
      good: offer.good,
      amount,
      price: status.price,
    });
  }
  return { ok: true, state: next, events };
}
