/**
 * The Discord companion's side of the API (W8): the service token, acting for a player by
 * their Discord id, one-time login links, DMs, and the feed reaching the web and the bot's
 * channel from one event.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGame } from "@wipe-day/content/load";
import { manualClock } from "@wipe-day/domain/clock";
import { nextEventAt } from "@wipe-day/domain/settle";
import type { BaseState } from "@wipe-day/domain/state";
import type { BotHome, DmNote } from "@wipe-day/domain/wire";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { LINK_SECONDS } from "./auth";
import type { Config } from "./config";
import { Game } from "./game";
import { EventHub } from "./hub";
import { log } from "./log";
import { Notifier } from "./push";
import { openDb } from "./store/db";
import { bases, players } from "./store/schema";

const { content, locale } = loadGame();
const T0 = 1_700_000_000;
const TOKEN = "a-bot-token-that-is-long-enough-to-pass";
const NIA = { id: "123456789012345678", name: "Nia 🌊" };

function setup(overrides: Partial<Config> = {}) {
  const config: Config = {
    production: false,
    port: 0,
    publicUrl: "https://game.test",
    discord: null,
    databasePath: ":memory:",
    backupDir: "",
    webDist: join(tmpdir(), "wipe-day-no-web-build"),
    devLogin: true,
    adminToken: null,
    botToken: TOKEN,
    ...overrides,
  };
  const clock = manualClock(T0);
  const db = openDb(":memory:");
  const hub = new EventHub();
  const notifier = new Notifier(
    db,
    locale,
    log,
    "mailto:test@localhost.invalid",
    async () => ({ statusCode: 201 }),
    (discordId, notes) => {
      for (const { kind, title, body, url } of notes)
        hub.broadcastBot({
          event: "dm",
          data: { discordId, kind, title, body, url: `${config.publicUrl}${url}` },
        });
    },
  );
  const game = new Game({
    db,
    content,
    clock,
    hub,
    newSeed: () => 7,
    notify: (playerId, events) => notifier.notify(playerId, events),
  });
  const app = createApp({ db, game, hub, clock, config, discord: null, notifier });

  /** A request from the bot, acting for `user` (or for nobody). */
  const bot = async (
    path: string,
    { method = "GET", body, user = NIA, token = TOKEN }: BotRequest = {},
  ) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    if (user) {
      headers["x-discord-id"] = user.id;
      headers["x-discord-name"] = encodeURIComponent(user.name);
    }
    return app.request(`/api/bot${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  };
  const home = async (user = NIA) => (await (await bot("/home", { user })).json()) as BotHome;
  const patch = (playerId: number, change: (state: BaseState) => BaseState) => {
    const row = db.select().from(bases).where(eq(bases.playerId, playerId)).get();
    if (!row) throw new Error("no base");
    const next = change(JSON.parse(row.stateJson) as BaseState);
    db.update(bases)
      .set({ stateJson: JSON.stringify(next), nextEventAt: nextEventAt(content, next) })
      .where(eq(bases.playerId, playerId))
      .run();
  };
  const cookieOf = (response: Response): string =>
    response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0] ?? "")
      .find((cookie) => cookie.startsWith("wd_session=")) ?? "";
  return { app, db, hub, game, clock, notifier, bot, home, patch, cookieOf };
}

interface BotRequest {
  method?: string;
  body?: unknown;
  user?: { id: string; name: string } | null;
  token?: string | null;
}

/** A manned Beachcomber whose Night Shift started at `at`. */
function manned(base: BaseState, at: number): BaseState {
  return {
    ...base,
    run: { ...base.run, lines: { beachcomber: 1 }, hands: ["beachcomber"], activeAt: at },
  };
}

const NIGHT_SHIFT = 12 * 3600;

/** Reads a server-sent event stream: the next event of a kind, then close. */
function sse(response: Response) {
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const seen: { event: string; data: string }[] = [];
  const next = async (event: string): Promise<unknown> => {
    for (;;) {
      const index = seen.findIndex((message) => message.event === event);
      if (index >= 0) return JSON.parse(seen.splice(index, 1)[0]?.data ?? "null");
      const { value, done } = await reader.read();
      if (done) throw new Error(`stream ended before ${event}`);
      buffer += decoder.decode(value, { stream: true });
      let end = buffer.indexOf("\n\n");
      while (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const lines = block.split("\n");
        const name =
          lines
            .find((line) => line.startsWith("event:"))
            ?.slice(6)
            .trim() ?? "";
        const data = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        seen.push({ event: name, data });
        end = buffer.indexOf("\n\n");
      }
    }
  };
  return { next, close: () => reader.cancel() };
}

describe("the bot's token (W8)", () => {
  it("turns away requests without the token, or with a wrong one", async () => {
    const { bot } = setup({ devLogin: false });
    expect((await bot("/home", { token: null })).status).toBe(403);
    expect((await bot("/home", { token: "x".repeat(40) })).status).toBe(403);
    expect((await bot("/home")).status).toBe(200);
  });

  it("is open to a development server without a token, and closed in production", async () => {
    expect((await setup({ botToken: null }).bot("/home", { token: null })).status).toBe(200);
    const production = setup({ botToken: null, devLogin: false, production: true });
    expect((await production.bot("/home", { token: null })).status).toBe(403);
  });

  it("needs a Discord id to act for", async () => {
    const { bot } = setup();
    expect((await bot("/state", { user: null })).status).toBe(400);
    expect((await bot("/state", { user: { id: "dev-1", name: "X" } })).status).toBe(400);
  });
});

describe("acting for a player (W8)", () => {
  it("makes the player on first use, with DMs on and a working login link", async () => {
    const { db, home, app, cookieOf } = setup();
    const first = await home();
    expect(first.player.name).toBe(NIA.name);
    expect(first.state.run.era).toBe("twig");
    expect(first.discordDm).toBe(true);
    expect(first.loginUrl).toMatch(/^https:\/\/game\.test\/api\/auth\/link\?t=/);
    const row = db.select().from(players).where(eq(players.discordId, NIA.id)).get();
    expect(row?.id).toBe(first.player.id);

    // The link logs the web into the same player, once.
    const path = first.loginUrl.replace("https://game.test", "");
    const used = await app.request(path);
    expect(used.status).toBe(302);
    const cookie = cookieOf(used);
    expect(cookie).not.toBe("");
    const me = (await (await app.request("/api/me", { headers: { cookie } })).json()) as {
      id: number;
    };
    expect(me.id).toBe(first.player.id);
    expect(cookieOf(await app.request(path))).toBe("");
  });

  it("lets a login link run out after ten minutes", async () => {
    const { home, app, clock, cookieOf } = setup();
    const { loginUrl } = await home();
    clock.advance(LINK_SECONDS);
    const late = await app.request(loginUrl.replace("https://game.test", ""));
    expect(late.status).toBe(302);
    expect(late.headers.get("location")).toBe("/");
    expect(cookieOf(late)).toBe("");
  });

  it("refuses commands until R2 lets the bot Collect (not_on_discord), without marking seen", async () => {
    const { bot, home, db, clock } = setup();
    const before = await home();
    const seenAt = () =>
      db.select().from(players).where(eq(players.id, before.player.id)).get()?.lastSeenAt;
    const joined = seenAt();
    clock.advance(3600);
    const response = await bot("/commands", {
      method: "POST",
      body: { key: "discord:111", command: { type: "ping" } },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "not_on_discord" });
    expect(seenAt()).toBe(joined);
  });

  it("keeps the name fresh and takes DMs off and on", async () => {
    const { bot, home } = setup();
    await home();
    const renamed = await home({ id: NIA.id, name: "Nia of the Narrows" });
    expect(renamed.player.name).toBe("Nia of the Narrows");
    expect((await bot("/dm", { method: "PUT", body: { on: false } })).status).toBe(200);
    expect((await home()).discordDm).toBe(false);
    expect((await bot("/dm", { method: "PUT", body: { on: "yes" } })).status).toBe(400);
  });
});

describe("DMs (W8)", () => {
  it("go to players who use the bot, for the kinds they turned on", async () => {
    const { home, bot, patch, clock, game, hub } = setup();
    const { player } = await home();
    const dms: DmNote[] = [];
    hub.subscribeBot((message) => {
      if (message.event === "dm") dms.push(message.data);
    });
    patch(player.id, (base) => manned(base, T0));
    clock.advance(NIGHT_SHIFT + 60);
    game.tick();
    expect(dms).toEqual([
      expect.objectContaining({
        discordId: NIA.id,
        kind: "night_shift_over",
        title: "The Night Shift is over",
        url: "https://game.test/",
      }),
    ]);

    await bot("/dm", { method: "PUT", body: { on: false } });
    patch(player.id, (base) => manned(base, clock.now()));
    clock.advance(NIGHT_SHIFT + 60);
    game.tick();
    expect(dms).toHaveLength(1);
  });

  it("never go to a player who has not used the bot", async () => {
    const { app, game, hub, notifier, clock } = setup();
    const login = await app.request("/api/dev/login", {
      method: "POST",
      body: JSON.stringify({ slot: 1 }),
      headers: { "content-type": "application/json" },
    });
    expect(login.status).toBe(200);
    expect(notifier.discordDm(1)).toBeNull();
    const dms: unknown[] = [];
    hub.subscribeBot((message) => dms.push(message));
    clock.advance(60);
    game.tick();
    await notifier.notify(1, [{ type: "night_shift_over", at: clock.now() }]);
    expect(dms).toEqual([]);
  });
});

describe("the bot's stream (W8)", () => {
  it("opens with ready, and starts the channel's cursor at the newest row: no old history", async () => {
    const { bot, game } = setup();
    const stream = sse(await bot("/stream", { user: null }));
    expect(typeof (await stream.next("ready"))).toBe("number");
    await stream.close();
    // The feed is empty until R2's Wipe Days, so there is nothing to catch up on.
    expect(game.feedMissed()).toEqual([]);
    expect((await bot("/feed/ack", { method: "POST", body: { id: 5 }, user: null })).status).toBe(
      200,
    );
  });
});
