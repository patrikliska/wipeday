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
 * the shelf (`buy_upgrade`), eras (`buy_era`), flotsam and Collect; R2 the Workshop
 * (`buy_research`) and the crows (`claim_gull`); R4 the nuke and the Blast Map.
 */
import type { Content } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import type { Amount } from "./amount";
import { earnBadges } from "./badges";
import type { GameEvent } from "./events";
import { arrivalKind, claimUntil, crateValue, flotsamAt, gapBefore } from "./flotsam";
import { crossing, gullValue } from "./gulls";
import { costFactor, costOf, eraOpen, handPriceOf, lineOf, maxAffordable } from "./lines";
import { levelOf, levelsCost, maxResearch, researchGate, researchOf } from "./research";
import { cyclePayout, settle, windowEnd } from "./settle";
import {
  bought,
  eraCost,
  eraGate,
  type Gate,
  nextEra,
  rosterReached,
  upgradeCost,
  upgradeGate,
  upgradeOf,
} from "./shelf";
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
  | { type: "hire_hand"; line: string }
  /** A shelf row: a Grip rung or an island upgrade. */
  | { type: "buy_upgrade"; upgrade: string }
  /** The next level of a Workshop item, or as many as the supplies buy ("max"). */
  | { type: "buy_research"; item: string; count: 1 | "max" }
  /** The next era. */
  | { type: "buy_era"; era: string }
  /** Catch flotsam arrival `k` of run `run` while it floats. */
  | { type: "claim_flotsam"; run: number; k: number }
  /** Catch crow `k` of run `run` while it crosses the sky (D197, D238). */
  | { type: "claim_gull"; run: number; k: number }
  /** The welcome-back card's one button: back to work (restarts the Night Shift). */
  | { type: "collect" };

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
  | { reason: "locked"; gate: Gate }
  | { reason: "supplies"; need: Amount; have: Amount }
  | { reason: "max_owned"; have: number }
  | { reason: "no_units" }
  | { reason: "hired" }
  /** That shelf row or era is already bought. */
  | { reason: "owned" }
  /** Eras go in order: `era` comes first. */
  | { reason: "not_next"; era: string }
  /** That flotsam drifted off (or has not washed up yet); `at` is when the next one does. */
  | { reason: "gone"; at: number | null }
  /** That flotsam is already caught. */
  | { reason: "claimed" }
  /** That flotsam belonged to an earlier run. */
  | { reason: "stale_run" };

export type { Gate };

export type CommandResult =
  | { ok: true; state: BaseState; events: GameEvent[]; changed: boolean }
  | { ok: false; state: BaseState; events: GameEvent[]; changed: boolean; refusal: Refusal };

type Step = { ok: true; state: BaseState; events: GameEvent[] } | { ok: false; refusal: Refusal };

const PURCHASES: readonly CommandType[] = [
  "buy_line",
  "hire_hand",
  "buy_upgrade",
  "buy_research",
  "buy_era",
];
const isPurchase = (command: Command): boolean => PURCHASES.includes(command.type);

/**
 * Settles `state` to `now`, then applies `command`. Pure; the caller owns the clock.
 * `world`: what only the server knows (unused until R8's friends).
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
    // The flotsam schedule starts with the run's clock (D154).
    base = { ...base, run: { ...base.run, flotsam: flotsamAt(content, base, now) } };
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
  const events = [...settled.events, ...result.events];
  // Badges after every successful command, never on a refusal or inside settle (D198). They read
  // the command's own events only: settle's can be swallowed by an earlier settle (N24).
  const badges = earnBadges(content, { ...result.state, run }, result.events, now);
  return {
    ok: true,
    state: badges.state,
    events: [...events, ...badges.events],
    changed: true,
  };
}

function step(content: Content, state: BaseState, command: Command, now: number): Step {
  switch (command.type) {
    case "taps":
      return { ok: true, ...applyTaps(content, state, command, now) };
    case "ping":
      return { ok: true, state, events: [] };
    case "collect": {
      const stats = { ...state.meta.stats, collects: state.meta.stats.collects + 1 };
      const full = windowEnd(content, state) <= now;
      return {
        ok: true,
        state: { ...state, meta: { ...state.meta, stats } },
        events: [{ type: "night_shift_collected", full }],
      };
    }
    case "buy_line":
      return buyLine(content, state, command.line, command.count);
    case "hire_hand":
      return hireHand(content, state, command.line, now);
    case "buy_upgrade":
      return buyUpgrade(content, state, command.upgrade);
    case "buy_research":
      return buyResearch(content, state, command.item, command.count, now);
    case "buy_era":
      return buyEra(content, state, command.era, now);
    case "claim_flotsam":
      return claimFlotsam(content, state, command.run, command.k, now);
    case "claim_gull":
      return claimGull(content, state, command.run, command.k, now);
  }
}

function claimGull(content: Content, state: BaseState, n: number, k: number, now: number): Step {
  const run = state.run;
  if (n !== run.n) return { ok: false, refusal: { reason: "stale_run" } };
  if (!Number.isInteger(k) || k < 0)
    return { ok: false, refusal: { reason: "unknown", what: String(k) } };
  if (k <= run.gulls.last) return { ok: false, refusal: { reason: "claimed" } };
  const startedAt = run.startedAt;
  const slot = startedAt === null ? null : crossing(content, state, startedAt, k);
  if (!slot || now < slot.at || now > slot.until)
    return { ok: false, refusal: { reason: "gone", at: slot && now < slot.at ? slot.at : null } };
  const value = gullValue(content, state, slot.elite, now);
  return {
    ok: true,
    state: {
      ...state,
      run: {
        ...run,
        supplies: run.supplies + value,
        made: run.made + value,
        gulls: { caught: run.gulls.caught + 1, last: k },
      },
      meta: { ...state.meta, stats: { ...state.meta.stats, gulls: state.meta.stats.gulls + 1 } },
    },
    events: [{ type: "gull_caught", k, elite: slot.elite, value }],
  };
}

function claimFlotsam(content: Content, state: BaseState, n: number, k: number, now: number): Step {
  const run = state.run;
  if (n !== run.n) return { ok: false, refusal: { reason: "stale_run" } };
  const cursor = run.flotsam;
  if (k === cursor.last) return { ok: false, refusal: { reason: "claimed" } };
  // Settle has already moved the cursor past arrivals whose window closed.
  const at = cursor.at;
  if (k !== cursor.k || at === null || now < at || now > claimUntil(content, state, at))
    return { ok: false, refusal: { reason: "gone", at } };
  const kind = arrivalKind(content, state, k);
  const effect = kind.effect;
  const lump = crateValue(content, state, kind, now);
  const buffs =
    "buff" in effect
      ? [
          // The same kind again restarts its timer; different kinds multiply (D148).
          ...run.buffs.filter((buff) => buff.kind !== effect.buff),
          { kind: effect.buff, until: now + effect.seconds },
        ]
      : run.buffs;
  const caught: BaseState = {
    ...state,
    run: {
      ...run,
      supplies: run.supplies + lump,
      made: run.made + lump,
      buffs,
      flotsam: { k, at, caught: cursor.caught + 1, last: k },
    },
    meta: { ...state.meta, stats: { ...state.meta.stats, flotsam: state.meta.stats.flotsam + 1 } },
  };
  // The next arrival follows this one's own time, whenever it was caught.
  const next = k + 1;
  const flotsam = { ...caught.run.flotsam, k: next, at: at + gapBefore(content, caught, next, at) };
  return {
    ok: true,
    state: { ...caught, run: { ...caught.run, flotsam } },
    events: [{ type: "flotsam_claimed", kind: kind.id, k, value: lump }],
  };
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
  const next: BaseState = {
    ...state,
    run: {
      ...state.run,
      supplies: Math.max(0, supplies - cost),
      lines: { ...state.run.lines, [id]: n + k },
    },
    meta: { ...state.meta, stats: { ...state.meta.stats, units: state.meta.stats.units + k } },
  };
  // A roster tier, once every open line reaches it, stays for the run.
  const roster = rosterReached(content, next);
  return {
    ok: true,
    state: roster === next.run.roster ? next : { ...next, run: { ...next.run, roster } },
    events: [{ type: "bought", line: id, count: k, cost }],
  };
}

function buyUpgrade(content: Content, state: BaseState, id: string): Step {
  const upgrade = upgradeOf(content, id);
  if (!upgrade) return { ok: false, refusal: { reason: "unknown", what: id } };
  if (bought(state, id)) return { ok: false, refusal: { reason: "owned" } };
  const gate = upgradeGate(content, state, upgrade);
  if (gate) return { ok: false, refusal: { reason: "locked", gate } };
  const cost = upgradeCost(content, state, upgrade);
  const supplies = state.run.supplies;
  if (cost > supplies)
    return { ok: false, refusal: { reason: "supplies", need: cost, have: supplies } };
  return {
    ok: true,
    state: {
      ...state,
      run: {
        ...state.run,
        supplies: Math.max(0, supplies - cost),
        upgrades: [...state.run.upgrades, id],
      },
    },
    events: [{ type: "upgraded", upgrade: id, cost }],
  };
}

function buyResearch(
  content: Content,
  state: BaseState,
  id: string,
  count: 1 | "max",
  now: number,
): Step {
  const def = researchOf(content, id);
  if (!def) return { ok: false, refusal: { reason: "unknown", what: id } };
  const n = levelOf(state, id);
  if (n >= def.levels) return { ok: false, refusal: { reason: "max_owned", have: n } };
  const gate = researchGate(content, state, def, now);
  if (gate) return { ok: false, refusal: { reason: "locked", gate } };
  const supplies = state.run.supplies;
  const owned = def.line === undefined ? 0 : (state.run.lines[def.line] ?? 0);
  const k = count === "max" ? maxResearch(def, n, supplies, owned) : 1;
  const cost = levelsCost(def, n, Math.max(1, k));
  if (k === 0 || cost > supplies)
    return { ok: false, refusal: { reason: "supplies", need: cost, have: supplies } };
  const stats = state.meta.stats;
  return {
    ok: true,
    state: {
      ...state,
      run: {
        ...state.run,
        supplies: Math.max(0, supplies - cost),
        // A new object: the effects cache keys on it (effects.ts).
        research: { ...state.run.research, [id]: n + k },
      },
      meta: { ...state.meta, stats: { ...stats, research: stats.research + k } },
    },
    events: [{ type: "researched", item: id, level: n + k, count: k, cost }],
  };
}

function buyEra(content: Content, state: BaseState, id: string, now: number): Step {
  const era = content.eras.find((row) => row.id === id);
  if (!era) return { ok: false, refusal: { reason: "unknown", what: id } };
  const next = nextEra(content, state);
  if (!next || TIERS.indexOf(era.id) < TIERS.indexOf(next.id))
    return { ok: false, refusal: { reason: "owned" } };
  if (era.id !== next.id) return { ok: false, refusal: { reason: "not_next", era: next.id } };
  const gate = eraGate(state, era);
  if (gate) return { ok: false, refusal: { reason: "locked", gate } };
  const cost = eraCost(content, state, era);
  const supplies = state.run.supplies;
  if (cost > supplies)
    return { ok: false, refusal: { reason: "supplies", need: cost, have: supplies } };
  // A purchase starts the run's clock before the step, so `startedAt` is set.
  const at = now - (state.run.startedAt ?? now);
  return {
    ok: true,
    state: {
      ...state,
      run: {
        ...state.run,
        supplies: Math.max(0, supplies - cost),
        era: era.id,
        eraAt: { ...state.run.eraAt, [era.id]: at },
        // The new target starts fresh; the old one's last fall is the scene's (D153).
        target: { ...state.run.target, taps: 0 },
      },
      meta: { ...state.meta, stats: { ...state.meta.stats, eras: state.meta.stats.eras + 1 } },
    },
    events: [{ type: "era_reached", era: era.id, at }],
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
