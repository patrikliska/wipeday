/**
 * The HTTP surface. Every route under `/api`; in production the same process
 * also serves the web build, so the game is one origin and cookies just work.
 *
 * GET  /api/health             liveness for Docker and humans
 * GET  /api/auth/discord       start Discord login
 * GET  /api/auth/callback      finish it, set the session cookie, back to the game
 * POST /api/auth/logout
 * POST /api/dev/login          dev only: log in as test player 1, 2 or 3
 * GET  /api/me                 who is logged in (401 when nobody)
 * GET  /api/state              the base, settled to now, plus a welcome-back summary
 * POST /api/commands           {key, command}: one idempotent action
 * GET  /api/events             server-sent events: the base changed (other tab, timers)
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Clock } from "@wipe-day/domain/clock";
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
}

/** Keeps idle proxies from closing the event stream. */
const HEARTBEAT_MS = 25_000;

type Env = { Variables: { playerId: number } };

export function createApp(deps: AppDeps): Hono<Env> {
  const { db, game, hub, clock, config, discord } = deps;
  const app = new Hono<Env>();
  const cookieBase = { httpOnly: true, secure: config.production, sameSite: "Lax" as const };

  const startSession = (playerId: number): string => {
    const session = createSession(db, playerId, clock.now());
    return session.token;
  };
  const setSession = (c: Parameters<typeof setCookie>[0], token: string) =>
    setCookie(c, SESSION_COOKIE, token, { ...cookieBase, path: "/", maxAge: 30 * 86400 });

  app.get("/api/health", (c) => c.json({ ok: true, now: clock.now(), streams: hub.connections }));

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

  authed.get("/events", (c) => {
    const playerId = c.get("playerId");
    return streamSSE(c, async (stream) => {
      const unsubscribe = hub.subscribe(playerId, (message) => {
        void stream.writeSSE({ event: "state", data: JSON.stringify(message) });
      });
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
