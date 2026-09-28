/**
 * The game service: every read and write of a base goes through here, each in
 * one SQLite transaction (better-sqlite3 is synchronous, so a transaction can
 * never interleave with another request).
 *
 * - `look`: settle to now, save if anything changed, report what happened while away.
 * - `command`: idempotent by the client's key (D59): the first run stores its
 *   response, a replay returns exactly that response and changes nothing.
 * - `tick`: settle every base whose next timed event is due, so builds and
 *   crafts land (and are pushed) even when nobody is looking.
 */
import { randomInt } from "node:crypto";
import type { Content } from "@wipe-day/content/schema";
import { accrued, type BaseState, newBase } from "@wipe-day/domain/base";
import type { Clock } from "@wipe-day/domain/clock";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import type { GameEvent } from "@wipe-day/domain/events";
import { normalizeState } from "@wipe-day/domain/normalize";
import { nextEventAt, settleAll } from "@wipe-day/domain/settle";
import type {
  CommandResponse,
  PlayerView,
  PushMessage,
  StateResponse,
  WelcomeBack,
} from "@wipe-day/domain/wire";
import { and, eq, gt, inArray, isNull, lt, lte } from "drizzle-orm";
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
}

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

  private log(playerId: number, seasonId: number, events: GameEvent[], now: number): void {
    for (const event of events) {
      const { type, ...payload } = event;
      this.db
        .insert(eventLog)
        .values({ at: now, playerId, seasonId, type, payload: JSON.stringify(payload) })
        .run();
    }
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
    const response = this.db.transaction(() => {
      const { lastSeenAt, ...player } = this.player(playerId);
      const loaded = this.load(playerId, now);
      const settled = settleAll(this.deps.content, loaded.state, now);
      let version = loaded.version;
      if (!loaded.stored || JSON.stringify(settled.state) !== JSON.stringify(loaded.state)) {
        version = this.save(playerId, loaded, settled.state, now);
        this.log(playerId, loaded.seasonId, settled.events, now);
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
      this.log(playerId, loaded.seasonId, result.events, now);
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
      this.db.transaction(() => {
        const loaded = this.load(playerId, now);
        if (!loaded.stored) return;
        const settled = settleAll(this.deps.content, loaded.state, now);
        const version = this.save(playerId, loaded, settled.state, now);
        this.log(playerId, loaded.seasonId, settled.events, now);
        push = {
          version,
          serverNow: now,
          state: settled.state,
          events: settled.events,
          origin: null,
        };
      });
      if (push) {
        this.deps.hub.publish(playerId, push);
        changed.push(playerId);
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
