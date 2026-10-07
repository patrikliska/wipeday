/**
 * What the API sends and the web client reads: one definition for both ends
 * (apps never import each other). Types only.
 */

import type { Tier } from "@wipe-day/content/tiers";
import type { BaseState } from "./base";
import type { Refusal } from "./commands";
import type { GameEvent } from "./events";
import type { NotifyKind } from "./feed";
import type { Category, Leaderboards, SeasonSummary } from "./leaderboard";
import type { Legacy } from "./legacy";
import type { MarketListing } from "./market";
import type { PvpOdds, PvpStatus } from "./raids";
import type { SignalProgress } from "./signal";

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

/** The running season (W7): its number, the announced end and the modifiers. */
export interface SeasonView {
  number: number;
  startedAt: number;
  /** Announced end, or null while none is. */
  endsAt: number | null;
  modifier: string | null;
  /** The next season's modifier, once announced. */
  next: string | null;
}

/** `GET /api/state`. */
export interface StateResponse {
  serverNow: number;
  version: number;
  player: PlayerView;
  seasonStartedAt: number;
  season: SeasonView;
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

// --- the legacy layer and the Signal (W7) ------------------------------------------------

/** One finished season of the player's: its card, ranks and the legacy points it gave. */
export interface ArchivedSeason {
  season: number;
  summary: SeasonSummary;
  ranks: Partial<Record<Category, number>>;
  points: number;
}

export interface HallEntry {
  season: number;
  /** A leaderboard category, or "signal". */
  category: string;
  playerId: number;
  name: string;
  value: number;
}

/** `GET /api/legacy`. */
export interface LegacyResponse {
  legacy: Legacy;
  /** The player's finished seasons, newest first. */
  seasons: ArchivedSeason[];
  hall: HallEntry[];
}

/** `GET /api/signal`. */
export interface SignalResponse {
  serverNow: number;
  open: boolean;
  progress: SignalProgress;
  /** What the open stage still needs. */
  needs: Record<string, number>;
  top: { playerId: number; name: string; worth: number }[];
  /** This player's gifts so far, in scrap at reference prices. */
  mine: number;
}

/** One `den` message on the event stream (the island's news: the Den, and from W7 the season
 * and the Signal). */
export type DenPush =
  | { kind: "bet"; bet: WheelBetView }
  | { kind: "result"; round: number; segment: number }
  /** Listings changed: the board is stale. */
  | { kind: "board" }
  | { kind: "jackpot"; jackpot: number }
  /** A season ended or its end was announced: reload. */
  | { kind: "season"; number: number }
  /** The Signal moved. */
  | { kind: "signal" };

// --- the Discord companion (W8) ----------------------------------------------------------

/** `GET /api/bot/home`: the base for the bot's card, the DM switch and a one-time login link. */
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

/** A season's winner, by leaderboard category or "signal" (the bot's season news). */
export interface Winner {
  category: string;
  name: string;
  value: number;
}

/** A `news` on the bot's stream: the season's end announced, or the reset done. */
export type SeasonNews =
  | { kind: "announced"; season: SeasonView }
  | { kind: "ended"; ended: number; season: SeasonView; winners: Winner[] };
