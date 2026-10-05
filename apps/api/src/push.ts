/**
 * Web Push (W4b): a player turns notifications on per device, picks the kinds
 * (party back and raided on by default), and the scheduler pings their phone
 * when something they asked about lands while they are away.
 *
 * The VAPID key pair is generated on first boot and kept in the `settings`
 * table, so nothing has to be configured on the server. Subscriptions that the
 * push service reports gone (404, 410) are dropped.
 */
import type { Locale } from "@wipe-day/content/locale";
import type { GameEvent } from "@wipe-day/domain/events";
import {
  type NotifyKind,
  type NotifyPrefs,
  notifyKindOf,
  notifyPrefs,
} from "@wipe-day/domain/feed";
import { eq } from "drizzle-orm";
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
  const t = (key: string, args?: Record<string, string | number>) => locale.t(key, args);
  switch (event.type) {
    case "mission_back": {
      const place =
        event.kind === "scout" ? t(`region.${event.target}.name`) : t(`site.${event.target}.name`);
      return {
        kind,
        title: t(event.kind === "scout" ? "push.scout_back" : "push.party_back"),
        body: t(`push.outcome_${event.kind === "scout" ? "scouted" : event.outcome}`, { place }),
        tag: event.mission,
        url: `/?report=${encodeURIComponent(event.mission)}`,
      };
    }
    case "survivor_arrived":
      return {
        kind,
        title: t("push.arrived_title"),
        body: t("push.arrived", { name: t(`crew.${event.survivor}.name`) }),
        tag: `arrived-${event.survivor}`,
        url: "/",
      };
    case "build_done":
      return {
        kind,
        title: t("push.built_title"),
        body: t("push.tier_done", { tier: t(`base_tier.${event.tier}.name`) }),
        tag: `tier-${event.tier}`,
        url: "/",
      };
    case "building_done":
      return {
        kind,
        title: t("push.built_title"),
        body: t("push.building_done", {
          building: t(`building.${event.building}.name`),
          level: event.level,
        }),
        tag: `building-${event.building}`,
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

  /** Remembers a device for a player; the same endpoint again just moves to them. */
  subscribe(playerId: number, subscription: Subscription, now: number): void {
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
   * Pings every device of `playerId` for the events whose kind they turned on. Returns how
   * many notifications went out. Never throws: a failed push is logged, a gone one dropped.
   */
  async notify(playerId: number, events: GameEvent[]): Promise<number> {
    const prefs = this.prefs(playerId);
    const due = events
      .map((event) => notificationFor(this.locale, event))
      .filter((note): note is Notification => note !== null && prefs[note.kind]);
    if (due.length === 0) return 0;
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
