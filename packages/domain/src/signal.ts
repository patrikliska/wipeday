/**
 * The Signal (W7): the island's shared tower for the season's last week. It opens on season
 * day `opensOnDay`, or as soon as the season's end is announced. Everyone gives toward the
 * stage that is open (foundation, tower, lamp, fuel); when the last stage is full the Signal
 * is lit. Gifts rank on their own board (at reference prices) and give legacy points at the
 * reset (`legacy.ts`).
 *
 * The progress is shared, so it lives on the server (like the Den's board): a gift is a
 * server-only command that reads it from `World.signal`, and the server adds the gift to the
 * progress in the same transaction (`addGift`).
 */
import type { Amounts, Content } from "@wipe-day/content/schema";
import type { BaseState } from "./base";
import type { GameEvent } from "./events";
import { refValue } from "./goods";

const DAY = 86400;

export interface SignalProgress {
  /** Index of the stage open now; past the last one, the Signal is lit. */
  stage: number;
  /** Given toward the open stage so far. */
  given: Amounts;
  litAt: number | null;
}

/** The progress as the server hands it to a gift, with whether the Signal takes gifts now. */
export interface SignalView extends SignalProgress {
  open: boolean;
}

export function newSignal(): SignalProgress {
  return { stage: 0, given: {}, litAt: null };
}

/** Day of the season (1-based) for a base of that season. */
export function seasonDay(season: { startedAt: number }, now: number): number {
  return Math.floor((now - season.startedAt) / DAY) + 1;
}

/** Whether the Signal takes gifts: from `opensOnDay`, or once the end is announced. */
export function signalOpen(
  content: Content,
  season: { startedAt: number },
  now: number,
  announced: boolean,
): boolean {
  return announced || seasonDay(season, now) >= content.seasons.signal.opensOnDay;
}

/** What the open stage still needs, by good; empty once the Signal is lit. */
export function stillNeeded(content: Content, progress: SignalProgress): Amounts {
  const stage = content.seasons.signal.stages[progress.stage];
  if (!stage) return {};
  const out: Amounts = {};
  for (const [good, need] of Object.entries(stage.needs)) {
    const left = need - (progress.given[good] ?? 0);
    if (left > 0) out[good] = left;
  }
  return out;
}

export type GiveStatus =
  | { code: "ok"; amount: number }
  | { code: "server_only" }
  | { code: "signal_closed"; day: number }
  | { code: "signal_lit" }
  | { code: "not_needed" }
  | { code: "unaffordable"; missing: Amounts };

/**
 * Can the base give `amount` of `good` now? A gift is cut to what the stage still needs and
 * to what the base holds, so a click never overpays.
 */
export function giveStatus(
  content: Content,
  state: BaseState,
  signal: SignalView | undefined,
  good: string,
  amount: number,
): GiveStatus {
  if (!signal) return { code: "server_only" };
  if (signal.stage >= content.seasons.signal.stages.length) return { code: "signal_lit" };
  if (!signal.open) return { code: "signal_closed", day: content.seasons.signal.opensOnDay };
  const left = stillNeeded(content, signal)[good] ?? 0;
  if (left <= 0) return { code: "not_needed" };
  const have = state.stock[good] ?? 0;
  if (have < 1) return { code: "unaffordable", missing: { [good]: 1 } };
  return { code: "ok", amount: Math.max(1, Math.min(amount, left, have)) };
}

/** The giver's side: the goods leave the stock. The server adds them to the Signal. */
export function giveToSignal(
  content: Content,
  state: BaseState,
  signal: SignalView | undefined,
  good: string,
  amount: number,
):
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; status: Exclude<GiveStatus, { code: "ok" }> } {
  const status = giveStatus(content, state, signal, good, amount);
  if (status.code !== "ok") return { ok: false, status };
  return {
    ok: true,
    state: {
      ...state,
      stock: { ...state.stock, [good]: (state.stock[good] ?? 0) - status.amount },
    },
    events: [
      {
        type: "signal_gift",
        good,
        amount: status.amount,
        worth: refValue(content, good, status.amount),
        stage: signal?.stage ?? 0,
      },
    ],
  };
}

/** The Signal's side of a gift: a full stage opens the next; past the last, it is lit. */
export function addGift(
  content: Content,
  progress: SignalProgress,
  good: string,
  amount: number,
  now: number,
): SignalProgress {
  const given = { ...progress.given, [good]: (progress.given[good] ?? 0) + amount };
  const next = { ...progress, given };
  if (Object.keys(stillNeeded(content, next)).length > 0) return next;
  const stage = progress.stage + 1;
  const lit = stage >= content.seasons.signal.stages.length;
  return { stage, given: {}, litAt: lit ? now : null };
}
