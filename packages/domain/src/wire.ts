/**
 * What the API sends and the web client reads: one definition for both ends
 * (apps never import each other). Types only.
 */
import type { BaseState } from "./base";
import type { Refusal } from "./commands";
import type { GameEvent } from "./events";

export interface PlayerView {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface WelcomeBack {
  awaySeconds: number;
  /** What happened while away, oldest first. */
  events: GameEvent[];
}

/** `GET /api/state`. */
export interface StateResponse {
  serverNow: number;
  version: number;
  player: PlayerView;
  seasonStartedAt: number;
  state: BaseState;
  welcomeBack: WelcomeBack | null;
}

/** `POST /api/commands`. A refusal still carries the (settled) state to show. */
export type CommandResponse =
  | { ok: true; serverNow: number; version: number; state: BaseState; events: GameEvent[] }
  | {
      ok: false;
      serverNow: number;
      version: number;
      state: BaseState;
      events: GameEvent[];
      refusal: Refusal;
    };

/** One `state` message on `GET /api/events`: the base changed. */
export interface PushMessage {
  version: number;
  serverNow: number;
  state: BaseState;
  events: GameEvent[];
  /** The command key that caused it, so the tab that sent it can ignore its own echo. */
  origin: string | null;
}

/** `GET /api/me`. */
export interface MeResponse extends PlayerView {
  /** The dev-only test login is available on this server. */
  devLogin: boolean;
}
