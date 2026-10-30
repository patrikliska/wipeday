/**
 * Simulator v2 (D144; docs/redesign/10-balance.md 7): lifetimes of runs played through the real
 * domain, so there is no second economy: if a number differs from the game, the domain is wrong.
 *
 * Each archetype (`pacing.json5`) checks in on its sessions, taps as the client sends taps
 * (batches of 1 s for the first 10 online minutes of a run, then 5 s, through the token bucket),
 * buys what the crown picks (`advisor.ts` `crown()`, weighed by its own pace as the client
 * weighs the player's; D178), catches its share of the flotsam that floats while it is online,
 * and is away in between, where settle runs in closed form. Deterministic: seeds only, no clock
 * reads.
 *
 * R4: the real `nuke` through `applyCommand`, pressed by each archetype's policy (the crown,
 * doubling, or the optimal's "past the peak"), and after every press the Blast Map's pick bought
 * while glass allows (`nodePick`, D268), so N11-N14 and 4.10 read the game as shipped.
 *
 * R3's cards (D252): every archetype opens its drops at once, buys each star its shards pay
 * for, crafts the first missing gear its rarity shards buy, and after a hire or a new card puts
 * the strongest production gear on the hired survivors whose lines make the most.
 *
 * R3 S2: every archetype claims the Work Orders and the daily quests it has met (after each
 * batch), catches Lucky Tide crates by its flotsam share, and spends scrap by its `spend` policy
 * at a session's start: boosts (Overdrive, Double Time while it taps, the tide while it catches),
 * tier-II drops, or none.
 */

import { RARITIES, SLOTS } from "@wipe-day/content/cards";
import type { Archetype, Assertion, Content, Phase } from "@wipe-day/content/schema";
import { PHASES } from "@wipe-day/content/schema";
import { choices, crown, lasting, type Player } from "@wipe-day/domain/advisor";
import { assertFiniteState } from "@wipe-day/domain/amount";
import { type NodeDef, nodeEffects, nodePick, shippedNodes } from "@wipe-day/domain/blastmap";
import { tideAt } from "@wipe-day/domain/boosts";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import { dropsOnWay } from "@wipe-day/domain/drops";
import { foldStat, fullRate, glow, rates, unitRate } from "@wipe-day/domain/effects";
import type { GameEvent } from "@wipe-day/domain/events";
import { claimUntil, flotsamAt } from "@wipe-day/domain/flotsam";
import { gullAt } from "@wipe-day/domain/gulls";
import { fuelled, orderClaimed, orderMet, ordersOf } from "@wipe-day/domain/orders";
import { bigRedCrown, glassYield, runAge } from "@wipe-day/domain/prestige";
import { questClaimed, questMet, questsOf } from "@wipe-day/domain/quests";
import { workshopOpensAt } from "@wipe-day/domain/research";
import { rng, SEED, seedOf } from "@wipe-day/domain/rng";
import { mannedRate, settle } from "@wipe-day/domain/settle";
import { type BaseState, type Meta, newBase } from "@wipe-day/domain/state";
import { tapParts } from "@wipe-day/domain/taps";
import { weatherAt } from "@wipe-day/domain/weather";

/** Day 1 starts at this UTC midnight. */
export const DAY0 = 1_699_920_000;
const DAY = 86_400;
/** Batches are 1 s for this long into a run's online time, then 5 s (`10-balance.md` 7.3). */
const FINE_SECONDS = 600;
/** A batch holds at most this many taps (the client's tail, D134). */
const MAX_BATCH = 30;
/** The runs N5 and N6 look at. */
const EARLY_RUNS = 5;

export interface Session {
  /** Seconds after midnight (UTC). */
  start: number;
  seconds: number;
}

/** "08:00+5m" → one session a day; "hourly+5m" → 24. */
export function sessionsOf(archetype: Archetype): Session[] {
  const out: Session[] = [];
  for (const spec of archetype.sessions) {
    const [when = "", length = "0m"] = spec.split("+");
    const seconds = Number.parseInt(length, 10) * 60;
    if (when === "hourly") {
      for (let hour = 0; hour < 24; hour++) out.push({ start: hour * 3600, seconds });
    } else {
      const [h = "0", m = "0"] = when.split(":");
      out.push({ start: Number(h) * 3600 + Number(m) * 60, seconds });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export interface DayRow {
  day: number;
  run: number;
  supplies: number;
  made: number;
  lifetime: number;
  owned: number;
  hands: number;
  glassEver: number;
  nukes: number;
  /** Counted Wipe Days (R4). */
  wipeDays: number;
  taps: number;
  /** Supply Drops opened so far, and cards owned (R3). */
  drops: number;
  cards: number;
  /** Scrap ever earned, Work Orders and quests claimed so far (R3 S2). */
  scrap: number;
  orders: number;
  quests: number;
  /** The Album's pace (R3 S4, N33): Common and Rare cards owned (the base set), drops promised
   * and not yet paid by the gate, stars above 1, gear shards held, gear crafted. */
  baseSet: number;
  owed: number;
  stars: number;
  shards: number;
  crafted: number;
}

export interface RunRow {
  n: number;
  /** Seconds after DAY0. */
  start: number;
  end: number | null;
  made: number;
  glass: number;
  /** Work Orders claimed in the run, and whether the set was fuelled (R3 S2). */
  orders: number;
  fuelled: boolean;
  /** R4: the Wipe Day it counted as (null: a small blast), the nodes bought right after the press,
   * the lasting power the press and those nodes added (N12), and when the run passed the one
   * before it (N11; seconds after DAY0, null if never). */
  wipeDay: number | null;
  nodes: number;
  /** Shipped nodes lit after the shopping (N14 reads later nukes while the map has room). */
  lit: number;
  power: number;
  passedAt: number | null;
}

export interface Life {
  name: string;
  days: DayRow[];
  runs: RunRow[];
  /** Seconds from run 1's first tap to its first hand, if any. */
  firstHandSeconds: number | null;
  /**
   * Run 1's moments, in seconds after its first tap: `era_<tier>`, `hand` (the first),
   * `flotsam` (the first caught), each shelf row by id the first time, `research` (the first
   * Workshop level) and each Workshop item by id, and `nuke`.
   */
  beats: Record<string, number>;
  /** Runs 1-5: the longest online stretch with nothing affordable, early (first 10 online minutes) and at all. */
  stuck: { early: number; online: number };
  /**
   * Every check-in: its day, when it started (seconds after DAY0), the lifetime made when it
   * started (glass's measure) and whether it bought anything.
   */
  checkIns: { day: number; at: number; made: number; bought: boolean }[];
  /**
   * Run 1's income: minute 0-1 (what taps drove, taps and the unmanned cycles they ran, against
   * all made), and from minute 10 outside buffs (the taps and fells alone, against all made).
   */
  income: {
    firstMinute: { tapDriven: number; made: number };
    later: { direct: number; made: number };
  };
  /** The state at the start of the days asked for (N9's hours). */
  snapshots: Record<number, BaseState>;
  /** The largest number any state held (N23). */
  largest: number;
  /** Commands applied. */
  steps: number;
}

/**
 * Whether the archetype presses the Big Red now (R4): `crown` when the advisor crowns it (the
 * four rules, waiting out buffs), `double` at a gain of at least glass ever, `best` (the optimal
 * player) at a counting press once this run's glass an hour has fallen under 80% of its peak
 * ten minutes in, or at the first nuke.
 */
function pressesNow(content: Content, state: BaseState, now: number, rule: Archetype["nuke"]) {
  const y = glassYield(content, state, now);
  if (!y.pressable) return false;
  if (rule === "double") return y.first || y.gain >= Math.max(1, state.meta.glass.ever);
  if (rule === "best")
    return y.first || (y.counts && runAge(state, now) >= 600 && y.rateNow < 0.8 * y.peak);
  return (
    !state.run.buffs.some((buff) => buff.until > now) && bigRedCrown(content, state, now) !== null
  );
}

/**
 * The lasting power `meta` gives a fresh run (N12): Glow times the map's all-line output fold.
 * Scoped nodes (a line, an era) are left out: a cheap, monotone measure of what a nuke added.
 */
function metaPower(content: Content, meta: Meta): number {
  const effects = nodeEffects(content, meta);
  const k = foldStat("glow_k", effects, content.prestige.glowK);
  const counts = { nukes: meta.wipeDays, hands: 14, sectors: {} };
  const output = foldStat("output", effects, 1, {}, { online: true }, counts);
  return glow(content, meta.glass.ever, k) * output;
}

/** A rough gain per node for the pick's "best income per glass" (04 8.4), deterministic. */
function nodeGain(content: Content, node: NodeDef): number {
  let gain = 0;
  for (const effect of node.effects) {
    const share =
      effect.scope === undefined || effect.scope === "all"
        ? 1
        : content.lines.some((line) => line.id === effect.scope)
          ? 1 / content.lines.length
          : 0.25;
    const v = effect.value;
    switch (effect.stat) {
      case "output":
      case "speed":
        gain += (effect.op === "more" ? v - 1 : v) * share * (effect.when ? 0.3 : 1);
        break;
      case "tap":
      case "tap_share":
        gain += 0.3 * v;
        break;
      case "glass_gain":
        gain += 0.5 * (effect.op === "more" ? v - 1 : v);
        break;
      case "glow_k":
        gain += 2 * v;
        break;
      case "night_shift":
        gain += 0.05 * v;
        break;
      case "line_cost":
      case "hand_cost":
      case "upgrade_cost":
      case "era_cost":
        gain += 0.5 * (1 - v);
        break;
      case "keep_hand":
      case "start_owned":
      case "start_era":
      case "start_upgrade":
        gain += 0.2;
        break;
      default:
        gain += effect.stat.startsWith("feature:") ? 0.1 : 0.05;
    }
  }
  return gain;
}

const largestOf = (state: BaseState): number =>
  Math.max(state.run.supplies, state.run.made, state.meta.lifetime, state.meta.glass.ever);

const PURCHASES = new Set<Command["type"]>([
  "buy_line",
  "hire_hand",
  "buy_upgrade",
  "buy_research",
  "buy_era",
]);
const ONLINE = { online: true } as const;

/** Whether `archetype` catches flotsam arrival `k` of its run (a seeded share of them). */
function catches(archetype: Archetype, seed: number, run: number, k: number): boolean {
  if (archetype.catches >= 1) return true;
  return archetype.catches > 0 && rng(seedOf(seed, run, k)).next() < archetype.catches;
}

/** The flotsam floating at `t`, if the cursor's arrival is in its claim window. */
function floating(content: Content, state: BaseState, t: number): number | null {
  const cursor = flotsamAt(content, state, t);
  if (cursor.at === null || cursor.at > t || t > claimUntil(content, state, cursor.at)) return null;
  return cursor.k;
}

/**
 * When a life may stop before its last day: once calendar day `day` is played, run 1 has ended
 * and run `runs` has started (the quick profile, D236).
 */
export interface Stop {
  day: number;
  runs: number;
}

/** One archetype's life up to calendar day `days`, from its `startDay` (a late joiner: day 30). */
export function simulate(
  content: Content,
  name: string,
  archetype: Archetype,
  days: number,
  seed = 11,
  snapshotDays: readonly number[] = [],
  stop: Stop | null = null,
): Life {
  const sessions = sessionsOf(archetype);
  const startDay = archetype.startDay ?? 1;
  const baseSeed = seedOf(seed, ...[...name].map((char) => char.charCodeAt(0)));
  let state = newBase(content, DAY0 + (startDay - 1) * DAY, baseSeed);
  const life: Life = {
    name,
    days: [],
    runs: [],
    firstHandSeconds: null,
    beats: {},
    stuck: { early: 0, online: 0 },
    checkIns: [],
    income: { firstMinute: { tapDriven: 0, made: 0 }, later: { direct: 0, made: 0 } },
    snapshots: {},
    largest: 0,
    steps: 0,
  };
  let runStart = 0;
  let runOnline = 0;
  let stuck = 0;
  let bought = false;
  /** The run before this one: its made (N11 reads when this run passes it). */
  let previousMade = 0;
  let passedAt: number | null = null;

  /** Run 1's moments, from the events of each command. */
  const beat = (key: string, at: number) => {
    if (state.meta.nukes === 0 && life.beats[key] === undefined) life.beats[key] = at;
  };
  const since = (now: number) => now - (state.run.startedAt ?? now);
  const record = (events: GameEvent[], now: number) => {
    for (const event of events) {
      if (event.type === "era_reached") beat(`era_${event.era}`, event.at);
      if (event.type === "hand_hired") beat("hand", since(now));
      if (event.type === "flotsam_claimed") beat("flotsam", since(now));
      if (event.type === "upgraded") beat(event.upgrade, since(now));
      if (event.type === "frenzy_tripped") beat("frenzy", since(now));
      if (event.type === "gull_caught") beat("gull", since(now));
      if (event.type === "badge_unlocked") beat("badge", since(now));
      if (event.type === "drop_opened") beat("drop", since(now));
      if (event.type === "hand_hired" || event.type === "drop_earned") tending = true;
      if (event.type === "researched") {
        beat("research", since(now));
        beat(event.item, since(now));
      }
    }
  };

  /** A hire or an earned drop since the cards were last tended. */
  let tending = false;
  let crafted = 0;

  /** The Blast Map's pick, bought while glass allows (R4, 04 8.4): every nuke's shopping. */
  const buyNodes = (now: number): number => {
    let count = 0;
    for (let i = 0; i < 400; i++) {
      const pick = nodePick(content, state, (node) => nodeGain(content, node));
      if (pick?.state.kind !== "affordable") break;
      if (!step({ type: "buy_node", path: [pick.node.id] }, now).ok) break;
      count += 1;
    }
    return count;
  };

  /** The Big Red, by the archetype's policy (R4): the press, then the map. */
  const maybeNuke = (now: number): boolean => {
    if (!pressesNow(content, state, now, archetype.nuke)) return false;
    const before = metaPower(content, state.meta);
    const made = state.run.made;
    const orders = state.run.orders.claimed.length;
    const wasFuelled = fuelled(content, state);
    const n = state.run.n;
    // Run 1's beat is read before the press: `beat` only records while no nuke has happened.
    if (pressesNow(content, state, now, archetype.nuke)) beat("nuke", since(now));
    const result = step({ type: "nuke", run: n }, now);
    if (!result.ok) return false;
    const nuked = result.events.find((event) => event.type === "nuked");
    const nodes = buyNodes(now);
    tending = true;
    life.runs.push({
      n,
      start: runStart,
      end: now - DAY0,
      made,
      glass: nuked?.type === "nuked" ? nuked.gain : 0,
      orders,
      fuelled: wasFuelled,
      wipeDay: nuked?.type === "nuked" ? nuked.wipeDay : null,
      nodes,
      lit: state.meta.nodes.length,
      power: metaPower(content, state.meta) / before,
      passedAt,
    });
    previousMade = made;
    passedAt = null;
    runStart = now - DAY0;
    runOnline = 0;
    stuck = 0;
    waiting = null;
    return true;
  };

  /** The Work Orders and quests met and not yet claimed (R3 S2): a player taps Claim. */
  const claims = (now: number) => {
    for (const order of ordersOf(content, state))
      if (!orderClaimed(state, order.id) && orderMet(content, state, order))
        step({ type: "claim_order", run: state.run.n, id: order.id }, now);
    for (const quest of questsOf(content, state))
      if (!questClaimed(state, quest.id) && questMet(state, quest))
        step({ type: "claim_quest", day: state.meta.quests.day, id: quest.id }, now);
  };

  /** Scrap by the archetype's policy, at a session's start. */
  const spend = (now: number) => {
    if (archetype.spend === "boosts") {
      for (const boost of content.scrap.boosts) {
        if (boost.id === "double_time" && archetype.tapsPerSecond === 0) continue;
        if (boost.tide && archetype.catches === 0) continue;
        if (state.meta.scrap >= boost.cost) step({ type: "buy_boost", boost: boost.id }, now);
      }
    } else if (archetype.spend === "drops") {
      while (state.meta.scrap >= content.scrap.drops[2]) {
        if (!step({ type: "buy_drop", tier: 2 }, now).ok) break;
        tending = true;
      }
    }
  };

  const step = (command: Command, now: number): ReturnType<typeof applyCommand> => {
    const result = applyCommand(content, state, command, now);
    state = result.state;
    life.steps += 1;
    life.largest = Math.max(life.largest, largestOf(state));
    if (result.ok) {
      record(result.events, now);
      if (PURCHASES.has(command.type)) bought = true;
      if (command.type === "craft_gear") crafted += 1;
    }
    if (
      command.type === "hire_hand" &&
      result.ok &&
      life.firstHandSeconds === null &&
      state.meta.nukes === 0 &&
      state.run.startedAt !== null
    ) {
      life.firstHandSeconds = now - state.run.startedAt;
    }
    return result;
  };

  /**
   * The player as the client's crown sees them (`state/pace.ts`, D165): tapping all the time at
   * `tapsPerSecond` while they tap, not at all otherwise; income is what runs (unmanned lines
   * too while tapping) plus the taps.
   */
  const pace = (calm: BaseState, now: number, tapsPerSecond: number): Player => {
    const tapShare = tapsPerSecond > 0 ? 1 : 0;
    const manned = mannedRate(content, calm, now);
    const running = manned + tapShare * (fullRate(content, calm, now, ONLINE) - manned);
    const income = running + tapsPerSecond * tapParts(content, calm, now).base;
    return { income, tapShare, tapRate: tapsPerSecond };
  };

  /**
   * The crown's last pick while it still holds: it saves for a purchase out of reach, and among
   * those the ranking does not depend on the supplies held (the wait shifts every score alike;
   * what is affordable only falls behind), so the pick changes only when prices or the pace
   * change, the supplies reach the next price or the Workshop opens. The crown scores lasting
   * rates, so buffs never move it (D200).
   */
  let waiting: {
    rates: object;
    pace: number;
    next: number;
    until: number;
    any: boolean;
  } | null = null;

  /** Buys the crown's pick while it is affordable; says whether anything at all was. */
  const buy = (now: number, tapsPerSecond: number): boolean => {
    if (
      waiting &&
      waiting.rates === rates(content, state) &&
      waiting.pace === tapsPerSecond &&
      state.run.supplies < waiting.next &&
      now < waiting.until
    ) {
      return waiting.any;
    }
    for (let i = 0; i < 100; i++) {
      const calm = lasting(state);
      const player = pace(calm, now, tapsPerSecond);
      const offered = choices(content, calm, now, player.income, player.tapShare, player.tapRate);
      const pick = crown(content, calm, now, player, offered);
      if (pick.kind !== "purchase" || !pick.choice.affordable) {
        const supplies = state.run.supplies;
        let next = Number.POSITIVE_INFINITY;
        for (const choice of offered)
          if (choice.cost > supplies) next = Math.min(next, choice.cost);
        const any = offered.some((choice) => choice.affordable);
        const opens = workshopOpensAt(content, state);
        waiting = {
          rates: rates(content, state),
          pace: tapsPerSecond,
          next,
          until: opens !== null && opens > now ? opens : Number.POSITIVE_INFINITY,
          any,
        };
        return any;
      }
      // A Workshop level: as many as the supplies reach, the tile's Max (D229, D235); one level
      // at a time made the late tiers' 500 levels a run the quick profile's cost (R3 S4).
      const command = pick.choice.command;
      step(command.type === "buy_research" ? { ...command, count: "max" } : command, now);
    }
    return true;
  };

  /** The cards, as a player would keep them: open, star, craft, then wear the best (D252). */
  const tend = (now: number) => {
    tending = false;
    for (const tier of [1, 2, 3] as const)
      while (state.meta.drops.held[tier] > 0)
        if (!step({ type: "open_drop", tier, pull: state.meta.drops.pulls }, now).ok) break;
    const { stars, shards } = content.cards;
    for (const row of content.cards.survivors) {
      for (
        let n = state.meta.cards.survivors[row.id];
        n !== undefined && n <= stars.costs.length;
        n++
      ) {
        if ((state.meta.drops.shards.crew[row.id] ?? 0) < (stars.costs[n - 1] ?? Infinity)) break;
        if (!step({ type: "star_up", survivor: row.id, to: n + 1 }, now).ok) break;
      }
    }
    for (const rarity of RARITIES) {
      for (const row of content.cards.gear) {
        if (row.rarity !== rarity || row.id in state.meta.cards.gear) continue;
        if (state.meta.drops.shards.gear[rarity] < shards.craft[rarity]) break;
        step({ type: "craft_gear", gear: row.id }, now);
      }
    }
    // The hired survivors, the line that makes most first; production gear, strongest first.
    const hired = content.lines
      .filter((line) => state.run.hands.includes(line.id))
      .filter((line) => state.meta.cards.survivors[line.hand] !== undefined)
      .map((line) => ({
        hand: line.hand,
        rate: (state.run.lines[line.id] ?? 0) * unitRate(content, state, line, now, ONLINE),
      }))
      .sort((a, b) => b.rate - a.rate);
    const power = (stat: string, value: number) =>
      stat === "output" || stat === "speed" ? value : 1;
    for (const slot of SLOTS) {
      const owned = content.cards.gear
        .filter((row) => row.slot === slot && row.id in state.meta.cards.gear)
        .sort(
          (a, b) => power(b.effect.stat, b.effect.value) - power(a.effect.stat, a.effect.value),
        );
      for (const [i, survivor] of hired.entries()) {
        const gear = owned[i];
        if (!gear) break;
        if (state.meta.cards.gear[gear.id] !== survivor.hand)
          step({ type: "equip_gear", gear: gear.id, survivor: survivor.hand }, now);
      }
    }
  };

  const wanted = new Set(snapshotDays);
  for (let day = startDay; day <= days; day++) {
    const midnight = DAY0 + (day - 1) * DAY;
    if (wanted.has(day)) life.snapshots[day] = settle(content, state, midnight).state;
    for (const session of sessions) {
      let t = midnight + session.start;
      const end = t + session.seconds;
      bought = false;
      const checkIn = { at: t - DAY0, made: settle(content, state, t).state };
      step({ type: "ping" }, t);
      claims(t);
      spend(t);
      // A check-in finds a run that grew while away: the record may have fallen (N11), and the
      // crown may already say press (the casual's evening nuke).
      if (passedAt === null && previousMade > 0 && state.run.made >= previousMade)
        passedAt = t - DAY0;
      maybeNuke(t);
      while (t < end) {
        const idle = state.run.hands.length === 0;
        const rate = archetype.tapsPerSecond + (idle ? (archetype.tapsWhileNothingRuns ?? 0) : 0);
        // As the client batches (D134): 1 s at first, then 5 s, never more than 30 taps.
        const wide = runOnline < FINE_SECONDS ? 1 : 5;
        const fits = Math.max(1, Math.floor(MAX_BATCH / Math.max(rate, 1)));
        const length = Math.min(wide, fits, end - t);
        const count = Math.round(rate * length);
        const to = t + length - 1;
        const before = state.run.made;
        const buffed = state.run.buffs.some((buff) => buff.until > t);
        // What the manned lines make over run 1's first minute: everything else the taps drove.
        const manned =
          state.meta.nukes === 0 && runOnline < 60 ? mannedRate(content, state, t) * length : 0;
        // Not tapping, the player still watches the counter rise: the state settles (D178).
        if (count === 0) state = settle(content, state, to).state;
        if (count > 0) {
          const result = step({ type: "taps", count, from: t, to }, to);
          const tapped = result.events.find((event) => event.type === "tapped");
          // A batch that trips a Frenzy is part of the burst too (N8's "outside bursts").
          const burst = buffed || result.events.some((event) => event.type === "frenzy_tripped");
          if (state.meta.nukes === 0 && tapped?.type === "tapped") {
            const made = state.run.made - before;
            if (runOnline < 60) {
              life.income.firstMinute.tapDriven += Math.max(0, made - manned);
              life.income.firstMinute.made += made;
            } else if (runOnline >= FINE_SECONDS && !burst) {
              life.income.later.direct += tapped.direct;
              life.income.later.made += made;
            }
          }
        }
        const k = floating(content, state, to);
        if (k !== null && catches(archetype, baseSeed, state.run.n, k))
          step({ type: "claim_flotsam", run: state.run.n, k }, to);
        // Crows, by the same share as flotsam on their own stream (D238).
        const crow = gullAt(content, state, to);
        if (crow && catches(archetype, seedOf(baseSeed, SEED.gull), state.run.n, crow.k))
          step({ type: "claim_gull", run: state.run.n, k: crow.k }, to);
        // Lucky Tide crates, by the same share on their own stream.
        const tide = tideAt(content, state, to);
        if (tide && catches(archetype, seedOf(baseSeed, SEED.tide), state.run.n, tide.k))
          step({ type: "claim_tide", run: state.run.n, k: tide.k }, to);
        const affordable = buy(to, rate);
        claims(to);
        if (tending) tend(to);
        if (state.run.n <= EARLY_RUNS) {
          stuck = affordable ? 0 : stuck + length;
          life.stuck.online = Math.max(life.stuck.online, stuck);
          if (runOnline < FINE_SECONDS) life.stuck.early = Math.max(life.stuck.early, stuck);
        }
        if (passedAt === null && previousMade > 0 && state.run.made >= previousMade)
          passedAt = to - DAY0;
        maybeNuke(to);
        runOnline += length;
        t += length;
      }
      // Every number still finite (D130), checked once a session: `finite()` guards each gain.
      assertFiniteState(state);
      // A stretch with nothing affordable ends with the session.
      stuck = 0;
      life.checkIns.push({
        day,
        at: checkIn.at,
        made: checkIn.made.meta.lifetime + checkIn.made.run.made,
        bought,
      });
    }
    // The day's end, settled in closed form.
    state = settle(content, state, midnight + DAY - 1).state;
    life.largest = Math.max(life.largest, largestOf(state));
    life.days.push({
      day,
      run: state.run.n,
      supplies: state.run.supplies,
      made: state.run.made,
      lifetime: state.meta.lifetime + state.run.made,
      owned: Object.values(state.run.lines).reduce((sum, n) => sum + n, 0),
      hands: state.run.hands.length,
      glassEver: state.meta.glass.ever,
      nukes: state.meta.nukes,
      wipeDays: state.meta.wipeDays,
      taps: state.meta.stats.taps,
      drops: state.meta.stats.drops,
      cards:
        Object.keys(state.meta.cards.survivors).length + Object.keys(state.meta.cards.gear).length,
      scrap: state.meta.stats.scrap,
      orders: state.meta.stats.orders,
      quests: state.meta.stats.quests,
      baseSet: baseSetOwned(content, state),
      owed: dropsOnWay(content, state),
      stars: Object.values(state.meta.cards.survivors).reduce((sum, n) => sum + n - 1, 0),
      shards: Object.values(state.meta.drops.shards.gear).reduce((sum, n) => sum + n, 0),
      crafted,
    });
    if (stop && day >= stop.day && life.runs.length > 0 && state.run.n > stop.runs) break;
  }
  life.runs.push({
    n: state.run.n,
    start: runStart,
    end: null,
    made: state.run.made,
    glass: 0,
    orders: state.run.orders.claimed.length,
    fuelled: fuelled(content, state),
    wipeDay: null,
    nodes: 0,
    lit: state.meta.nodes.length,
    power: 1,
    passedAt,
  });
  return life;
}

/** Every archetype of the pacing file, alone (`stops`: each one's early stop, if any). */
export function simulateArchetypes(
  content: Content,
  days: number,
  seed = 11,
  snapshotDays: readonly number[] = [],
  stops: Readonly<Record<string, Stop>> = {},
): Life[] {
  return Object.entries(content.pacing.archetypes).map(([name, a]) =>
    simulate(content, name, a, days, seed, snapshotDays, stops[name] ?? null),
  );
}

/**
 * The checks whose reach is known: what they read from each archetype is named by their `days`
 * (or `day`) and `archetype`, run 1's end, or runs 1-5. With any other check due, every life
 * plays to the profile's last day.
 */
const SHORT_CHECKS: ReadonlySet<string> = new Set([
  "prestigeShape",
  "magnitude",
  "firstHandSeconds",
  "nothingAffordableEarly",
  "nothingAffordableOnline",
  "casualCheckInsWithPurchase",
  "tapShare",
  "activeHour",
  "run1Made",
  "firstHourBeats",
  "casualFirstNuke",
  "scrap",
  "casualDropsPerDay",
  "casualAlbumBase",
  "casualAlbumFull",
  "ordersReachable",
  "firstNukeMinutes",
  "firstNukeMinutesAny",
  "passPreviousRun",
  "powerPerNuke",
  "flattening",
  "nodesBought",
  "casualWipeDaysByDay30",
  "casualFirstWeekGlass",
]);
/** Days every archetype must play for a check that reads them all (R4's run-to-run checks). */
// The run-to-run checks read their early band (nukes 1-5, the first week) in the quick profile;
// the mid and late bands are `--full`'s (R4 S2: 30 days each put the profile at 32 s, D270).
const REACH_DAYS: Readonly<Record<string, number>> = {
  passPreviousRun: 7,
  powerPerNuke: 7,
  flattening: 7,
  nodesBought: 7,
  firstNukeMinutesAny: 3,
};
/** N19's window: a 7-day average from day 2 (12-feel.md 11), so everyone plays to day 8. */
const SCRAP_FROM_DAY = 2;
const SCRAP_DAYS = 7;

/** Each archetype's early stop for the due assertions, or null when one reaches further. */
export function earlyStops(
  content: Content,
  due: readonly Assertion[],
): Record<string, Stop> | null {
  if (due.some((assertion) => !SHORT_CHECKS.has(assertion.check))) return null;
  const stops: Record<string, Stop> = {};
  for (const [name, archetype] of Object.entries(content.pacing.archetypes)) {
    const startDay = archetype.startDay ?? 1;
    let day = startDay;
    for (const assertion of due) {
      // N19 reads everyone's first week from day 2, and the casual to its day-30 total.
      if (assertion.check === "scrap") {
        day = Math.max(day, startDay + SCRAP_FROM_DAY + SCRAP_DAYS - 2);
        if (name === str(assertion.archetype, "casual"))
          day = Math.max(day, num(assertion.byDay, 30));
        continue;
      }
      const reach = REACH_DAYS[assertion.check];
      if (reach !== undefined) day = Math.max(day, startDay + reach - 1);
      const reads =
        assertion.check === "activeHour"
          ? str(assertion.archetype, "active")
          : assertion.check.startsWith("casual")
            ? str(assertion.archetype, "casual")
            : null;
      if (reads !== name) continue;
      const days = Array.isArray(assertion.days)
        ? assertion.days.map((d) => num(d, 1))
        : [num(assertion.days ?? assertion.day, 1)];
      day = Math.max(day, ...days);
    }
    stops[name] = {
      day: Math.min(day, archetype.quickDays ?? Number.POSITIVE_INFINITY),
      runs: EARLY_RUNS,
    };
  }
  return stops;
}

/** Every scenario of the pacing file: one long session, so a single day covers it. */
export function simulateScenarios(content: Content, seed = 11): Life[] {
  return Object.entries(content.pacing.scenarios).map(([name, a]) =>
    simulate(content, name, a, 1, seed),
  );
}

/** Every archetype and scenario of the pacing file, alone. */
export function simulateAll(
  content: Content,
  days: number,
  seed = 11,
  snapshotDays: readonly number[] = [],
): Life[] {
  return [
    ...simulateArchetypes(content, days, seed, snapshotDays),
    ...simulateScenarios(content, seed),
  ];
}

/**
 * Supplies made in one online hour from `start`: tapping `tapsPerSecond` and catching every
 * flotsam and crow, or idle (a ping every 5 minutes, so the player counts as online). Nothing is bought,
 * so the hour measures what activity adds, not what it compounds into (N9).
 */
export function hourMade(
  content: Content,
  from: BaseState,
  start: number,
  tapsPerSecond: number,
): number {
  let state = applyCommand(content, from, { type: "ping" }, start).state;
  const made = state.run.made;
  for (let t = start; t < start + 3600; t += 5) {
    const to = t + 4;
    if (tapsPerSecond > 0) {
      state = applyCommand(
        content,
        state,
        { type: "taps", count: Math.round(tapsPerSecond * 5), from: t, to },
        to,
      ).state;
      const k = floating(content, state, to);
      if (k !== null)
        state = applyCommand(
          content,
          state,
          { type: "claim_flotsam", run: state.run.n, k },
          to,
        ).state;
      const crow = gullAt(content, state, to);
      if (crow)
        state = applyCommand(
          content,
          state,
          { type: "claim_gull", run: state.run.n, k: crow.k },
          to,
        ).state;
    } else if ((t - start) % 300 === 0) {
      state = applyCommand(content, state, { type: "ping" }, t).state;
    }
  }
  return settle(content, state, start + 3600).state.run.made - made;
}

type HourRatios = { weighted: number; clear: number; rain: number };

/** N9's hours per snapshot: its weighted and rain rows read the same hours. */
const hours = new WeakMap<BaseState, Map<number, HourRatios>>();

/**
 * N9 at a day's snapshot: active ÷ idle online hours, from six hour starts on six flotsam seeds,
 * three starting in rain and three not, weighted by the island's rain share (errata E13).
 */
export function activeHour(
  content: Content,
  snapshot: BaseState,
  tapsPerSecond: number,
): HourRatios {
  const known = hours.get(snapshot)?.get(tapsPerSecond);
  if (known) return known;
  const ratios = { clear: [] as number[], rain: [] as number[] };
  // Hours start at noon on the snapshot's day, then every 30-minute block after it.
  let start = snapshot.run.settledAt + 12 * 3600;
  for (let k = 0; ratios.clear.length < 3 || ratios.rain.length < 3; k++) {
    const rainy = weatherAt(content, start) === "rain";
    const list = rainy ? ratios.rain : ratios.clear;
    if (list.length < 3) {
      const seeded = { ...snapshot, run: { ...snapshot.run, seed: seedOf(snapshot.run.seed, k) } };
      const active = hourMade(content, seeded, start, tapsPerSecond);
      const idle = hourMade(content, seeded, start, 0);
      list.push(active / Math.max(idle, 1e-9));
    }
    start += content.islandClock.weather.blockMinutes * 60;
    if (k > 2000) break;
  }
  const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
  const rainShare = content.islandClock.weather.rain / 100;
  const clear = mean(ratios.clear);
  const rain = mean(ratios.rain);
  const result = { weighted: (1 - rainShare) * clear + rainShare * rain, clear, rain };
  const byRate = hours.get(snapshot) ?? new Map<number, HourRatios>();
  byRate.set(tapsPerSecond, result);
  hours.set(snapshot, byRate);
  return result;
}

// --- the assertions (`pacing.json5` v2) ----------------------------------------------------

export type Status = "pass" | "warn" | "fail" | "pending" | "missing";

export interface Verdict {
  n: string;
  check: string;
  on: Phase;
  status: Status;
  detail: string;
}

interface Context {
  content: Content;
  lives: Life[];
}

type Check = (assertion: Assertion, context: Context) => { ok: boolean; detail: string };

const num = (value: unknown, fallback: number): number =>
  typeof value === "number" ? value : fallback;
const str = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;
const pair = (value: unknown, fallback: [number, number]): [number, number] =>
  Array.isArray(value) && value.length === 2 ? [num(value[0], 0), num(value[1], 0)] : fallback;
const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
/** Seconds after DAY0 as "day 2 08:03". */
export const dayClock = (seconds: number): string => {
  const day = Math.floor(seconds / DAY) + 1;
  const inDay = seconds - (day - 1) * DAY;
  const hh = String(Math.floor(inDay / 3600)).padStart(2, "0");
  const mm = String(Math.floor((inDay % 3600) / 60)).padStart(2, "0");
  return `day ${day} ${hh}:${mm}`;
};

/** The lives of an archetype or scenario by name (one per seed). */
const named = (lives: Life[], name: string): Life[] => lives.filter((life) => life.name === name);

/** The archetypes N11-N13 judge (the idler's doubling runs sit outside the bands by design). */
const RUN_ARCHETYPES = ["casual", "active", "optimal"] as const;
/** Early is runs 1-5, mid later runs ending by day 30, late runs ending by day 180 (03 13.1). */
type RunPhase = "early" | "mid" | "late";
const phaseOf = (run: RunRow): RunPhase | null => {
  if (run.end === null) return null;
  if (run.n <= EARLY_RUNS) return "early";
  const day = Math.floor(run.end / DAY) + 1;
  return day <= 30 ? "mid" : day <= 180 ? "late" : null;
};
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const a = sorted[mid - 1];
  const b = sorted[mid];
  if (b === undefined) return Number.NaN;
  return sorted.length % 2 === 0 && a !== undefined ? (a + b) / 2 : b;
};
const geomean = (values: number[]): number =>
  values.length === 0
    ? Number.NaN
    : Math.exp(values.reduce((sum, v) => sum + Math.log(Math.max(v, 1e-12)), 0) / values.length);
/** Per archetype and phase, `pick` over every finished run pair or run. */
function byPhase(
  lives: Life[],
  pick: (run: RunRow, previous: RunRow | undefined, life: Life) => number | null,
): Map<string, Map<RunPhase, number[]>> {
  const out = new Map<string, Map<RunPhase, number[]>>();
  for (const name of RUN_ARCHETYPES) {
    const phases = new Map<RunPhase, number[]>();
    for (const life of named(lives, name)) {
      for (const [i, run] of life.runs.entries()) {
        const phase = phaseOf(run);
        if (phase === null) continue;
        const value = pick(run, life.runs[i - 1], life);
        if (value === null || !Number.isFinite(value)) continue;
        phases.set(phase, [...(phases.get(phase) ?? []), value]);
      }
    }
    out.set(name, phases);
  }
  return out;
}
const PHASES_IN_ORDER: RunPhase[] = ["early", "mid", "late"];

/** Common and Rare cards owned: the Album's base set (N33, D266). */
function baseSetOwned(content: Content, state: BaseState): number {
  const base = (rarity: string) => rarity === "common" || rarity === "rare";
  const cards = state.meta.cards;
  return (
    content.cards.survivors.filter(
      (row) => base(row.rarity) && cards.survivors[row.id] !== undefined,
    ).length + content.cards.gear.filter((row) => base(row.rarity) && row.id in cards.gear).length
  );
}

/** How many cards the base set and the whole Album hold. */
function albumSizes(content: Content): { base: number; all: number } {
  const rows = [...content.cards.survivors, ...content.cards.gear];
  return {
    base: rows.filter((row) => row.rarity === "common" || row.rarity === "rare").length,
    all: rows.length,
  };
}

/** Values per name, in order of first appearance: "47s", or "45:39-51:24" over several seeds. */
function perName(
  rows: (readonly [string, number | undefined])[],
  show: (value: number) => string,
): string {
  const byName = new Map<string, (number | undefined)[]>();
  for (const [name, value] of rows) byName.set(name, [...(byName.get(name) ?? []), value]);
  return [...byName].map(([name, values]) => `${name} ${range(values, show)}`).join(", ");
}

function range(values: (number | undefined)[], show: (value: number) => string): string {
  if (values.some((value) => value === undefined)) return "never";
  const known = values as number[];
  const low = Math.min(...known);
  const high = Math.max(...known);
  return low === high ? show(low) : `${show(low)}-${show(high)}`;
}

/** The checks implemented so far, by name. A shipped assertion without one fails. */
export const CHECKS: Record<string, Check> = {
  // N21: the prestige shape in data is the one the owner chose (decision 9).
  prestigeShape: (assertion, { content }) => {
    const p = content.prestige;
    const want = {
      exponent: num(assertion.exponent, Number.NaN),
      l0: num(assertion.l0, Number.NaN),
      glowK: num(assertion.glowK, Number.NaN),
      firstNukeGlass: num(assertion.firstNukeGlass, Number.NaN),
    };
    const ok =
      p.exponent === want.exponent &&
      p.l0 === want.l0 &&
      p.glowK === want.glowK &&
      p.firstNukeGlass === want.firstNukeGlass;
    return {
      ok,
      detail: `exponent ${p.exponent}, l0 ${p.l0}, glowK ${p.glowK}, first nuke ${p.firstNukeGlass}`,
    };
  },
  // N23: every number stays finite (the simulator asserts it every step) and below the ceiling.
  magnitude: (assertion, { lives }) => {
    const largest = Math.max(...lives.map((life) => life.largest));
    const max = num(assertion.max, 1e150);
    return {
      ok: Number.isFinite(largest) && largest < max,
      detail: `largest ${largest.toExponential(3)}`,
    };
  },
  // N4: the first hand comes within `max` seconds of the first tap, for everyone who plays.
  firstHandSeconds: (assertion, { lives }) => {
    const times = lives.map((life) => [life.name, life.firstHandSeconds] as const);
    const worst = Math.max(...times.map(([, s]) => s ?? Number.POSITIVE_INFINITY));
    return {
      ok: worst <= num(assertion.max, 120),
      detail: perName(
        times.map(([name, s]) => [name, s ?? undefined] as const),
        (s) => `${s}s`,
      ),
    };
  },
  // N5: in runs 1-5's first 10 online minutes, never more than maxSeconds with nothing to buy.
  nothingAffordableEarly: (assertion, { lives }) => {
    const worst = Math.max(...lives.map((life) => life.stuck.early));
    return { ok: worst <= num(assertion.maxSeconds, 30), detail: `longest ${worst}s` };
  },
  // N6: online in runs 1-5, never more than maxSeconds with nothing affordable.
  nothingAffordableOnline: (assertion, { lives }) => {
    const worst = Math.max(...lives.map((life) => life.stuck.online));
    const who = lives.find((life) => life.stuck.online === worst)?.name ?? "";
    return { ok: worst <= num(assertion.maxSeconds, 120), detail: `longest ${worst}s (${who})` };
  },
  // N7: the casual buys something at (at least) `min` of their check-ins over the first days.
  casualCheckInsWithPurchase: (assertion, { lives }) => {
    const days = num(assertion.days, 1);
    const checkIns = named(lives, str(assertion.archetype, "casual")).flatMap((life) =>
      life.checkIns.filter((checkIn) => checkIn.day <= days),
    );
    const share =
      checkIns.filter((checkIn) => checkIn.bought).length / Math.max(1, checkIns.length);
    return {
      ok: share >= num(assertion.min, 1),
      detail: `${pct(share)} of ${checkIns.length} check-ins`,
    };
  },
  // N8: what taps drive in run 1's first minute, and the taps' own share from minute 10.
  tapShare: (assertion, { lives }) => {
    const scenario = named(lives, str(assertion.scenario, "firstHour"));
    const sum = (pick: (life: Life) => number) =>
      scenario.reduce((total, life) => total + pick(life), 0);
    const first =
      sum((l) => l.income.firstMinute.tapDriven) / sum((l) => l.income.firstMinute.made);
    const later = sum((l) => l.income.later.direct) / sum((l) => l.income.later.made);
    const [low, high] = pair(assertion.fromMinute10, [0.05, 0.25]);
    return {
      ok: first >= num(assertion.firstMinuteMin, 0.5) && later >= low && later <= high,
      detail: `minute 0-1 tap-driven ${pct(first)}, from minute 10 direct ${pct(later)}`,
    };
  },
  // N9: an active hour against an idle online hour, at the active archetype's checkpoints.
  activeHour: (assertion, { content, lives }) => {
    const days = Array.isArray(assertion.days) ? assertion.days.map((d) => num(d, 0)) : [];
    const life = named(lives, str(assertion.archetype, "active"))[0];
    const min = num(assertion.min, 1.5);
    const max = num(assertion.max, 3);
    const parts: string[] = [];
    let ok = true;
    for (const day of days) {
      const snapshot = life?.snapshots[day];
      if (!snapshot) {
        // A day past the quick profile's stop (`quickDays`, D236) is `--full`'s reading.
        if (life && day > life.days.length) {
          parts.push(`day ${day}: --full`);
          continue;
        }
        parts.push(`day ${day}: no snapshot`);
        ok = false;
        continue;
      }
      const hour = activeHour(content, snapshot, num(assertion.tapsPerSecond, 6));
      const value = assertion.rain === true ? hour.rain : hour.weighted;
      ok &&= value >= min && value <= max;
      parts.push(
        assertion.rain === true
          ? `day ${day}: rain ${hour.rain.toFixed(2)}`
          : `day ${day}: ${hour.weighted.toFixed(2)} (clear ${hour.clear.toFixed(2)}, rain ${hour.rain.toFixed(2)})`,
      );
    }
    return { ok, detail: parts.join("; ") };
  },
  // N23 (R1): run 1 ends between min and max supplies made.
  run1Made: (assertion, { lives }) => {
    const made = lives.flatMap((life) => {
      const first = life.runs[0];
      return first && first.end !== null ? [first.made] : [];
    });
    const low = Math.min(...made);
    const high = Math.max(...made);
    return {
      ok: made.length > 0 && low >= num(assertion.min, 0) && high <= num(assertion.max, 1e300),
      detail: `${made.length} run 1s, ${low.toExponential(2)} to ${high.toExponential(2)}`,
    };
  },
  // N3 (guardrail 1): the casual's first nuke lands by the end of the check-in starting at `by`
  // on day `day`.
  casualFirstNuke: (assertion, { content, lives }) => {
    const name = str(assertion.archetype, "casual");
    const archetype = content.pacing.archetypes[name];
    const [h = "21", m = "0"] = str(assertion.by, "21:00").split(":");
    const start = Number(h) * 3600 + Number(m) * 60;
    const session = archetype
      ? sessionsOf(archetype).find((row) => row.start === start)
      : undefined;
    const by = (num(assertion.day, 1) - 1) * DAY + start + (session?.seconds ?? 0);
    const ends = named(lives, name).map((life) => life.runs[0]?.end ?? undefined);
    const ok = ends.length > 0 && ends.every((end) => end !== undefined && end <= by);
    return { ok, detail: `first nuke ${range(ends, dayClock)} (want by ${dayClock(by)})` };
  },
  // 10-balance.md 4.2 (errata E1): run 1's beats, each in its band.
  firstHourBeats: (assertion, { lives }) => {
    const scenario = named(lives, str(assertion.scenario, "firstHour"));
    const bands = (assertion.beats ?? {}) as Record<string, unknown>;
    const parts: string[] = [];
    let ok = scenario.length > 0;
    for (const [key, band] of Object.entries(bands)) {
      const [low, high] = pair(band, [0, 0]);
      const times = scenario.map((life) => life.beats[key]);
      const inside = times.every((s) => s !== undefined && s >= low && s <= high);
      ok &&= inside;
      parts.push(
        `${key} ${range(times, clock)}${inside ? "" : ` (want ${clock(low)}-${clock(high)})`}`,
      );
    }
    return { ok, detail: parts.join(", ") };
  },
  // N19 (12-feel.md 11): scrap a day for a casual, a 7-day average from day 2, in its band;
  // at least `casualByDay30` ever by day 30; nobody's average above `anyMeanMax`.
  scrap: (assertion, { lives }) => {
    const [low, high] = pair(assertion.casualMean, [4, 6]);
    const byDay = num(assertion.byDay, 30);
    const casualName = str(assertion.archetype, "casual");
    const means = lives
      .filter((life) => life.days.length >= SCRAP_FROM_DAY + SCRAP_DAYS - 1)
      .map((life) => {
        const first = life.days[0]?.day ?? 1;
        const earned = (day: number) =>
          life.days.find((row) => row.day === day)?.scrap ?? Number.NaN;
        const from = first + SCRAP_FROM_DAY - 1;
        return [
          life.name,
          (earned(from + SCRAP_DAYS - 1) - earned(from - 1)) / SCRAP_DAYS,
        ] as const;
      });
    const casual = means.filter(([name]) => name === casualName).map(([, mean]) => mean);
    const totals = named(lives, casualName).map(
      (life) => life.days.find((row) => row.day === byDay)?.scrap,
    );
    const worst = Math.max(...means.map(([, mean]) => mean));
    const ok =
      casual.length > 0 &&
      casual.every((mean) => mean >= low && mean <= high) &&
      totals.every((total) => total !== undefined && total >= num(assertion.casualByDay30, 100)) &&
      worst <= num(assertion.anyMeanMax, 8);
    return {
      ok,
      detail: `${perName(means, (mean) => mean.toFixed(2))} a day; ${casualName} by day ${byDay} ${range(totals, (n) => String(n))}`,
    };
  },
  // N30: the casual opens at least `min` drops every day of days 1-`days`, `casualMean` a day
  // over them (D248: 2-4), and nobody averages more than `anyMeanMax` (D266).
  casualDropsPerDay: (assertion, { lives }) => {
    const days = num(assertion.days, 30);
    const min = num(assertion.min, 1);
    const [low, high] = pair(assertion.casualMean, [0, Number.POSITIVE_INFINITY]);
    const anyMax = num(assertion.anyMeanMax, Number.POSITIVE_INFINITY);
    const casualName = str(assertion.archetype, "casual");
    let worst = Number.POSITIVE_INFINITY;
    let where = "";
    for (const life of named(lives, casualName)) {
      let before = 0;
      for (const row of life.days) {
        if (row.day > days) break;
        const opened = row.drops - before;
        before = row.drops;
        if (opened < worst) {
          worst = opened;
          where = `day ${row.day}`;
        }
      }
    }
    // A mean over at least a week (a life the quick profile cuts shorter is `--full`'s).
    const means = lives
      .filter((life) => life.days.length >= 7)
      .map((life) => {
        const first = life.days[0]?.day ?? 1;
        const last = life.days.find((row) => row.day === first + days - 1) ?? life.days.at(-1);
        return [life.name, (last?.drops ?? 0) / ((last?.day ?? first) - first + 1)] as const;
      });
    const casual = means.filter(([name]) => name === casualName).map(([, mean]) => mean);
    const ok =
      worst >= min &&
      casual.every((mean) => mean >= low && mean <= high) &&
      means.every(([, mean]) => mean <= anyMax);
    return {
      ok,
      detail: `fewest in a day ${worst} (${where}); ${perName(means, (mean) => mean.toFixed(2))} a day`,
    };
  },
  // N33 (D266): the casual owns the Album's base set (every Common and Rare) by day `days`, and
  // not before day `notBefore` (a flood would empty the goal).
  casualAlbumBase: (assertion, { content, lives }) => {
    const days = num(assertion.days, 14);
    const notBefore = num(assertion.notBefore, 1);
    const want = albumSizes(content).base;
    const whens = named(lives, str(assertion.archetype, "casual")).map(
      (life) => life.days.find((row) => row.baseSet >= want)?.day,
    );
    const ok = whens.every((day) => day !== undefined && day <= days && day >= notBefore);
    return {
      ok,
      detail: `base set (${want} cards) complete on day ${range(whens, (n) => String(n))} (want days ${notBefore}-${days})`,
    };
  },
  // N33: the whole Album (the Legendaries by pity) is not complete before day `notBefore`.
  casualAlbumFull: (assertion, { content, lives }) => {
    const notBefore = num(assertion.notBefore, 45);
    const want = albumSizes(content).all;
    const whens = named(lives, str(assertion.archetype, "casual")).map(
      (life) => life.days.find((row) => row.cards >= want)?.day,
    );
    const ok = whens.every((day) => day === undefined || day >= notBefore);
    return {
      ok,
      detail: `Album (${want} cards) complete on day ${range(whens, (n) => String(n))} (want not before ${notBefore})`,
    };
  },
  // N1 (guardrail 1): the first-hour scenario's first nuke, minutes after its first tap.
  firstNukeMinutes: (assertion, { lives }) => {
    const scenario = named(lives, str(assertion.scenario, "firstHour"));
    const minutes = scenario.map((life) =>
      life.beats.nuke === undefined ? undefined : life.beats.nuke / 60,
    );
    const low = num(assertion.min, 40);
    const high = num(assertion.max, 60);
    const ok = minutes.length > 0 && minutes.every((m) => m !== undefined && m >= low && m <= high);
    return {
      ok,
      detail: `first nuke ${range(minutes, (m) => clock(m * 60))} (want ${low}-${high} min)`,
    };
  },
  // N2: no first nuke under `min` minutes on the wall clock from the first tap, for anyone.
  firstNukeMinutesAny: (assertion, { lives }) => {
    const rows = lives.map(
      (life) =>
        [life.name, life.beats.nuke === undefined ? undefined : life.beats.nuke / 60] as const,
    );
    const known = rows.filter((row): row is readonly [string, number] => row[1] !== undefined);
    const worst = Math.min(...known.map(([, m]) => m));
    return {
      ok: known.length === rows.length && worst >= num(assertion.min, 25),
      detail: perName(rows, (m) => clock(m * 60)),
    };
  },
  // N11: the time run N+1 needs to pass run N's supplies made, as a share of run N's length;
  // the median per phase at most `early` / `mid` / `late`.
  passPreviousRun: (assertion, { lives }) => {
    const shares = byPhase(lives, (run, previous) => {
      if (!previous || previous.end === null || run.passedAt === null) return null;
      const length = previous.end - previous.start;
      return length > 0 ? (run.passedAt - run.start) / length : null;
    });
    const parts: string[] = [];
    let ok = true;
    for (const [name, phases] of shares) {
      const words: string[] = [];
      for (const phase of PHASES_IN_ORDER) {
        const values = phases.get(phase);
        if (!values || values.length === 0) continue;
        const m = median(values);
        const limit = num(assertion[phase], 1);
        ok &&= m <= limit;
        words.push(`${phase} ${pct(m)} (${values.length})`);
      }
      if (words.length > 0) parts.push(`${name}: ${words.join(", ")}`);
    }
    return { ok, detail: parts.join("; ") || "no finished run pairs" };
  },
  // N12: the lasting power a nuke adds (Glow and the map), geometric mean per phase in its band.
  powerPerNuke: (assertion, { lives }) => {
    const powers = byPhase(lives, (run) => run.power);
    const parts: string[] = [];
    let ok = true;
    for (const [name, phases] of powers) {
      const words: string[] = [];
      for (const phase of PHASES_IN_ORDER) {
        const values = phases.get(phase);
        if (!values || values.length === 0) continue;
        const g = geomean(values);
        const [low, high] = pair(assertion[phase], [0, Number.POSITIVE_INFINITY]);
        ok &&= g >= low && g <= high;
        words.push(`${phase} ×${g.toFixed(2)} (${values.length})`);
      }
      if (words.length > 0) parts.push(`${name}: ${words.join(", ")}`);
    }
    return { ok, detail: parts.join("; ") || "no finished runs" };
  },
  // N13: five consecutive nukes whose power product is under `minProduct`, with nothing on the
  // agenda in the next `unlockLookahead` Wipe Days, is a flat stretch: the build fails.
  flattening: (assertion, { content, lives }) => {
    const window = num(assertion.window, 5);
    const minProduct = num(assertion.minProduct, 1.3);
    const lookahead = num(assertion.unlockLookahead, 3);
    const alarms: string[] = [];
    for (const life of lives) {
      const finished = life.runs.filter((run) => run.end !== null);
      for (let i = window - 1; i < finished.length; i++) {
        let product = 1;
        for (let j = i - window + 1; j <= i; j++) product *= finished[j]?.power ?? 1;
        if (product >= minProduct) continue;
        const wipeDay = finished[i]?.wipeDay ?? 0;
        const opens = content.agenda.rows.some(
          (row) => row.at > wipeDay && row.at <= wipeDay + lookahead,
        );
        if (!opens)
          alarms.push(
            `${life.name} runs ${finished[i - window + 1]?.n}-${finished[i]?.n} ×${product.toFixed(2)}`,
          );
      }
    }
    return {
      ok: alarms.length === 0,
      detail: alarms.length ? alarms.join("; ") : "no flat stretch",
    };
  },
  // N14: 6-10 nodes bought at the first nuke; later a median of at least `laterMedianMin` a nuke.
  nodesBought: (assertion, { content, lives }) => {
    const [low, high] = pair(assertion.first, [6, 10]);
    const laterMin = num(assertion.laterMedianMin, 2);
    const firsts = lives.map(
      (life) => [life.name, life.runs.find((run) => run.end !== null)?.nodes] as const,
    );
    // Later nukes count while the shipped map still had room before the shopping.
    const total = shippedNodes(content).length;
    const laters = lives
      .map((life) => {
        const finished = life.runs.filter((run) => run.end !== null);
        const room = finished.slice(1).filter((run) => run.lit - run.nodes < total);
        return [
          life.name,
          room.length >= 2 ? median(room.map((run) => run.nodes)) : undefined,
        ] as const;
      })
      .filter((row): row is readonly [string, number] => row[1] !== undefined);
    const ok =
      firsts.every(([, n]) => n !== undefined && n >= low && n <= high) &&
      laters.every(([, m]) => m >= laterMin);
    return {
      ok,
      detail: `first nuke ${perName(firsts, (n) => String(n))}; later median ${perName(laters, (m) => m.toFixed(1))}`,
    };
  },
  // 4.10 (errata E14): the casual's counted Wipe Days by day 30 in the month-1 band.
  casualWipeDaysByDay30: (assertion, { lives }) => {
    const day = num(assertion.day, 30);
    const counts = named(lives, str(assertion.archetype, "casual")).map(
      (life) => life.days.find((row) => row.day === day)?.wipeDays,
    );
    const ok = counts.every(
      (n) => n !== undefined && n >= num(assertion.min, 20) && n <= num(assertion.max, 40),
    );
    return { ok, detail: `Wipe Days by day ${day}: ${range(counts, (n) => String(n))}` };
  },
  // 4.10: the casual's glass ever at the end of the first week.
  casualFirstWeekGlass: (assertion, { lives }) => {
    const day = num(assertion.day, 7);
    const glass = named(lives, str(assertion.archetype, "casual")).map(
      (life) => life.days.find((row) => row.day === day)?.glassEver,
    );
    const ok = glass.every(
      (g) => g !== undefined && g >= num(assertion.min, 300) && g <= num(assertion.max, 2000),
    );
    return {
      ok,
      detail: `glass ever at day ${day}: ${range(glass, (g) => String(Math.round(g)))}`,
    };
  },
  // N32 (D255): five Work Orders are reachable in every run 1, for every archetype.
  ordersReachable: (assertion, { content, lives }) => {
    const fuel = num(assertion.fuel, content.orders.fuel);
    const rows = lives.map((life) => [life.name, life.runs[0]?.orders ?? 0] as const);
    const ok = rows.every(([, claimed]) => claimed >= fuel);
    return { ok, detail: `run 1 claims ${perName(rows, (n) => String(n))} (want ${fuel})` };
  },
};

export const phaseIndex = (phase: Phase): number => PHASES.indexOf(phase);

/**
 * Runs the profile and judges every assertion of `pacing.json5` switched on by `upTo` (the
 * shipped phase unless asked for a later one, to see its numbers before it ships).
 */
export function checkPacing(
  content: Content,
  profile: "test" | "full" = "test",
  upTo: Phase = content.pacing.shipped,
): Verdict[] {
  const { days, seeds, scenarioSeeds, early } = content.pacing.profiles[profile] ?? {
    days: 90,
    seeds: [11],
  };
  const limit = phaseIndex(upTo);
  const due = content.pacing.assertions.filter((assertion) => phaseIndex(assertion.on) <= limit);
  // Snapshots only for the days an N9 check due now reads.
  const snapshotDays = due.flatMap((assertion) =>
    assertion.check === "activeHour" && Array.isArray(assertion.days)
      ? assertion.days.map((day) => num(day, 0))
      : [],
  );
  const stops = early ? earlyStops(content, due) : null;
  const lives = [
    ...seeds.flatMap((seed) => simulateArchetypes(content, days, seed, snapshotDays, stops ?? {})),
    ...(scenarioSeeds ?? seeds).flatMap((seed) => simulateScenarios(content, seed)),
  ];
  return content.pacing.assertions.map((assertion): Verdict => {
    const base = { n: assertion.n, check: assertion.check, on: assertion.on };
    if (phaseIndex(assertion.on) > limit) return { ...base, status: "pending", detail: "" };
    const check = CHECKS[assertion.check];
    if (!check) return { ...base, status: "missing", detail: "no implementation" };
    const { ok, detail } = check(assertion, { content, lives });
    return { ...base, status: ok ? "pass" : assertion.warn ? "warn" : "fail", detail };
  });
}

// --- what the Night Shift's window costs (12-feel.md 15) ------------------------------------

/** One configuration of the window report: a name and the content it plays. */
export interface WindowVariant {
  name: string;
  content: Content;
}

/** R1's base output (`lines.json5` before R2 Feel S6 lowered it for the Workshop). */
const R1_RATE_BASE = 1.5;

/**
 * The variants `pnpm sim window` compares: R1 as it shipped (12 h, its base output, no Workshop
 * tiers), the shipped economy with a 12 h window, and the shipped content (2 h). Built in
 * memory, so the content checks of the shipped data do not refuse the 12 h windows.
 */
export function windowVariants(content: Content): WindowVariant[] {
  const window = (c: Content, windowHours: number, maxHours: number): Content => ({
    ...c,
    run: { ...c.run, nightShift: { ...c.run.nightShift, windowHours, maxHours } },
  });
  const scale = R1_RATE_BASE / content.formula.rateBase;
  const r1: Content = {
    ...content,
    formula: { ...content.formula, rateBase: R1_RATE_BASE },
    lines: content.lines.map((line) => ({ ...line, rate: line.rate * scale })),
    research: content.research.filter((def) => def.kind === "mk"),
  };
  return [
    { name: "R1: 12 h, no Workshop", content: window(r1, 12, 48) },
    { name: "12 h + Workshop", content: window(content, 12, 48) },
    { name: "2 h + Workshop", content },
  ];
}

export interface WindowRow {
  variant: string;
  archetype: string;
  /** Lifetime made at the start of each day-1 check-in, then at the end of day 1. */
  checkIns: { at: number; made: number }[];
  dayEnd: number;
  /** Seconds after DAY0, if run 1 ended inside the days played. */
  firstNuke: number | null;
}

/** Day 1 and the first nuke for each archetype under each variant (`days` played, one seed). */
export function windowReport(content: Content, days = 3, seed = 11): WindowRow[] {
  const rows: WindowRow[] = [];
  for (const variant of windowVariants(content)) {
    for (const name of ["idler", "casual", "active"]) {
      const archetype = variant.content.pacing.archetypes[name];
      if (!archetype) continue;
      const life = simulate(variant.content, name, archetype, days, seed);
      rows.push({
        variant: variant.name,
        archetype: name,
        checkIns: life.checkIns.filter((c) => c.day === 1).map(({ at, made }) => ({ at, made })),
        dayEnd: life.days[0]?.lifetime ?? 0,
        firstNuke: life.runs[0]?.end ?? null,
      });
    }
    for (const name of Object.keys(variant.content.pacing.scenarios)) {
      const archetype = variant.content.pacing.scenarios[name];
      if (!archetype || name !== "firstHour") continue;
      const life = simulate(variant.content, name, archetype, 1, seed);
      rows.push({
        variant: variant.name,
        archetype: name,
        checkIns: [],
        dayEnd: life.days[0]?.lifetime ?? 0,
        firstNuke: life.beats.nuke ?? null,
      });
    }
  }
  return rows;
}
