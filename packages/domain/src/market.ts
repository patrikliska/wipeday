/**
 * Player listings at the Den (W5). A listing is escrow inside the seller's own
 * base: the goods leave the stock when listed (with a fee the Den keeps) and
 * either go to a buyer, come back on cancel, or come home whole when the listing
 * expires. The server keeps an index of open listings for everyone else to see;
 * a purchase is one transaction over both bases (`takeListing` on the seller,
 * `buyListing` on the buyer), so goods are never created or lost, only scrap
 * leaves through fees (the invariant in `market.test.ts`).
 */
import type { Content } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import type { BaseState } from "./base";
import { denOpen } from "./den";
import type { GameEvent } from "./events";
import { giveGood, giveScrap, held, isTradeable, roomFor, takeGood } from "./goods";

const HOUR = 3600;

/** A listing as the seller's base keeps it. */
export interface Listing {
  /** Local to the seller's base (`l1`, `l2` ...); the server's index maps it to a row. */
  id: string;
  good: string;
  amount: number;
  /** Scrap for the whole lot. */
  price: number;
  listedAt: number;
  expiresAt: number;
}

/** A listing as everyone sees it on the board (the server's row). */
export interface MarketListing {
  /** The server's row id: what a buyer names. */
  id: number;
  seller: number;
  sellerName: string;
  /** The seller's local id. */
  local: string;
  good: string;
  amount: number;
  price: number;
  listedAt: number;
  expiresAt: number;
}

/** What the Den keeps for posting a listing priced at `price`. */
export function listingFee(content: Content, price: number): number {
  const { feePercent, minFee } = content.den.market;
  return Math.max(minFee, Math.ceil((price * feePercent) / 100));
}

/** The lowest price the Den posts `amount` of `good` at (no gifting). */
export function priceFloor(content: Content, good: string, amount: number): number {
  const per100 = content.den.market.refPer100[good] ?? 0;
  return Math.max(1, Math.ceil((amount * per100 * content.den.market.floorPercent) / 10_000));
}

/** The Den's going rate for `amount` of `good` (what the sell form suggests). */
export function refPrice(content: Content, good: string, amount: number): number {
  return Math.max(1, Math.round((amount * (content.den.market.refPer100[good] ?? 0)) / 100));
}

/** Scrap per 100 units, for comparing listings of different sizes. */
export function per100(price: number, amount: number): number {
  return amount > 0 ? (price * 100) / amount : 0;
}

export type ListStatus =
  | { code: "ok"; fee: number }
  | { code: "den_closed"; tier: Tier }
  | { code: "not_tradeable" }
  | { code: "listing_cap"; count: number }
  | { code: "price_floor"; price: number }
  | { code: "unaffordable"; missing: Record<string, number> };

/** Whether `amount` of `good` can go up for `price` scrap now, and the fee it costs. */
export function listStatus(
  content: Content,
  state: BaseState,
  good: string,
  amount: number,
  price: number,
): ListStatus {
  if (!denOpen(content, state)) return { code: "den_closed", tier: content.den.open.tier };
  if (!isTradeable(content, good) || amount < 1 || price < 1) return { code: "not_tradeable" };
  const { maxListings } = content.den.market;
  if (state.listings.length >= maxListings) return { code: "listing_cap", count: maxListings };
  const floor = priceFloor(content, good, amount);
  if (price < floor) return { code: "price_floor", price: floor };
  const fee = listingFee(content, price);
  const missing: Record<string, number> = {};
  const have = held(content, state, good);
  if (have < amount) missing[good] = amount - have;
  // Listing scrap for scrap is not a thing (scrap is not tradeable), so the fee never overlaps.
  const scrap = state.stock.scrap ?? 0;
  if (scrap < fee) missing.scrap = fee - scrap;
  if (Object.keys(missing).length > 0) return { code: "unaffordable", missing };
  return { code: "ok", fee };
}

export type MarketResult =
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; status: Exclude<ListStatus, { code: "ok" }> };

/** Puts goods up: they leave the base (escrow) and the fee is paid. */
export function listGoods(
  content: Content,
  state: BaseState,
  good: string,
  amount: number,
  price: number,
  now: number,
): MarketResult {
  const status = listStatus(content, state, good, amount, price);
  if (status.code !== "ok") return { ok: false, status };
  const seq = state.listingSeq + 1;
  const listing: Listing = {
    id: `l${seq}`,
    good,
    amount,
    price,
    listedAt: now,
    expiresAt: now + content.den.market.listingHours * HOUR,
  };
  const without = takeGood(content, state, good, amount);
  return {
    ok: true,
    state: {
      ...without,
      stock: { ...without.stock, scrap: (without.stock.scrap ?? 0) - status.fee },
      listings: [...without.listings, listing],
      listingSeq: seq,
    },
    events: [{ type: "listed", listing, fee: status.fee }],
  };
}

/** Takes a listing down: the goods come back whole, the fee does not. */
export function cancelListing(
  content: Content,
  state: BaseState,
  id: string,
): { ok: true; state: BaseState; events: GameEvent[] } | { ok: false } {
  const listing = state.listings.find((candidate) => candidate.id === id);
  if (!listing) return { ok: false };
  const back = giveGood(content, state, listing.good, listing.amount);
  return {
    ok: true,
    state: { ...back, listings: back.listings.filter((candidate) => candidate.id !== id) },
    events: [
      { type: "listing_cancelled", listing: id, good: listing.good, amount: listing.amount },
    ],
  };
}

/** Listings past their time go home whole. Part of settling. */
export function settleListings(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const expired = state.listings.filter((listing) => listing.expiresAt <= now);
  if (expired.length === 0) return { state, events: [] };
  let next: BaseState = {
    ...state,
    listings: state.listings.filter((listing) => listing.expiresAt > now),
  };
  const events: GameEvent[] = [];
  for (const listing of expired) {
    next = giveGood(content, next, listing.good, listing.amount);
    events.push({
      type: "listing_expired",
      listing: listing.id,
      good: listing.good,
      amount: listing.amount,
      at: listing.expiresAt,
    });
  }
  return { state: next, events };
}

/** When the next listing runs out, for the server's timer. */
export function nextListingAt(state: BaseState): number | null {
  return state.listings.length > 0
    ? Math.min(...state.listings.map((listing) => listing.expiresAt))
    : null;
}

/**
 * The seller's side of a sale: the listing leaves the base and its price comes in
 * (uncapped). The caller settled the seller first, so an expired listing is already
 * home and the sale is refused.
 */
export function takeListing(
  state: BaseState,
  local: string,
  now: number,
): { ok: true; state: BaseState; events: GameEvent[]; listing: Listing } | { ok: false } {
  const listing = state.listings.find((candidate) => candidate.id === local);
  if (!listing || listing.expiresAt <= now) return { ok: false };
  const paid = giveScrap(state, listing.price);
  return {
    ok: true,
    listing,
    state: { ...paid, listings: paid.listings.filter((candidate) => candidate.id !== local) },
    events: [
      {
        type: "sold",
        listing: local,
        good: listing.good,
        amount: listing.amount,
        price: listing.price,
        at: now,
      },
    ],
  };
}

export type BuyStatus =
  | { code: "ok" }
  | { code: "den_closed"; tier: Tier }
  | { code: "listing_gone" }
  | { code: "own_listing" }
  | { code: "no_room"; room: number }
  | { code: "unaffordable"; missing: { scrap: number } };

/** Whether the buyer can take `listing` now. `self`: the buyer's player id. */
export function buyStatus(
  content: Content,
  state: BaseState,
  listing: MarketListing,
  self: number | undefined,
  now: number,
): BuyStatus {
  if (!denOpen(content, state)) return { code: "den_closed", tier: content.den.open.tier };
  if (listing.expiresAt <= now) return { code: "listing_gone" };
  if (self !== undefined && listing.seller === self) return { code: "own_listing" };
  const room = roomFor(content, state, listing.good);
  if (listing.amount > room) return { code: "no_room", room };
  const scrap = state.stock.scrap ?? 0;
  if (scrap < listing.price)
    return { code: "unaffordable", missing: { scrap: listing.price - scrap } };
  return { code: "ok" };
}

/** The buyer's side: the price goes out, the goods come in. */
export function buyListing(
  content: Content,
  state: BaseState,
  listing: MarketListing,
  self: number | undefined,
  now: number,
):
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; status: Exclude<BuyStatus, { code: "ok" }> } {
  const status = buyStatus(content, state, listing, self, now);
  if (status.code !== "ok") return { ok: false, status };
  const paid: BaseState = {
    ...state,
    stock: { ...state.stock, scrap: (state.stock.scrap ?? 0) - listing.price },
  };
  return {
    ok: true,
    state: giveGood(content, paid, listing.good, listing.amount),
    events: [
      {
        type: "bought",
        listing: listing.id,
        good: listing.good,
        amount: listing.amount,
        price: listing.price,
        seller: listing.seller,
        sellerName: listing.sellerName,
      },
    ],
  };
}
