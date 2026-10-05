/**
 * The HTTP surface. Every route under `/api`; in production the same process
 * also serves the web build, so the game is one origin and cookies just work.
 *
 * GET  /api/health             liveness for Docker and humans
 * GET  /api/config             which logins this server offers
 * GET  /api/auth/discord       start Discord login
 * GET  /api/auth/callback      finish it, set the session cookie, back to the game
 * POST /api/auth/logout
 * POST /api/dev/login          dev only: log in as test player 1, 2 or 3
 * GET  /api/me                 who is logged in (401 when nobody)
 * GET  /api/state              the base, settled to now, plus a welcome-back summary
 * POST /api/commands           {key, command}: one idempotent action
 * GET  /api/events             server-sent events: the base changed (other tab, timers),
 *                              and `feed` items from everyone
 * GET  /api/feed?before=id     the season's feed, newest first (W4b)
 * GET  /api/notify             notification kinds on/off, the push key, devices on
 * PUT  /api/notify             {kind: bool, ...}: turn kinds on or off
 * POST /api/push/subscribe     {endpoint, keys}: this device wants notifications
 * POST /api/push/unsubscribe   {endpoint}
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Clock } from "@wipe-day/domain/clock";
import { NOTIFY_KINDS } from "@wipe-day/domain/feed";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import {
  createSession,
  type DiscordAuth,
  deleteSession,
  newOAuthState,
  SESSION_COOKIE,
  STATE_COOKIE,
  sessionPlayer,
  upsertPlayer,
} from "./auth";
import { commandRequestSchema } from "./commandSchema";
import type { Config } from "./config";
import type { Game } from "./game";
import type { EventHub } from "./hub";
import type { Notifier } from "./push";
import type { Db } from "./store/db";
import { players } from "./store/schema";

export interface AppDeps {
  db: Db;
  game: Game;
  hub: EventHub;
  clock: Clock;
  config: Config;
  /** Null when Discord login is not configured (development without secrets). */
  discord: DiscordAuth | null;
  notifier: Notifier;
}

/** Keeps idle proxies from closing the event stream. */
const HEARTBEAT_MS = 25_000;

type Env = { Variables: { playerId: number } };

export function createApp(deps: AppDeps): Hono<Env> {
  const { db, game, hub, clock, config, discord, notifier } = deps;
  const app = new Hono<Env>();
  const cookieBase = { httpOnly: true, secure: config.production, sameSite: "Lax" as const };

  const startSession = (playerId: number): string => {
    const session = createSession(db, playerId, clock.now());
    return session.token;
  };
  const setSession = (c: Parameters<typeof setCookie>[0], token: string) =>
    setCookie(c, SESSION_COOKIE, token, { ...cookieBase, path: "/", maxAge: 30 * 86400 });

  app.get("/api/health", (c) => c.json({ ok: true, now: clock.now(), streams: hub.connections }));

  /** What the login screen offers, before anyone is logged in. */
  app.get("/api/config", (c) =>
    c.json({ devLogin: config.devLogin, discordLogin: discord !== null }),
  );

  app.get("/api/auth/discord", (c) => {
    if (!discord) return c.json({ error: "login_unavailable" }, 503);
    const state = newOAuthState();
    setCookie(c, STATE_COOKIE, state, { ...cookieBase, path: "/api/auth", maxAge: 600 });
    return c.redirect(discord.authorizationUrl(state).toString());
  });

  app.get("/api/auth/callback", async (c) => {
    const expected = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: "/api/auth" });
    const code = c.req.query("code");
    if (!discord || !code || !expected || c.req.query("state") !== expected) {
      return c.redirect("/?login=failed");
    }
    try {
      const identity = await discord.identify(code);
      const playerId = upsertPlayer(db, identity, clock.now());
      setSession(c, startSession(playerId));
      return c.redirect("/");
    } catch {
      return c.redirect("/?login=failed");
    }
  });

  app.post("/api/auth/logout", (c) => {
    deleteSession(db, getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  if (config.devLogin) {
    const devLogin = z.strictObject({ slot: z.int().min(1).max(3) });
    app.post("/api/dev/login", async (c) => {
      const parsed = devLogin.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "bad_request" }, 400);
      const { slot } = parsed.data;
      const playerId = upsertPlayer(
        db,
        { discordId: `dev-${slot}`, name: `Test Player ${slot}`, avatarUrl: null },
        clock.now(),
      );
      setSession(c, startSession(playerId));
      return c.json({ ok: true, playerId });
    });
  }

  // Everything below needs a logged-in player.
  const authed = new Hono<Env>();
  authed.use(async (c, next) => {
    const playerId = sessionPlayer(db, getCookie(c, SESSION_COOKIE), clock.now());
    if (playerId === null) return c.json({ error: "login_required" }, 401);
    c.set("playerId", playerId);
    await next();
  });

  authed.get("/me", (c) => {
    const row = db
      .select()
      .from(players)
      .where(eq(players.id, c.get("playerId")))
      .get();
    if (!row) return c.json({ error: "login_required" }, 401);
    return c.json({
      id: row.id,
      name: row.name,
      avatarUrl: row.avatarUrl,
      devLogin: config.devLogin,
    });
  });

  authed.get("/state", (c) => c.json(game.look(c.get("playerId"))));

  authed.post("/commands", async (c) => {
    const parsed = commandRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: "bad_request", issues: parsed.error.issues.map((i) => i.message) },
        400,
      );
    }
    return c.json(game.command(c.get("playerId"), parsed.data.key, parsed.data.command));
  });

  authed.get("/feed", (c) => {
    const before = Number(c.req.query("before"));
    return c.json({
      items: game.feed(Number.isInteger(before) && before > 0 ? before : undefined),
    });
  });

  authed.get("/notify", (c) => {
    const playerId = c.get("playerId");
    return c.json({
      prefs: notifier.prefs(playerId),
      publicKey: notifier.publicKey,
      devices: notifier.devices(playerId),
    });
  });

  const prefsSchema = z.partialRecord(z.enum(NOTIFY_KINDS), z.boolean());
  authed.put("/notify", async (c) => {
    const parsed = prefsSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "bad_request" }, 400);
    return c.json({ prefs: notifier.setPrefs(c.get("playerId"), parsed.data) });
  });

  const subscriptionSchema = z.object({
    endpoint: z.url().max(2000),
    keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
  });
  authed.post("/push/subscribe", async (c) => {
    const parsed = subscriptionSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "bad_request" }, 400);
    notifier.subscribe(c.get("playerId"), parsed.data, clock.now());
    return c.json({ ok: true });
  });

  authed.post("/push/unsubscribe", async (c) => {
    const parsed = z
      .object({ endpoint: z.string().min(1).max(2000) })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "bad_request" }, 400);
    notifier.unsubscribe(c.get("playerId"), parsed.data.endpoint);
    return c.json({ ok: true });
  });

  authed.get("/events", (c) => {
    const playerId = c.get("playerId");
    return streamSSE(c, async (stream) => {
      const unsubscribeState = hub.subscribe(playerId, (message) => {
        void stream.writeSSE({ event: "state", data: JSON.stringify(message) });
      });
      const unsubscribeFeed = hub.subscribeFeed((items) => {
        void stream.writeSSE({ event: "feed", data: JSON.stringify(items) });
      });
      const unsubscribe = () => {
        unsubscribeState();
        unsubscribeFeed();
      };
      stream.onAbort(unsubscribe);
      await stream.writeSSE({ event: "ready", data: String(clock.now()) });
      while (!stream.aborted) {
        await stream.sleep(HEARTBEAT_MS);
        if (!stream.aborted) await stream.writeSSE({ event: "ping", data: String(clock.now()) });
      }
      unsubscribe();
    });
  });

  app.route("/api", authed);
  app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

  // Production: the web build, with the SPA's index.html for every other path.
  const index = join(config.webDist, "index.html");
  if (existsSync(index)) {
    const html = readFileSync(index, "utf8");
    app.use("/*", serveStatic({ root: relative(process.cwd(), config.webDist) || "." }));
    app.get("*", (c) => c.html(html));
  }
  return app;
}
