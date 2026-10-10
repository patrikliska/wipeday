/**
 * The social layer's two outlets for what happens, decided here so the web feed, push
 * notifications and the Discord channel agree:
 *
 * - the feed: the happenings worth telling the other players. R2 adds Wipe Days and the first
 *   Armored era, R4 shared first finds, R6 the Freighter's tiers
 *   (docs/redesign/09-architecture.md 7.2); until then the feed is empty;
 * - notifications: which happenings may ping a player's phone, by kind, each opt-in per kind
 *   (CLAUDE.md 6.3 rule 11). On by default: only "Night Shift over" (D138). Quiet hours
 *   (22:00-08:00 the player's time, on by default; errata E19) hold them until 08:00.
 */
import type { GameEvent } from "./events";

/** Event types that can reach the feed: the server queries the log by these. */
export const FEED_TYPES = [] as const satisfies readonly GameEvent["type"][];

export type FeedEvent = Extract<GameEvent, { type: (typeof FEED_TYPES)[number] }>;

/** One line of the feed: who, when, what. `id` orders it (newest has the highest). */
export interface FeedItem {
  id: number;
  at: number;
  playerId: number;
  playerName: string;
  event: FeedEvent;
}

/** Whether an event is worth telling everyone. */
export function isFeedWorthy(event: GameEvent): event is FeedEvent {
  return (FEED_TYPES as readonly string[]).includes(event.type);
}

/** The kinds of notification a player can turn on, in the order the settings list them. */
export const NOTIFY_KINDS = ["night_shift_over"] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];
/** On or off per kind, and `quiet`: hold them through quiet hours. */
export type NotifyPrefs = Record<NotifyKind, boolean> & { quiet: boolean };

export const DEFAULT_NOTIFY: NotifyPrefs = { night_shift_over: true, quiet: true };

/** Quiet hours, in the player's own hours: from 22:00 to 08:00 (CLAUDE.md 6.3 rule 11). */
export const QUIET_HOURS = { from: 22, to: 8 } as const;

/** The player's hour at `t`, `offsetMinutes` east of UTC. */
const localHour = (t: number, offsetMinutes: number): number =>
  ((((t + offsetMinutes * 60) % 86_400) + 86_400) % 86_400) / 3600;

/** Whether `t` falls in quiet hours for a player `offsetMinutes` east of UTC. */
export function inQuietHours(t: number, offsetMinutes: number): boolean {
  const hour = localHour(t, offsetMinutes);
  return hour >= QUIET_HOURS.from || hour < QUIET_HOURS.to;
}

/** The second quiet hours end after `t`: the player's next 08:00. */
export function quietUntil(t: number, offsetMinutes: number): number {
  const hour = localHour(t, offsetMinutes);
  const wait = (QUIET_HOURS.to - hour + 24) % 24;
  return Math.ceil(t + wait * 3600);
}

/** Which notification kind an event is, or null when it never notifies. */
export function notifyKindOf(event: GameEvent): NotifyKind | null {
  return event.type === "night_shift_over" ? "night_shift_over" : null;
}

/** A player's stored preferences over the defaults (unknown and old kinds dropped). */
export function notifyPrefs(stored: Partial<Record<string, unknown>> | null): NotifyPrefs {
  const out = { ...DEFAULT_NOTIFY };
  for (const kind of [...NOTIFY_KINDS, "quiet"] as const) {
    const value = stored?.[kind];
    if (typeof value === "boolean") out[kind] = value;
  }
  return out;
}
