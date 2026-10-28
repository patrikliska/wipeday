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
 * (`buy_research`) and the crows (`claim_gull`); R3 the cards (`open_drop`, `star_up`,
 * `craft_gear`, `equip_gear`), then the Work Orders (`claim_order`), the daily quests
 * (`claim_quest`) and scrap (`buy_boost`, `buy_drop`, `claim_tide`); R4 the nuke and the Blast Map.
 */
import { GROUND_ZERO, nodeOf } from "@wipe-day/content/blastmap";
import { DROP_TIERS, type DropTier } from "@wipe-day/content/cards";
import type { Content, FlotsamKind } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import type { Amount } from "./amount";
import { earnBadges } from "./badges";
import { gateOpen, hasFeature, nodeEffects, nodeState } from "./blastmap";
import { boostOf, boostUntil, tideSlot } from "./boosts";
import { gearOf, survivorOf } from "./cards";
import { credit, grantDrops, openDrop } from "./drops";
import type { GameEvent } from "./events";
import { arrivalKind, claimUntil, crateValue, flotsamAt, gapBefore } from "./flotsam";
import { crossing, gullValue } from "./gulls";
import { costFactor, costOf, eraOpen, handPriceOf, lineOf, maxAffordable } from "./lines";
import { orderClaimed, orderMet, orderOf, orderProgress } from "./orders";
import { glassYield, nuke } from "./prestige";
import { claimQuest, questClaimed, questMet, questOf, questProgress, rollQuests } from "./quests";
import { levelOf, levelsCost, maxResearch, mkFactor, researchGate, researchOf } from "./research";
import { earnScrap, pay, spendScrap } from "./scrap";
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
import type { BaseState, RunState } from "./state";
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
  | { type: "collect" }
  /** Open a held Supply Drop of `tier`; `pull` is `meta.drops.pulls` as the client saw it. */
  | { type: "open_drop"; tier: DropTier; pull: number }
  /** A survivor's next star, `to` (2-5), paid in its shards. */
  | { type: "star_up"; survivor: string; to: number }
  /** A gear card not yet owned, paid in shards of its rarity. */
  | { type: "craft_gear"; gear: string }
  /** Put a gear card on an owned survivor (swapping out what that slot held), or back (null). */
  | { type: "equip_gear"; gear: string; survivor: string | null }
  /** Claim a met Work Order `id` of run `run` (D256). */
  | { type: "claim_order"; run: number; id: string }
  /** Claim a met daily quest `id` of island day `day` (D257). */
  | { type: "claim_quest"; day: number; id: string }
  /** Buy a boost for scrap: a timed buff, or the Lucky Tide (D258). */
  | { type: "buy_boost"; boost: string }
  /** Buy a Supply Drop of tier II or III for scrap. */
  | { type: "buy_drop"; tier: 2 | 3 }
  /** Catch Lucky Tide crate `k` of run `run` while it floats. */
  | { type: "claim_tide"; run: number; k: number }
  /** Press the Big Red on run `run` (R4): the island goes, the glass stays (03-the-big-red.md). */
  | { type: "nuke"; run: number }
  /** Buy Blast Map nodes, the whole `path` or nothing, in order (04-blast-map.md 8.3). */
  | { type: "buy_node"; path: string[] }
  /** The admin's gift (server only): glass to held, a skin; logged with its note. */
  | { type: "grant"; glass: number; skin: string | null; note: string }
  /** The admin's full free respec (server only): every node but Ground Zero back to glass. */
  | { type: "respec" };

export type CommandType = Command["type"];

/** Taps and pings travel on the slim path: 1-hour records, no log rows, version-only pushes. */
export const SLIM_COMMANDS: readonly CommandType[] = ["taps", "ping"];
export const isSlim = (command: Command): boolean => SLIM_COMMANDS.includes(command.type);

/** Commands only the server issues (the admin's); a client never sends or predicts them. */
export const SERVER_ONLY: readonly CommandType[] = ["grant", "respec"];

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
  | { reason: "stale_run" }
  /** No Supply Drop of that tier is held. */
  | { reason: "no_drop" }
  /** Not enough shards: `need` and `have`. */
  | { reason: "shards"; need: number; have: number }
  /** That survivor already has five stars. */
  | { reason: "max_stars" }
  /** That card is not in the Album yet. */
  | { reason: "not_owned"; what: string }
  /** The command was sent for an older state (a second click): nothing happened. */
  | { reason: "stale" }
  /** Not enough scrap: `need` and `have`. */
  | { reason: "scrap"; need: number; have: number }
  /** That order or quest is not done yet: `value` of `goal` (null for a one-off condition). */
  | { reason: "unmet"; value: number | null; goal: number | null }
  /** That boost still runs until `until`: buy it again after. */
  | { reason: "running"; until: number }
  /** Nothing to launch yet: the next glass comes at `need` supplies made (R4). */
  | { reason: "not_ready"; need: Amount }
  /** Not enough glass: `need` and `have`. */
  | { reason: "glass"; need: Amount; have: Amount }
  /** That node is not in this build (a later wave). */
  | { reason: "hidden" }
  /** That node has no owned parent yet (the path was not whole). */
  | { reason: "no_parent"; what: string };

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
  // The island day's quests roll with time, like settle: the old day's met quests are paid, the
  // new day's drawn, before any rule runs (D257).
  const rolled = rollQuests(content, settled.state, now);
  const before = [...settled.events, ...rolled.events];
  let base = rolled.state;
  if (base.run.startedAt === null && (command.type === "taps" || isPurchase(command))) {
    base = { ...base, run: { ...base.run, startedAt: now } };
    // The flotsam schedule starts with the run's clock (D154).
    base = { ...base, run: { ...base.run, flotsam: flotsamAt(content, base, now) } };
  }
  const result = step(content, base, command, now);
  if (!result.ok) {
    return {
      ok: false,
      state: rolled.state,
      events: before,
      changed: settled.changed || rolled.events.length > 0,
      refusal: result.refusal,
    };
  }
  let run = result.state.run;
  if (isPurchase(command) && run.firstBuyAt === null) run = { ...run, firstBuyAt: now };
  run = { ...run, activeAt: now, madeAtActive: run.made };
  // The Big Red's readout keeps the run's best glass an hour (03 2.1), sampled per command; and
  // Personal Best (R4) turns on the first command after the run passes the record (never inside
  // settle, so settle stays path independent, N24).
  const after: BaseState = { ...result.state, run };
  if (command.type !== "nuke") {
    // Rounded, so two settle paths' float noise never shows up in a stored number (N24).
    const peak = Number(glassYield(content, after, now).peak.toPrecision(10));
    if (peak > run.peak) run = { ...run, peak };
    if (
      run.personalBestAt === null &&
      run.made > after.meta.records.bestRun &&
      after.meta.records.bestRun > 0 &&
      hasFeature(content, after.meta, "personal_best")
    )
      run = { ...run, personalBestAt: now };
  }
  const events = [...before, ...result.events];
  // Badges after every successful command, never on a refusal or inside settle (D198). They read
  // the command's own events only: settle's can be swallowed by an earlier settle (N24).
  const badges = earnBadges(content, { ...result.state, run }, result.events, now);
  // Then the drops the counters have earned (fells, badges), from the counters alone (D251).
  const paid = credit(content, badges.state, now);
  return {
    ok: true,
    state: paid.state,
    events: [...events, ...badges.events, ...paid.events],
    changed: true,
  };
}

function step(content: Content, state: BaseState, command: Command, now: number): Step {
  switch (command.type) {
    case "taps":
      return { ok: true, ...applyTaps(content, state, command, now) };
    case "ping":
      return { ok: true, state, events: [] };
    case "collect":
      return collect(content, state, now);
    case "nuke":
      return pressBigRed(content, state, command.run, now);
    case "buy_node":
      return buyNodes(content, state, command.path);
    case "grant":
      return grant(state, command.glass, command.skin, command.note);
    case "respec":
      return respec(content, state);
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
    case "open_drop":
      return openHeldDrop(content, state, command.tier, command.pull);
    case "star_up":
      return starUp(content, state, command.survivor, command.to);
    case "craft_gear":
      return craftGear(content, state, command.gear);
    case "equip_gear":
      return equipGear(content, state, command.gear, command.survivor);
    case "claim_order":
      return claimOrder(content, state, command.run, command.id, now);
    case "claim_quest":
      return claimDailyQuest(content, state, command.day, command.id);
    case "buy_boost":
      return buyBoost(content, state, command.boost, now);
    case "buy_drop":
      return buyDrop(content, state, command.tier);
    case "claim_tide":
      return claimTide(content, state, command.run, command.k, now);
  }
}

/**
 * Collect (the welcome card's one button): counts, and with Hot Breakfast (R4, Bunker 1.1) a
 * return after its hours starts a Rally: every line ×4 for 60 s, the Fuel Drum's buff.
 */
function collect(content: Content, state: BaseState, now: number): Step {
  const stats = { ...state.meta.stats, collects: state.meta.stats.collects + 1 };
  const full = windowEnd(content, state) <= now;
  const events: GameEvent[] = [{ type: "night_shift_collected", full }];
  let run = state.run;
  const breakfast = nodeEffects(content, state.meta).find(
    (effect) => effect.stat === "feature:hot_breakfast",
  );
  const drum = content.flotsam.kinds.find((kind) => "buff" in kind.effect);
  if (breakfast && drum && "buff" in drum.effect && now - run.activeAt >= breakfast.value * 3600) {
    const { buff, seconds } = drum.effect;
    const until = now + seconds;
    run = { ...run, buffs: [...run.buffs.filter((b) => b.kind !== buff), { kind: buff, until }] };
    events.push({ type: "boost_bought", boost: buff, until });
  }
  return { ok: true, state: { ...state, run, meta: { ...state.meta, stats } }, events };
}

/** The Big Red (03 1.5, 7.7): one hold on the right run, if the yield allows a press. */
function pressBigRed(content: Content, state: BaseState, n: number, now: number): Step {
  if (n !== state.run.n) return { ok: false, refusal: { reason: "stale_run" } };
  const y = glassYield(content, state, now);
  if (!y.pressable) return { ok: false, refusal: { reason: "not_ready", need: y.nextAt } };
  return { ok: true, ...nuke(content, state, now) };
}

/**
 * Blast Map nodes (04 5, 8.3): the whole path or nothing, in order, each node open (its ring
 * and own gate), reachable from what is owned or earlier on the path, and paid in glass held.
 * The server recomputes the cost; a path the client built on a stale map is refused whole.
 */
function buyNodes(content: Content, state: BaseState, path: string[]): Step {
  if (path.length === 0) return { ok: false, refusal: { reason: "unknown", what: "" } };
  const meta = state.meta;
  const owned = new Set(meta.nodes);
  let cost = 0;
  const ids: string[] = [];
  for (const id of path) {
    const node = nodeOf(content, id);
    if (!node) return { ok: false, refusal: { reason: "unknown", what: id } };
    if (id === GROUND_ZERO || owned.has(id)) return { ok: false, refusal: { reason: "owned" } };
    const check = nodeState(content, meta, id);
    if (check.kind === "hidden") return { ok: false, refusal: { reason: "hidden" } };
    if (check.kind === "ring_gate")
      return {
        ok: false,
        refusal: { reason: "locked", gate: { kind: "wipe_day", value: check.at } },
      };
    if (check.kind === "node_gate")
      return {
        ok: false,
        refusal: { reason: "locked", gate: { kind: "wipe_day", value: check.at } },
      };
    const parents =
      node.type === "completion"
        ? node.requires.every((parent) => owned.has(parent))
        : node.requires.some((parent) => owned.has(parent));
    if (!parents) return { ok: false, refusal: { reason: "no_parent", what: id } };
    if (!gateOpen(content, meta, node)) return { ok: false, refusal: { reason: "hidden" } };
    owned.add(id);
    ids.push(id);
    cost += node.cost;
  }
  if (cost > meta.glass.held)
    return { ok: false, refusal: { reason: "glass", need: cost, have: meta.glass.held } };
  return {
    ok: true,
    state: {
      ...state,
      meta: {
        ...meta,
        nodes: [...meta.nodes, ...ids],
        glass: { ...meta.glass, held: meta.glass.held - cost, spent: meta.glass.spent + cost },
      },
    },
    events: [{ type: "node_bought", ids, cost }],
  };
}

/** The admin's gift (09-architecture.md 9.6): to glass held only, never Glow or the formula. */
function grant(state: BaseState, glass: number, skin: string | null, note: string): Step {
  const meta = state.meta;
  return {
    ok: true,
    state: {
      ...state,
      meta: {
        ...meta,
        glass: { ...meta.glass, held: meta.glass.held + Math.max(0, glass) },
        skin: skin ?? meta.skin,
      },
    },
    events: [{ type: "granted", glass, skin, note }],
  };
}

/** A full free respec (04 5): every glass spent back, every node but Ground Zero cleared. */
function respec(_content: Content, state: BaseState): Step {
  const meta = state.meta;
  const nodes = meta.nodes.filter((id) => id === GROUND_ZERO);
  const refunded = meta.glass.spent;
  return {
    ok: true,
    state: {
      ...state,
      meta: {
        ...meta,
        nodes,
        glass: { ...meta.glass, held: meta.glass.held + refunded, spent: 0 },
      },
    },
    events: [{ type: "respecced", refunded, nodes: meta.nodes.length - nodes.length }],
  };
}

function claimOrder(content: Content, state: BaseState, n: number, id: string, now: number): Step {
  const run = state.run;
  if (n !== run.n) return { ok: false, refusal: { reason: "stale_run" } };
  const order = orderOf(content, id);
  if (!order || !run.orders.ids.includes(id))
    return { ok: false, refusal: { reason: "unknown", what: id } };
  if (orderClaimed(state, id)) return { ok: false, refusal: { reason: "claimed" } };
  if (!orderMet(content, state, order)) {
    const progress = orderProgress(content, state, order);
    return {
      ok: false,
      refusal: { reason: "unmet", value: progress?.value ?? null, goal: progress?.goal ?? null },
    };
  }
  const claimed = [...run.orders.claimed, id];
  const fuelsNow = claimed.length === content.orders.fuel && run.orders.fuelledAt === null;
  let out: BaseState = {
    ...state,
    run: {
      ...run,
      orders: { ...run.orders, claimed, fuelledAt: fuelsNow ? now : run.orders.fuelledAt },
    },
    meta: { ...state.meta, stats: { ...state.meta.stats, orders: state.meta.stats.orders + 1 } },
  };
  const events: GameEvent[] = [{ type: "order_claimed", id, pays: order.pays }];
  // Its shards are at once (D266); a drop would queue for the drops' hourly gate (`credit`,
  // after this step), as the set's does on the fuelling claim.
  const paid = pay(out, order.pays, "orders", true);
  out = paid.state;
  events.push(...paid.events);
  if (fuelsNow) {
    events.push({ type: "orders_fuelled", run: run.n, pays: content.orders.set });
    const bonus = pay(out, content.orders.set, "orders", true);
    out = bonus.state;
    events.push(...bonus.events);
  }
  return { ok: true, state: out, events };
}

function claimDailyQuest(content: Content, state: BaseState, day: number, id: string): Step {
  const quests = state.meta.quests;
  // The day moved under the click: the roll already paid what was met (D257).
  if (day !== quests.day) return { ok: false, refusal: { reason: "stale" } };
  const quest = questOf(content, id);
  if (!quest || !quests.ids.includes(id))
    return { ok: false, refusal: { reason: "unknown", what: id } };
  if (questClaimed(state, id)) return { ok: false, refusal: { reason: "claimed" } };
  if (!questMet(state, quest)) {
    const progress = questProgress(state, quest);
    return { ok: false, refusal: { reason: "unmet", value: progress.value, goal: progress.goal } };
  }
  return { ok: true, ...claimQuest(content, state, quest) };
}

function buyBoost(content: Content, state: BaseState, id: string, now: number): Step {
  const boost = boostOf(content, id);
  if (!boost) return { ok: false, refusal: { reason: "unknown", what: id } };
  const until = boostUntil(state, boost, now);
  if (until !== null) return { ok: false, refusal: { reason: "running", until } };
  const have = state.meta.scrap;
  if (have < boost.cost) return { ok: false, refusal: { reason: "scrap", need: boost.cost, have } };
  const ends = now + boost.seconds;
  let run: RunState = state.run;
  if (boost.tide) {
    run = { ...run, tide: { boost: id, from: now, until: ends, last: -1 } };
  } else {
    // The buff of its kind (none runs: checked above); other kinds multiply (D148).
    run = {
      ...run,
      buffs: [...run.buffs.filter((buff) => buff.kind !== id), { kind: id, until: ends }],
    };
  }
  return {
    ok: true,
    state: spendScrap({ ...state, run }, boost.cost),
    events: [
      { type: "scrap_spent", n: boost.cost, what: id },
      { type: "boost_bought", boost: id, until: ends },
    ],
  };
}

function buyDrop(content: Content, state: BaseState, tier: 2 | 3): Step {
  const cost = content.scrap.drops[tier];
  if (cost === undefined) return { ok: false, refusal: { reason: "unknown", what: String(tier) } };
  const have = state.meta.scrap;
  if (have < cost) return { ok: false, refusal: { reason: "scrap", need: cost, have } };
  return {
    ok: true,
    state: grantDrops(spendScrap(state, cost), tier, 1),
    events: [
      { type: "scrap_spent", n: cost, what: `drop_${tier}` },
      { type: "drop_earned", tier, count: 1, source: "scrap" },
    ],
  };
}

function claimTide(content: Content, state: BaseState, n: number, k: number, now: number): Step {
  const run = state.run;
  if (n !== run.n) return { ok: false, refusal: { reason: "stale_run" } };
  if (!Number.isInteger(k) || k < 0)
    return { ok: false, refusal: { reason: "unknown", what: String(k) } };
  const tide = run.tide;
  if (!tide) return { ok: false, refusal: { reason: "gone", at: null } };
  if (k <= tide.last) return { ok: false, refusal: { reason: "claimed" } };
  const slot = tideSlot(content, state, k);
  if (!slot || now < slot.at || now > slot.until)
    return { ok: false, refusal: { reason: "gone", at: slot && now < slot.at ? slot.at : null } };
  const lump = crateValue(content, state, slot.kind, now);
  const caught = withCatch(run, slot.kind, lump, now);
  return {
    ok: true,
    state: { ...state, run: { ...caught, tide: { ...tide, last: k } } },
    events: [{ type: "tide_claimed", kind: slot.kind.id, k, value: lump }],
  };
}

/** The run after catching `kind`: its lump, or its buff (the same kind again restarts, D148). */
function withCatch(run: RunState, kind: FlotsamKind, lump: Amount, now: number): RunState {
  const effect = kind.effect;
  const buffs =
    "buff" in effect
      ? [
          ...run.buffs.filter((buff) => buff.kind !== effect.buff),
          { kind: effect.buff, until: now + effect.seconds },
        ]
      : run.buffs;
  return { ...run, supplies: run.supplies + lump, made: run.made + lump, buffs };
}

function openHeldDrop(content: Content, state: BaseState, tier: DropTier, pull: number): Step {
  if (!DROP_TIERS.includes(tier))
    return { ok: false, refusal: { reason: "unknown", what: String(tier) } };
  if (pull !== state.meta.drops.pulls) return { ok: false, refusal: { reason: "stale" } };
  if (state.meta.drops.held[tier] <= 0) return { ok: false, refusal: { reason: "no_drop" } };
  const opened = openDrop(content, state, tier);
  return {
    ok: true,
    state: opened.state,
    events: [{ type: "drop_opened", tier, cards: opened.cards }],
  };
}

function starUp(content: Content, state: BaseState, survivor: string, to: number): Step {
  if (!survivorOf(content, survivor))
    return { ok: false, refusal: { reason: "unknown", what: survivor } };
  const stars = state.meta.cards.survivors[survivor];
  if (stars === undefined) return { ok: false, refusal: { reason: "not_owned", what: survivor } };
  const costs = content.cards.stars.costs;
  if (stars >= costs.length + 1) return { ok: false, refusal: { reason: "max_stars" } };
  // A second click asks for a star already bought.
  if (to !== stars + 1) return { ok: false, refusal: { reason: to <= stars ? "owned" : "stale" } };
  const cost = costs[stars - 1] ?? Number.POSITIVE_INFINITY;
  const drops = state.meta.drops;
  const have = drops.shards.crew[survivor] ?? 0;
  if (have < cost) return { ok: false, refusal: { reason: "shards", need: cost, have } };
  const crew = { ...drops.shards.crew, [survivor]: have - cost };
  const meta = {
    ...state.meta,
    cards: { ...state.meta.cards, survivors: { ...state.meta.cards.survivors, [survivor]: to } },
    drops: { ...drops, shards: { ...drops.shards, crew } },
  };
  return {
    ok: true,
    state: { ...state, meta },
    events: [{ type: "starred", survivor, stars: to, cost }],
  };
}

function craftGear(content: Content, state: BaseState, id: string): Step {
  const gear = gearOf(content, id);
  if (!gear) return { ok: false, refusal: { reason: "unknown", what: id } };
  if (id in state.meta.cards.gear) return { ok: false, refusal: { reason: "owned" } };
  const cost = content.cards.shards.craft[gear.rarity];
  const drops = state.meta.drops;
  const have = drops.shards.gear[gear.rarity];
  if (have < cost) return { ok: false, refusal: { reason: "shards", need: cost, have } };
  const meta = {
    ...state.meta,
    cards: { ...state.meta.cards, gear: { ...state.meta.cards.gear, [id]: null } },
    drops: {
      ...drops,
      shards: { ...drops.shards, gear: { ...drops.shards.gear, [gear.rarity]: have - cost } },
    },
  };
  return {
    ok: true,
    state: { ...state, meta },
    events: [{ type: "gear_crafted", gear: id, cost }],
  };
}

function equipGear(content: Content, state: BaseState, id: string, survivor: string | null): Step {
  const gear = gearOf(content, id);
  if (!gear) return { ok: false, refusal: { reason: "unknown", what: id } };
  const cards = state.meta.cards;
  if (!(id in cards.gear)) return { ok: false, refusal: { reason: "not_owned", what: id } };
  if (survivor !== null) {
    if (!survivorOf(content, survivor))
      return { ok: false, refusal: { reason: "unknown", what: survivor } };
    if (cards.survivors[survivor] === undefined)
      return { ok: false, refusal: { reason: "not_owned", what: survivor } };
  }
  // Already so: a second click changes nothing (and keeps the effects cache).
  if (cards.gear[id] === survivor)
    return { ok: true, state, events: [{ type: "gear_equipped", gear: id, survivor }] };
  const worn: Record<string, string | null> = { ...cards.gear, [id]: survivor };
  // One card a slot: what the survivor wore there goes back to the Album.
  if (survivor !== null)
    for (const other of content.cards.gear)
      if (other.id !== id && other.slot === gear.slot && worn[other.id] === survivor)
        worn[other.id] = null;
  return {
    ok: true,
    state: { ...state, meta: { ...state.meta, cards: { ...cards, gear: worn } } },
    events: [{ type: "gear_equipped", gear: id, survivor }],
  };
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
  const caught: BaseState = {
    ...state,
    run: {
      ...run,
      supplies: run.supplies + value,
      made: run.made + value,
      gulls: { caught: run.gulls.caught + 1, last: k },
    },
    meta: { ...state.meta, stats: { ...state.meta.stats, gulls: state.meta.stats.gulls + 1 } },
  };
  const events: GameEvent[] = [{ type: "gull_caught", k, elite: slot.elite, value }];
  // The Magpie pays its scrap too (D248, D259).
  const magpie = slot.elite ? earnScrap(caught, content.scrap.magpie, "magpie") : null;
  if (magpie) events.push(...magpie.events);
  return { ok: true, state: magpie ? magpie.state : caught, events };
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
  const drop = "drop" in effect ? effect.drop : null;
  const caught: BaseState = {
    ...state,
    run: {
      ...withCatch(run, kind, lump, now),
      flotsam: { k, at, caught: cursor.caught + 1, last: k },
    },
    meta: { ...state.meta, stats: { ...state.meta.stats, flotsam: state.meta.stats.flotsam + 1 } },
  };
  // The next arrival follows this one's own time, whenever it was caught.
  const next = k + 1;
  const flotsam = { ...caught.run.flotsam, k: next, at: at + gapBefore(content, caught, next, at) };
  const events: GameEvent[] = [{ type: "flotsam_claimed", kind: kind.id, k, value: lump }];
  let out: BaseState = { ...caught, run: { ...caught.run, flotsam } };
  // The Sealed Locker: a Supply Drop instead of supplies (12-feel.md 7.1).
  if (drop !== null) {
    out = grantDrops(out, drop, 1);
    events.push({ type: "drop_earned", tier: drop, count: 1, source: "locker" });
  }
  return { ok: true, state: out, events };
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
      meta: {
        ...state.meta,
        stats: { ...state.meta.stats, upgrades: state.meta.stats.upgrades + 1 },
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
  const factor = mkFactor(content, state, def);
  const k = count === "max" ? maxResearch(def, n, supplies, owned, factor) : 1;
  const cost = levelsCost(def, n, Math.max(1, k)) * factor;
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
  // The first time ever this era is reached (the feed's "first Armored", R4): the lifetime
  // count of eras reached says whether any earlier run got this far.
  const first = !everReached(content, state, era.id);
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
    events: first
      ? [{ type: "era_reached", era: era.id, at, first }]
      : [{ type: "era_reached", era: era.id, at }],
  };
}

/**
 * Whether any run before this one reached `era`: the badges' wall keeps the first time each era
 * was reached (`era_<id>` badges, from R2), so no new counter is needed.
 */
function everReached(content: Content, state: BaseState, era: string): boolean {
  const badge = content.achievements.badges.find(
    (row) =>
      row.when.kind === "state" &&
      row.when.state === "era" &&
      row.when.gte === TIERS.indexOf(era as (typeof TIERS)[number]),
  );
  return badge !== undefined && state.meta.badges[badge.id] !== undefined;
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
