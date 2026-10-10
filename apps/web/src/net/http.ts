/**
 * The real game: the API on the same origin. Time follows the server's clock, and the event
 * stream keeps other tabs and finished timers in sync. A command is one attempt; the store's
 * queue owns the retries (D134).
 */
import { type Clock, systemClock } from "@wipe-day/domain/clock";
import type { Command } from "@wipe-day/domain/commands";
import type {
  CommandResponse,
  MeResponse,
  PushMessage,
  StateResponse,
} from "@wipe-day/domain/wire";
import { type Backend, HttpError, type ServerConfig } from "./backend";

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
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        retryAfterMs?: number;
      };
      throw new HttpError(response.status, body.error ?? "error", body.retryAfterMs ?? null);
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
    const response = await this.request<CommandResponse>("/api/commands", {
      method: "POST",
      body: JSON.stringify({ key, command }),
    });
    this.clock.sync(response.serverNow);
    return response;
  }

  subscribe(onPush: (message: PushMessage) => void, onReconnect: () => void): () => void {
    const source = new EventSource("/api/events");
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
