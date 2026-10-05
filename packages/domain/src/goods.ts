/**
 * Goods that change hands at the Den (W5): any resource but scrap, and any item.
 * One place knows where a good is kept (stock or inventory), whether storage caps
 * it, and what it is worth (`den.json5` `refPer100`).
 */
import type { Content } from "@wipe-day/content/schema";
import { type BaseState, storageCap } from "./base";

export function isItem(content: Content, good: string): boolean {
  return content.items.some((item) => item.id === good);
}

/** Whether the Den trades `good` (it has a reference price). */
export function isTradeable(content: Content, good: string): boolean {
  return content.den.market.refPer100[good] !== undefined;
}

/** Gathered and smelted resources are capped by storage; parts and items are not. */
export function isCapped(content: Content, good: string): boolean {
  const resource = content.resources.find((candidate) => candidate.id === good);
  return resource?.kind === "raw" || resource?.kind === "refined";
}

/** How many of `good` the base holds (stock or inventory). */
export function held(content: Content, state: BaseState, good: string): number {
  return isItem(content, good) ? (state.items[good] ?? 0) : (state.stock[good] ?? 0);
}

/** How many more of `good` fit: storage room for capped goods, no limit for the rest. */
export function roomFor(content: Content, state: BaseState, good: string): number {
  if (!isCapped(content, good)) return Number.POSITIVE_INFINITY;
  return Math.max(0, storageCap(content, state) - (state.stock[good] ?? 0));
}

/** Adds `amount` of `good` as it is, uncapped (goods that come home are never lost). */
export function giveGood(
  content: Content,
  state: BaseState,
  good: string,
  amount: number,
): BaseState {
  if (isItem(content, good))
    return { ...state, items: { ...state.items, [good]: (state.items[good] ?? 0) + amount } };
  return { ...state, stock: { ...state.stock, [good]: (state.stock[good] ?? 0) + amount } };
}

/** Takes `amount` of `good` out; the caller checked it is there. */
export function takeGood(
  content: Content,
  state: BaseState,
  good: string,
  amount: number,
): BaseState {
  if (isItem(content, good)) {
    const items = { ...state.items, [good]: (state.items[good] ?? 0) - amount };
    if (items[good] === 0) delete items[good];
    return { ...state, items };
  }
  return { ...state, stock: { ...state.stock, [good]: (state.stock[good] ?? 0) - amount } };
}

/** What `amount` of `good` is worth at reference prices, in whole scrap (rounded down). */
export function refValue(content: Content, good: string, amount: number): number {
  return Math.floor((amount * (content.den.market.refPer100[good] ?? 0)) / 100);
}

/** Adds scrap, uncapped: proceeds and winnings are never lost to a full store. */
export function giveScrap(state: BaseState, amount: number): BaseState {
  if (amount === 0) return state;
  return { ...state, stock: { ...state.stock, scrap: (state.stock.scrap ?? 0) + amount } };
}
