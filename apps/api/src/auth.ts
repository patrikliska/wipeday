/**
 * Login (D60): Discord OAuth2 (`identify` only) through arctic, then a session
 * cookie. The cookie holds a random token; the database holds only its SHA-256,
 * so a leaked database cannot be used to log in. Sessions last 30 days and
 * slide forward while used.
 *
 * W8: the Discord bot hands out one-time login links (`/api/auth/link?t=`): ten minutes,
 * one use, then a normal session. The bot acts for players by their Discord id, so a
 * player who starts on Discord has the same base when they open the web.
 */
import { createHash, randomBytes } from "node:crypto";
import { Discord, generateState } from "arctic";
import { and, eq, gt, lte } from "drizzle-orm";
import type { Db } from "./store/db";
import { loginLinks, players, sessions } from "./store/schema";

export const SESSION_COOKIE = "wd_session";
export const STATE_COOKIE = "wd_oauth_state";
const SESSION_SECONDS = 30 * 86400;
/** Slide the expiry forward at most once a day, not on every request. */
const SLIDE_AFTER = 86400;
/** A login link from the bot works once, within this many seconds. */
export const LINK_SECONDS = 600;

export interface Identity {
  discordId: string;
  name: string;
  avatarUrl: string | null;
}

/** The Discord side of login, behind an interface so tests can stub it. */
export interface DiscordAuth {
  /** Where to send the browser, with `state` to check on the way back. */
  authorizationUrl(state: string): URL;
  /** Trades the callback's code for the player's Discord identity. */
  identify(code: string): Promise<Identity>;
}

export function discordAuth(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): DiscordAuth {
  const discord = new Discord(clientId, clientSecret, redirectUri);
  return {
    authorizationUrl: (state) => discord.createAuthorizationURL(state, null, ["identify"]),
    identify: async (code) => {
      const tokens = await discord.validateAuthorizationCode(code, null);
      const response = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokens.accessToken()}` },
      });
      if (!response.ok) throw new Error(`Discord /users/@me answered ${response.status}`);
      const user = (await response.json()) as {
        id: string;
        username: string;
        global_name?: string | null;
        avatar?: string | null;
      };
      return {
        discordId: user.id,
        name: user.global_name || user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
          : null,
      };
    },
  };
}

export const newOAuthState = (): string => generateState();

const hash = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Creates the player on first login; keeps name and avatar fresh afterwards. */
export function upsertPlayer(db: Db, identity: Identity, now: number): number {
  const existing = db.select().from(players).where(eq(players.discordId, identity.discordId)).get();
  if (existing) {
    if (existing.name === identity.name && existing.avatarUrl === identity.avatarUrl)
      return existing.id;
    db.update(players)
      .set({ name: identity.name, avatarUrl: identity.avatarUrl })
      .where(eq(players.id, existing.id))
      .run();
    return existing.id;
  }
  return db
    .insert(players)
    .values({ ...identity, createdAt: now, lastSeenAt: now })
    .returning({ id: players.id })
    .get().id;
}

export function createSession(
  db: Db,
  playerId: number,
  now: number,
): { token: string; maxAge: number } {
  const token = randomBytes(32).toString("base64url");
  db.insert(sessions)
    .values({ tokenHash: hash(token), playerId, createdAt: now, expiresAt: now + SESSION_SECONDS })
    .run();
  return { token, maxAge: SESSION_SECONDS };
}

/** The player a session token belongs to, or null when unknown or expired. */
export function sessionPlayer(db: Db, token: string | undefined, now: number): number | null {
  if (!token) return null;
  const tokenHash = hash(token);
  const row = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .get();
  if (!row) return null;
  if (row.expiresAt - now < SESSION_SECONDS - SLIDE_AFTER) {
    db.update(sessions)
      .set({ expiresAt: now + SESSION_SECONDS })
      .where(eq(sessions.tokenHash, tokenHash))
      .run();
  }
  return row.playerId;
}

export function deleteSession(db: Db, token: string | undefined): void {
  if (token)
    db.delete(sessions)
      .where(eq(sessions.tokenHash, hash(token)))
      .run();
}

/** A one-time login link's token for `playerId`; expired links are swept on the way. */
export function createLoginLink(db: Db, playerId: number, now: number): string {
  db.delete(loginLinks).where(lte(loginLinks.expiresAt, now)).run();
  const token = randomBytes(32).toString("base64url");
  db.insert(loginLinks)
    .values({ tokenHash: hash(token), playerId, expiresAt: now + LINK_SECONDS })
    .run();
  return token;
}

/** Spends a login link: the player it was for, or null when unknown, used or expired. */
export function useLoginLink(db: Db, token: string | undefined, now: number): number | null {
  if (!token) return null;
  const row = db
    .delete(loginLinks)
    .where(eq(loginLinks.tokenHash, hash(token)))
    .returning()
    .get();
  return row && row.expiresAt > now ? row.playerId : null;
}
