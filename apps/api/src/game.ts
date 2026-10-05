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
 */
import { randomInt } from "node:crypto";
import type { Content } from "@wipe-day/content/schema";
import { accrued, type BaseState, newBase } from "@wipe-day/domain/base";
import type { Clock } from "@wipe-day/domain/clock";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import type { GameEvent } from "@wipe-day/domain/events";
import { FEED_TYPES, type FeedItem, isFeedWorthy } from "@wipe-day/domain/feed";
import { normalizeState } from "@wipe-day/domain/normalize";
import { nextEventAt, settleAll } from "@wipe-day/domain/settle";
import type {
  CommandResponse,
  PlayerView,
  PushMessage,
  StateResponse,
  WelcomeBack,
} from "@wipe-day/domain/wire";
import { and, desc, eq, gt, inArray, isNull, lt, lte } from "drizzle-orm";
import type { EventHub } from "./hub";
import type { Db } from "./store/db";
import { bases, commands, eventLog, players, seasons } from "./store/schema";

/** Away this long and `GET /state` includes a welcome-back summary. */
export const WELCOME_BACK_AFTER = 3600;
/** Stored command responses are kept this long; a replay after that runs again. */
export const COMMAND_TTL = 7 * 86400;
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
];

export type { CommandResponse, PlayerView, PushMessage, StateResponse, WelcomeBack };

export interface GameDeps {
  db: Db;
  content: Content;
  clock: Clock;
  hub: EventHub;
  /** Seed for a new base; random in production, fixed in tests. */
  newSeed?: () => number;
  /** Pings a player's devices about what the scheduler settled (W4b push); optional. */
  notify?: (playerId: number, events: GameEvent[]) => Promise<unknown>;
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

export class Game {
  constructor(private readonly deps: GameDeps) {}

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
      nextEventAt: nextEventAt(state),
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

  /** Writes the events to the log; returns the ones worth the feed, for the broadcast. */
  private log(playerId: number, seasonId: number, events: GameEvent[], now: number): FeedItem[] {
    const feed: FeedItem[] = [];
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
        feed.push({ id: row.id, at: now, playerId, playerName, event });
      }
    }
    return feed;
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

  /** `GET /state`: settle, save if anything changed, and summarise a long absence. */
  look(playerId: number): StateResponse {
    const now = this.deps.clock.now();
    let push: PushMessage | null = null;
    let feed: FeedItem[] = [];
    const response = this.db.transaction(() => {
      const { lastSeenAt, ...player } = this.player(playerId);
      const loaded = this.load(playerId, now);
      const settled = settleAll(this.deps.content, loaded.state, now);
      let version = loaded.version;
      if (!loaded.stored || JSON.stringify(settled.state) !== JSON.stringify(loaded.state)) {
        version = this.save(playerId, loaded, settled.state, now);
        feed = this.log(playerId, loaded.seasonId, settled.events, now);
        if (loaded.stored) {
          push = {
            version,
            serverNow: now,
            state: settled.state,
            events: settled.events,
            origin: null,
          };
        }
      }
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
        state: settled.state,
        welcomeBack,
      };
    });
    if (push) this.deps.hub.publish(playerId, push);
    this.deps.hub.broadcast(feed);
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
    let push: PushMessage | null = null;
    let feed: FeedItem[] = [];
    const response = this.db.transaction(() => {
      const stored = this.db
        .select()
        .from(commands)
        .where(and(eq(commands.playerId, playerId), eq(commands.key, key)))
        .get();
      if (stored) return JSON.parse(stored.resultJson) as CommandResponse;

      const loaded = this.load(playerId, now);
      const result = applyCommand(this.deps.content, loaded.state, command, now);
      const changed =
        !loaded.stored || JSON.stringify(result.state) !== JSON.stringify(loaded.state);
      const version = changed ? this.save(playerId, loaded, result.state, now) : loaded.version;
      feed = this.log(playerId, loaded.seasonId, result.events, now);
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
      if (changed)
        push = { version, serverNow: now, state: result.state, events: result.events, origin: key };
      return response;
    });
    if (push) this.deps.hub.publish(playerId, push);
    this.deps.hub.broadcast(feed);
    return response;
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
      let push: PushMessage | null = null;
      let feed: FeedItem[] = [];
      this.db.transaction(() => {
        const loaded = this.load(playerId, now);
        if (!loaded.stored) return;
        const settled = settleAll(this.deps.content, loaded.state, now);
        const version = this.save(playerId, loaded, settled.state, now);
        feed = this.log(playerId, loaded.seasonId, settled.events, now);
        push = {
          version,
          serverNow: now,
          state: settled.state,
          events: settled.events,
          origin: null,
        };
      });
      this.deps.hub.broadcast(feed);
      if (push) {
        const message: PushMessage = push;
        this.deps.hub.publish(playerId, message);
        changed.push(playerId);
        // The phone: fire and forget (the push service answers in its own time).
        void this.deps.notify?.(playerId, message.events);
      }
    }
    this.db
      .delete(commands)
      .where(lt(commands.at, now - COMMAND_TTL))
      .run();
    return changed;
  }

  /** What is waiting to be collected right now, for tests and tools. */
  pending(playerId: number): Record<string, number> {
    const now = this.deps.clock.now();
    const loaded = this.load(playerId, now);
    return accrued(this.deps.content, settleAll(this.deps.content, loaded.state, now).state, now);
  }
}
