import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { utcDay } from "./active";
import { denWorthIt } from "./advisor";
import { type BaseState, newBase } from "./base";
import { betRound, casinoLimit, roundEndsAt, spinSlots, wagerLeft, wheelResult } from "./casino";
import { applyCommand, type Command } from "./commands";
import { contractOf, rollContracts, termsOf } from "./contracts";
import { denBuy, offerOf, offerPrice, rollStock } from "./den";
import type { GameEvent } from "./events";
import { leaderboards, seasonSummary, wealthOf } from "./leaderboard";
import { nextEventAt, settleAll } from "./settle";
import { recordStats } from "./stats";
import type { World } from "./world";

const content = loadContent(contentPaths.data, loadLocale());
// Noon UTC, so a few hours of play never cross midnight.
const T0 = 1_700_006_400 - (1_700_006_400 % 86_400) + 12 * 3600;
const HOUR = 3600;
const { casino } = content.den;

const stoneBase = (extra: Partial<BaseState> = {}): BaseState =>
  settleAll(
    content,
    {
      ...newBase(content, T0, 7),
      tier: "stone",
      upkeepPaidUntil: T0,
      stock: {
        timber: 9000,
        stone: 9000,
        ingots: 2000,
        fibre: 2000,
        food: 2000,
        rope: 500,
        scrap: 1000,
      },
      ...extra,
    },
    T0,
  ).state;

function run(state: BaseState, command: Command, now = T0, world?: World) {
  const result = applyCommand(content, state, command, now, world);
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.refusal)}`);
  return result;
}

describe("the Den's counter", () => {
  it("opens at the Den's tier with the same offers for everyone at that tier", () => {
    expect(settleAll(content, newBase(content, T0, 1), T0).state.den.offers).toEqual([]);
    const a = stoneBase();
    const b = settleAll(content, { ...newBase(content, T0, 99), tier: "stone" }, T0).state;
    expect(a.den.offers).toHaveLength(content.den.stock.perDay);
    expect(a.den.offers).toEqual(b.den.offers);
    expect(a.den.offers).toEqual(rollStock(content, utcDay(T0), "stone"));
    // Metal-only offers never show at Stone.
    for (const id of a.den.offers) expect(offerOf(content, id)?.minTier).toBe("stone");
  });

  it("sells lots at a markup up to the daily limit, then restocks the next day", () => {
    const state = stoneBase({
      den: { day: utcDay(T0), tier: "stone", offers: ["rope_lot"], bought: {} },
    });
    const offer = offerOf(content, "rope_lot");
    if (!offer) throw new Error("rope_lot");
    const price = offerPrice(content, offer);
    expect(price).toBe(Math.ceil((offer.lot * 25 * 250) / 10_000));
    const bought = run(state, { type: "den_buy", offer: "rope_lot", lots: offer.lotsPerDay });
    expect(bought.state.stock.rope).toBe(500 + offer.lot * offer.lotsPerDay);
    expect(bought.state.stock.scrap).toBe(1000 - price * offer.lotsPerDay);
    expect(denBuy(content, bought.state, "rope_lot", 1, T0)).toMatchObject({
      ok: false,
      status: { code: "sold_out" },
    });
    const tomorrow = settleAll(content, bought.state, T0 + 24 * HOUR).state;
    expect(tomorrow.den.bought).toEqual({});
  });

  it("sells a blueprint the base does not know", () => {
    const state = stoneBase({
      den: { day: utcDay(T0), tier: "stone", offers: ["blueprint_lot"], bought: {} },
    });
    const bought = run(state, { type: "den_buy", offer: "blueprint_lot", lots: 1 });
    expect(bought.state.blueprints).toHaveLength(1);
    expect(bought.events.some((event) => event.type === "blueprint_found")).toBe(true);
  });
});

describe("contracts", () => {
  it("roll for the tier and pay scrap below what the Den sells the goods for", () => {
    const state = stoneBase();
    expect(state.contracts.ids).toEqual(rollContracts(content, utcDay(T0), "stone"));
    for (const id of state.contracts.ids) {
      const contract = contractOf(content, id);
      if (!contract) throw new Error(id);
      const terms = termsOf(content, contract, "stone");
      expect(terms.pay).toBeLessThan(
        (terms.amount *
          (content.den.market.refPer100[terms.good] ?? 0) *
          content.den.stock.markupPercent) /
          10_000,
      );
    }
  });

  it("deliver hands the goods over once, and the advisor points at a deliverable one", () => {
    const state = stoneBase({
      contracts: { day: utcDay(T0), tier: "stone", ids: ["net_fibre"], done: [] },
    });
    expect(denWorthIt(content, state)).toBe(true);
    const done = run(state, { type: "deliver", contract: "net_fibre" });
    const contract = contractOf(content, "net_fibre");
    if (!contract) throw new Error("net_fibre");
    const terms = termsOf(content, contract, "stone");
    expect(done.state.stock.fibre).toBe(2000 - terms.amount);
    expect(done.state.stock.scrap).toBe(1000 + terms.pay);
    expect(done.state.stats.contracts).toBe(1);
    const again = applyCommand(content, done.state, { type: "deliver", contract: "net_fibre" }, T0);
    expect(again).toMatchObject({ ok: false, refusal: { code: "no_contract" } });
    expect(denWorthIt(content, done.state)).toBe(false);
  });
});

describe("the casino", () => {
  const limit = casinoLimit(content, { tier: "stone" });
  if (!limit) throw new Error("no stone limits");

  it("needs the server's seed for slots and dice (no prediction)", () => {
    const result = applyCommand(content, stoneBase(), { type: "slots_spin", amount: 5 }, T0);
    expect(result).toMatchObject({ ok: false, refusal: { code: "server_only" } });
  });

  it("holds the chips, the biggest bet and the daily cap", () => {
    const state = stoneBase();
    const world = { seed: 1 };
    expect(
      applyCommand(content, state, { type: "dice_roll", option: "over", amount: 7 }, T0, world),
    ).toMatchObject({ ok: false, refusal: { code: "bad_bet", step: casino.betStep } });
    expect(
      applyCommand(
        content,
        state,
        { type: "dice_roll", option: "over", amount: limit.maxBet + casino.betStep },
        T0,
        world,
      ),
    ).toMatchObject({
      ok: false,
      refusal: { code: "max_bet", amount: limit.maxBet, tier: "stone" },
    });
    let s = state;
    let wagered = 0;
    for (let seed = 1; wagered < limit.dailyWager; seed++) {
      s = run(s, { type: "dice_roll", option: "under", amount: limit.maxBet }, T0, { seed }).state;
      wagered += limit.maxBet;
    }
    expect(wagerLeft(content, s, T0)).toBe(0);
    expect(
      applyCommand(content, s, { type: "slots_spin", amount: 5 }, T0, { seed: 9 }),
    ).toMatchObject({
      ok: false,
      refusal: { code: "wager_cap", left: 0 },
    });
    // A new UTC day, a fresh cap.
    expect(wagerLeft(content, s, T0 + 24 * HOUR)).toBe(limit.dailyWager);
  });

  it("pays the dice by the table", () => {
    // Find seeds for a win and a loss on "seven", so the test does not depend on luck.
    const outcomes = Array.from({ length: 200 }, (_, seed) =>
      run(stoneBase(), { type: "dice_roll", option: "seven", amount: 10 }, T0, { seed }),
    );
    const win = outcomes.find((result) => result.state.stock.scrap === 1000 - 10 + 56);
    const loss = outcomes.find((result) => result.state.stock.scrap === 990);
    expect(win).toBeDefined();
    expect(loss).toBeDefined();
    const event = win?.events.find((e) => e.type === "wager");
    expect(event).toMatchObject({ game: "dice", option: "seven", bet: 10, payout: 56 });
  });

  it("a slots jackpot wins the pool and makes the feed", () => {
    let seed = 0;
    while (!spinSlots(content, seed).jackpot) seed++;
    const result = run(stoneBase(), { type: "slots_spin", amount: 5 }, T0, {
      seed,
      jackpot: 123_456,
    });
    const pool = Math.floor((123_456 + 5 * casino.slots.jackpot.feedPercent) / 100);
    const won = (5 * casino.slots.jackpot.pays) / 100 + pool;
    expect(result.state.stock.scrap).toBe(1000 - 5 + won);
    expect(result.events).toContainEqual({ type: "jackpot_won", amount: won, at: T0 });
    expect(result.events.some((event) => event.type === "big_win")).toBe(true);
  });

  it("wheel bets wait for their round, then pay everyone from the same spin", () => {
    const placed = run(stoneBase(), { type: "wheel_bet", segment: "gull", amount: 10 });
    const round = betRound(content, T0);
    expect(placed.state.wheelBets).toEqual([{ round, segment: "gull", amount: 10 }]);
    expect(placed.state.stock.scrap).toBe(990);
    const spinAt = roundEndsAt(content, round);
    expect(nextEventAt(content, placed.state)).toBe(spinAt);
    // Without the server's reveal (the client) the bet stays pending.
    expect(settleAll(content, placed.state, spinAt + 5).state.wheelBets).toHaveLength(1);
    const gull = casino.wheel.segments.findIndex((segment) => segment.id === "gull");
    const won = settleAll(content, placed.state, spinAt, { reveal: () => gull });
    expect(won.state.wheelBets).toEqual([]);
    expect(won.state.stock.scrap).toBe(990 + 22);
    const lost = settleAll(content, placed.state, spinAt, { reveal: () => gull + 1 });
    expect(lost.state.stock.scrap).toBe(990);
    expect(lost.events.find((event) => event.type === "wager")).toMatchObject({
      game: "wheel",
      payout: 0,
      round,
    });
  });

  it("a bet after betting closes rides on the next round", () => {
    const round = Math.floor(T0 / casino.wheel.roundSeconds);
    const late = roundEndsAt(content, round) - 1;
    expect(betRound(content, late)).toBe(round + 1);
    expect(wheelResult(content, 5)).toBe(wheelResult(content, 5));
  });
});

describe("stats and the leaderboards", () => {
  it("rank by category, ties sharing a rank", () => {
    const rich = stoneBase();
    const explored = { ...rich, stats: { ...rich.stats, sites: ["quarry", "cannery"] } };
    const boards = leaderboards(
      content,
      [
        { playerId: 1, name: "A", state: rich },
        { playerId: 2, name: "B", state: explored },
        { playerId: 3, name: "C", state: newBase(content, T0, 3) },
      ],
      T0,
    );
    expect(boards.explorer.map((row) => row.playerId)).toEqual([2, 1, 3]);
    // A tie shares the rank.
    expect(boards.explorer[1]?.rank).toBe(2);
    expect(boards.explorer[2]?.rank).toBe(2);
    expect(boards.wealth[0]?.value).toBe(wealthOf(content, rich));
    const card = seasonSummary(content, explored, boards, 2, T0 - 3 * 86_400);
    expect(card.ranks.explorer).toBe(1);
    expect(card.players).toBe(3);
  });

  it("record a cleared site once, the best haul, trades and wins", () => {
    const back = (outcome: "success" | "partial" | "fail", stone: number): GameEvent => ({
      type: "mission_back",
      mission: "m1",
      kind: "trip",
      target: "quarry",
      outcome,
      crew: ["mara"],
      gained: { stone },
      at: T0,
    });
    const state = recordStats(
      stoneBase(),
      [
        back("partial", 300),
        back("success", 500),
        back("fail", 900),
        { type: "sold", listing: "l1", good: "rope", amount: 10, price: 30, at: T0 },
        {
          type: "wager",
          game: "dice",
          option: "seven",
          bet: 10,
          payout: 56,
          result: [3, 4],
          feed: 0,
          at: T0,
        },
      ],
      T0,
    );
    expect(state.stats).toMatchObject({
      sites: ["quarry"],
      bestHaul: 500,
      traded: 30,
      wagered: 10,
      won: 56,
      biggestWin: 56,
    });
    // Nothing to count: the very same state comes back.
    expect(recordStats(state, [{ type: "collected", gained: {} }], T0)).toBe(state);
  });
});
