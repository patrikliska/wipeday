import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGame } from "@wipe-day/content/load";
import { type ManualClock, manualClock } from "@wipe-day/domain/clock";
import { applyCommand } from "@wipe-day/domain/commands";
import { nextEventAt, suppliesAt } from "@wipe-day/domain/settle";
import type { BaseState } from "@wipe-day/domain/state";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import type { DiscordAuth } from "./auth";
import type { Config } from "./config";
import { type CommandResponse, Game, type PushMessage, type StateResponse } from "./game";
import { EventHub } from "./hub";
import { log } from "./log";
import { Notifier } from "./push";
import { openDb } from "./store/db";
import { bases, commands, eventLog, players } from "./store/schema";

const { content, locale } = loadGame();
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
  adminToken: null,
  botToken: null,
};

const discord: DiscordAuth = {
  authorizationUrl: (state) => new URL(`https://discord.test/authorize?state=${state}`),
  identify: async (code) => ({ discordId: `discord-${code}`, name: "Nia", avatarUrl: null }),
};

function setup(file = ":memory:", clock: ManualClock = manualClock(T0)) {
  const db = openDb(file);
  const hub = new EventHub();
  /** What the push service was asked to deliver; a 410 for endpoints marked gone. */
  const sent: { endpoint: string; payload: { kind: string; title: string; body: string } }[] = [];
  const gone = new Set<string>();
  const notifier = new Notifier(db, locale, log, "mailto:test@localhost.invalid", async (s, p) => {
    if (gone.has(s.endpoint)) throw Object.assign(new Error("gone"), { statusCode: 410 });
    sent.push({ endpoint: s.endpoint, payload: JSON.parse(p) });
    return { statusCode: 201 };
  });
  const game = new Game({
    db,
    content,
    clock,
    hub,
    newSeed: () => 7,
    notify: (playerId, events) => notifier.notify(playerId, events),
  });
  const app = createApp({ db, game, hub, clock, config, discord, notifier });
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
    const next = change(JSON.parse(row.stateJson) as BaseState);
    // The scheduler finds bases by this column: keep it in step, as `save` does.
    db.update(bases)
      .set({ stateJson: JSON.stringify(next), nextEventAt: nextEventAt(content, next) })
      .where(eq(bases.playerId, playerId))
      .run();
  };
  const logged = (playerId: number, type: string) =>
    db
      .select()
      .from(eventLog)
      .where(and(eq(eventLog.playerId, playerId), eq(eventLog.type, type)))
      .all().length;
  const json = async (cookie: string, path: string, method = "GET", body?: unknown) => {
    const response = await app.request(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: { cookie, "content-type": "application/json" },
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  return {
    db,
    hub,
    game,
    app,
    clock,
    login,
    state,
    send,
    patch,
    logged,
    cookieOf,
    json,
    sent,
    gone,
    notifier,
  };
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

/** A base that can afford things: three Beachcombers, one manned, and supplies. */
const playing =
  (supplies: number) =>
  (base: BaseState): BaseState => ({
    ...base,
    run: { ...base.run, supplies, lines: { beachcomber: 3, campfire: 1 }, hands: ["beachcomber"] },
  });

/** The rows of a player's command records, parsed. */
const records = (db: ReturnType<typeof setup>["db"], playerId: number) =>
  db
    .select()
    .from(commands)
    .where(eq(commands.playerId, playerId))
    .all()
    .map((row) => ({ ...row, result: JSON.parse(row.resultJson) as Record<string, unknown> }));

describe("state and commands", () => {
  it("creates a fresh v2 island on first look", async () => {
    const { login, state } = setup();
    const first = await state(await login(1));
    expect(first.state.v).toBe(2);
    expect(first.state.run.supplies).toBe(0);
    expect(first.state.run.n).toBe(1);
    expect(first.version).toBe(1);
    expect(first.serverNow).toBe(T0);
    expect(first.welcomeBack).toBeNull();
  });

  const COMMANDS = [
    { type: "taps", count: 5, from: T0, to: T0 },
    { type: "ping" },
    { type: "buy_line", line: "beachcomber", count: 1 },
    { type: "hire_hand", line: "campfire" },
  ] as const;

  for (const command of COMMANDS) {
    it(`runs ${command.type} once per key: a replay returns the outcome with the current state`, async () => {
      const { login, state, send, patch, clock } = setup();
      const cookie = await login(1);
      await state(cookie);
      patch(1, playing(1e6));
      const first = await send(cookie, `key-${command.type}-1`, command);
      expect(first.ok).toBe(true);
      clock.advance(10);
      const replay = await send(cookie, `key-${command.type}-1`, command);
      expect(replay.replay).toBe(true);
      expect(replay.ok).toBe(true);
      expect(replay.version).toBe(first.version);
      // The state is the current one (ten seconds later, as settle says), and the command did
      // not run twice.
      expect(replay.state.run.lines).toEqual(first.state.run.lines);
      expect(replay.state.run.hands).toEqual(first.state.run.hands);
      expect(replay.state.run.taps).toBe(first.state.run.taps);
      expect(replay.state.run.supplies).toBeCloseTo(suppliesAt(content, first.state, T0 + 10), 6);
    });
  }

  it("judges a stale prediction by the current state: a double click cannot buy twice", async () => {
    const { login, state, send, patch } = setup();
    const cookie = await login(1);
    await state(cookie);
    patch(1, (base) => ({ ...base, run: { ...base.run, supplies: 10 } }));
    expect(
      (await send(cookie, "key-buy-a", { type: "buy_line", line: "beachcomber", count: 1 })).ok,
    ).toBe(true);
    const second = await send(cookie, "key-buy-b", {
      type: "buy_line",
      line: "beachcomber",
      count: 1,
    });
    expect(second).toMatchObject({ ok: false, refusal: { reason: "supplies" } });
    expect(second.state.run.lines.beachcomber).toBe(1);
  });

  it("keeps outcomes only: no record holds a state (D134)", async () => {
    const { db, login, state, send, patch } = setup();
    const cookie = await login(1);
    await state(cookie);
    patch(1, playing(1e6));
    await send(cookie, "key-slim-1", { type: "taps", count: 3, from: T0, to: T0 });
    await send(cookie, "key-std-1", { type: "buy_line", line: "beachcomber", count: 10 });
    await send(cookie, "key-std-2", { type: "buy_line", line: "loom", count: 1 });
    const rows = records(db, 1);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.result).not.toHaveProperty("state");
      expect(row.resultJson).not.toContain('"run"');
    }
    expect(rows.find((row) => row.key === "key-slim-1")?.result).toEqual({
      ok: true,
      version: 2,
      credited: 3,
    });
    expect(rows.find((row) => row.key === "key-std-2")?.result).toMatchObject({
      ok: false,
      refusal: { reason: "locked" },
    });
  });

  it("expires slim records after an hour and standard ones after 7 days, with no log rows for taps", async () => {
    const { db, login, state, send, game, clock, logged } = setup();
    const cookie = await login(1);
    await state(cookie);
    await send(cookie, "key-tap-1", { type: "taps", count: 3, from: T0, to: T0 });
    await send(cookie, "key-ping-1", { type: "ping" });
    await send(cookie, "key-buy-1", { type: "buy_line", line: "beachcomber", count: 1 });
    expect(logged(1, "tapped")).toBe(0);
    expect(db.select().from(eventLog).all()).toHaveLength(0);
    clock.advance(3599);
    game.tick();
    expect(records(db, 1)).toHaveLength(3);
    clock.advance(2);
    game.tick();
    expect(records(db, 1).map((row) => row.key)).toEqual(["key-buy-1"]);
    clock.advance(7 * 86400);
    game.tick();
    expect(records(db, 1)).toHaveLength(0);
  });

  it("credits a taps batch replayed after its record expired only from the bucket", async () => {
    const { login, state, send, clock, game } = setup();
    const cookie = await login(1);
    await state(cookie);
    const batch = { type: "taps", count: 30, from: T0, to: T0 } as const;
    const first = await send(cookie, "key-old-batch", batch);
    expect(first.state.run.taps).toBe(30);
    clock.advance(3601);
    game.tick();
    const late = await send(cookie, "key-old-batch", batch);
    expect(late.replay).toBeUndefined();
    // Its times clamp to the bucket's last refill: no refill, only the 15 tokens left.
    expect(late.state.run.taps).toBe(45);
  });

  it("keeps two players apart, even when they act at the same moment", async () => {
    const { login, state, send } = setup();
    const one = await login(1);
    const two = await login(2);
    await state(one);
    await state(two);
    await send(one, "same-key-1234", { type: "taps", count: 10, from: T0, to: T0 });
    const other = await send(two, "same-key-1234", { type: "taps", count: 4, from: T0, to: T0 });
    expect(other.state.run.taps).toBe(4);
    expect((await state(one)).state.run.taps).toBe(10);
  });

  it("rejects malformed commands", async () => {
    const { app, login } = setup();
    const cookie = await login(1);
    for (const body of [
      { key: "short", command: { type: "ping" } },
      { key: "key-bad-1", command: { type: "gather" } },
      { key: "key-bad-2", command: { type: "taps", count: 500, from: T0, to: T0 } },
      { key: "key-bad-3", command: { type: "buy_line", line: "beachcomber", count: 7 } },
    ]) {
      const response = await app.request("/api/commands", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { cookie, "content-type": "application/json" },
      });
      expect(response.status).toBe(400);
    }
  });

  it("slows a runaway tab down with 429 and a wait (10 a second, burst 30)", async () => {
    const { app, login, state } = setup();
    const cookie = await login(1);
    await state(cookie);
    const statuses: number[] = [];
    let wait: unknown;
    for (let i = 0; i < 31; i++) {
      const response = await app.request("/api/commands", {
        method: "POST",
        body: JSON.stringify({ key: `key-burst-${i}`, command: { type: "ping" } }),
        headers: { cookie, "content-type": "application/json" },
      });
      statuses.push(response.status);
      if (response.status === 429) wait = await response.json();
    }
    expect(statuses.filter((status) => status === 200)).toHaveLength(30);
    expect(statuses.at(-1)).toBe(429);
    expect(wait).toMatchObject({ error: "slow_down" });
  });
});

describe("the base's shape", () => {
  it("replaces a W-phase base in place: a fresh island, the version raised, base_reset logged", async () => {
    const { db, login, state, logged } = setup();
    const cookie = await login(1);
    await state(cookie);
    db.update(bases)
      .set({ stateJson: JSON.stringify({ tier: "stone", stock: { timber: 900 } }), version: 41 })
      .where(eq(bases.playerId, 1))
      .run();
    const after = await state(cookie);
    expect(after.state.v).toBe(2);
    expect(after.state.run.supplies).toBe(0);
    expect(after.version).toBe(42);
    expect(logged(1, "base_reset")).toBe(1);
    expect((await state(cookie)).version).toBe(42);
  });

  it("refuses to save a non-finite number, and the transaction leaves the base as it was", async () => {
    const { db, app, login, state } = setup();
    const cookie = await login(1);
    const before = await state(cookie);
    const row = db.select().from(bases).where(eq(bases.playerId, 1)).get();
    // JSON has no Infinity: 1e999 parses to it, as a corrupt or hand-edited row would.
    const corrupt = (row?.stateJson ?? "").replace(
      '"hustle":{"value":0',
      '"hustle":{"value":1e999',
    );
    db.update(bases).set({ stateJson: corrupt }).where(eq(bases.playerId, 1)).run();
    const response = await app.request("/api/commands", {
      method: "POST",
      body: JSON.stringify({ key: "key-corrupt-1", command: { type: "ping" } }),
      headers: { cookie, "content-type": "application/json" },
    });
    expect(response.status).toBe(500);
    const after = db.select().from(bases).where(eq(bases.playerId, 1)).get();
    expect(after?.version).toBe(before.version);
    expect(after?.stateJson).toBe(corrupt);
  });
});

describe("time", () => {
  it("accrues offline across a restart exactly as the domain says", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "wipe-day-api-")), "game.db");
    const clock = manualClock(T0);
    const first = setup(file, clock);
    const cookie = await first.login(1);
    await first.state(cookie);
    first.patch(1, playing(0));
    const start = (await first.state(cookie)).state;
    first.db.$client.close();

    clock.advance(4 * 3600);
    const second = setup(file, clock);
    const after = (await second.state(cookie)).state;
    expect(after.run.supplies).toBeCloseTo(suppliesAt(content, start, T0 + 4 * 3600), 6);
    expect(after.run.supplies).toBeCloseTo(3 * 1.5 * 4 * 3600, 6);
  });

  it("ends the Night Shift on the scheduler, logs it once, and pings the device", async () => {
    const { login, state, patch, game, clock, json, sent, logged } = setup();
    const cookie = await login(1);
    await state(cookie);
    expect((await json(cookie, "/api/push/subscribe", "POST", DEVICE)).status).toBe(200);
    patch(1, playing(0));
    clock.advance(12 * 3600 - 1);
    expect(game.tick()).toEqual([]);
    clock.advance(2);
    expect(game.tick()).toEqual([1]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(logged(1, "night_shift_over")).toBe(1);
    expect(sent[0]?.payload).toMatchObject({ kind: "night_shift_over" });
    clock.advance(3600);
    expect(game.tick()).toEqual([]);
    // A full window destroys nothing and makes nothing more (N18).
    const full = (await state(cookie)).state;
    expect(full.run.supplies).toBeCloseTo(3 * 1.5 * 12 * 3600, 3);
  });

  it("pushes a standard command's state to other tabs, and only the version for taps", async () => {
    const { hub, login, state, send, patch } = setup();
    const cookie = await login(1);
    await state(cookie);
    patch(1, playing(100));
    const heard: PushMessage[] = [];
    hub.subscribe(1, (message) => heard.push(message));
    await send(cookie, "key-tab-taps", { type: "taps", count: 2, from: T0, to: T0 });
    await send(cookie, "key-tab-buy", { type: "buy_line", line: "beachcomber", count: 1 });
    expect(heard).toHaveLength(2);
    expect(heard[0]).toMatchObject({ origin: "key-tab-taps", events: [] });
    expect(heard[0]?.state).toBeUndefined();
    expect(heard[1]?.origin).toBe("key-tab-buy");
    expect(heard[1]?.state?.run.lines.beachcomber).toBe(4);
  });
});

describe("the taps transport (N10, N25)", () => {
  /** One tab's honest batches: `rate` taps a second for `seconds`, one batch a second. */
  const tab = (rate: number, seconds: number, start: number) =>
    Array.from({ length: seconds }, (_, i) => ({
      type: "taps" as const,
      count: rate,
      from: start + i,
      to: start + i,
    }));

  it("an hour at 15 taps a second from one tab: at most 3,700 slim records, every tap credited as predicted", () => {
    const { game, clock, db } = setup();
    const playerId = db
      .insert(players)
      .values({ discordId: "tab-1", name: "Tab", avatarUrl: null, createdAt: T0, lastSeenAt: T0 })
      .returning()
      .get().id;
    game.look(playerId);
    let predicted = game.look(playerId).state;
    let server = predicted;
    for (const [i, batch] of tab(15, 3600, T0 + 1).entries()) {
      clock.set(batch.to);
      predicted = applyCommand(content, predicted, batch, batch.to).state;
      server = game.command(playerId, `key-hour-${i}`, batch).state;
      if (i % 600 === 0) game.tick();
    }
    expect(game.records(playerId)).toBeLessThanOrEqual(3700);
    expect(server.run.taps).toBe(15 * 3600);
    expect(server.run.supplies).toBe(predicted.run.supplies);
    expect(db.select().from(eventLog).all()).toHaveLength(0);
  });

  it("two tabs together never pass the bucket", () => {
    const { game, clock, db } = setup();
    const playerId = db
      .insert(players)
      .values({ discordId: "tab-2", name: "Tabs", avatarUrl: null, createdAt: T0, lastSeenAt: T0 })
      .returning()
      .get().id;
    game.look(playerId);
    const seconds = 60;
    const a = tab(15, seconds, T0 + 1);
    const b = tab(15, seconds, T0 + 1);
    let last = game.look(playerId).state;
    for (let i = 0; i < seconds; i++) {
      clock.set(T0 + 1 + i);
      const first = a[i];
      const second = b[i];
      if (first) last = game.command(playerId, `key-a-${i}`, first).state;
      if (second) last = game.command(playerId, `key-b-${i}`, second).state;
    }
    // The bucket starts full (45) and refills 15 a second.
    expect(last.run.taps).toBeLessThanOrEqual(45 + 15 * seconds);
    expect(last.run.taps).toBeGreaterThan(15 * seconds);
  });
});

const DEVICE = {
  endpoint: "https://push.example/device-1",
  keys: { p256dh: "BPkey", auth: "authkey" },
};

describe("notifications", () => {
  it("defaults to Night Shift over only, and takes changes per kind", async () => {
    const { login, state, json } = setup();
    const cookie = await login(1);
    await state(cookie);
    const prefs = await json(cookie, "/api/notify");
    expect(prefs.body.prefs).toEqual({ night_shift_over: true });
    const changed = await json(cookie, "/api/notify", "PUT", { night_shift_over: false });
    expect(changed.body.prefs).toEqual({ night_shift_over: false });
    expect((await json(cookie, "/api/notify", "PUT", { party_back: true })).status).toBe(400);
  });

  it("never pings for a kind turned off, and drops a gone device", async () => {
    const { login, state, patch, game, clock, json, sent, gone, notifier } = setup();
    const cookie = await login(1);
    await state(cookie);
    await json(cookie, "/api/push/subscribe", "POST", DEVICE);
    await json(cookie, "/api/notify", "PUT", { night_shift_over: false });
    patch(1, playing(0));
    clock.advance(13 * 3600);
    game.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent).toHaveLength(0);

    await json(cookie, "/api/notify", "PUT", { night_shift_over: true });
    gone.add(DEVICE.endpoint);
    patch(1, (base) => ({
      ...playing(0)(base),
      run: { ...playing(0)(base).run, activeAt: clock.now() },
    }));
    clock.advance(13 * 3600);
    game.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(notifier.devices(1)).toBe(0);
  });
});
