import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { type BaseState, newBase } from "./base";
import { applyCommand } from "./commands";
import { held } from "./goods";
import {
  buyListing,
  cancelListing,
  listGoods,
  listingFee,
  type MarketListing,
  priceFloor,
  settleListings,
  takeListing,
} from "./market";
import { rng } from "./rng";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const HOUR = 3600;
const { listingHours, maxListings } = content.den.market;

const trader = (seed: number, extra: Partial<BaseState> = {}): BaseState => ({
  ...newBase(content, T0, seed),
  tier: "stone",
  stock: { timber: 4000, stone: 4000, rope: 300, gears: 20, scrap: 500 },
  items: { bow: 2, tin_keycode: 1 },
  ...extra,
});

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

/** The board's view of a seller's listing, as the server's index would show it. */
const onBoard = (seller: number, state: BaseState, local: string, id = 1): MarketListing => {
  const listing = state.listings.find((candidate) => candidate.id === local);
  if (!listing) throw new Error(`no listing ${local}`);
  return { ...listing, id, local, seller, sellerName: `P${seller}` };
};

describe("listing", () => {
  it("puts the goods in escrow and takes the fee", () => {
    const listed = ok(listGoods(content, trader(1), "rope", 100, 40, T0));
    expect(listed.state.stock.rope).toBe(200);
    expect(listed.state.stock.scrap).toBe(500 - listingFee(content, 40));
    expect(listed.state.listings).toEqual([
      {
        id: "l1",
        good: "rope",
        amount: 100,
        price: 40,
        listedAt: T0,
        expiresAt: T0 + listingHours * HOUR,
      },
    ]);
    // Items too: a keycode can change hands.
    const keycode = ok(listGoods(content, listed.state, "tin_keycode", 1, 80, T0));
    expect(keycode.state.items.tin_keycode).toBeUndefined();
  });

  it("refuses below the floor, above the cap, without the goods, and before the Den opens", () => {
    const floor = priceFloor(content, "rope", 100);
    expect(listGoods(content, trader(1), "rope", 100, floor - 1, T0)).toMatchObject({
      ok: false,
      status: { code: "price_floor", price: floor },
    });
    expect(listGoods(content, trader(1), "rope", 900, 900, T0)).toMatchObject({
      ok: false,
      status: { code: "unaffordable", missing: { rope: 600 } },
    });
    expect(listGoods(content, trader(1), "scrap", 10, 10, T0)).toMatchObject({
      ok: false,
      status: { code: "not_tradeable" },
    });
    expect(listGoods(content, trader(1, { tier: "wood" }), "rope", 10, 10, T0)).toMatchObject({
      ok: false,
      status: { code: "den_closed", tier: "stone" },
    });
    let state = trader(1);
    for (let index = 0; index < maxListings; index++)
      state = ok(listGoods(content, state, "timber", 100, 10, T0)).state;
    expect(listGoods(content, state, "timber", 100, 10, T0)).toMatchObject({
      ok: false,
      status: { code: "listing_cap", count: maxListings },
    });
  });

  it("cancelling brings the goods back but keeps the fee", () => {
    const listed = ok(listGoods(content, trader(1), "rope", 100, 40, T0)).state;
    const back = ok(cancelListing(content, listed, "l1")).state;
    expect(back.stock.rope).toBe(300);
    expect(back.stock.scrap).toBe(500 - listingFee(content, 40));
    expect(back.listings).toEqual([]);
  });

  it("expired listings come home whole when settling, and nobody can buy them", () => {
    const listed = ok(listGoods(content, trader(1), "rope", 100, 40, T0)).state;
    const later = T0 + listingHours * HOUR;
    expect(takeListing(listed, "l1", later)).toEqual({ ok: false });
    const settled = settleListings(content, listed, later);
    expect(settled.state.stock.rope).toBe(300);
    expect(settled.events).toEqual([
      { type: "listing_expired", listing: "l1", good: "rope", amount: 100, at: later },
    ]);
  });
});

describe("a sale", () => {
  it("moves the goods to the buyer and the price to the seller", () => {
    const seller = ok(listGoods(content, trader(1), "gears", 10, 60, T0)).state;
    const listing = onBoard(1, seller, "l1");
    const sold = ok(takeListing(seller, "l1", T0 + 60));
    const bought = ok(buyListing(content, trader(2), listing, 2, T0 + 60));
    expect(sold.state.stock.scrap).toBe(500 - listingFee(content, 60) + 60);
    expect(bought.state.stock.scrap).toBe(440);
    expect(bought.state.stock.gears).toBe(30);
  });

  it("refuses your own listing, an unaffordable one and goods with no room", () => {
    const seller = ok(listGoods(content, trader(1), "timber", 4000, 200, T0)).state;
    const listing = onBoard(1, seller, "l1");
    expect(buyListing(content, trader(1), listing, 1, T0)).toMatchObject({
      ok: false,
      status: { code: "own_listing" },
    });
    expect(buyListing(content, trader(2, { stock: { scrap: 50 } }), listing, 2, T0)).toMatchObject({
      ok: false,
      status: { code: "unaffordable", missing: { scrap: 150 } },
    });
    // Timber is capped by storage: a nearly full store has no room for 4000.
    const full = trader(2, { stock: { timber: 19_000, scrap: 500 } });
    expect(buyListing(content, full, listing, 2, T0)).toMatchObject({
      ok: false,
      status: { code: "no_room" },
    });
  });

  it("the buyer's command refuses without the server's listing (it cannot be predicted)", () => {
    const result = applyCommand(content, trader(2), { type: "market_buy", listing: 7 }, T0);
    expect(result).toMatchObject({ ok: false, refusal: { code: "server_only" } });
  });
});

describe("the market cannot create anything (invariant)", () => {
  const GOODS = ["timber", "rope", "gears", "bow", "tin_keycode"];
  /** Every good across the bases and their escrow, plus scrap. */
  function totals(bases: BaseState[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const state of bases) {
      for (const good of [...GOODS, "scrap"])
        out[good] = (out[good] ?? 0) + held(content, state, good);
      for (const listing of state.listings)
        out[listing.good] = (out[listing.good] ?? 0) + listing.amount;
    }
    return out;
  }

  it("holds over random lists, buys, cancels and expiries across three bases", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const random = rng(seed);
      let bases = [trader(1), trader(2), trader(3)];
      const start = totals(bases);
      let fees = 0;
      let now = T0;
      for (let step = 0; step < 200; step++) {
        now += random.int(0, 6) * HOUR;
        const who = random.int(0, 2);
        const roll = random.next();
        const state = settleListings(content, bases[who] as BaseState, now).state;
        bases[who] = state;
        if (roll < 0.45) {
          const good = GOODS[random.int(0, GOODS.length - 1)] as string;
          const have = held(content, state, good);
          if (have < 1) continue;
          const amount = random.int(1, have);
          const price = priceFloor(content, good, amount) + random.int(0, 50);
          const result = listGoods(content, state, good, amount, price, now);
          if (result.ok) {
            fees += listingFee(content, price);
            bases[who] = result.state;
          }
        } else if (roll < 0.85) {
          const from = (who + random.int(1, 2)) % 3;
          const seller = settleListings(content, bases[from] as BaseState, now).state;
          bases[from] = seller;
          const local = seller.listings[random.int(0, Math.max(0, seller.listings.length - 1))]?.id;
          if (!local) continue;
          const listing = onBoard(from, seller, local);
          // The API's order: the buyer must be able to pay before the seller gives anything up.
          const bought = buyListing(content, state, listing, who, now);
          if (!bought.ok) continue;
          const sold = ok(takeListing(seller, local, now));
          bases[from] = sold.state;
          bases[who] = bought.state;
        } else {
          const local = state.listings[0]?.id;
          if (local) bases[who] = ok(cancelListing(content, state, local)).state;
        }
      }
      bases = bases.map((state) => settleListings(content, state, now + listingHours * HOUR).state);
      const end = totals(bases);
      for (const good of GOODS) expect(end[good], `${good}, seed ${seed}`).toBe(start[good]);
      expect(end.scrap, `scrap, seed ${seed}`).toBe((start.scrap ?? 0) - fees);
    }
  });
});
