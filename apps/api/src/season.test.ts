import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGame } from "@wipe-day/content/load";
import { type BaseState, newBase } from "@wipe-day/domain/base";
import { manualClock } from "@wipe-day/domain/clock";
import { carryFor, type Legacy } from "@wipe-day/domain/legacy";
import { nextEventAt, settleAll } from "@wipe-day/domain/settle";
import type { LegacyResponse, SignalResponse, StateResponse } from "@wipe-day/domain/wire";
import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import type { Config } from "./config";
import { type CommandResponse, Game } from "./game";
import { EventHub } from "./hub";
import { legacyOf, saveLegacy } from "./legacyStore";
import { log } from "./log";
import { Notifier } from "./push";
import { openDb } from "./store/db";
import { bases, hallOfFame, listings, seasonArchive, seasons } from "./store/schema";

const { content, locale } = loadGame();
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
  botToken: null,
};

function setup(overrides: Partial<Config> = {}) {
  const db = openDb(":memory:");
  const hub = new EventHub();
  const clock = manualClock(T0);
  const notifier = new Notifier(db, locale, log, "mailto:test@localhost.invalid", async () => ({
    statusCode: 201,
  }));
  const backups: string[] = [];
  const game = new Game({
    db,
    content,
    clock,
    hub,
    newSeed: () => 7,
    rollSeed: () => 1,
    backup: async (name) => backups.push(name),
  });
  const app = createApp({
    db,
    game,
    hub,
    clock,
    config: { ...config, ...overrides },
    discord: null,
    notifier,
  });
  const stored = (playerId: number, seasonId = 1): BaseState => {
    const row = db
      .select()
      .from(bases)
      .where(and(eq(bases.playerId, playerId), eq(bases.seasonId, seasonId)))
      .get();
    if (!row) throw new Error("no base");
    return JSON.parse(row.stateJson) as BaseState;
  };
  const patch = (playerId: number, change: (state: BaseState) => BaseState) => {
    const next = change(stored(playerId));
    db.update(bases)
      .set({ stateJson: JSON.stringify(next), nextEventAt: nextEventAt(content, next) })
      .where(and(eq(bases.playerId, playerId), eq(bases.seasonId, 1)))
      .run();
  };
  const login = async (slot: number): Promise<string> => {
    const response = await app.request("/api/dev/login", {
      method: "POST",
      body: JSON.stringify({ slot }),
      headers: { "content-type": "application/json" },
    });
    const cookie = response.headers.getSetCookie()[0]?.split(";")[0] ?? "";
    await app.request("/api/state", { headers: { cookie } });
    return cookie;
  };
  const get = async <T>(cookie: string, path: string): Promise<T> =>
    (await (await app.request(path, { headers: { cookie } })).json()) as T;
  const send = async (cookie: string, key: string, command: unknown): Promise<CommandResponse> => {
    const response = await app.request("/api/commands", {
      method: "POST",
      body: JSON.stringify({ key, command }),
      headers: { cookie, "content-type": "application/json" },
    });
    return (await response.json()) as CommandResponse;
  };
  const admin = async (path: string, body: unknown, token?: string) =>
    app.request(`/api/admin${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
  return { db, game, clock, backups, stored, patch, login, get, send, admin };
}

/** A season's worth: a Stone base with blueprints, a levelled crew, raids held, goods. */
const veteranBase = (state: BaseState, levels: [string, number, number][]): BaseState => ({
  ...state,
  tier: "stone",
  upkeepPaidUntil: T0 + 30 * 24 * HOUR,
  stock: { timber: 30_000, stone: 30_000, planks: 2000, scrap: 900 },
  blueprints: ["strongbox", "crossbow"],
  crew: state.crew.map((member) => {
    const level = levels.find(([id]) => id === member.id);
    return level ? { ...member, level: level[1], xp: level[2] } : member;
  }),
  stats: { ...state.stats, defended: 11 },
});

describe("the season reset", () => {
  it("keeps exactly the persistent layer (snapshot over a seeded database)", async () => {
    const { db, game, clock, backups, stored, patch, login, get, send, admin } = setup();
    const [p1, p2] = [await login(1), await login(2), await login(3)];
    patch(1, (state) =>
      veteranBase(state, [
        ["mara", 4, 500],
        ["dax", 2, 120],
      ]),
    );
    patch(2, (state) => ({ ...veteranBase(state, [["ivo", 3, 300]]), blueprints: ["feast"] }));
    // An open listing and an announced end: the Signal takes gifts.
    db.insert(listings)
      .values({
        seasonId: 1,
        sellerId: 3,
        localId: "l1",
        good: "rope",
        amount: 10,
        price: 30,
        listedAt: T0,
        expiresAt: T0 + 48 * HOUR,
        status: "open",
      })
      .run();
    expect(
      (await admin("/season/announce", { endsAt: T0 + 7 * 24 * HOUR, next: "storm_season" }))
        .status,
    ).toBe(200);
    expect(
      (await send(p1, "gift-planks-1", { type: "signal_give", good: "planks", amount: 900 })).ok,
    ).toBe(true);
    expect(
      (await send(p2, "gift-stone-02", { type: "signal_give", good: "stone", amount: 5000 })).ok,
    ).toBe(true);

    clock.set(T0 + 2 * HOUR);
    const ended = await game.endSeason();
    expect(ended).toEqual({ ended: 1, started: 2, players: 3 });
    expect(backups).toEqual(["wipeday-pre-season-1.db"]);

    // The season rows.
    const all = db.select().from(seasons).all();
    expect(all.map((row) => [row.id, row.endedAt, row.modifier])).toEqual([
      [1, T0 + 2 * HOUR, null],
      [2, null, "storm_season"],
    ]);
    // Archived bases stop ticking; the open listing closed.
    expect(
      db
        .select()
        .from(bases)
        .where(eq(bases.seasonId, 1))
        .all()
        .every((row) => row.nextEventAt === null),
    ).toBe(true);
    expect(db.select().from(listings).get()?.status).toBe("closed");
    expect(db.select().from(seasonArchive).all()).toHaveLength(3);

    // The legacy rows: blueprints, the best levels, points, titles and skins.
    const l1 = legacyOf(db, 1);
    const l2 = legacyOf(db, 2);
    expect(l1.blueprints).toEqual(["crossbow", "strongbox"]);
    expect(l2.blueprints).toEqual(["feast"]);
    expect(l1.levels.mara).toEqual({ level: 4, xp: 500 });
    expect(l1.levels.dax).toEqual({ level: 2, xp: 120 });
    expect(l2.levels.ivo).toEqual({ level: 3, xp: 300 });
    expect(l1.seasons).toBe(1);
    expect(l1.skins).toContain("driftwood");
    expect(l1.skins).toContain("rust");
    expect(l1.points).toBeGreaterThan(content.legacy.points.played);
    // Player 2 gave more to the Signal (5000 stone is worth more than 900 planks).
    expect(l2.titles).toContain("signal:1");
    const fame = db.select().from(hallOfFame).where(eq(hallOfFame.category, "signal")).all();
    expect(fame.map((row) => row.playerId)).toEqual([2]);

    // A new season's base: exactly the fresh base plus what was kept.
    const fresh = await get<StateResponse>(p1, "/api/state");
    expect(fresh.season).toMatchObject({ number: 2, modifier: "storm_season", endsAt: null });
    // (The first look settles the fresh base: the day's tasks, the Den's counter and contracts.)
    const carry = carryFor(l1, { number: 2, startedAt: T0 + 2 * HOUR, modifier: "storm_season" });
    const expected = settleAll(content, newBase(content, T0 + 2 * HOUR, 7, carry), T0 + 2 * HOUR);
    expect(fresh.state).toEqual(expected.state);
    expect(stored(1, 2).blueprints).toEqual(["crossbow", "strongbox"]);
    expect(stored(1, 2).crew.find((member) => member.id === "mara")).toMatchObject({
      level: 4,
      xp: 500,
    });
    expect(stored(1, 2).tier).toBe("twig");

    // The player's legacy and the hall of fame.
    const view = await get<LegacyResponse>(p1, "/api/legacy");
    expect(view.legacy.points).toBe(l1.points);
    expect(view.seasons[0]).toMatchObject({ season: 1, points: l1.points });
    expect(view.hall.some((entry) => entry.season === 1)).toBe(true);
  });

  it("the tick leaves archived bases alone and a new season starts empty of gifts", async () => {
    const { game, clock, login, db, get } = setup();
    const p1 = await login(1);
    await game.endSeason();
    clock.set(T0 + 30 * HOUR);
    expect(game.tick()).toEqual([]);
    const signal = await get<SignalResponse>(p1, "/api/signal");
    expect(signal).toMatchObject({ open: false, mine: 0, top: [] });
    expect(db.select().from(seasons).where(isNull(seasons.endedAt)).all()).toHaveLength(1);
  });
});

describe("legacy points and perks", () => {
  it("buys a perk with the points, once per key, and refuses without enough", async () => {
    const { db, login, send, stored } = setup();
    const p1 = await login(1);
    const legacy: Legacy = { ...legacyOf(db, 1), points: 5 };
    saveLegacy(db, 1, legacy, T0);
    const first = await send(p1, "perk-hands-01", { type: "buy_perk", perk: "steady_hands" });
    expect(first.ok).toBe(true);
    const again = await send(p1, "perk-hands-01", { type: "buy_perk", perk: "steady_hands" });
    expect(again).toEqual(first);
    expect(legacyOf(db, 1)).toMatchObject({ points: 2, spent: 3, perks: { steady_hands: 1 } });
    expect(stored(1).perks).toEqual({ steady_hands: 1 });
    const poor = await send(p1, "perk-hands-02", { type: "buy_perk", perk: "steady_hands" });
    expect(poor).toMatchObject({ ok: false, refusal: { code: "no_points", need: 3 } });
  });

  it("wears only an earned skin", async () => {
    const { db, login, send, stored } = setup();
    const p1 = await login(1);
    expect(await send(p1, "skin-rust-001", { type: "set_cosmetic", skin: "rust" })).toMatchObject({
      ok: false,
      refusal: { code: "not_earned" },
    });
    saveLegacy(db, 1, { ...legacyOf(db, 1), skins: ["rust"] }, T0);
    expect((await send(p1, "skin-rust-002", { type: "set_cosmetic", skin: "rust" })).ok).toBe(true);
    expect(stored(1).skin).toBe("rust");
    expect(legacyOf(db, 1).skin).toBe("rust");
  });
});

describe("the Signal on the server", () => {
  it("two players racing for a stage's last units never overfill it", async () => {
    const { login, send, patch, admin, get, clock } = setup();
    const [p1, p2] = [await login(1), await login(2)];
    for (const id of [1, 2])
      patch(id, (state) => ({ ...state, stock: { ...state.stock, planks: 5000 } }));
    await admin("/season/announce", { endsAt: T0 + 86_400, next: null });
    const need = content.seasons.signal.stages[0]?.needs.planks ?? 0;
    clock.set(T0 + 60);
    await Promise.all([
      send(p1, "race-planks-1", { type: "signal_give", good: "planks", amount: need }),
      send(p2, "race-planks-2", { type: "signal_give", good: "planks", amount: need }),
    ]);
    const signal = await get<SignalResponse>(p1, "/api/signal");
    expect(signal.progress.given.planks ?? 0).toBe(need);
    expect(signal.needs.planks).toBeUndefined();
  });

  it("is closed before its day unless the end is announced", async () => {
    const { login, send, patch } = setup();
    const p1 = await login(1);
    patch(1, (state) => ({ ...state, stock: { ...state.stock, planks: 100 } }));
    expect(
      await send(p1, "gift-closed-1", { type: "signal_give", good: "planks", amount: 10 }),
    ).toMatchObject({
      ok: false,
      refusal: { code: "signal_closed", day: content.seasons.signal.opensOnDay },
    });
  });
});

describe("the admin routes", () => {
  it("need the token in production; take it when it matches", async () => {
    const closed = setup({ devLogin: false });
    expect((await closed.admin("/season/end", {})).status).toBe(403);
    const guarded = setup({ devLogin: false, adminToken: "a-long-secret-token" });
    expect((await guarded.admin("/season/end", {}, "wrong-token-value")).status).toBe(403);
    await guarded.login(1).catch(() => undefined);
    expect(
      (await guarded.admin("/season/announce", { endsAt: null, next: null }, "a-long-secret-token"))
        .status,
    ).toBe(200);
  });
});
