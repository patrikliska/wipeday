import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGame } from "@wipe-day/content/load";
import type { BaseState } from "@wipe-day/domain/base";
import { betRound, casinoLimit, roundEndsAt } from "@wipe-day/domain/casino";
import { manualClock } from "@wipe-day/domain/clock";
import { nextEventAt } from "@wipe-day/domain/settle";
import type { DenBoard, DenPush, RanksResponse } from "@wipe-day/domain/wire";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import type { Config } from "./config";
import { type CommandResponse, Game, type StateResponse } from "./game";
import { EventHub } from "./hub";
import { log } from "./log";
import { Notifier } from "./push";
import { openDb } from "./store/db";
import { bases, trades } from "./store/schema";

const { content, locale } = loadGame();
// Noon UTC: a test's few hours never cross the day's wager reset.
const T0 = 1_700_006_400 - (1_700_006_400 % 86_400) + 12 * 3600;
const HOUR = 3600;

const config: Config = {
  production: false,
  port: 0,
  publicUrl: "http://localhost:5173",
  discord: null,
  databasePath: ":memory:",
  backupDir: "",
  webDist: join(tmpdir(), "wipe-day-no-web-build"),
  devLogin: true,
  adminToken: null,
};

function setup() {
  const db = openDb(":memory:");
  const hub = new EventHub();
  const clock = manualClock(T0);
  const notifier = new Notifier(db, locale, log, "mailto:test@localhost.invalid", async () => ({
    statusCode: 201,
  }));
  let roll = 0;
  const game = new Game({ db, content, clock, hub, newSeed: () => 7, rollSeed: () => ++roll });
  const app = createApp({ db, game, hub, clock, config, discord: null, notifier });
  const den: DenPush[] = [];
  hub.subscribeDen((message) => den.push(message));

  const login = async (slot: number): Promise<string> => {
    const response = await app.request("/api/dev/login", {
      method: "POST",
      body: JSON.stringify({ slot }),
      headers: { "content-type": "application/json" },
    });
    const cookie = response.headers.getSetCookie()[0]?.split(";")[0] ?? "";
    // The base exists from the first look; then it gets a Stone holdfast with goods to trade.
    await app.request("/api/state", { headers: { cookie } });
    patch(slot, (state) => ({
      ...state,
      tier: "stone",
      upkeepPaidUntil: T0,
      stock: { timber: 20_000, stone: 20_000, rope: 500, scrap: 1000 },
    }));
    return cookie;
  };
  const get = async <T>(cookie: string, path: string): Promise<T> =>
    (await (await app.request(path, { headers: { cookie } })).json()) as T;
  const state = (cookie: string) => get<StateResponse>(cookie, "/api/state");
  const send = async (cookie: string, key: string, command: unknown): Promise<CommandResponse> => {
    const response = await app.request("/api/commands", {
      method: "POST",
      body: JSON.stringify({ key, command }),
      headers: { cookie, "content-type": "application/json" },
    });
    expect(response.status).toBe(200);
    return (await response.json()) as CommandResponse;
  };
  const stored = (playerId: number): BaseState => {
    const row = db.select().from(bases).where(eq(bases.playerId, playerId)).get();
    if (!row) throw new Error("no base");
    return JSON.parse(row.stateJson) as BaseState;
  };
  function patch(playerId: number, change: (state: BaseState) => BaseState) {
    const next = change(stored(playerId));
    db.update(bases)
      .set({ stateJson: JSON.stringify(next), nextEventAt: nextEventAt(content, next) })
      .where(eq(bases.playerId, playerId))
      .run();
  }
  return { db, game, clock, den, login, get, state, send, stored };
}

const limit = casinoLimit(content, { tier: "stone" });
if (!limit) throw new Error("no Stone limits");

describe("the daily wager cap under concurrent clicks (roadmap W5)", () => {
  it("50 parallel spins with different keys never pass the cap, and scrap adds up", async () => {
    const { login, send, stored } = setup();
    const cookie = await login(1);
    const responses = await Promise.all(
      Array.from({ length: 50 }, (_, index) =>
        send(cookie, `spin-${index}-xxxx`, { type: "slots_spin", amount: limit.maxBet }),
      ),
    );
    const ok = responses.filter((response) => response.ok);
    expect(ok).toHaveLength(limit.dailyWager / limit.maxBet);
    for (const response of responses.filter((r) => !r.ok))
      expect(response).toMatchObject({ refusal: { code: "wager_cap", left: 0 } });
    const paid = ok
      .flatMap((response) => response.events)
      .reduce((sum, event) => sum + (event.type === "wager" ? event.payout : 0), 0);
    const base = stored(1);
    expect(base.casino.wagered).toBe(limit.dailyWager);
    expect(base.stock.scrap).toBe(1000 - limit.dailyWager + paid);
  });

  it("the same key twice is one spin", async () => {
    const { login, send, stored } = setup();
    const cookie = await login(1);
    const first = await send(cookie, "same-key-123", {
      type: "dice_roll",
      option: "over",
      amount: 10,
    });
    const again = await send(cookie, "same-key-123", {
      type: "dice_roll",
      option: "over",
      amount: 10,
    });
    expect(again).toEqual(first);
    expect(stored(1).casino.wagered).toBe(10);
  });

  it("the jackpot pool grows with every spin", async () => {
    const { login, send, game } = setup();
    const cookie = await login(1);
    await send(cookie, "pool-spin-1", { type: "slots_spin", amount: 10 });
    expect(game.den.jackpot()).toBe(10 * content.den.casino.slots.jackpot.feedPercent);
  });
});

describe("the market across two bases", () => {
  async function listed() {
    const harness = setup();
    const seller = await harness.login(1);
    const listing = await harness.send(seller, "list-rope-1", {
      type: "market_list",
      good: "rope",
      amount: 100,
      price: 40,
    });
    expect(listing.ok).toBe(true);
    const board = await harness.get<DenBoard>(seller, "/api/den");
    const id = board.listings[0]?.id;
    if (!id) throw new Error("not on the board");
    return { ...harness, seller, id };
  }

  it("a sale moves the goods and the price, and two buyers racing get one listing", async () => {
    const { login, send, stored, id, db, get, seller } = await listed();
    const [b2, b3] = [await login(2), await login(3)];
    const [r2, r3] = await Promise.all([
      send(b2, "buy-by-two-1", { type: "market_buy", listing: id }),
      send(b3, "buy-by-three", { type: "market_buy", listing: id }),
    ]);
    const winner = r2.ok ? 2 : 3;
    expect([r2.ok, r3.ok].filter(Boolean)).toHaveLength(1);
    expect(r2.ok ? r3 : r2).toMatchObject({ ok: false, refusal: { code: "listing_gone" } });
    expect(stored(winner).stock.rope).toBe(600);
    expect(stored(winner).stock.scrap).toBe(960);
    // The seller: 400 rope left, the price in, the fee gone.
    expect(stored(1).stock.rope).toBe(400);
    expect(stored(1).stock.scrap).toBe(1000 - 2 + 40);
    expect(stored(1).listings).toEqual([]);
    expect(db.select().from(trades).all()).toHaveLength(1);
    expect((await get<DenBoard>(seller, "/api/den")).listings).toEqual([]);
  });

  it("a replayed buy returns the stored answer and changes nothing", async () => {
    const { login, send, stored, id } = await listed();
    const buyer = await login(2);
    const first = await send(buyer, "buy-once-123", { type: "market_buy", listing: id });
    const again = await send(buyer, "buy-once-123", { type: "market_buy", listing: id });
    expect(again).toEqual(first);
    expect(stored(2).stock.rope).toBe(600);
    expect(stored(1).stock.scrap).toBe(1038);
  });

  it("nobody buys their own listing; an expired one is gone and back home", async () => {
    const { login, send, stored, id, seller, clock } = await listed();
    expect(await send(seller, "buy-mine-123", { type: "market_buy", listing: id })).toMatchObject({
      ok: false,
      refusal: { code: "own_listing" },
    });
    const buyer = await login(2);
    clock.set(T0 + content.den.market.listingHours * HOUR);
    expect(await send(buyer, "buy-late-123", { type: "market_buy", listing: id })).toMatchObject({
      ok: false,
      refusal: { code: "listing_gone" },
    });
    expect(stored(1).stock.rope).toBe(500);
    expect(stored(2).stock.rope).toBe(500);
  });
});

describe("the wheel's shared rounds", () => {
  it("one spin pays every bettor from the same result when the round ends", async () => {
    const { login, send, stored, game, clock, den } = setup();
    const [p1, p2] = [await login(1), await login(2)];
    const round = betRound(content, T0);
    expect(
      (await send(p1, "wheel-one-12", { type: "wheel_bet", segment: "gull", amount: 10 })).ok,
    ).toBe(true);
    expect(
      (await send(p2, "wheel-two-12", { type: "wheel_bet", segment: "crab", amount: 10 })).ok,
    ).toBe(true);
    expect(den.filter((message) => message.kind === "bet")).toHaveLength(2);
    expect(stored(1).wheelBets).toHaveLength(1);

    clock.set(roundEndsAt(content, round));
    game.settleRound(round);
    const result = game.den.result(round);
    const segment = content.den.casino.wheel.segments[result];
    for (const [playerId, bet] of [
      [1, "gull"],
      [2, "crab"],
    ] as const) {
      const base = stored(playerId);
      expect(base.wheelBets).toEqual([]);
      const pays = segment?.id === bet ? (10 * segment.pays) / 100 : 0;
      expect(base.stock.scrap).toBe(990 + pays);
    }
    expect(den).toContainEqual({ kind: "result", round, segment: result });
  });

  it("the minute tick spins a round nobody scheduled (a restart mid-round)", async () => {
    const { login, send, stored, game, clock } = setup();
    const cookie = await login(1);
    const round = betRound(content, T0);
    await send(cookie, "wheel-tick-1", { type: "wheel_bet", segment: "gull", amount: 10 });
    clock.set(roundEndsAt(content, round) + 30);
    expect(game.tick()).toContain(1);
    expect(stored(1).wheelBets).toEqual([]);
  });
});

describe("the ranks", () => {
  it("lists every player of the season with the asker's card", async () => {
    const { login, get } = setup();
    const p1 = await login(1);
    await login(2);
    const ranks = await get<RanksResponse>(p1, "/api/ranks");
    expect(ranks.boards.wealth).toHaveLength(2);
    expect(ranks.me.players).toBe(2);
    expect(ranks.me.tier).toBe("stone");
  });
});
