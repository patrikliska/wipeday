import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGame } from "@wipe-day/content/load";
import { accrued, type BaseState, newBase } from "@wipe-day/domain/base";
import { type ManualClock, manualClock } from "@wipe-day/domain/clock";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import type { DiscordAuth } from "./auth";
import type { Config } from "./config";
import { type CommandResponse, Game, type PushMessage, type StateResponse } from "./game";
import { EventHub } from "./hub";
import { openDb } from "./store/db";
import { bases, eventLog } from "./store/schema";

const { content } = loadGame();
const T0 = 1_700_000_000;

const config: Config = {
  production: false,
  port: 0,
  publicUrl: "http://localhost:5173",
  discord: null,
  databasePath: ":memory:",
  backupDir: "",
  webDist: join(tmpdir(), "wipe-day-no-web-build"),
  devLogin: true,
};

const discord: DiscordAuth = {
  authorizationUrl: (state) => new URL(`https://discord.test/authorize?state=${state}`),
  identify: async (code) => ({ discordId: `discord-${code}`, name: "Nia", avatarUrl: null }),
};

function setup(file = ":memory:", clock: ManualClock = manualClock(T0)) {
  const db = openDb(file);
  const hub = new EventHub();
  const game = new Game({ db, content, clock, hub, newSeed: () => 7 });
  const app = createApp({ db, game, hub, clock, config, discord });
  /** The `name=value` of the cookie a response sets (the session one unless named). */
  const cookieOf = (response: Response, name = "wd_session"): string =>
    response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0] ?? "")
      .find((cookie) => cookie.startsWith(`${name}=`)) ?? "";

  const login = async (slot: number): Promise<string> => {
    const response = await app.request("/api/dev/login", {
      method: "POST",
      body: JSON.stringify({ slot }),
      headers: { "content-type": "application/json" },
    });
    expect(response.status).toBe(200);
    return cookieOf(response);
  };
  const state = async (cookie: string): Promise<StateResponse> =>
    (await (await app.request("/api/state", { headers: { cookie } })).json()) as StateResponse;
  const send = async (cookie: string, key: string, command: unknown): Promise<CommandResponse> => {
    const response = await app.request("/api/commands", {
      method: "POST",
      body: JSON.stringify({ key, command }),
      headers: { cookie, "content-type": "application/json" },
    });
    expect(response.status).toBe(200);
    return (await response.json()) as CommandResponse;
  };
  /** Rewrites a player's stored base, as if they had played a while. */
  const patch = (playerId: number, change: (state: BaseState) => BaseState) => {
    const row = db.select().from(bases).where(eq(bases.playerId, playerId)).get();
    if (!row) throw new Error("no base");
    db.update(bases)
      .set({ stateJson: JSON.stringify(change(JSON.parse(row.stateJson) as BaseState)) })
      .where(eq(bases.playerId, playerId))
      .run();
  };
  const logged = (playerId: number, type: string) =>
    db
      .select()
      .from(eventLog)
      .where(and(eq(eventLog.playerId, playerId), eq(eventLog.type, type)))
      .all().length;
  return { db, hub, game, app, clock, login, state, send, patch, logged, cookieOf };
}

describe("login", () => {
  it("keeps the game behind a session", async () => {
    const { app } = setup();
    expect((await app.request("/api/state")).status).toBe(401);
    expect((await app.request("/api/commands", { method: "POST" })).status).toBe(401);
  });

  it("logs in with Discord: state cookie, callback, session", async () => {
    const { app, cookieOf } = setup();
    const start = await app.request("/api/auth/discord");
    expect(start.status).toBe(302);
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state");
    const stateCookie = cookieOf(start, "wd_oauth_state");
    expect(stateCookie).toContain("wd_oauth_state=");

    const forged = await app.request(`/api/auth/callback?code=abc&state=wrong`, {
      headers: { cookie: stateCookie },
    });
    expect(forged.headers.get("location")).toBe("/?login=failed");

    const done = await app.request(`/api/auth/callback?code=abc&state=${state}`, {
      headers: { cookie: stateCookie },
    });
    expect(done.status).toBe(302);
    expect(done.headers.get("location")).toBe("/");
    const session = cookieOf(done);
    const me = await (await app.request("/api/me", { headers: { cookie: session } })).json();
    expect(me).toMatchObject({ name: "Nia" });

    await app.request("/api/auth/logout", { method: "POST", headers: { cookie: session } });
    expect((await app.request("/api/me", { headers: { cookie: session } })).status).toBe(401);
  });
});

describe("state and commands", () => {
  it("creates a twig base on first look", async () => {
    const { login, state } = setup();
    const first = await state(await login(1));
    expect(first.state.tier).toBe("twig");
    expect(first.version).toBe(1);
    expect(first.serverNow).toBe(T0);
    expect(first.welcomeBack).toBeNull();
  });

  it("runs a command once per key: a replay returns the same answer and banks nothing", async () => {
    const { login, state, send, logged } = setup();
    const cookie = await login(1);
    await state(cookie);
    const first = await send(cookie, "key-gather-1", { type: "gather" });
    const replay = await send(cookie, "key-gather-1", { type: "gather" });
    expect(first.ok).toBe(true);
    expect(replay).toEqual(first);
    expect((await state(cookie)).state.stock).toEqual(first.state.stock);
    expect(logged(1, "gathered")).toBe(1);
  });

  it("new keys obey the state: a double click cannot craft or smelt twice what the base cannot afford", async () => {
    const { login, state, send, patch } = setup();
    const cookie = await login(1);
    await state(cookie);
    const second = await send(cookie, "key-gather-2", { type: "gather" });
    expect(second.ok).toBe(true);
    const again = await send(cookie, "key-gather-3", { type: "gather" });
    expect(again).toMatchObject({ ok: false, refusal: { code: "cooldown" } });

    patch(1, (base) => ({
      ...base,
      tier: "stone",
      buildings: { furnace: 1, workbench: 1 },
      stock: { timber: 700, stone: 50, ore: 1000 },
    }));
    // The campfire lands at once; the second click aims at level 2, which the base cannot
    // afford: refused, nothing charged.
    const fire = await send(cookie, "key-fire-1", { type: "build", what: "campfire" });
    const fireAgain = await send(cookie, "key-fire-2", { type: "build", what: "campfire" });
    expect(fire.ok).toBe(true);
    expect(fireAgain).toMatchObject({ ok: false, refusal: { code: "unaffordable" } });
    expect(fireAgain.state.stock.timber).toBe(600);
    // 600 timber fuels 1000 ore (50 per 100): the second smelt finds nothing left to smelt.
    const smelt = await send(cookie, "key-smelt-1", { type: "smelt", ore: "ore" });
    const smeltAgain = await send(cookie, "key-smelt-2", { type: "smelt", ore: "ore" });
    expect(smelt.ok).toBe(true);
    expect(smeltAgain).toMatchObject({ ok: false, refusal: { code: "nothing_to_smelt" } });
    expect(smeltAgain.state.furnaceJobs).toHaveLength(1);
  });

  it("keeps two players apart, even when they act at the same moment", async () => {
    const { login, state, send } = setup();
    const one = await login(1);
    const two = await login(2);
    await Promise.all([state(one), state(two)]);
    const [a, b] = await Promise.all([
      send(one, "same-key-123", { type: "gather" }),
      send(two, "same-key-123", { type: "gather" }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect((await state(one)).state.stock).toEqual((await state(two)).state.stock);
    expect((await state(one)).state.seed).toBe(7);
  });

  it("rejects malformed commands", async () => {
    const { app, login } = setup();
    const cookie = await login(1);
    const response = await app.request("/api/commands", {
      method: "POST",
      body: JSON.stringify({ key: "key-bad-1", command: { type: "teleport" } }),
      headers: { cookie, "content-type": "application/json" },
    });
    expect(response.status).toBe(400);
  });
});

describe("time", () => {
  it("accrues offline across a restart exactly as the domain says", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "wipe-day-api-")), "game.db");
    const clock = manualClock(T0);
    const first = setup(file, clock);
    const cookie = await first.login(1);
    await first.state(cookie);
    first.db.$client.close();

    clock.advance(10 * 3600 + 17);
    const second = setup(file, clock);
    const expected = accrued(content, newBase(content, T0, 7), clock.now());
    expect(second.game.pending(1)).toEqual(expected);
    const collected = await second.send(cookie, "key-collect-1", { type: "collect" });
    expect(collected.events[0]).toEqual({ type: "collected", gained: expected });
  });

  it("lands timers on the scheduler, pushes them, and welcomes the player back", async () => {
    const { login, state, send, patch, game, hub, clock } = setup();
    const cookie = await login(1);
    await state(cookie);
    patch(1, (base) => ({
      ...base,
      // A W1-shaped base (the workbench as an item): loading converts it to a building.
      items: { workbench_1: 1 },
      stock: { timber: 500, fibre: 100 },
    }));
    const queued = await send(cookie, "key-bow-1", { type: "craft", item: "bow" });
    expect(queued.ok).toBe(true);

    const pushed: PushMessage[] = [];
    hub.subscribe(1, (message) => pushed.push(message));
    clock.advance(2 * 3600);
    expect(game.tick()).toEqual([1]);
    expect(pushed.at(-1)?.events.map((event) => event.type)).toContain("crafted");
    expect(pushed.at(-1)?.state.items.bow).toBe(1);

    const back = await state(cookie);
    expect(back.welcomeBack?.awaySeconds).toBe(2 * 3600);
    expect(back.welcomeBack?.events.map((event) => event.type)).toContain("crafted");
    expect((await state(cookie)).welcomeBack).toBeNull();
  });

  it("pushes a command to the player's other tabs with its key", async () => {
    const { login, state, send, hub } = setup();
    const cookie = await login(1);
    await state(cookie);
    const pushed: PushMessage[] = [];
    hub.subscribe(1, (message) => pushed.push(message));
    await send(cookie, "key-gather-9", { type: "gather" });
    expect(pushed).toHaveLength(1);
    expect(pushed[0]?.origin).toBe("key-gather-9");
  });
});
