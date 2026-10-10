/**
 * Every player action as data, and the one function that applies it (D64; docs/redesign/
 * 09-architecture.md 6). The API runs it inside a transaction, the web client runs it to predict
 * the result before the server answers (and to play in demo mode), and the simulator runs it for
 * its archetypes: one rulebook, three callers.
 *
 * The pipeline: settle to `now`; start the run's clock on its first taps or purchase; apply the
 * rule (a refusal keeps the settled state and says what is missing); on success the Night Shift
 * window restarts (`activeAt`).
 *
 * R0's commands: `taps` and `ping` (the slim path, D134), `buy_line` and `hire_hand`. R1 adds
 * the shelf, eras, flotsam and Collect; R2 the nuke and the Blast Map.
 */
import type { Content } from "@wipe-day/content/schema";
import type { Amount } from "./amount";
import type { GameEvent } from "./events";
import { costFactor, costOf, eraOpen, handPriceOf, lineOf, maxAffordable } from "./lines";
import { cyclePayout, settle } from "./settle";
import type { BaseState } from "./state";
import { applyTaps } from "./taps";
import type { World } from "./world";

export type BuyCount = 1 | 10 | 100 | "max";

export type Command =
  /** Taps from `from` to `to` (whole seconds): at most 1 s or 30 taps a batch (D134). */
  | { type: "taps"; count: number; from: number; to: number }
  /** A visible tab is still there: restarts the Night Shift window. */
  | { type: "ping" }
  | { type: "buy_line"; line: string; count: BuyCount }
  | { type: "hire_hand"; line: string };

export type CommandType = Command["type"];

/** Taps and pings travel on the slim path: 1-hour records, no log rows, version-only pushes. */
export const SLIM_COMMANDS: readonly CommandType[] = ["taps", "ping"];
export const isSlim = (command: Command): boolean => SLIM_COMMANDS.includes(command.type);

/** Commands the client cannot predict (none since the redesign; kept for `set_cosmetic`). */
export const SERVER_ONLY: readonly CommandType[] = [];

/**
 * Why a command did not happen, with what is missing (rule 6.3.5): `need` and `have` in
 * supplies, or the `gate` that opens it.
 */
export type Refusal =
  | { reason: "unknown"; what: string }
  | { reason: "locked"; gate: { kind: "era"; value: string } }
  | { reason: "supplies"; need: Amount; have: Amount }
  | { reason: "max_owned"; have: number }
  | { reason: "no_units" }
  | { reason: "hired" };

export type CommandResult =
  | { ok: true; state: BaseState; events: GameEvent[]; changed: boolean }
  | { ok: false; state: BaseState; events: GameEvent[]; changed: boolean; refusal: Refusal };

type Step = { ok: true; state: BaseState; events: GameEvent[] } | { ok: false; refusal: Refusal };

const isPurchase = (command: Command): boolean =>
  command.type === "buy_line" || command.type === "hire_hand";

/**
 * Settles `state` to `now`, then applies `command`. Pure; the caller owns the clock.
 * `world`: what only the server knows (unused until R6's friends).
 */
export function applyCommand(
  content: Content,
  state: BaseState,
  command: Command,
  now: number,
  _world?: World,
): CommandResult {
  const settled = settle(content, state, now);
  let base = settled.state;
  if (base.run.startedAt === null && (command.type === "taps" || isPurchase(command))) {
    base = { ...base, run: { ...base.run, startedAt: now } };
  }
  const result = step(content, base, command, now);
  if (!result.ok) {
    return {
      ok: false,
      state: settled.state,
      events: settled.events,
      changed: settled.changed,
      refusal: result.refusal,
    };
  }
  let run = result.state.run;
  if (isPurchase(command) && run.firstBuyAt === null) run = { ...run, firstBuyAt: now };
  run = { ...run, activeAt: now, madeAtActive: run.made };
  return {
    ok: true,
    state: { ...result.state, run },
    events: [...settled.events, ...result.events],
    changed: true,
  };
}

function step(content: Content, state: BaseState, command: Command, now: number): Step {
  switch (command.type) {
    case "taps":
      return { ok: true, ...applyTaps(content, state, command, now) };
    case "ping":
      return { ok: true, state, events: [] };
    case "buy_line":
      return buyLine(content, state, command.line, command.count);
    case "hire_hand":
      return hireHand(content, state, command.line, now);
  }
}

function buyLine(content: Content, state: BaseState, id: string, count: BuyCount): Step {
  const line = lineOf(content, id);
  if (!line) return { ok: false, refusal: { reason: "unknown", what: id } };
  if (!eraOpen(state, line))
    return { ok: false, refusal: { reason: "locked", gate: { kind: "era", value: line.era } } };
  const n = state.run.lines[id] ?? 0;
  const factor = costFactor(content, state, line);
  const supplies = state.run.supplies;
  if (n >= line.maxOwned) return { ok: false, refusal: { reason: "max_owned", have: n } };
  let k: number;
  if (count === "max") {
    k = maxAffordable(line, n, supplies, factor);
    if (k === 0) {
      return {
        ok: false,
        refusal: { reason: "supplies", need: costOf(line, n, 1, factor), have: supplies },
      };
    }
  } else {
    k = count;
    if (n + k > line.maxOwned) return { ok: false, refusal: { reason: "max_owned", have: n } };
  }
  const cost = costOf(line, n, k, factor);
  if (cost > supplies)
    return { ok: false, refusal: { reason: "supplies", need: cost, have: supplies } };
  return {
    ok: true,
    state: {
      ...state,
      run: {
        ...state.run,
        supplies: Math.max(0, supplies - cost),
        lines: { ...state.run.lines, [id]: n + k },
      },
    },
    events: [{ type: "bought", line: id, count: k, cost }],
  };
}

function hireHand(content: Content, state: BaseState, id: string, now: number): Step {
  const line = lineOf(content, id);
  if (!line) return { ok: false, refusal: { reason: "unknown", what: id } };
  if (!eraOpen(state, line))
    return { ok: false, refusal: { reason: "locked", gate: { kind: "era", value: line.era } } };
  if (state.run.hands.includes(id)) return { ok: false, refusal: { reason: "hired" } };
  if ((state.run.lines[id] ?? 0) <= 0) return { ok: false, refusal: { reason: "no_units" } };
  const price = handPriceOf(content, state, line);
  const supplies = state.run.supplies;
  if (price > supplies)
    return { ok: false, refusal: { reason: "supplies", need: price, have: supplies } };
  // The cycle in flight pays at once, in full: the hand finishes what the taps started.
  const ready = state.run.readyAt[id];
  const flight = ready !== undefined && ready > now ? cyclePayout(content, state, id, now) : 0;
  const { [id]: _done, ...readyAt } = state.run.readyAt;
  return {
    ok: true,
    state: {
      ...state,
      run: {
        ...state.run,
        supplies: Math.max(0, supplies - price) + flight,
        made: state.run.made + flight,
        hands: [...state.run.hands, id],
        readyAt,
      },
      meta: { ...state.meta, stats: { ...state.meta.stats, hands: state.meta.stats.hands + 1 } },
    },
    events: [{ type: "hand_hired", line: id, hand: line.hand }],
  };
}
