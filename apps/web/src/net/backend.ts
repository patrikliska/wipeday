/**
 * Where the game state lives, seen from the client. Two implementations with one shape:
 * `HttpBackend` (the real game on the server) and `LocalBackend` (demo mode and screenshots:
 * the same domain rules, run in the browser).
 *
 * `command` makes one attempt and throws on failure; the store's queue retries with the same
 * key (safe: the server runs each key once) and never drops a predicted tap (D134).
 */
import type { Clock } from "@wipe-day/domain/clock";
import type { Command } from "@wipe-day/domain/commands";
import type {
  CommandResponse,
  MeResponse,
  PushMessage,
  StateResponse,
} from "@wipe-day/domain/wire";

export interface ServerConfig {
  /** The passwordless test login exists on this server (development only). */
  devLogin: boolean;
  /** Discord login is configured. */
  discordLogin: boolean;
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
  /** Pushed changes (another tab, timers). `onReconnect` fires after the stream was lost. */
  subscribe(onPush: (message: PushMessage) => void, onReconnect: () => void): () => void;
  devLogin(slot: number): Promise<void>;
  logout(): Promise<void>;
  readonly loginUrl: string;
}

/** A request the server answered with an error status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** For a 429: how long the server asked us to wait. */
    readonly retryAfterMs: number | null = null,
  ) {
    super(`HTTP ${status}: ${code}`);
    this.name = "HttpError";
  }
}

/** A fresh idempotency key for one player intent. */
export function newKey(): string {
  return crypto.randomUUID();
}
