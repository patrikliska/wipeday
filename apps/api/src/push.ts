/**
 * Web Push (W4b): a player turns notifications on per device, picks the kinds
 * ("Night Shift over" on by default, D138), and the scheduler pings their phone
 * when something they asked about lands while they are away. Quiet hours (R1, errata E19):
 * between 22:00 and 08:00 the player's own time a notification is held, one per kind, and sent
 * at 08:00 by the scheduler (`flushHeld`). The player's time comes from the browser with the push
 * subscription; until one arrives, the island's clock stands in.
 *
 * The VAPID key pair is generated on first boot and kept in the `settings`
 * table, so nothing has to be configured on the server. Subscriptions that the
 * push service reports gone (404, 410) are dropped.
 *
 * W8: the same notifications go to the player's Discord DMs through the bot, for the kinds
 * they turned on, once they have used the bot and unless they turned DMs off.
 */
import type { Locale } from "@wipe-day/content/locale";
import { type Clock, systemClock } from "@wipe-day/domain/clock";
import type { GameEvent } from "@wipe-day/domain/events";
import {
  inQuietHours,
  type NotifyKind,
  type NotifyPrefs,
  notifyKindOf,
  notifyPrefs,
  quietUntil,
} from "@wipe-day/domain/feed";
import { eq, isNotNull } from "drizzle-orm";
import webpush from "web-push";
import type { log as Log } from "./log";
import type { Db } from "./store/db";
import { players, pushSubscriptions, settings } from "./store/schema";

export interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** What gets shown on the phone; `url` opens the game where it matters. */
export interface Notification {
  title: string;
  body: string;
  tag: string;
  url: string;
  kind: NotifyKind;
}

/** Hands a player's due notifications to the Discord bot (W8). */
export type DmSend = (discordId: string, notes: Notification[]) => void;

/** Notifications held through quiet hours, sent at `until`. */
interface Held {
  until: number;
  notes: Notification[];
}

export interface NotifierOptions {
  clock?: Clock;
  /** Minutes east of UTC for a player whose browser has not said (the island's clock). */
  defaultOffsetMinutes?: number;
}

/** Discord user ids are snowflakes; test players (`dev-1`) never get a DM. */
const SNOWFLAKE = /^\d{17,20}$/;

/** Sends one payload to one subscription; web-push in production, a stub in tests. */
export type PushSend = (
  subscription: Subscription,
  payload: string,
) => Promise<{ statusCode: number }>;

const VAPID_KEY = "vapid";

/** The keys, made once and kept. */
function vapidKeys(db: Db): { publicKey: string; privateKey: string } {
  const row = db.select().from(settings).where(eq(settings.key, VAPID_KEY)).get();
  if (row) return JSON.parse(row.value) as { publicKey: string; privateKey: string };
  const keys = webpush.generateVAPIDKeys();
  db.insert(settings)
    .values({ key: VAPID_KEY, value: JSON.stringify(keys) })
    .run();
  return keys;
}

/** The words for an event's notification, or null when it does not notify. */
export function notificationFor(locale: Locale, event: GameEvent): Notification | null {
  const kind = notifyKindOf(event);
  if (!kind) return null;
  switch (event.type) {
    case "night_shift_over":
      return {
        kind,
        title: locale.t("push.night_shift_over_title"),
        body: locale.t("push.night_shift_over"),
        tag: "night_shift_over",
        url: "/",
      };
    default:
      return null;
  }
}

export class Notifier {
  readonly publicKey: string;

  constructor(
    private readonly db: Db,
    private readonly locale: Locale,
    private readonly logger: typeof Log,
    /** The VAPID subject: an https URL or a mailto: address. */
    subject: string,
    private readonly send: PushSend = (subscription, payload) =>
      webpush.sendNotification(subscription, payload, { TTL: 6 * 3600 }),
    private readonly dm: DmSend = () => {},
    private readonly options: NotifierOptions = {},
  ) {
    const keys = vapidKeys(db);
    this.publicKey = keys.publicKey;
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  }

  prefs(playerId: number): NotifyPrefs {
    const row = this.db.select().from(players).where(eq(players.id, playerId)).get();
    return notifyPrefs(
      row?.notifyJson ? (JSON.parse(row.notifyJson) as Record<string, unknown>) : null,
    );
  }

  setPrefs(playerId: number, change: Partial<NotifyPrefs>): NotifyPrefs {
    const next = notifyPrefs({ ...this.prefs(playerId), ...change });
    this.db
      .update(players)
      .set({ notifyJson: JSON.stringify(next) })
      .where(eq(players.id, playerId))
      .run();
    return next;
  }

  /** Whether the bot DMs this player: null until they first use the bot (W8). */
  discordDm(playerId: number): boolean | null {
    const row = this.db.select().from(players).where(eq(players.id, playerId)).get();
    return row?.discordDm === null || row?.discordDm === undefined ? null : row.discordDm === 1;
  }

  setDiscordDm(playerId: number, on: boolean): void {
    this.db
      .update(players)
      .set({ discordDm: on ? 1 : 0 })
      .where(eq(players.id, playerId))
      .run();
  }

  /**
   * Remembers a device for a player; the same endpoint again just moves to them. The browser's
   * offset from UTC, when sent, sets the player's quiet hours.
   */
  subscribe(
    playerId: number,
    subscription: Subscription,
    now: number,
    tzOffsetMinutes?: number,
  ): void {
    if (tzOffsetMinutes !== undefined)
      this.db.update(players).set({ tzOffsetMinutes }).where(eq(players.id, playerId)).run();
    const values = {
      playerId,
      keysJson: JSON.stringify(subscription.keys),
      createdAt: now,
    };
    this.db
      .insert(pushSubscriptions)
      .values({ endpoint: subscription.endpoint, ...values })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values })
      .run();
  }

  unsubscribe(playerId: number, endpoint: string): void {
    const row = this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .get();
    if (row?.playerId === playerId)
      this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
  }

  devices(playerId: number): number {
    return this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.playerId, playerId))
      .all().length;
  }

  /**
   * Pings every device of `playerId` for the events whose kind they turned on, or holds them
   * until 08:00 during the player's quiet hours. Returns how many notifications went out. Never
   * throws: a failed push is logged, a gone one dropped.
   */
  async notify(playerId: number, events: GameEvent[]): Promise<number> {
    const prefs = this.prefs(playerId);
    const due = events
      .map((event) => notificationFor(this.locale, event))
      .filter((note): note is Notification => note !== null && prefs[note.kind]);
    if (due.length === 0) return 0;
    const player = this.db.select().from(players).where(eq(players.id, playerId)).get();
    if (!player) return 0;
    const now = (this.options.clock ?? systemClock).now();
    const offset = player.tzOffsetMinutes ?? this.options.defaultOffsetMinutes ?? 0;
    if (prefs.quiet && inQuietHours(now, offset)) {
      const held = player.heldJson ? (JSON.parse(player.heldJson) as Held) : null;
      // One note per kind: a later one replaces the held one (its tag would anyway).
      const notes = [
        ...(held?.notes ?? []).filter((note) => !due.some((next) => next.tag === note.tag)),
        ...due,
      ];
      const next: Held = { until: quietUntil(now, offset), notes };
      this.db
        .update(players)
        .set({ heldJson: JSON.stringify(next) })
        .where(eq(players.id, playerId))
        .run();
      return 0;
    }
    return this.deliver(player, due);
  }

  /** Sends what quiet hours held, for every player whose 08:00 has come (the scheduler's tick). */
  async flushHeld(): Promise<number> {
    const now = (this.options.clock ?? systemClock).now();
    let sent = 0;
    for (const player of this.db.select().from(players).where(isNotNull(players.heldJson)).all()) {
      const held = JSON.parse(player.heldJson ?? "null") as Held | null;
      if (held && held.until > now) continue;
      this.db.update(players).set({ heldJson: null }).where(eq(players.id, player.id)).run();
      if (held) sent += await this.deliver(player, held.notes);
    }
    return sent;
  }

  private async deliver(player: typeof players.$inferSelect, due: Notification[]): Promise<number> {
    const playerId = player.id;
    if (player.discordDm === 1 && SNOWFLAKE.test(player.discordId)) {
      try {
        this.dm(player.discordId, due);
      } catch (error) {
        this.logger.warn("dm failed", { error: (error as Error).message });
      }
    }
    const devices = this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.playerId, playerId))
      .all();
    let sent = 0;
    for (const device of devices) {
      const subscription = {
        endpoint: device.endpoint,
        keys: JSON.parse(device.keysJson) as Subscription["keys"],
      };
      for (const note of due) {
        try {
          await this.send(subscription, JSON.stringify(note));
          sent += 1;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            this.db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.endpoint, device.endpoint))
              .run();
            break;
          }
          this.logger.warn("push failed", { status, error: (error as Error).message });
        }
      }
    }
    return sent;
  }
}
