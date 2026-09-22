/**
 * Repositories: the only place that knows table shapes. Everything is
 * synchronous (better-sqlite3), which is what makes "one click = one
 * transaction" trivial: `db.transaction(() => { ... })`.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { Amounts } from "../content/schema";
import type { BaseState } from "../domain/base";
import type { Tier } from "../ui/theme";
import type { Db } from "./db";
import { bases, eventLog, hints, homeMessages, players, resources, seasons } from "./schema";

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

export const basesRepo = {
  load(db: Db, playerId: number): BaseState | null {
    const row = db.select().from(bases).where(eq(bases.playerId, playerId)).get();
    if (!row) return null;
    const stock: Amounts = {};
    for (const entry of db.select().from(resources).where(eq(resources.playerId, playerId)).all()) {
      stock[entry.resourceId] = entry.amount;
    }
    return {
      tier: row.tier as Tier,
      toolId: row.toolId,
      stock,
      lastCollectedAt: row.lastCollectedAt,
      lastGatherAt: row.lastGatherAt,
    };
  },

  save(db: Db, playerId: number, seasonId: number, state: BaseState): void {
    const row = {
      seasonId,
      tier: state.tier,
      toolId: state.toolId,
      lastCollectedAt: state.lastCollectedAt,
      lastGatherAt: state.lastGatherAt,
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
