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
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
