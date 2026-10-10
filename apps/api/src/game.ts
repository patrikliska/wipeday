/**
 * The game service: every read and write of a base goes through here, each in one SQLite
 * transaction (better-sqlite3 is synchronous, so a transaction can never interleave with
 * another request).
 *
 * - `look`: settle to now, save if anything beyond time moved, answer with the base.
 * - `command`: idempotent by the client's key (D59, D134). Every command keeps an outcome-only
 *   record (never the state): taps and pings for 1 hour on the slim path (no `event_log` row,
 *   a version-only push to the other tabs), everything else for 7 days. A replay returns the
 *   stored outcome with the base as it is now.
 * - `tick`: settle every base whose next timed event is due (the Night Shift's end), so it is
 *   logged and the player's phone gets the notification they turned on; prune old records.
 * - `feed`: the happenings worth telling everyone, newest first; empty until R2's Wipe Days.
 *
 * A stored base of an older shape (every W-phase base) is replaced by a fresh v2 base, saved in
 * place with the version raised, and `base_reset` is logged (D133): the cut-over's safety net.
 */
import { randomInt } from "node:crypto";
import type { Content } from "@wipe-day/content/schema";
import { assertFiniteState } from "@wipe-day/domain/amount";
import type { Clock } from "@wipe-day/domain/clock";
import { applyCommand, type Command, isSlim } from "@wipe-day/domain/commands";
import { type GameEvent, isLogged } from "@wipe-day/domain/events";
import { FEED_TYPES, type FeedItem, isFeedWorthy } from "@wipe-day/domain/feed";
import { normalizeState } from "@wipe-day/domain/normalize";
import { nextEventAt, settle } from "@wipe-day/domain/settle";
import { type BaseState, newBase } from "@wipe-day/domain/state";
import type {
  CommandOutcome,
  CommandResponse,
  PlayerView,
  PushMessage,
  StateResponse,
} from "@wipe-day/domain/wire";
import { and, desc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";
import type { EventHub } from "./hub";
import type { Db } from "./store/db";
import { bases, commands, eventLog, players, seasons } from "./store/schema";
import { putSetting, setting } from "./store/settings";

/** How long a command's outcome is kept (D134): taps and pings 1 hour, the rest 7 days. */
export const SLIM_TTL = 3600;
export const COMMAND_TTL = 7 * 86400;

export type { CommandResponse, PlayerView, PushMessage, StateResponse };

export interface GameDeps {
  db: Db;
  content: Content;
  clock: Clock;
  hub: EventHub;
  /** Seed for a new base; random in production, fixed in tests. */
  newSeed?: () => number;
  /** Pings a player's devices about what the scheduler settled (Web Push, DMs); optional. */
  notify?: (playerId: number, events: GameEvent[]) => Promise<unknown>;
}

type SeasonRow = typeof seasons.$inferSelect;

/** Feed items per page. */
export const FEED_PAGE = 40;
/** W8: the Discord channel's cursor in `settings`, and how much it catches up on. */
const FEED_CURSOR = "discord_feed";
const FEED_REPLAY = 20;
const FEED_REPLAY_SECONDS = 86400;

interface Loaded {
  seasonId: number;
  state: BaseState;
  version: number;
  /** False when the row does not exist yet. */
  stored: boolean;
  /** The stored row was of an older shape and this is a fresh base in its place. */
  reset: number | null;
}

/** What a transaction leaves to do once it has committed: pushes, broadcasts, pings. */
interface Outbox {
  pushes: { playerId: number; message: PushMessage }[];
  feed: FeedItem[];
  notify: { playerId: number; events: GameEvent[] }[];
}

const outbox = (): Outbox => ({ pushes: [], feed: [], notify: [] });

export class Game {
  constructor(private readonly deps: GameDeps) {}

  private get db(): Db {
    return this.deps.db;
  }

  /** The one perpetual season row (D128), created on first use. */
  private currentSeason(now: number): SeasonRow {
    const running = this.db.select().from(seasons).where(isNull(seasons.endedAt)).get();
    if (running) return running;
    return this.db.insert(seasons).values({ startedAt: now }).returning().get();
  }

  private load(playerId: number, now: number): Loaded {
    const season = this.currentSeason(now);
    const row = this.db
      .select()
      .from(bases)
      .where(and(eq(bases.playerId, playerId), eq(bases.seasonId, season.id)))
      .get();
    const seed = () => this.deps.newSeed?.() ?? randomInt(1, 2 ** 31);
    if (!row) {
      const state = newBase(this.deps.content, now, seed());
      return { seasonId: season.id, state, version: 0, stored: false, reset: null };
    }
    const parsed: unknown = JSON.parse(row.stateJson);
    const state = normalizeState(this.deps.content, parsed);
    if (state)
      return { seasonId: season.id, state, version: row.version, stored: true, reset: null };
    const from = (parsed as { v?: unknown }).v;
    return {
      seasonId: season.id,
      state: newBase(this.deps.content, now, seed()),
      version: row.version,
      stored: true,
      reset: typeof from === "number" ? from : 1,
    };
  }

  private save(playerId: number, loaded: Loaded, state: BaseState, now: number): number {
    // JSON.stringify would write Infinity as null: refuse, and the transaction rolls back (D130).
    assertFiniteState(state);
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

  /** Writes the rare events to the log (D143) and collects the feed lines into `out`. */
  private log(
    playerId: number,
    seasonId: number,
    events: GameEvent[],
    now: number,
    out: Outbox,
  ): void {
    let playerName: string | null = null;
    for (const event of events) {
      if (!isLogged(event)) continue;
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
    }
  }

  /** Sends what a committed transaction left behind. */
  private flush(out: Outbox): void {
    for (const { playerId, message } of out.pushes) this.deps.hub.publish(playerId, message);
    this.deps.hub.broadcast(out.feed);
    for (const { playerId, events } of out.notify) void this.deps.notify?.(playerId, events);
  }

  /** The feed, newest first; `before` pages back by item id. */
  feed(before?: number, limit = FEED_PAGE): FeedItem[] {
    const types: readonly string[] = FEED_TYPES;
    if (types.length === 0) return [];
    const rows = this.db
      .select({ row: eventLog, name: players.name })
      .from(eventLog)
      .innerJoin(players, eq(players.id, eventLog.playerId))
      .where(
        and(
          inArray(eventLog.type, [...types]),
          before !== undefined ? lt(eventLog.id, before) : undefined,
        ),
      )
      .orderBy(desc(eventLog.id))
      .limit(limit)
      .all();
    const items: FeedItem[] = [];
    for (const { row, name } of rows) {
      const event = { type: row.type, ...JSON.parse(row.payload) } as GameEvent;
      if (isFeedWorthy(event)) {
        items.push({
          id: row.id,
          at: row.at,
          playerId: row.playerId ?? 0,
          playerName: name,
          event,
        });
      }
    }
    return items;
  }

  /**
   * W8: the feed items the Discord channel missed while the bot was away (after its cursor),
   * oldest first: the newest `FEED_REPLAY`, from the last `FEED_REPLAY_SECONDS`. The first
   * time, the cursor starts at the newest log row, so the channel never gets old history.
   */
  feedMissed(): FeedItem[] {
    const stored = setting(this.db, FEED_CURSOR);
    if (stored === undefined) {
      const newest = this.db
        .select({ id: eventLog.id })
        .from(eventLog)
        .orderBy(desc(eventLog.id))
        .limit(1)
        .get();
      putSetting(this.db, FEED_CURSOR, String(newest?.id ?? 0));
      return [];
    }
    const cursor = Number(stored) || 0;
    const since = this.deps.clock.now() - FEED_REPLAY_SECONDS;
    return this.feed(undefined, FEED_PAGE)
      .filter((item) => item.id > cursor && item.at >= since)
      .slice(0, FEED_REPLAY)
      .reverse();
  }

  /** W8: the bot posted the feed up to `id`. */
  ackFeed(id: number): void {
    const cursor = Number(setting(this.db, FEED_CURSOR)) || 0;
    if (id > cursor) putSetting(this.db, FEED_CURSOR, String(id));
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
   * Settles a base to `now` inside the caller's transaction and saves it when anything beyond
   * time moved (an event, a buff that ran out, a new or reset base). Pure accrual is not saved:
   * settle is path-independent, so the next look computes the same.
   */
  private settleStored(
    playerId: number,
    now: number,
    out: Outbox,
    notify = false,
  ): { loaded: Loaded; state: BaseState; version: number } {
    const loaded = this.load(playerId, now);
    const settled = settle(this.deps.content, loaded.state, now);
    let version = loaded.version;
    if (!loaded.stored || loaded.reset !== null || settled.changed) {
      version = this.save(playerId, loaded, settled.state, now);
      const events: GameEvent[] =
        loaded.reset !== null ? [{ type: "base_reset", from: loaded.reset }] : [];
      events.push(...settled.events);
      this.log(playerId, loaded.seasonId, events, now, out);
      if (loaded.stored) {
        out.pushes.push({
          playerId,
          message: { version, serverNow: now, state: settled.state, events, origin: null },
        });
        if (notify) out.notify.push({ playerId, events });
      }
    }
    return { loaded, state: settled.state, version };
  }

  /** `GET /state`: settle, save if needed. `seen` false (the Discord bot) leaves lastSeenAt. */
  look(playerId: number, seen = true): StateResponse {
    const now = this.deps.clock.now();
    const out = outbox();
    const response = this.db.transaction(() => {
      const { lastSeenAt: _last, ...player } = this.player(playerId);
      const { state, version } = this.settleStored(playerId, now, out);
      if (seen) this.seen(playerId, now);
      return { serverNow: now, version, player, state, welcomeBack: null };
    });
    this.flush(out);
    return response;
  }

  /**
   * Runs `command` once per `key`. A replayed key returns the stored outcome with the base as it
   * is now (D134): no record holds a state, and the client adopts whatever state arrives.
   */
  command(playerId: number, key: string, command: Command, seen = true): CommandResponse {
    const now = this.deps.clock.now();
    const out = outbox();
    const response = this.db.transaction((): CommandResponse => {
      const stored = this.db
        .select()
        .from(commands)
        .where(and(eq(commands.playerId, playerId), eq(commands.key, key)))
        .get();
      if (stored && (stored.expiresAt ?? stored.at + COMMAND_TTL) > now) {
        const outcome = JSON.parse(stored.resultJson) as CommandOutcome;
        const { state, version } = this.settleStored(playerId, now, out);
        return { ...outcome, version, serverNow: now, state, events: [], replay: true };
      }

      const loaded = this.load(playerId, now);
      const result = applyCommand(this.deps.content, loaded.state, command, now);
      const changed = !loaded.stored || loaded.reset !== null || result.changed;
      const version = changed ? this.save(playerId, loaded, result.state, now) : loaded.version;
      const logged: GameEvent[] =
        loaded.reset !== null ? [{ type: "base_reset", from: loaded.reset }] : [];
      logged.push(...result.events);
      this.log(playerId, loaded.seasonId, logged, now, out);

      const slim = isSlim(command);
      const tapped = result.events.find((event) => event.type === "tapped");
      const credited = tapped?.type === "tapped" ? tapped.credited : 0;
      const outcome: CommandOutcome = result.ok
        ? slim
          ? { ok: true, version, credited }
          : { ok: true, version, events: result.events }
        : { ok: false, version, refusal: result.refusal };
      if (stored) {
        this.db
          .delete(commands)
          .where(and(eq(commands.playerId, playerId), eq(commands.key, key)))
          .run();
      }
      this.db
        .insert(commands)
        .values({
          playerId,
          key,
          resultJson: JSON.stringify(outcome),
          at: now,
          expiresAt: now + (slim ? SLIM_TTL : COMMAND_TTL),
        })
        .run();
      if (seen) this.seen(playerId, now);
      if (changed) {
        // Other tabs: a slim command sends the version only; they refetch the state.
        out.pushes.push({
          playerId,
          message: slim
            ? { version, serverNow: now, events: [], origin: key }
            : { version, serverNow: now, state: result.state, events: result.events, origin: key },
        });
      }
      return { ...outcome, serverNow: now, state: result.state, events: result.events };
    });
    this.flush(out);
    return response;
  }

  /**
   * Settles every base whose next timed event is due and pushes the result, then drops command
   * records past their time. Returns the players changed.
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
      .where(
        or(
          lt(commands.expiresAt, now),
          and(isNull(commands.expiresAt), lt(commands.at, now - COMMAND_TTL)),
        ),
      )
      .run();
    return changed;
  }

  /** How many command records a player has (tests: N25). */
  records(playerId: number): number {
    return this.db.select().from(commands).where(eq(commands.playerId, playerId)).all().length;
  }
}
