/**
 * The Den's games (W5), scrap only: the Wheel of Salvage (one shared spin every
 * 30 seconds), the One-Armed Scavenger (slots with a shared jackpot) and Bones
 * (two dice). Odds and pays are in `den.json5`; their exact return is in
 * `@wipe-day/content/odds` and shown before every bet. Guard rails: bets come in
 * chips, a biggest bet and a daily wager cap by base tier, and nothing but scrap.
 *
 * The rolls need randomness the player cannot see in advance, so they come from
 * the server (`World`): a fresh seed per slots spin or dice roll, and the wheel's
 * result per round (`reveal`), known only once the round has ended. Placing a
 * wheel bet is deterministic and predicted; the client waits for the spin.
 */

import { type CasinoGame, diceWins } from "@wipe-day/content/odds";
import type { Content, DiceOption } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import { utcDay } from "./active";
import type { BaseState } from "./base";
import { denOpen, denResetAt } from "./den";
import type { GameEvent } from "./events";
import { giveScrap } from "./goods";
import { pickWeighted, rng } from "./rng";

export interface WheelBet {
  round: number;
  /** Segment id. */
  segment: string;
  amount: number;
}

/** Scrap wagered and won on one UTC day: the daily cap reads `wagered`. */
export interface CasinoDay {
  day: number;
  wagered: number;
  won: number;
}

export function newCasinoDay(): CasinoDay {
  return { day: -1, wagered: 0, won: 0 };
}

/** The base's limits: the biggest bet and the daily wager cap. Null while the Den is closed. */
export function casinoLimit(
  content: Content,
  state: Pick<BaseState, "tier">,
): { maxBet: number; dailyWager: number } | null {
  if (!denOpen(content, state)) return null;
  return content.den.casino.limits[state.tier] ?? null;
}

/** Today's totals (yesterday's count for nothing). */
export function casinoToday(state: BaseState, now: number): CasinoDay {
  const day = utcDay(now);
  return state.casino.day === day ? state.casino : { day, wagered: 0, won: 0 };
}

/** Scrap still allowed on the tables today. */
export function wagerLeft(content: Content, state: BaseState, now: number): number {
  const limit = casinoLimit(content, state);
  return limit ? Math.max(0, limit.dailyWager - casinoToday(state, now).wagered) : 0;
}

export type WagerStatus =
  | { code: "ok" }
  | { code: "den_closed"; tier: Tier }
  | { code: "bad_bet"; step: number }
  | { code: "max_bet"; amount: number; tier: Tier }
  | { code: "wager_cap"; left: number; resetAt: number }
  | { code: "unaffordable"; missing: { scrap: number } };

/** Whether `amount` may be bet now: chips, the biggest bet, the daily cap, the scrap. */
export function wagerStatus(
  content: Content,
  state: BaseState,
  amount: number,
  now: number,
): WagerStatus {
  const limit = casinoLimit(content, state);
  if (!limit) return { code: "den_closed", tier: content.den.open.tier };
  const step = content.den.casino.betStep;
  if (amount < step || amount % step !== 0) return { code: "bad_bet", step };
  if (amount > limit.maxBet) return { code: "max_bet", amount: limit.maxBet, tier: state.tier };
  const left = wagerLeft(content, state, now);
  if (amount > left) return { code: "wager_cap", left, resetAt: denResetAt(now) };
  const scrap = state.stock.scrap ?? 0;
  if (scrap < amount) return { code: "unaffordable", missing: { scrap: amount - scrap } };
  return { code: "ok" };
}

/** Takes the stake and counts it against today's cap. */
function stake(state: BaseState, amount: number, now: number): BaseState {
  const today = casinoToday(state, now);
  return {
    ...state,
    stock: { ...state.stock, scrap: (state.stock.scrap ?? 0) - amount },
    casino: { ...today, wagered: today.wagered + amount },
  };
}

/** Pays a win (uncapped) and adds it to today's winnings. */
function payOut(state: BaseState, amount: number, now: number): BaseState {
  const paid = giveScrap(state, amount);
  const today = casinoToday(paid, now);
  return { ...paid, casino: { ...today, won: today.won + amount } };
}

/** The wager event, plus a feed line when the win is big. */
function wagerEvents(
  content: Content,
  game: CasinoGame,
  option: string | null,
  bet: number,
  payout: number,
  result: number[],
  feed: number,
  at: number,
  round?: number,
): GameEvent[] {
  const events: GameEvent[] = [
    {
      type: "wager",
      game,
      option,
      bet,
      payout,
      result,
      feed,
      at,
      ...(round !== undefined ? { round } : {}),
    },
  ];
  if (payout >= bet * content.den.casino.bigWin)
    events.push({ type: "big_win", game, bet, payout, at });
  return events;
}

// --- the wheel ------------------------------------------------------------------------

/** The round running at `now`. Rounds are global: everyone's bets meet the same spin. */
export function roundOf(content: Content, now: number): number {
  return Math.floor(now / content.den.casino.wheel.roundSeconds);
}

/** When round `round` spins. */
export function roundEndsAt(content: Content, round: number): number {
  return (round + 1) * content.den.casino.wheel.roundSeconds;
}

/** The round a bet placed now rides on: this one, or the next once betting has closed. */
export function betRound(content: Content, now: number): number {
  const round = roundOf(content, now);
  const closesAt = roundEndsAt(content, round) - content.den.casino.wheel.closeSeconds;
  return now < closesAt ? round : round + 1;
}

/** Where the wheel stops for a seed (the server's per-round seed): a segment index. */
export function wheelResult(content: Content, seed: number): number {
  return pickWeighted(
    rng(seed),
    content.den.casino.wheel.segments.map((segment) => segment.weight),
  );
}

export type BetResult =
  | { ok: true; state: BaseState; events: GameEvent[] }
  | {
      ok: false;
      status:
        | Exclude<WagerStatus, { code: "ok" }>
        | { code: "bad_option" }
        | { code: "server_only" };
    };

/** Puts `amount` on a segment for the round open now; it resolves when that round spins. */
export function placeWheelBet(
  content: Content,
  state: BaseState,
  segment: string,
  amount: number,
  now: number,
): BetResult {
  const found = content.den.casino.wheel.segments.find((candidate) => candidate.id === segment);
  if (!found || found.pays <= 0) return { ok: false, status: { code: "bad_option" } };
  const status = wagerStatus(content, state, amount, now);
  if (status.code !== "ok") return { ok: false, status };
  const round = betRound(content, now);
  const staked = stake(state, amount, now);
  return {
    ok: true,
    state: { ...staked, wheelBets: [...staked.wheelBets, { round, segment, amount }] },
    events: [{ type: "wheel_bet", round, segment, amount }],
  };
}

/**
 * Pays the bets whose round has spun, as far as the results are known (`reveal`, from
 * the server). Without it (the client) bets wait for the server. Part of settling.
 */
export function settleWheel(
  content: Content,
  state: BaseState,
  now: number,
  reveal?: (round: number) => number | null,
): { state: BaseState; events: GameEvent[] } {
  if (state.wheelBets.length === 0 || !reveal) return { state, events: [] };
  const { segments } = content.den.casino.wheel;
  let next = state;
  const waiting: WheelBet[] = [];
  const events: GameEvent[] = [];
  for (const bet of state.wheelBets) {
    const at = roundEndsAt(content, bet.round);
    const result = at <= now ? reveal(bet.round) : null;
    if (result === null) {
      waiting.push(bet);
      continue;
    }
    const segment = segments.find((candidate) => candidate.id === bet.segment);
    const won = segments[result]?.id === bet.segment;
    const payout = won && segment ? Math.floor((bet.amount * segment.pays) / 100) : 0;
    if (payout > 0) next = payOut(next, payout, at);
    events.push(
      ...wagerEvents(content, "wheel", bet.segment, bet.amount, payout, [result], 0, at, bet.round),
    );
  }
  return { state: { ...next, wheelBets: waiting }, events };
}

/** When the earliest pending bet's round spins, for the server's timer. */
export function nextWheelAt(content: Content, state: BaseState): number | null {
  return state.wheelBets.length > 0
    ? Math.min(...state.wheelBets.map((bet) => roundEndsAt(content, bet.round)))
    : null;
}

// --- the slots ------------------------------------------------------------------------

export interface SlotSpin {
  /** Symbol index on each of the three reels. */
  reels: number[];
  /** Percent of the bet paid (0 for nothing); the jackpot is separate. */
  pays: number;
  jackpot: boolean;
}

/** Three reels from one seed, and what they pay. */
export function spinSlots(content: Content, seed: number): SlotSpin {
  const { symbols } = content.den.casino.slots;
  const random = rng(seed);
  const weights = symbols.map((symbol) => symbol.weight);
  const reels = [0, 1, 2].map(() => pickWeighted(random, weights));
  const [a, b, c] = reels as [number, number, number];
  if (a === b && b === c) {
    const symbol = symbols[a];
    if (symbol?.jackpot)
      return { reels, pays: content.den.casino.slots.jackpot.pays, jackpot: true };
    return { reels, pays: symbol?.three ?? 0, jackpot: false };
  }
  // Exactly two alike, anywhere.
  const pair = a === b || a === c ? a : b === c ? b : -1;
  return { reels, pays: pair >= 0 ? (symbols[pair]?.two ?? 0) : 0, jackpot: false };
}

/**
 * One spin: the stake goes in (its feed share to the shared pool), the reels stop where
 * the server's seed says, and three jackpot symbols pay the jackpot's multiple of the bet
 * plus the whole pool (this spin's share included).
 */
export function playSlots(
  content: Content,
  state: BaseState,
  amount: number,
  now: number,
  world: { seed?: number; jackpot?: number } | undefined,
): BetResult {
  if (world?.seed === undefined) return { ok: false, status: { code: "server_only" } };
  const status = wagerStatus(content, state, amount, now);
  if (status.code !== "ok") return { ok: false, status };
  const { jackpot } = content.den.casino.slots;
  // The pool is kept in hundredths of scrap, so a small bet's share is never rounded away.
  const feed = amount * jackpot.feedPercent;
  const spin = spinSlots(content, world.seed);
  let payout = Math.floor((amount * spin.pays) / 100);
  const events: GameEvent[] = [];
  if (spin.jackpot) {
    payout += Math.floor(((world.jackpot ?? 0) + feed) / 100);
    events.push({ type: "jackpot_won", amount: payout, at: now });
  }
  let next = stake(state, amount, now);
  if (payout > 0) next = payOut(next, payout, now);
  return {
    ok: true,
    state: next,
    events: [
      ...wagerEvents(content, "slots", null, amount, payout, spin.reels, feed, now),
      ...events,
    ],
  };
}

// --- bones (dice) -----------------------------------------------------------------------

/** Two dice from one seed. */
export function rollDice(seed: number): [number, number] {
  const random = rng(seed);
  return [random.int(1, 6), random.int(1, 6)];
}

export function playDice(
  content: Content,
  state: BaseState,
  option: DiceOption,
  amount: number,
  now: number,
  world: { seed?: number } | undefined,
): BetResult {
  const found = content.den.casino.dice.options.find((candidate) => candidate.id === option);
  if (!found) return { ok: false, status: { code: "bad_option" } };
  if (world?.seed === undefined) return { ok: false, status: { code: "server_only" } };
  const status = wagerStatus(content, state, amount, now);
  if (status.code !== "ok") return { ok: false, status };
  const [a, b] = rollDice(world.seed);
  const payout = diceWins(option, a, b) ? Math.floor((amount * found.pays) / 100) : 0;
  let next = stake(state, amount, now);
  if (payout > 0) next = payOut(next, payout, now);
  return {
    ok: true,
    state: next,
    events: wagerEvents(content, "dice", option, amount, payout, [a, b], 0, now),
  };
}
