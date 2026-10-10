/**
 * What the API sends and the clients read: one definition for both ends (apps never import
 * each other). Types only.
 */
import type { Refusal } from "./commands";
import type { GameEvent } from "./events";
import type { NotifyKind } from "./feed";
import type { BaseState } from "./state";
import type { WelcomeBack } from "./welcome";

export type { WelcomeBack };

export interface PlayerView {
  id: number;
  name: string;
  avatarUrl: string | null;
}

/** `GET /api/state`. */
export interface StateResponse {
  serverNow: number;
  version: number;
  player: PlayerView;
  state: BaseState;
  welcomeBack: WelcomeBack | null;
}

/**
 * What a command record keeps (D134): the outcome, never the state. Taps and pings (the slim
 * path) keep `credited` for 1 hour; every other command its events for 7 days.
 */
export type CommandOutcome =
  | { ok: true; version: number; credited?: number; events?: GameEvent[] }
  | { ok: false; version: number; refusal: Refusal; events?: GameEvent[] };

/**
 * `POST /api/commands`: the outcome with the current state. A replay returns the stored
 * outcome with the state as it is now, and `replay: true`.
 */
export type CommandResponse = CommandOutcome & {
  serverNow: number;
  state: BaseState;
  events: GameEvent[];
  replay?: boolean;
};

/**
 * One `state` message on `GET /api/events`: the base changed. A taps batch or a ping sends no
 * state (`state` absent): the other tabs refetch `GET /api/state`, at most every 2 s.
 */
export interface PushMessage {
  version: number;
  serverNow: number;
  state?: BaseState;
  events: GameEvent[];
  /** The command key that caused it, so the tab that sent it can ignore its own echo. */
  origin: string | null;
}

/** `GET /api/me`. */
export interface MeResponse extends PlayerView {
  /** The dev-only test login is available on this server. */
  devLogin: boolean;
}

/** `POST /api/commands` refused before the domain saw it: too fast (D134). */
export interface SlowDown {
  error: "slow_down";
  retryAfterMs: number;
}

// --- the Discord companion (W8) ----------------------------------------------------------

/** `GET /api/bot/home`: the base, the DM switch and a one-time login link. */
export interface BotHome extends StateResponse {
  /** DMs for the notification kinds the player turned on. */
  discordDm: boolean;
  /** Logs this player in on the web, once, within ten minutes. */
  loginUrl: string;
}

/** A `dm` on the bot's stream: a notification for one player, to send as a Discord DM. */
export interface DmNote {
  discordId: string;
  kind: NotifyKind;
  title: string;
  body: string;
  /** Where in the game it matters, absolute. */
  url: string;
}
