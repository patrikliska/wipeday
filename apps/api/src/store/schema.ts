/**
 * The game server's database (drizzle, SQLite). Separate from the Discord
 * bot's database until W8 retires the bot's own store.
 *
 * Conventions: time columns are UTC unix seconds; amounts are integers; Discord
 * ids are text (snowflakes exceed JavaScript's safe integer range). A base's
 * season state is one JSON document (D62): it is always read and written whole,
 * inside one transaction per command, and `version` counts the writes.
 * After editing: `pnpm --filter @wipe-day/api db:generate`.
 */
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Discord user id, or `dev-{n}` for local test players. */
  discordId: text("discord_id").notNull().unique(),
  name: text("name").notNull(),
  /** Discord avatar URL, if the player has one. */
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at").notNull(),
  /** Last `GET /state` or command: drives the welcome-back summary. */
  lastSeenAt: integer("last_seen_at").notNull(),
});

/** Login sessions. Only the SHA-256 of the cookie token is stored. */
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("sessions_player").on(table.playerId)],
);

export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: integer("started_at").notNull(),
  /** Null while the season is running. */
  endedAt: integer("ended_at"),
});

/** One base per player per season: the domain's `BaseState` as JSON. */
export const bases = sqliteTable(
  "bases",
  {
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id),
    stateJson: text("state_json").notNull(),
    /** Incremented on every write; clients use it to spot a stale view. */
    version: integer("version").notNull(),
    /** Next moment settling changes something on its own (build, craft, barrel); null = none. */
    nextEventAt: integer("next_event_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.seasonId] }),
    index("bases_next_event").on(table.nextEventAt),
  ],
);

/** Idempotency: the stored response of every command, by the client's key (D59). */
export const commands = sqliteTable(
  "commands",
  {
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    key: text("key").notNull(),
    resultJson: text("result_json").notNull(),
    at: integer("at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.key] }),
    index("commands_at").on(table.at),
  ],
);

/** Every state change: debugging, the feed, the welcome-back summary, balance analysis. */
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
