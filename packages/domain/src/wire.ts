/**
 * What the API sends and the web client reads: one definition for both ends
 * (apps never import each other). Types only.
 */

import type { Tier } from "@wipe-day/content/tiers";
import type { BaseState } from "./base";
import type { Refusal } from "./commands";
import type { GameEvent } from "./events";
import type { Leaderboards, SeasonSummary } from "./leaderboard";
import type { MarketListing } from "./market";
import type { PvpOdds, PvpStatus } from "./raids";

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

// --- the Den (W5) ---------------------------------------------------------------------

/** A bet on the wheel as the table shows it: who is on which segment this round. */
export interface WheelBetView {
  round: number;
  playerId: number;
  name: string;
  segment: string;
  amount: number;
}

/** `GET /api/den`: the market board and the tables. */
export interface DenBoard {
  serverNow: number;
  /** Every open player listing, newest first (the player's own included). */
  listings: MarketListing[];
  /** The wheel round running now, and the bets on it and the next one. */
  round: number;
  bets: WheelBetView[];
  /** The last spins, newest first: segment index by round. */
  results: { round: number; segment: number }[];
  /** The slots' shared pool, in hundredths of scrap. */
  jackpot: number;
}

/** `GET /api/den/history?good=`: what players paid per 100 units, by UTC day. */
export interface PriceHistory {
  good: string;
  days: { day: number; per100: number; amount: number }[];
}

/** `GET /api/ranks`: every category's table and the player's own season card. */
export interface RanksResponse {
  boards: Leaderboards;
  me: SeasonSummary;
}

// --- raids (W6) -----------------------------------------------------------------------

/** Another holdfast in the raids, as the PvP tab lists it. */
export interface RaidTargetView {
  id: number;
  name: string;
  tier: Tier;
  /** Whether it can be raided now (with the charges it costs), or the first reason not. */
  status: PvpStatus;
  odds: PvpOdds;
  shieldUntil: number | null;
}

/** `GET /api/raids`: every other holdfast in the raids. */
export interface RaidsResponse {
  serverNow: number;
  targets: RaidTargetView[];
}

/** One `den` message on the event stream. */
export type DenPush =
  | { kind: "bet"; bet: WheelBetView }
  | { kind: "result"; round: number; segment: number }
  /** Listings changed: the board is stale. */
  | { kind: "board" }
  | { kind: "jackpot"; jackpot: number };
