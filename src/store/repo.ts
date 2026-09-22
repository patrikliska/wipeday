/**
 * Repositories: the only place that knows table shapes. Everything is
 * synchronous (better-sqlite3), which is what makes "one click = one
 * transaction" trivial: `db.transaction(() => { ... })`.
 */
import { and, eq, isNull, lte } from "drizzle-orm";
import type { Amounts } from "../content/schema";
import type { ActiveState } from "../domain/active";
import type { BaseState } from "../domain/base";
import type { Tier } from "../ui/theme";
import type { Db } from "./db";
import {
  bases,
  eventLog,
  furnaceJobs,
  hints,
  homeMessages,
  inventoryItems,
  players,
  resources,
  seasons,
} from "./schema";

export interface Player {
  id: number;
  discordId: string;
  displayName: string;
  createdAt: number;
}

export interface Season {
  id: number;
  startedAt: number;
}

export interface HomeMessage {
  channelId: string;
  messageId: string;
}

export const playersRepo = {
  byDiscordId(db: Db, discordId: string): Player | null {
    return db.select().from(players).where(eq(players.discordId, discordId)).get() ?? null;
  },
  byId(db: Db, id: number): Player | null {
    return db.select().from(players).where(eq(players.id, id)).get() ?? null;
  },
  create(db: Db, discordId: string, displayName: string, now: number): Player {
    return db.insert(players).values({ discordId, displayName, createdAt: now }).returning().get();
  },
  rename(db: Db, id: number, displayName: string): void {
    db.update(players).set({ displayName }).where(eq(players.id, id)).run();
  },
};

export const seasonsRepo = {
  /** The running season, started on demand: Phase 6 adds real season control. */
  current(db: Db, now: number): Season {
    const running = db.select().from(seasons).where(isNull(seasons.endedAt)).get();
    if (running) return running;
    return db.insert(seasons).values({ startedAt: now }).returning().get();
  },
};

/** Rows from before Phase 2b have no active state; they get a fresh one. */
function parseActive(json: string | null): ActiveState {
  const fallback: ActiveState = {
    nodeRun: null,
    barrel: null,
    nextBarrelAt: 0,
    tasks: { day: -1, ids: [], progress: {}, done: [] },
  };
  if (!json) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(json) as Partial<ActiveState>) };
  } catch {
    return fallback;
  }
}

export const basesRepo = {
  load(db: Db, playerId: number): BaseState | null {
    const row = db.select().from(bases).where(eq(bases.playerId, playerId)).get();
    if (!row) return null;
    const stock: Amounts = {};
    for (const entry of db.select().from(resources).where(eq(resources.playerId, playerId)).all()) {
      stock[entry.resourceId] = entry.amount;
    }
    const items: Record<string, number> = {};
    for (const entry of db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.playerId, playerId))
      .all()) {
      items[entry.itemId] = entry.count;
    }
    const jobs = db
      .select()
      .from(furnaceJobs)
      .where(eq(furnaceJobs.playerId, playerId))
      .orderBy(furnaceJobs.id)
      .all()
      .map(({ input, output, amount, startedAt, collected }) => ({
        input,
        output,
        amount,
        startedAt,
        collected,
      }));
    return {
      tier: row.tier as Tier,
      toolId: row.toolId,
      stock,
      lastCollectedAt: row.lastCollectedAt,
      lastGatherAt: row.lastGatherAt,
      build:
        row.buildTier !== null && row.buildEndsAt !== null
          ? { tier: row.buildTier as Tier, endsAt: row.buildEndsAt }
          : null,
      upkeepPaidUntil: row.upkeepPaidUntil,
      furnaceId: row.furnaceId,
      furnaceJobs: jobs,
      items,
      ...parseActive(row.activeJson),
    };
  },

  save(db: Db, playerId: number, seasonId: number, state: BaseState): void {
    const row = {
      seasonId,
      tier: state.tier,
      toolId: state.toolId,
      lastCollectedAt: state.lastCollectedAt,
      lastGatherAt: state.lastGatherAt,
      buildTier: state.build?.tier ?? null,
      buildEndsAt: state.build?.endsAt ?? null,
      upkeepPaidUntil: state.upkeepPaidUntil,
      furnaceId: state.furnaceId,
      activeJson: JSON.stringify({
        nodeRun: state.nodeRun,
        barrel: state.barrel,
        nextBarrelAt: state.nextBarrelAt,
        tasks: state.tasks,
      } satisfies ActiveState),
    };
    db.insert(bases)
      .values({ playerId, ...row })
      .onConflictDoUpdate({ target: bases.playerId, set: row })
      .run();
    for (const [resourceId, amount] of Object.entries(state.stock)) {
      db.insert(resources)
        .values({ playerId, resourceId, amount })
        .onConflictDoUpdate({
          target: [resources.playerId, resources.resourceId],
          set: { amount },
        })
        .run();
    }
    for (const [itemId, count] of Object.entries(state.items)) {
      db.insert(inventoryItems)
        .values({ playerId, itemId, count })
        .onConflictDoUpdate({
          target: [inventoryItems.playerId, inventoryItems.itemId],
          set: { count },
        })
        .run();
    }
    // Jobs are few and short-lived: replace the set wholesale.
    db.delete(furnaceJobs).where(eq(furnaceJobs.playerId, playerId)).run();
    for (const job of state.furnaceJobs) {
      db.insert(furnaceJobs)
        .values({ playerId, ...job })
        .run();
    }
  },

  /** Players whose base has something that ends at or before `now` (builds, furnace jobs). */
  withPendingEndsBefore(db: Db, now: number): number[] {
    const building = db
      .select({ playerId: bases.playerId })
      .from(bases)
      .where(lte(bases.buildEndsAt, now))
      .all()
      .map((row) => row.playerId);
    return [...new Set(building)];
  },
};

export const hintsRepo = {
  uses(db: Db, playerId: number): Record<string, number> {
    const out: Record<string, number> = {};
    for (const row of db.select().from(hints).where(eq(hints.playerId, playerId)).all()) {
      out[row.hint] = row.uses;
    }
    return out;
  },
  bump(db: Db, playerId: number, hint: string): void {
    const current = db
      .select()
      .from(hints)
      .where(and(eq(hints.playerId, playerId), eq(hints.hint, hint)))
      .get();
    db.insert(hints)
      .values({ playerId, hint, uses: 1 })
      .onConflictDoUpdate({
        target: [hints.playerId, hints.hint],
        set: { uses: (current?.uses ?? 0) + 1 },
      })
      .run();
  },
};

export const homeMessagesRepo = {
  get(db: Db, playerId: number): HomeMessage | null {
    const row = db.select().from(homeMessages).where(eq(homeMessages.playerId, playerId)).get();
    return row ? { channelId: row.channelId, messageId: row.messageId } : null;
  },
  set(db: Db, playerId: number, home: HomeMessage, now: number): void {
    const row = { ...home, updatedAt: now };
    db.insert(homeMessages)
      .values({ playerId, ...row })
      .onConflictDoUpdate({ target: homeMessages.playerId, set: row })
      .run();
  },
  clear(db: Db, playerId: number): void {
    db.delete(homeMessages).where(eq(homeMessages.playerId, playerId)).run();
  },
};

export const eventLogRepo = {
  append(
    db: Db,
    entry: {
      at: number;
      playerId: number | null;
      seasonId: number | null;
      type: string;
      payload: unknown;
    },
  ): void {
    db.insert(eventLog)
      .values({ ...entry, payload: JSON.stringify(entry.payload ?? {}) })
      .run();
  },
};
