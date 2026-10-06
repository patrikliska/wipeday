/**
 * The game service: every read and write of a base goes through here, each in
 * one SQLite transaction (better-sqlite3 is synchronous, so a transaction can
 * never interleave with another request).
 *
 * - `look`: settle to now, save if anything changed, report what happened while away.
 * - `command`: idempotent by the client's key (D59): the first run stores its
 *   response, a replay returns exactly that response and changes nothing.
 * - `tick`: settle every base whose next timed event is due, so builds and
 *   crafts land (and are pushed) even when nobody is looking; the player's phone
 *   gets a notification for the kinds they turned on (W4b).
 * - `feed`: the happenings worth telling everyone, newest first (W4b); new ones are
 *   broadcast to every open tab as they are logged.
 * - The Den (W5): commands get a `World` (the casino's seed and the wheel's results
 *   from the server's secret, the shared jackpot, the listing a buyer targets); a
 *   purchase from another player is one transaction over both bases; the tables
 *   behind the board, the price history and the wheel's bets are written from the
 *   domain's events; `settleRound` spins the wheel for its bettors when a round ends.
 * - Raids (W6): NPC raids land through settling like any timer. A PvP raid is one
 *   transaction over both bases, like a sale: the defender is settled first and handed to
 *   the attacker's command as `World.target`, then the defender's half (`takeRaid`) is
 *   applied with what the attacker's report took.
 */
import { randomInt } from "node:crypto";
import type { Content } from "@wipe-day/content/schema";
import { accrued, type BaseState, newBase } from "@wipe-day/domain/base";
import { roundEndsAt } from "@wipe-day/domain/casino";
import type { Clock } from "@wipe-day/domain/clock";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import type { GameEvent } from "@wipe-day/domain/events";
import { FEED_TYPES, type FeedItem, isFeedWorthy } from "@wipe-day/domain/feed";
import { type Entry, leaderboards, seasonSummary } from "@wipe-day/domain/leaderboard";
import { type MarketListing, takeListing } from "@wipe-day/domain/market";
import { normalizeState } from "@wipe-day/domain/normalize";
import {
  hitOf,
  pvpOdds,
  pvpOpen,
  pvpStatus,
  type RaidTarget,
  takeRaid,
} from "@wipe-day/domain/raids";
import { nextEventAt, settleAll } from "@wipe-day/domain/settle";
import { recordStats } from "@wipe-day/domain/stats";
import type {
  CommandResponse,
  DenBoard,
  DenPush,
  PlayerView,
  PriceHistory,
  PushMessage,
  RaidsResponse,
  RanksResponse,
  StateResponse,
  WelcomeBack,
} from "@wipe-day/domain/wire";
import type { World } from "@wipe-day/domain/world";
import { and, desc, eq, gt, inArray, isNull, lt, lte } from "drizzle-orm";
import { Den } from "./den";
import type { EventHub } from "./hub";
import type { Db } from "./store/db";
import {
  bases,
  commands,
  eventLog,
  listings,
  players,
  seasons,
  trades,
  wheelBets,
} from "./store/schema";

/** Away this long and `GET /state` includes a welcome-back summary. */
export const WELCOME_BACK_AFTER = 3600;
/** Stored command responses are kept this long; a replay after that runs again. */
export const COMMAND_TTL = 7 * 86400;
/** Wheel bets are kept this many rounds for the table, then dropped. */
const WHEEL_BETS_KEPT = 120;
/** Event types the welcome-back summary tells about. */
const WHILE_AWAY: GameEvent["type"][] = [
  "build_done",
  "building_done",
  "building_decayed",
  "crafted",
  "mission_back",
  "region_revealed",
  "survivor_arrived",
  "item_found",
  "level_up",
  "barrel_spawned",
  "auto_collect",
  "upkeep_paid",
  "decayed",
  "sold",
  "listing_expired",
  "raid_landed",
  "raided",
];

export type { CommandResponse, PlayerView, PushMessage, StateResponse, WelcomeBack };

export interface GameDeps {
  db: Db;
  content: Content;
  clock: Clock;
  hub: EventHub;
  /** Seed for a new base; random in production, fixed in tests. */
  newSeed?: () => number;
  /** Seed for a casino roll (W5); random in production, scripted in tests. */
  rollSeed?: () => number;
  /** Pings a player's devices about what the scheduler settled (W4b push); optional. */
  notify?: (playerId: number, events: GameEvent[]) => Promise<unknown>;
  /** Runs `run` at unix time `at` (the wheel's spins); without it the minute tick does. */
  schedule?: (at: number, run: () => void) => void;
}

/** Feed items per page. */
export const FEED_PAGE = 40;

interface Loaded {
  seasonId: number;
  seasonStartedAt: number;
  state: BaseState;
  version: number;
  /** False when the row does not exist yet. */
  stored: boolean;
}

/** What a transaction leaves to do once it has committed: pushes, broadcasts, pings. */
interface Outbox {
  pushes: { playerId: number; message: PushMessage }[];
  feed: FeedItem[];
  den: DenPush[];
  notify: { playerId: number; events: GameEvent[] }[];
}

const outbox = (): Outbox => ({ pushes: [], feed: [], den: [], notify: [] });

/** The other base in a two-base transaction (a sale's seller, a raid's defender), settled. */
interface Seller {
  playerId: number;
  state: BaseState;
  loaded: Loaded;
}

export class Game {
  readonly den: Den;
  /** Rounds with a spin already scheduled. */
  private readonly scheduled = new Set<number>();

  constructor(private readonly deps: GameDeps) {
    this.den = new Den(deps.db, deps.content);
  }

  private get db(): Db {
    return this.deps.db;
  }

  /** The running season, created on first use. */
  private currentSeason(now: number): { id: number; startedAt: number } {
    const running = this.db.select().from(seasons).where(isNull(seasons.endedAt)).get();
    if (running) return { id: running.id, startedAt: running.startedAt };
    const created = this.db.insert(seasons).values({ startedAt: now }).returning().get();
    return { id: created.id, startedAt: created.startedAt };
  }

  /** What only the server knows, for one command or one settle (W5). */
  private world(playerId: number): World {
    return {
      reveal: (round) => this.den.result(round),
      jackpot: this.den.jackpot(),
      seed: this.deps.rollSeed?.() ?? randomInt(0, 2 ** 31 - 1),
      self: playerId,
    };
  }

  private load(playerId: number, now: number): Loaded {
    const season = this.currentSeason(now);
    const row = this.db
      .select()
      .from(bases)
      .where(and(eq(bases.playerId, playerId), eq(bases.seasonId, season.id)))
      .get();
    if (row) {
      return {
        seasonId: season.id,
        seasonStartedAt: season.startedAt,
        // Older shapes (W1 stations as items, `furnaceId`, `build`) convert on load.
        state: normalizeState(this.deps.content, JSON.parse(row.stateJson)),
        version: row.version,
        stored: true,
      };
    }
    const seed = this.deps.newSeed?.() ?? randomInt(1, 2 ** 31);
    return {
      seasonId: season.id,
      seasonStartedAt: season.startedAt,
      state: newBase(this.deps.content, now, seed),
      version: 0,
      stored: false,
    };
  }

  private save(playerId: number, loaded: Loaded, state: BaseState, now: number): number {
    const version = loaded.version + 1;
    const values = {
      stateJson: JSON.stringify(state),
      version,
      nextEventAt: nextEventAt(this.deps.content, state),
      updatedAt: now,
    };
    if (loaded.stored) {
      this.db
        .update(bases)
        .set(values)
        .where(and(eq(bases.playerId, playerId), eq(bases.seasonId, loaded.seasonId)))
        .run();
    } else {
      this.db
        .insert(bases)
        .values({ playerId, seasonId: loaded.seasonId, ...values })
        .run();
    }
    return version;
  }

  /**
   * Writes the events to the log and the Den's tables (the board, trades, wheel bets, the
   * jackpot); collects the feed lines and the Den's broadcasts into `out`.
   */
  private log(
    playerId: number,
    seasonId: number,
    events: GameEvent[],
    now: number,
    out: Outbox,
  ): void {
    let playerName: string | null = null;
    for (const event of events) {
      const { type, ...payload } = event;
      const row = this.db
        .insert(eventLog)
        .values({ at: now, playerId, seasonId, type, payload: JSON.stringify(payload) })
        .returning({ id: eventLog.id })
        .get();
      if (isFeedWorthy(event)) {
        playerName ??= this.player(playerId).name;
        out.feed.push({ id: row.id, at: now, playerId, playerName, event });
      }
      this.denTables(playerId, seasonId, event, now, out);
    }
  }

  /** The Den's tables follow the domain's events (W5). */
  private denTables(
    playerId: number,
    seasonId: number,
    event: GameEvent,
    now: number,
    out: Outbox,
  ): void {
    const close = (local: string, status: string) =>
      this.db
        .update(listings)
        .set({ status, closedAt: now })
        .where(
          and(
            eq(listings.sellerId, playerId),
            eq(listings.seasonId, seasonId),
            eq(listings.localId, local),
          ),
        )
        .run();
    switch (event.type) {
      case "listed": {
        const { listing } = event;
        this.db
          .insert(listings)
          .values({
            seasonId,
            sellerId: playerId,
            localId: listing.id,
            good: listing.good,
            amount: listing.amount,
            price: listing.price,
            listedAt: listing.listedAt,
            expiresAt: listing.expiresAt,
            status: "open",
          })
          .run();
        out.den.push({ kind: "board" });
        break;
      }
      case "listing_cancelled":
        close(event.listing, "cancelled");
        out.den.push({ kind: "board" });
        break;
      case "listing_expired":
        close(event.listing, "expired");
        out.den.push({ kind: "board" });
        break;
      case "den_bought":
        if (event.good !== "blueprint") {
          this.db
            .insert(trades)
            .values({
              seasonId,
              good: event.good,
              amount: event.amount,
              price: event.price,
              at: now,
              buyerId: playerId,
            })
            .run();
        }
        break;
      case "contract_done":
        this.db
          .insert(trades)
          .values({
            seasonId,
            good: event.good,
            amount: event.amount,
            price: event.pay,
            at: now,
            sellerId: playerId,
          })
          .run();
        break;
      case "wheel_bet": {
        this.db
          .insert(wheelBets)
          .values({ round: event.round, playerId, segment: event.segment, amount: event.amount })
          .run();
        out.den.push({
          kind: "bet",
          bet: { ...event, playerId, name: this.player(playerId).name },
        });
        this.scheduleSpin(event.round);
        break;
      }
      case "wager":
        if (event.feed > 0) {
          const jackpot = this.den.jackpot() + event.feed;
          this.den.setJackpot(jackpot);
          out.den.push({ kind: "jackpot", jackpot });
        }
        break;
      case "jackpot_won":
        this.den.setJackpot(0);
        out.den.push({ kind: "jackpot", jackpot: 0 });
        break;
      default:
        break;
    }
  }

  /** Sends what a committed transaction left behind. */
  private flush(out: Outbox): void {
    for (const { playerId, message } of out.pushes) this.deps.hub.publish(playerId, message);
    this.deps.hub.broadcast(out.feed);
    for (const message of out.den) this.deps.hub.broadcastDen(message);
    for (const { playerId, events } of out.notify) void this.deps.notify?.(playerId, events);
  }

  /** The feed for the running season, newest first; `before` pages back by item id. */
  feed(before?: number, limit = FEED_PAGE): FeedItem[] {
    const now = this.deps.clock.now();
    const season = this.currentSeason(now);
    const items: FeedItem[] = [];
    let cursor = before;
    // Rows of the feed's types that are not worth it (a failed trip) are skipped: page on.
    for (let page = 0; page < 5 && items.length < limit; page++) {
      const rows = this.db
        .select({ row: eventLog, name: players.name })
        .from(eventLog)
        .innerJoin(players, eq(players.id, eventLog.playerId))
        .where(
          and(
            eq(eventLog.seasonId, season.id),
            inArray(eventLog.type, [...FEED_TYPES]),
            cursor !== undefined ? lt(eventLog.id, cursor) : undefined,
          ),
        )
        .orderBy(desc(eventLog.id))
        .limit(limit * 2)
        .all();
      for (const { row, name } of rows) {
        const event = { type: row.type, ...JSON.parse(row.payload) } as GameEvent;
        if (isFeedWorthy(event) && items.length < limit) {
          items.push({
            id: row.id,
            at: row.at,
            playerId: row.playerId ?? 0,
            playerName: name,
            event,
          });
        }
      }
      if (rows.length < limit * 2) break;
      cursor = rows.at(-1)?.row.id;
    }
    return items;
  }

  private player(playerId: number): PlayerView & { lastSeenAt: number } {
    const row = this.db.select().from(players).where(eq(players.id, playerId)).get();
    if (!row) throw new Error(`unknown player ${playerId}`);
    return { id: row.id, name: row.name, avatarUrl: row.avatarUrl, lastSeenAt: row.lastSeenAt };
  }

  private seen(playerId: number, now: number): void {
    this.db.update(players).set({ lastSeenAt: now }).where(eq(players.id, playerId)).run();
  }

  /**
   * Settles a stored base to `now` and saves it when anything changed, inside the caller's
   * transaction; the push and the log go to `out`. Returns the settled base and its version.
   */
  private settleStored(
    playerId: number,
    now: number,
    out: Outbox,
    notify = false,
  ): { loaded: Loaded; state: BaseState; version: number; events: GameEvent[] } {
    const loaded = this.load(playerId, now);
    const settled = settleAll(this.deps.content, loaded.state, now, this.world(playerId));
    let version = loaded.version;
    if (!loaded.stored || JSON.stringify(settled.state) !== JSON.stringify(loaded.state)) {
      version = this.save(playerId, loaded, settled.state, now);
      this.log(playerId, loaded.seasonId, settled.events, now, out);
      if (loaded.stored) {
        out.pushes.push({
          playerId,
          message: {
            version,
            serverNow: now,
            state: settled.state,
            events: settled.events,
            origin: null,
          },
        });
        if (notify) out.notify.push({ playerId, events: settled.events });
      }
    }
    return { loaded, state: settled.state, version, events: settled.events };
  }

  /** `GET /state`: settle, save if anything changed, and summarise a long absence. */
  look(playerId: number): StateResponse {
    const now = this.deps.clock.now();
    const out = outbox();
    const response = this.db.transaction(() => {
      const { lastSeenAt, ...player } = this.player(playerId);
      const { loaded, state, version } = this.settleStored(playerId, now, out);
      const away = now - lastSeenAt;
      const welcomeBack =
        loaded.stored && away >= WELCOME_BACK_AFTER
          ? { awaySeconds: away, events: this.eventsSince(playerId, lastSeenAt) }
          : null;
      this.seen(playerId, now);
      return {
        serverNow: now,
        version,
        player,
        seasonStartedAt: loaded.seasonStartedAt,
        state,
        welcomeBack,
      };
    });
    this.flush(out);
    return response;
  }

  private eventsSince(playerId: number, since: number): GameEvent[] {
    return this.db
      .select()
      .from(eventLog)
      .where(
        and(
          eq(eventLog.playerId, playerId),
          gt(eventLog.at, since),
          inArray(eventLog.type, WHILE_AWAY),
        ),
      )
      .orderBy(eventLog.id)
      .all()
      .map((row) => ({ type: row.type, ...JSON.parse(row.payload) }) as GameEvent);
  }

  /**
   * Runs `command` once per `key`. A replayed key returns the stored response,
   * whatever the base looks like now: the client sees the same answer twice.
   */
  command(playerId: number, key: string, command: Command): CommandResponse {
    const now = this.deps.clock.now();
    const out = outbox();
    const response = this.db.transaction(() => {
      const stored = this.db
        .select()
        .from(commands)
        .where(and(eq(commands.playerId, playerId), eq(commands.key, key)))
        .get();
      if (stored) return JSON.parse(stored.resultJson) as CommandResponse;

      const loaded = this.load(playerId, now);
      const world = this.world(playerId);
      // A purchase from another player: settle the seller first (an expired listing goes
      // home), and only offer the listing to the buyer if it is still up.
      const sale =
        command.type === "market_buy" ? this.saleOf(command.listing, playerId, now, out) : null;
      if (sale) world.listing = sale.listing;
      // A raid on another player (W6): settle the defender first, then hand it to the domain.
      const raid =
        command.type === "raid_player"
          ? this.raidOf(command.target, playerId, loaded.state, now, out)
          : null;
      if (raid) {
        world.target = raid.target;
        world.selfName = this.player(playerId).name;
      }
      const result = applyCommand(this.deps.content, loaded.state, command, now, world);
      const changed =
        !loaded.stored || JSON.stringify(result.state) !== JSON.stringify(loaded.state);
      const version = changed ? this.save(playerId, loaded, result.state, now) : loaded.version;
      this.log(playerId, loaded.seasonId, result.events, now, out);
      if (result.ok && sale?.seller)
        this.completeSale(sale.listing, sale.seller, playerId, now, out);
      const launched = result.events.find((event) => event.type === "raid_launched");
      if (result.ok && raid?.defender && launched?.type === "raid_launched")
        this.completeRaid(
          raid.defender,
          hitOf(launched.report, playerId, world.selfName ?? ""),
          now,
          out,
        );
      const response: CommandResponse = result.ok
        ? { ok: true, serverNow: now, version, state: result.state, events: result.events }
        : {
            ok: false,
            serverNow: now,
            version,
            state: result.state,
            events: result.events,
            refusal: result.refusal,
          };
      this.db
        .insert(commands)
        .values({ playerId, key, resultJson: JSON.stringify(response), at: now })
        .run();
      this.seen(playerId, now);
      if (changed) {
        out.pushes.push({
          playerId,
          message: {
            version,
            serverNow: now,
            state: result.state,
            events: result.events,
            origin: key,
          },
        });
      }
      return response;
    });
    this.flush(out);
    return response;
  }

  /**
   * The listing a buyer names, as the board shows it, with the seller's base settled to now;
   * null when it is not up any more. The buyer's own listing comes without a seller: the
   * domain refuses it with the listing in hand.
   */
  private saleOf(
    listingId: number,
    buyerId: number,
    now: number,
    out: Outbox,
  ): { listing: MarketListing; seller: Seller | null } | null {
    const row = this.den.listing(listingId);
    if (row?.status !== "open") return null;
    const { status: _status, seasonId: _season, ...listing } = row;
    if (row.seller === buyerId) return { listing, seller: null };
    const settled = this.settleStored(row.seller, now, out);
    const still = settled.state.listings.some(
      (candidate) => candidate.id === row.local && candidate.expiresAt > now,
    );
    if (!still) return null;
    return {
      listing,
      seller: {
        playerId: row.seller,
        state: settled.state,
        loaded: { ...settled.loaded, version: settled.version, stored: true },
      },
    };
  }

  /** Pays the seller, closes the row and records the trade: the buyer already paid. */
  private completeSale(
    listing: MarketListing,
    seller: Seller,
    buyerId: number,
    now: number,
    out: Outbox,
  ): void {
    const taken = takeListing(seller.state, listing.local, now);
    if (!taken.ok) throw new Error(`listing ${listing.id} vanished inside the sale`);
    const state = recordStats(taken.state, taken.events, now);
    const version = this.save(seller.playerId, seller.loaded, state, now);
    this.log(seller.playerId, seller.loaded.seasonId, taken.events, now, out);
    this.db
      .update(listings)
      .set({ status: "sold", buyerId, closedAt: now })
      .where(eq(listings.id, listing.id))
      .run();
    this.db
      .insert(trades)
      .values({
        seasonId: seller.loaded.seasonId,
        good: listing.good,
        amount: listing.amount,
        price: listing.price,
        at: now,
        sellerId: seller.playerId,
        buyerId,
      })
      .run();
    out.den.push({ kind: "board" });
    out.pushes.push({
      playerId: seller.playerId,
      message: { version, serverNow: now, state, events: taken.events, origin: null },
    });
    out.notify.push({ playerId: seller.playerId, events: taken.events });
  }

  /**
   * The base a raid names, settled to now inside the attacker's transaction; null when that
   * player has no base this season. A raid on oneself gets the attacker's own base, which
   * the domain refuses.
   */
  private raidOf(
    targetId: number,
    attackerId: number,
    attacker: BaseState,
    now: number,
    out: Outbox,
  ): { target: RaidTarget; defender: Seller | null } | null {
    const row = this.db.select().from(players).where(eq(players.id, targetId)).get();
    if (!row) return null;
    if (targetId === attackerId)
      return { target: { id: targetId, name: row.name, state: attacker }, defender: null };
    const loaded = this.load(targetId, now);
    if (!loaded.stored) return null;
    const settled = this.settleStored(targetId, now, out);
    return {
      target: { id: targetId, name: row.name, state: settled.state },
      defender: {
        playerId: targetId,
        state: settled.state,
        loaded: { ...settled.loaded, version: settled.version, stored: true },
      },
    };
  }

  /** The defender's half of a raid: the take leaves, the shield and token arrive (W6). */
  private completeRaid(
    defender: Seller,
    hit: ReturnType<typeof hitOf>,
    now: number,
    out: Outbox,
  ): void {
    const taken = takeRaid(this.deps.content, defender.state, hit, now);
    const state = recordStats(taken.state, taken.events, now);
    const version = this.save(defender.playerId, defender.loaded, state, now);
    this.log(defender.playerId, defender.loaded.seasonId, taken.events, now, out);
    out.pushes.push({
      playerId: defender.playerId,
      message: { version, serverNow: now, state, events: taken.events, origin: null },
    });
    out.notify.push({ playerId: defender.playerId, events: taken.events });
  }

  /** Asks for one spin when `round` ends (the minute tick catches any that are missed). */
  private scheduleSpin(round: number): void {
    if (!this.deps.schedule || this.scheduled.has(round)) return;
    this.scheduled.add(round);
    this.deps.schedule(roundEndsAt(this.deps.content, round), () => {
      this.scheduled.delete(round);
      this.settleRound(round);
    });
  }

  /** The wheel spun: settle everyone who bet on `round`, and tell every table the result. */
  settleRound(round: number): void {
    const now = this.deps.clock.now();
    if (now < roundEndsAt(this.deps.content, round)) return;
    for (const playerId of this.den.bettors(round)) {
      const out = outbox();
      this.db.transaction(() => {
        this.settleStored(playerId, now, out);
      });
      this.flush(out);
    }
    this.deps.hub.broadcastDen({ kind: "result", round, segment: this.den.result(round) });
  }

  /**
   * Settles every base whose next timed event is due and pushes the result.
   * Also drops stored command responses past their time. Returns the players changed.
   */
  tick(): number[] {
    const now = this.deps.clock.now();
    const due = this.db
      .select({ playerId: bases.playerId })
      .from(bases)
      .where(lte(bases.nextEventAt, now))
      .all();
    const changed: number[] = [];
    for (const { playerId } of due) {
      const out = outbox();
      this.db.transaction(() => {
        const loaded = this.load(playerId, now);
        if (!loaded.stored) return;
        this.settleStored(playerId, now, out, true);
      });
      this.flush(out);
      if (out.pushes.some((push) => push.playerId === playerId)) changed.push(playerId);
    }
    this.db
      .delete(commands)
      .where(lt(commands.at, now - COMMAND_TTL))
      .run();
    const round = Math.floor(now / this.deps.content.den.casino.wheel.roundSeconds);
    this.db
      .delete(wheelBets)
      .where(lt(wheelBets.round, round - WHEEL_BETS_KEPT))
      .run();
    return changed;
  }

  /** `GET /api/den`. */
  denBoard(): DenBoard {
    const now = this.deps.clock.now();
    return this.den.board(this.currentSeason(now).id, now);
  }

  /** `GET /api/den/history`. */
  history(good: string): PriceHistory {
    const now = this.deps.clock.now();
    return this.den.history(this.currentSeason(now).id, good, now);
  }

  /** `GET /api/ranks`: every base of the season, settled to now without saving. */
  ranks(playerId: number): RanksResponse {
    const now = this.deps.clock.now();
    const season = this.currentSeason(now);
    const rows = this.db
      .select({ base: bases, name: players.name })
      .from(bases)
      .innerJoin(players, eq(players.id, bases.playerId))
      .where(eq(bases.seasonId, season.id))
      .all();
    const entries: Entry[] = rows.map(({ base, name }) => ({
      playerId: base.playerId,
      name,
      state: settleAll(
        this.deps.content,
        normalizeState(this.deps.content, JSON.parse(base.stateJson)),
        now,
        { reveal: (round) => this.den.result(round) },
      ).state,
    }));
    const boards = leaderboards(this.deps.content, entries, now);
    const mine =
      entries.find((entry) => entry.playerId === playerId)?.state ?? this.load(playerId, now).state;
    return {
      boards,
      me: seasonSummary(this.deps.content, mine, boards, playerId, season.startedAt),
    };
  }

  /**
   * `GET /api/raids` (W6): every other holdfast in the raids, settled to now without saving,
   * with whether the player can raid it and the confirm screen's numbers.
   */
  raids(playerId: number): RaidsResponse {
    const now = this.deps.clock.now();
    const season = this.currentSeason(now);
    const settle = (stateJson: string): BaseState =>
      settleAll(this.deps.content, normalizeState(this.deps.content, JSON.parse(stateJson)), now, {
        reveal: (round) => this.den.result(round),
      }).state;
    const rows = this.db
      .select({ base: bases, name: players.name })
      .from(bases)
      .innerJoin(players, eq(players.id, bases.playerId))
      .where(eq(bases.seasonId, season.id))
      .all();
    const mineRow = rows.find(({ base }) => base.playerId === playerId);
    const me = mineRow ? settle(mineRow.base.stateJson) : this.load(playerId, now).state;
    const targets = rows
      .filter(({ base }) => base.playerId !== playerId)
      .map(({ base, name }) => ({ id: base.playerId, name, state: settle(base.stateJson) }))
      .filter(({ state }) => state.pvp.on && pvpOpen(this.deps.content, state))
      .map((target) => ({
        id: target.id,
        name: target.name,
        tier: target.state.tier,
        status: pvpStatus(this.deps.content, me, playerId, target, now),
        odds: pvpOdds(this.deps.content, me, target, now),
        shieldUntil: target.state.pvp.shieldUntil,
      }));
    return { serverNow: now, targets };
  }

  /** What is waiting to be collected right now, for tests and tools. */
  pending(playerId: number): Record<string, number> {
    const now = this.deps.clock.now();
    const loaded = this.load(playerId, now);
    return accrued(this.deps.content, settleAll(this.deps.content, loaded.state, now).state, now);
  }
}
