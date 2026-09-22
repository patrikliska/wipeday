/**
 * Database schema (drizzle, SQLite).
 *
 * Conventions: every time column is UTC unix seconds; every amount is an
 * integer (no floats in the DB); Discord ids are stored as text because
 * snowflakes exceed JavaScript's safe integer range.
 *
 * Tables are added by the phase that first needs them (CLAUDE.md section 6 is
 * the full list). Phase 0 creates only what it uses plus the identity tables
 * every later table references. After editing: `pnpm db:generate`.
 */
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  discordId: text("discord_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: integer("started_at").notNull(),
  /** Null while the season is running. */
  endedAt: integer("ended_at"),
});

/** Season-layer base state: one row per player per season. See `domain/base.ts`. */
export const bases = sqliteTable("bases", {
  playerId: integer("player_id")
    .primaryKey()
    .references(() => players.id),
  seasonId: integer("season_id")
    .notNull()
    .references(() => seasons.id),
  tier: text("tier").notNull(),
  toolId: text("tool_id").notNull(),
  lastCollectedAt: integer("last_collected_at").notNull(),
  lastGatherAt: integer("last_gather_at"),
  /** Tier being built and when it lands; both null when idle. */
  buildTier: text("build_tier"),
  buildEndsAt: integer("build_ends_at"),
  upkeepPaidUntil: integer("upkeep_paid_until").notNull().default(0),
  furnaceId: text("furnace_id"),
});

/** One row per running furnace slot. */
export const furnaceJobs = sqliteTable(
  "furnace_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    input: text("input").notNull(),
    output: text("output").notNull(),
    amount: integer("amount").notNull(),
    startedAt: integer("started_at").notNull(),
    collected: integer("collected").notNull(),
  },
  (table) => [index("furnace_jobs_player").on(table.playerId)],
);

/** Inventory: item id -> count. */
export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    itemId: text("item_id").notNull(),
    count: integer("count").notNull(),
  },
  (table) => [primaryKey({ columns: [table.playerId, table.itemId] })],
);

/** Banked resources. A row exists from the moment the player first gains the resource. */
export const resources = sqliteTable(
  "resources",
  {
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    resourceId: text("resource_id").notNull(),
    amount: integer("amount").notNull(),
  },
  (table) => [primaryKey({ columns: [table.playerId, table.resourceId] })],
);

/** Onboarding hints: how often each has been acted on (hidden after two). */
export const hints = sqliteTable(
  "hints",
  {
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    hint: text("hint").notNull(),
    uses: integer("uses").notNull(),
  },
  (table) => [primaryKey({ columns: [table.playerId, table.hint] })],
);

/** The one persistent home message per player (CLAUDE.md 4.3 rule 7). */
export const homeMessages = sqliteTable("home_messages", {
  playerId: integer("player_id")
    .primaryKey()
    .references(() => players.id),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Every state-changing event, for debugging, feed narration and balance analysis. */
export const eventLog = sqliteTable(
  "event_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: integer("at").notNull(),
    playerId: integer("player_id").references(() => players.id),
    seasonId: integer("season_id").references(() => seasons.id),
    type: text("type").notNull(),
    /** JSON. */
    payload: text("payload").notNull(),
  },
  (table) => [
    index("event_log_player_at").on(table.playerId, table.at),
    index("event_log_type_at").on(table.type, table.at),
  ],
);

/**
 * Application emojis this bot has uploaded. Discord does not store a content
 * hash, so the sync keeps one here to tell "same name, new picture" apart.
 */
export const appEmojis = sqliteTable("app_emojis", {
  name: text("name").primaryKey(),
  emojiId: text("emoji_id").notNull(),
  fileHash: text("file_hash").notNull(),
  syncedAt: integer("synced_at").notNull(),
});
