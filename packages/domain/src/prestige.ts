/**
 * The Big Red (docs/redesign/03-the-big-red.md 1-3, 11; D132, D268): the glass formula, what a
 * press would pay right now, the Kettle's stage, and `nuke` itself: the one function that ends a
 * run. Pure: state and `now` in, state and the `nuked` event out; the command wraps it.
 *
 * Glass level over lifetime supplies L: G(L) = floor((L / l0)^exponent). A nuke pays the rise in
 * G since the last one (`meta.glass.level`), times the glass multipliers (`glass_gain`), so a
 * multiplier is never clawed back by the next press. Glow = 1 + k × √(glass ever). The first
 * nuke needs a delta of `firstNukeGlass`; later ones a gain of `laterNukeGlass`. A press that
 * adds at least `countShare` to glass ever is a counted Wipe Day; a smaller one a small blast,
 * which resets the island and pays its glass quietly (N22). Granted glass goes to `held` only.
 */
import { keptRung, nodeOf } from "@wipe-day/content/blastmap";
import type { Content } from "@wipe-day/content/schema";
import { TIERS, type Tier } from "@wipe-day/content/tiers";
import type { Amount } from "./amount";
import { nodeEffects } from "./blastmap";
import { grantDrops } from "./drops";
import { foldStat, fullRate, glow, rates, unitRate } from "./effects";
import type { GameEvent, NukedEvent, RunSummary } from "./events";
import { lineOf } from "./lines";
import { fuelled } from "./orders";
import { pickWeighted, rng, SEED, seedOf } from "./rng";
import { earnScrap } from "./scrap";
import { type BaseState, type Meta, newRun, type RunState } from "./state";

/**
 * G(L) = floor((L / l0)^exponent), exact at the boundaries: floating point may land a hair
 * under a whole number (5e5 × 2^5 must give 2, not 1.9999999), so the result is nudged to
 * the largest g with l0 × g^(1/exponent) ≤ L.
 */
export function glassLevel(content: Content, lifetime: Amount): number {
  const { l0, exponent } = content.prestige;
  if (!(lifetime > 0)) return 0;
  let level = Math.floor((lifetime / l0) ** exponent);
  const need = (g: number) => l0 * g ** (1 / exponent);
  while (need(level + 1) <= lifetime) level += 1;
  while (level > 0 && need(level) > lifetime) level -= 1;
  return level;
}

/** The unfloored level: the yield that moves smoothly (the Kettle's bar, the readout's rate). */
export function glassLevelExact(content: Content, lifetime: Amount): number {
  const { l0, exponent } = content.prestige;
  return lifetime > 0 ? (lifetime / l0) ** exponent : 0;
}

/** Lifetime supplies needed for glass level `level` (the inverse of `glassLevel`). */
export function lifetimeFor(content: Content, level: number): Amount {
  const { l0, exponent } = content.prestige;
  return l0 * level ** (1 / exponent);
}

/** Glow: 1 + k × √(glass ever). `k` is `glowK` unless an effect changes it. */
export { glow };

/** Lifetime supplies made so far, this run included. */
export const lifetimeOf = (state: BaseState): Amount => state.meta.lifetime + state.run.made;

/** The glass multiplier in force (Bigger Payload and friends; Late Tide joins in R8). */
export function glassMultiplier(content: Content, state: BaseState): number {
  const r = rates(content, state);
  return foldStat("glass_gain", r.byStat.get("glass_gain") ?? [], 1);
}

/** What a press would do right now (03 1.1, 1.5, 2.1). */
export interface Yield {
  /** The formula level now, and the levels not yet paid for. */
  level: number;
  delta: number;
  /** The glass a press pays now: floor(delta × multiplier). */
  gain: number;
  multiplier: number;
  /** No Wipe Day yet. */
  first: boolean;
  /** The first nuke needs a delta of 10; later ones a gain of 1. */
  pressable: boolean;
  /** The gain a counted Wipe Day needs: 10 at first, then 10% of glass ever (at least 1). */
  threshold: number;
  /** A Wipe Day (counted), or a small blast. */
  counts: boolean;
  /** A counted press that at least doubles glass ever (the first Wipe Day counts as one). */
  doubling: boolean;
  everBefore: Amount;
  everAfter: Amount;
  glowBefore: number;
  glowAfter: number;
  /** The unfloored gain, for bars that move at every check-in. */
  exact: number;
  /** This run's average glass an hour, and its best so far (`run.peak`). */
  rateNow: number;
  peak: number;
  /** Lifetime supplies at which the next whole glass comes. */
  nextAt: Amount;
}

/** Seconds this run has run (from its first tap or purchase; 0 while fresh). */
export const runAge = (state: BaseState, now: number): number =>
  state.run.startedAt === null ? 0 : Math.max(0, now - state.run.startedAt);

export function glassYield(content: Content, state: BaseState, now: number): Yield {
  const { meta } = state;
  const p = content.prestige;
  const lifetime = lifetimeOf(state);
  const level = glassLevel(content, lifetime);
  const delta = Math.max(0, level - meta.glass.level);
  const multiplier = glassMultiplier(content, state);
  const gain = Math.floor(delta * multiplier);
  const first = meta.wipeDays === 0;
  const pressable = first ? delta >= p.firstNukeGlass : gain >= p.laterNukeGlass;
  const threshold = first
    ? p.firstNukeGlass
    : Math.max(p.countMinGlass, Math.ceil(p.countShare * meta.glass.ever));
  const counts = pressable && (first || gain >= threshold);
  const everAfter = meta.glass.ever + gain;
  const k = foldStat("glow_k", rates(content, state).byStat.get("glow_k") ?? [], p.glowK);
  const exact = Math.max(0, glassLevelExact(content, lifetime) - meta.glass.level) * multiplier;
  const hours = Math.max(runAge(state, now) / 3600, 1 / 6);
  return {
    level,
    delta,
    gain,
    multiplier,
    first,
    pressable,
    threshold,
    counts,
    // The first Wipe Day pays as a doubling (the roadmap's "3 scrap for the first Wipe Day").
    doubling: counts && (first || gain >= meta.glass.ever),
    everBefore: meta.glass.ever,
    everAfter,
    glowBefore: glow(content, meta.glass.ever, k),
    glowAfter: glow(content, everAfter, k),
    exact,
    rateNow: exact / hours,
    peak: Math.max(state.run.peak, exact / hours),
    nextAt: lifetimeFor(content, meta.glass.level + delta + 1),
  };
}

export type KettleStage = "hidden" | "pad" | "frame" | "warhead" | "fuel";

/**
 * The Kettle's stage (03 3.2, with D255): hidden until `padAt` made in run 1 (the pad from the
 * start of later runs), the frame when glass is coming, the warhead when the press would count,
 * fuel and steam when the advisor crowns it (`crowned`, the caller's: `bigRedCrown`).
 */
export function kettleStage(
  content: Content,
  state: BaseState,
  now: number,
  crowned = bigRedCrown(content, state, now) !== null,
): KettleStage {
  const { kettle } = content.prestige;
  const first = state.meta.nukes === 0;
  if (first && lifetimeOf(state) < kettle.padAt) return "hidden";
  const y = glassYield(content, state, now);
  if (crowned) return "fuel";
  if (y.counts) return "warhead";
  const frameAt = first
    ? kettle.frameFirst
    : Math.max(1, Math.ceil(kettle.frameShare * state.meta.glass.ever));
  return y.gain >= frameAt ? "frame" : "pad";
}

/** Which of the crown's rules puts the Big Red first (03 2.2, D255). */
export type BigRedRule = "first" | "doubling" | "fuelled" | "day";

/**
 * The Big Red's crown (03 2.2 with D255), first match: the guided first nuke at a delta of 10;
 * a doubling press; a counting press in a run whose Work Orders set is fuelled; a counting
 * press once the run is `crown.ageSeconds` old. Every rule only ever becomes true inside a
 * run, so the crown is sticky without state. The caller passes down while a buff runs or the
 * welcome card is open (`advisor.ts`).
 */
export function bigRedCrown(content: Content, state: BaseState, now: number): BigRedRule | null {
  const y = glassYield(content, state, now);
  if (!y.pressable) return null;
  if (y.first) return "first";
  if (y.doubling) return "doubling";
  if (!y.counts) return null;
  if (fuelled(content, state)) return "fuelled";
  if (runAge(state, now) >= content.prestige.crown.ageSeconds) return "day";
  return null;
}

/** The flight the next press flies (03 7.3), rolled on the base's seed and the press count. */
export function rollFlight(content: Content, state: BaseState, counts: boolean): string {
  const { flights } = content.prestige;
  if (!counts) return flights.small;
  const wipeDay = state.meta.wipeDays + 1;
  const open = flights.variants.filter((flight) => flight.unlockAt <= wipeDay);
  if (open.length === 0) return flights.small;
  const unseen = open.filter((flight) => !state.meta.flights.includes(flight.id));
  // A new flight plays as soon as it unlocks; later, unseen ones weigh more.
  const pool = unseen.length > 0 ? unseen : open;
  const random = rng(seedOf(state.seed, SEED.flight, state.meta.nukes));
  const weights = pool.map((flight) =>
    state.meta.flights.includes(flight.id) ? flight.weight : flight.weight * flights.unseenWeight,
  );
  return pool[pickWeighted(random, weights)]?.id ?? flights.small;
}

/** Whether Wipe Day `n` is a news milestone (06-friends.md 2.2). */
export function newsMilestone(content: Content, n: number): boolean {
  const { milestones, every } = content.prestige.news;
  const last = milestones.at(-1) ?? 0;
  return milestones.includes(n) || (n > last && (n - last) % every === 0);
}

/** The hands that stay hired through the nuke: the agenda's rungs and the owned `keep_hand` nodes. */
export function keptHands(content: Content, state: BaseState): string[] {
  const rung = keptRung(content, state.meta.wipeDays + 1);
  const keeps = nodeEffects(content, state.meta)
    .filter((effect) => effect.stat === "keep_hand")
    .map((effect) => effect.scope ?? "");
  return state.run.hands.filter((id) => {
    const line = lineOf(content, id);
    if (!line) return false;
    return line.rung <= rung || keeps.includes(line.id) || keeps.includes(line.era);
  });
}

/** What the owned start nodes give a fresh run: units, shelf rows, the era (04 4.2). */
export function runStart(
  content: Content,
  meta: Meta,
): { lines: Record<string, number>; upgrades: string[]; era: Tier } {
  const lines: Record<string, number> = {};
  const upgrades: string[] = [];
  let era: Tier = "twig";
  for (const effect of nodeEffects(content, meta)) {
    if (effect.scope === undefined) continue;
    if (effect.stat === "start_owned") {
      lines[effect.scope] = Math.max(lines[effect.scope] ?? 0, Math.floor(effect.value));
    } else if (effect.stat === "start_upgrade") {
      if (!upgrades.includes(effect.scope)) upgrades.push(effect.scope);
    } else if (effect.stat === "start_era") {
      const tier = TIERS[effect.value];
      if (tier && TIERS.indexOf(tier) > TIERS.indexOf(era)) era = tier;
    }
  }
  // Shelf rows in their ladder order, so `after` gates read right.
  const ordered = content.upgrades
    .filter((upgrade) => upgrades.includes(upgrade.id))
    .map((upgrade) => upgrade.id);
  return { lines, upgrades: ordered, era };
}

/** The run's numbers for the postcard and the log (03 8.3). */
export function runSummary(content: Content, state: BaseState, now: number): RunSummary {
  const { run } = state;
  let best: { id: string; share: number } | null = null;
  const full = fullRate(content, state, now, { online: true });
  for (const line of content.lines) {
    const n = run.lines[line.id] ?? 0;
    if (n <= 0 || full <= 0) continue;
    const share = (n * unitRate(content, state, line, now, { online: true })) / full;
    if (!best || share > best.share) best = { id: line.id, share };
  }
  return {
    seconds: runAge(state, now),
    made: run.made,
    era: run.era,
    flotsam: run.flotsam.caught,
    gulls: run.gulls.caught,
    orders: run.orders.claimed.length,
    taps: run.taps,
    bestLine: best,
  };
}

/**
 * The nuke (03 1, 11): pays the yield, counts a Wipe Day or not, keeps exactly `meta` (glass,
 * nodes, records, flights, news, scrap, drops, cards, badges, hints) and starts a fresh run with
 * the kept hands and the start nodes applied. The caller checked `pressable`.
 */
export function nuke(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const y = glassYield(content, state, now);
  const { meta, run } = state;
  const flight = rollFlight(content, state, y.counts);
  const summary = runSummary(content, state, now);
  const wipeDay = y.counts ? meta.wipeDays + 1 : null;
  // News (06 2.2): a Wipe Day is news when enough time passed or its count is a milestone; a
  // held-back one folds into the next.
  const { foldMinutes } = content.prestige.news;
  const isNews =
    wipeDay !== null &&
    (meta.news.at === null ||
      now - meta.news.at >= foldMinutes * 60 ||
      newsMilestone(content, wipeDay));
  const news = !y.counts
    ? meta.news
    : isNews
      ? { at: now, folded: 0, glass: 0 }
      : { at: meta.news.at, folded: meta.news.folded + 1, glass: meta.news.glass + y.gain };
  const nodes =
    y.first && !meta.nodes.includes("ground_zero") ? [...meta.nodes, "ground_zero"] : meta.nodes;
  const flights = meta.flights.includes(flight) ? meta.flights : [...meta.flights, flight];
  const nextMeta: Meta = {
    ...meta,
    nukes: meta.nukes + 1,
    wipeDays: wipeDay ?? meta.wipeDays,
    lifetime: meta.lifetime + run.made,
    glass: { ...meta.glass, ever: y.everAfter, held: meta.glass.held + y.gain, level: y.level },
    nodes,
    records: {
      bestRun: Math.max(meta.records.bestRun, run.made),
      bestBlast: y.counts ? Math.max(meta.records.bestBlast, y.gain) : meta.records.bestBlast,
    },
    flights,
    news,
  };
  const kept = keptHands(content, state);
  const start = runStart(content, nextMeta);
  const fresh = newRun(content, nextMeta, state.seed, now);
  const nextRun: RunState = {
    ...fresh,
    lines: start.lines,
    upgrades: start.upgrades,
    era: start.era,
    hands: kept,
  };
  let out: BaseState = { ...state, meta: nextMeta, run: nextRun };
  const pays = y.doubling
    ? content.prestige.pays.doubling
    : y.counts
      ? content.prestige.pays.wipeDay
      : content.prestige.pays.small;
  const events: GameEvent[] = [];
  const event: NukedEvent = {
    type: "nuked",
    n: run.n,
    wipeDay,
    gain: y.gain,
    ever: y.everAfter,
    glowBefore: y.glowBefore,
    glowAfter: y.glowAfter,
    doubling: y.doubling,
    flight,
    pays,
    news: isNews ? { folded: meta.news.folded, glass: meta.news.glass } : null,
    summary,
  };
  events.push(event);
  // The press's drop lands in the Album at once (never through the hourly gate, D268).
  out = grantDrops(out, pays.drop, 1);
  events.push({ type: "drop_earned", tier: pays.drop, count: 1, source: "nuke" });
  if (pays.scrap > 0) {
    const earned = earnScrap(out, pays.scrap, "nuke");
    out = earned.state;
    events.push(...earned.events);
  }
  return { state: out, events };
}

/** Whether `id` names a node the content knows (for the admin's respec and normalise). */
export const knownNode = (content: Content, id: string): boolean =>
  nodeOf(content, id) !== undefined;
