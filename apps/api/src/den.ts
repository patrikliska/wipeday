/**
 * The server's side of the Den (W5): what only the server may know or keep.
 *
 * - The casino secret (generated on first boot, kept in `settings` like the VAPID
 *   keys): the wheel's result for round `r` is drawn from HMAC(secret, r), so every
 *   player meets the same spin, nobody can compute it before the round ends, and a
 *   restart changes nothing.
 * - The slots' shared jackpot pool, in hundredths of scrap.
 * - The market board (open listings), the price history and the wheel's bets, read
 *   from the tables the game service writes from the domain's events.
 */
import { createHmac, randomBytes } from "node:crypto";
import type { Content } from "@wipe-day/content/schema";
import { roundOf, wheelResult } from "@wipe-day/domain/casino";
import type { MarketListing } from "@wipe-day/domain/market";
import type { DenBoard, PriceHistory, WheelBetView } from "@wipe-day/domain/wire";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import type { Db } from "./store/db";
import { listings, players, settings, trades, wheelBets } from "./store/schema";

const SECRET_KEY = "casino_secret";
const JACKPOT_KEY = "jackpot";
const DAY = 86400;
/** Spins the board shows. */
const RESULTS = 10;
/** Days of price history. */
const HISTORY_DAYS = 14;

function setting(db: Db, key: string): string | undefined {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value;
}

function putSetting(db: Db, key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export class Den {
  private readonly secret: Buffer;

  constructor(
    private readonly db: Db,
    private readonly content: Content,
  ) {
    let hex = setting(db, SECRET_KEY);
    if (!hex) {
      hex = randomBytes(32).toString("hex");
      putSetting(db, SECRET_KEY, hex);
    }
    this.secret = Buffer.from(hex, "hex");
  }

  /** Round `round`'s seed: unknowable without the secret, the same for everyone. */
  private roundSeed(round: number): number {
    return createHmac("sha256", this.secret).update(`wheel:${round}`).digest().readUInt32BE(0);
  }

  /** The wheel's segment for a round. The domain asks only for rounds that have ended. */
  result(round: number): number {
    return wheelResult(this.content, this.roundSeed(round));
  }

  /** The pool, in hundredths of scrap. */
  jackpot(): number {
    return Number(setting(this.db, JACKPOT_KEY) ?? 0);
  }

  setJackpot(hundredths: number): void {
    putSetting(this.db, JACKPOT_KEY, String(Math.max(0, Math.floor(hundredths))));
  }

  /** Open listings of the season, newest first. */
  openListings(seasonId: number): MarketListing[] {
    return this.db
      .select({ row: listings, name: players.name })
      .from(listings)
      .innerJoin(players, eq(players.id, listings.sellerId))
      .where(and(eq(listings.seasonId, seasonId), eq(listings.status, "open")))
      .orderBy(desc(listings.id))
      .all()
      .map(({ row, name }) => ({
        id: row.id,
        seller: row.sellerId,
        sellerName: name,
        local: row.localId,
        good: row.good,
        amount: row.amount,
        price: row.price,
        listedAt: row.listedAt,
        expiresAt: row.expiresAt,
      }));
  }

  listing(id: number): (MarketListing & { status: string; seasonId: number }) | null {
    const found = this.db
      .select({ row: listings, name: players.name })
      .from(listings)
      .innerJoin(players, eq(players.id, listings.sellerId))
      .where(eq(listings.id, id))
      .get();
    if (!found) return null;
    const { row, name } = found;
    return {
      id: row.id,
      seller: row.sellerId,
      sellerName: name,
      local: row.localId,
      good: row.good,
      amount: row.amount,
      price: row.price,
      listedAt: row.listedAt,
      expiresAt: row.expiresAt,
      status: row.status,
      seasonId: row.seasonId,
    };
  }

  /** Bets on rounds from `round` on (this one and the next), with the bettors' names. */
  bets(round: number): WheelBetView[] {
    return this.db
      .select({ bet: wheelBets, name: players.name })
      .from(wheelBets)
      .innerJoin(players, eq(players.id, wheelBets.playerId))
      .where(gte(wheelBets.round, round))
      .orderBy(wheelBets.id)
      .all()
      .map(({ bet, name }) => ({
        round: bet.round,
        playerId: bet.playerId,
        name,
        segment: bet.segment,
        amount: bet.amount,
      }));
  }

  /** Who bet on `round`: the players whose bases the spin settles. */
  bettors(round: number): number[] {
    const rows = this.db
      .selectDistinct({ playerId: wheelBets.playerId })
      .from(wheelBets)
      .where(eq(wheelBets.round, round))
      .all();
    return rows.map((row) => row.playerId);
  }

  board(seasonId: number, now: number): DenBoard {
    const round = roundOf(this.content, now);
    const results = Array.from({ length: RESULTS }, (_, index) => round - 1 - index).map(
      (past) => ({ round: past, segment: this.result(past) }),
    );
    return {
      serverNow: now,
      listings: this.openListings(seasonId),
      round,
      bets: this.bets(round),
      results,
      jackpot: this.jackpot(),
    };
  }

  /** What players paid per 100 units of `good`, by UTC day, over the last two weeks. */
  history(seasonId: number, good: string, now: number): PriceHistory {
    const from = (Math.floor(now / DAY) - HISTORY_DAYS + 1) * DAY;
    const rows = this.db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.seasonId, seasonId),
          eq(trades.good, good),
          gte(trades.at, from),
          // Player to player only: the Den's own prices are fixed and shown beside it.
          isNotNull(trades.sellerId),
          isNotNull(trades.buyerId),
        ),
      )
      .all();
    const byDay = new Map<number, { price: number; amount: number }>();
    for (const row of rows) {
      const day = Math.floor(row.at / DAY);
      const sum = byDay.get(day) ?? { price: 0, amount: 0 };
      byDay.set(day, { price: sum.price + row.price, amount: sum.amount + row.amount });
    }
    return {
      good,
      days: [...byDay.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([day, sum]) => ({ day, per100: (sum.price * 100) / sum.amount, amount: sum.amount })),
    };
  }
}
