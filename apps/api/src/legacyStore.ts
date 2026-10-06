/**
 * The persistent layer's rows (W7): each player's legacy, and each season's Signal and its
 * gifts. Plain reads and writes inside the caller's transaction; the rules are the domain's
 * (`@wipe-day/domain/legacy`, `@wipe-day/domain/signal`).
 */
import type { Content } from "@wipe-day/content/schema";
import { type Legacy, newLegacy } from "@wipe-day/domain/legacy";
import { newSignal, type SignalProgress, stillNeeded } from "@wipe-day/domain/signal";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./store/db";
import { legacy, players, signal, signalGifts } from "./store/schema";

export function legacyOf(db: Db, playerId: number): Legacy {
  const row = db.select().from(legacy).where(eq(legacy.playerId, playerId)).get();
  return row ? { ...newLegacy(), ...(JSON.parse(row.json) as Partial<Legacy>) } : newLegacy();
}

export function saveLegacy(db: Db, playerId: number, value: Legacy, now: number): void {
  const json = JSON.stringify(value);
  db.insert(legacy)
    .values({ playerId, json, updatedAt: now })
    .onConflictDoUpdate({ target: legacy.playerId, set: { json, updatedAt: now } })
    .run();
}

export function signalOf(db: Db, seasonId: number): SignalProgress {
  const row = db.select().from(signal).where(eq(signal.seasonId, seasonId)).get();
  return row ? (JSON.parse(row.json) as SignalProgress) : newSignal();
}

export function saveSignal(db: Db, seasonId: number, progress: SignalProgress): void {
  const json = JSON.stringify(progress);
  db.insert(signal)
    .values({ seasonId, json, litAt: progress.litAt })
    .onConflictDoUpdate({ target: signal.seasonId, set: { json, litAt: progress.litAt } })
    .run();
}

export interface Giver {
  playerId: number;
  name: string;
  worth: number;
}

/** Everyone who gave to the season's Signal, the biggest first. */
export function givers(db: Db, seasonId: number): Giver[] {
  return db
    .select({
      playerId: signalGifts.playerId,
      name: players.name,
      worth: sql<number>`sum(${signalGifts.worth})`.as("worth"),
    })
    .from(signalGifts)
    .innerJoin(players, eq(players.id, signalGifts.playerId))
    .where(eq(signalGifts.seasonId, seasonId))
    .groupBy(signalGifts.playerId)
    .orderBy(desc(sql`worth`))
    .all()
    .map((row) => ({ ...row, worth: Number(row.worth) }));
}

export function recordGift(
  db: Db,
  gift: {
    seasonId: number;
    playerId: number;
    good: string;
    amount: number;
    worth: number;
    at: number;
  },
): void {
  db.insert(signalGifts).values(gift).run();
}

/** What the open stage still needs (for the panel). */
export function needs(content: Content, progress: SignalProgress): Record<string, number> {
  return stillNeeded(content, progress);
}

/** This player's gifts this season, in scrap at reference prices. */
export function givenBy(db: Db, seasonId: number, playerId: number): number {
  const row = db
    .select({ worth: sql<number>`coalesce(sum(${signalGifts.worth}), 0)` })
    .from(signalGifts)
    .where(and(eq(signalGifts.seasonId, seasonId), eq(signalGifts.playerId, playerId)))
    .get();
  return Number(row?.worth ?? 0);
}
