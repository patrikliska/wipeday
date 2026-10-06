/**
 * The real game: the API on the same origin. Commands retry with the same key
 * (safe: the server runs each key once), time follows the server's clock, and
 * the event stream keeps other tabs and finished timers in sync.
 */
import { type Clock, systemClock } from "@wipe-day/domain/clock";
import type { Command } from "@wipe-day/domain/commands";
import type { FeedItem, NotifyPrefs } from "@wipe-day/domain/feed";
import type {
  CommandResponse,
  DenBoard,
  DenPush,
  MeResponse,
  PriceHistory,
  PushMessage,
  RaidsResponse,
  RanksResponse,
  StateResponse,
} from "@wipe-day/domain/wire";
import {
  type Backend,
  type DeviceSubscription,
  HttpError,
  type NotifySettings,
  type ServerConfig,
} from "./backend";

/** Real time shifted to the server's: one reading source, corrected on every answer. */
class ServerClock implements Clock {
  private offsetMs = 0;
  nowMs(): number {
    return systemClock.nowMs() + this.offsetMs;
  }
  now(): number {
    return Math.floor(this.nowMs() / 1000);
  }
  /** Moves toward the server's time when the difference is bigger than rounding. */
  sync(serverNow: number): void {
    const drift = serverNow * 1000 - this.nowMs();
    if (Math.abs(drift) > 1500) this.offsetMs += drift;
  }
}

const RETRIES = [500, 1500, 4000];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpBackend implements Backend {
  readonly mode = "server";
  readonly clock = new ServerClock();
  readonly loginUrl = "/api/auth/discord";

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new HttpError(response.status, body.error ?? "error");
    }
    return (await response.json()) as T;
  }

  config(): Promise<ServerConfig> {
    return this.request<ServerConfig>("/api/config");
  }

  async me(): Promise<MeResponse | null> {
    try {
      return await this.request<MeResponse>("/api/me");
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) return null;
      throw error;
    }
  }

  async state(): Promise<StateResponse> {
    const state = await this.request<StateResponse>("/api/state");
    this.clock.sync(state.serverNow);
    return state;
  }

  async command(key: string, command: Command): Promise<CommandResponse> {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await this.request<CommandResponse>("/api/commands", {
          method: "POST",
          body: JSON.stringify({ key, command }),
        });
        this.clock.sync(response.serverNow);
        return response;
      } catch (error) {
        // A 4xx will not change on retry; a network error or 5xx might.
        const retryable = !(error instanceof HttpError) || error.status >= 500;
        const wait = RETRIES[attempt];
        if (!retryable || wait === undefined) throw error;
        await sleep(wait);
      }
    }
  }

  async feed(before?: number): Promise<FeedItem[]> {
    const query = before ? `?before=${before}` : "";
    return (await this.request<{ items: FeedItem[] }>(`/api/feed${query}`)).items;
  }

  notify(): Promise<NotifySettings | null> {
    return this.request<NotifySettings>("/api/notify");
  }

  async setNotify(change: Partial<NotifyPrefs>): Promise<NotifyPrefs> {
    const body = JSON.stringify(change);
    return (await this.request<{ prefs: NotifyPrefs }>("/api/notify", { method: "PUT", body }))
      .prefs;
  }

  async pushSubscribe(subscription: DeviceSubscription): Promise<void> {
    await this.request("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    });
  }

  async pushUnsubscribe(endpoint: string): Promise<void> {
    await this.request("/api/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    });
  }

  async den(): Promise<DenBoard> {
    const board = await this.request<DenBoard>("/api/den");
    this.clock.sync(board.serverNow);
    return board;
  }

  history(good: string): Promise<PriceHistory> {
    return this.request<PriceHistory>(`/api/den/history?good=${encodeURIComponent(good)}`);
  }

  raids(): Promise<RaidsResponse> {
    return this.request<RaidsResponse>("/api/raids");
  }

  ranks(): Promise<RanksResponse> {
    return this.request<RanksResponse>("/api/ranks");
  }

  subscribe(
    onPush: (message: PushMessage) => void,
    onReconnect: () => void,
    onFeed: (items: FeedItem[]) => void,
    onDen: (message: DenPush) => void,
  ): () => void {
    const source = new EventSource("/api/events");
    source.addEventListener("feed", (event) => {
      onFeed(JSON.parse((event as MessageEvent<string>).data) as FeedItem[]);
    });
    source.addEventListener("den", (event) => {
      onDen(JSON.parse((event as MessageEvent<string>).data) as DenPush);
    });
    let opened = false;
    source.addEventListener("ready", () => {
      // The stream came back after a drop: anything pushed meanwhile is missed, so reload.
      if (opened) onReconnect();
      opened = true;
    });
    source.addEventListener("state", (event) => {
      const message = JSON.parse((event as MessageEvent<string>).data) as PushMessage;
      this.clock.sync(message.serverNow);
      onPush(message);
    });
    return () => source.close();
  }

  async devLogin(slot: number): Promise<void> {
    await this.request("/api/dev/login", { method: "POST", body: JSON.stringify({ slot }) });
  }

  async logout(): Promise<void> {
    await this.request("/api/auth/logout", { method: "POST" });
  }
}
