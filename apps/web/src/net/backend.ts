/**
 * Where the game state lives, seen from the client. Two implementations with
 * one shape: `HttpBackend` (the real game on the server) and `LocalBackend`
 * (demo mode and screenshots: the same domain rules, run in the browser).
 */
import type { Clock } from "@wipe-day/domain/clock";
import type { Command } from "@wipe-day/domain/commands";
import type { FeedItem, NotifyPrefs } from "@wipe-day/domain/feed";
import type {
  CommandResponse,
  DenBoard,
  DenPush,
  LegacyResponse,
  MeResponse,
  PriceHistory,
  PushMessage,
  RaidsResponse,
  RanksResponse,
  SignalResponse,
  StateResponse,
} from "@wipe-day/domain/wire";

export interface ServerConfig {
  /** The passwordless test login exists on this server (development only). */
  devLogin: boolean;
  /** Discord login is configured. */
  discordLogin: boolean;
}

/** `GET /api/notify`: the kinds on, the server's push key, devices with notifications on. */
export interface NotifySettings {
  prefs: NotifyPrefs;
  publicKey: string;
  devices: number;
}

/** What a browser's push subscription serialises to. */
export interface DeviceSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface Backend {
  readonly mode: "server" | "demo";
  /** Game time: the server's clock, or the demo clock. */
  readonly clock: Clock;
  config(): Promise<ServerConfig>;
  /** Who is logged in, or null. */
  me(): Promise<MeResponse | null>;
  state(): Promise<StateResponse>;
  /** Idempotent by `key`: a retry with the same key never runs the command twice. */
  command(key: string, command: Command): Promise<CommandResponse>;
  /**
   * Pushed changes (another tab, timers), new feed items from everyone and the Den's news
   * (bets, spins, the board). `onReconnect` fires after the stream was lost.
   */
  subscribe(
    onPush: (message: PushMessage) => void,
    onReconnect: () => void,
    onFeed: (items: FeedItem[]) => void,
    onDen: (message: DenPush) => void,
  ): () => void;
  /** The Den's board: listings, the wheel, the jackpot (W5). */
  den(): Promise<DenBoard>;
  /** What players paid for `good`, by day. */
  history(good: string): Promise<PriceHistory>;
  /** The leaderboards and the player's season card. */
  ranks(): Promise<RanksResponse>;
  /** Other holdfasts in the raids, with whether and at what cost they can be raided (W6). */
  raids(): Promise<RaidsResponse>;
  /** What the player keeps across seasons, their finished seasons, the hall of fame (W7). */
  legacy(): Promise<LegacyResponse>;
  /** The Signal: its stages, what it still needs, who gave most (W7). */
  signal(): Promise<SignalResponse>;
  /** The season's feed, newest first; `before` pages back by item id. */
  feed(before?: number): Promise<FeedItem[]>;
  /** Notification settings; null where there are none (demo mode). */
  notify(): Promise<NotifySettings | null>;
  setNotify(change: Partial<NotifyPrefs>): Promise<NotifyPrefs>;
  pushSubscribe(subscription: DeviceSubscription): Promise<void>;
  pushUnsubscribe(endpoint: string): Promise<void>;
  devLogin(slot: number): Promise<void>;
  logout(): Promise<void>;
  readonly loginUrl: string;
}

/** A request the server answered with an error status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`HTTP ${status}: ${code}`);
    this.name = "HttpError";
  }
}

/** A fresh idempotency key for one player intent. */
export function newKey(): string {
  return crypto.randomUUID();
}
