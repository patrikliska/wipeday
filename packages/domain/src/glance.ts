/**
 * Read-only views of a base for the HUD (docs/redesign/09-architecture.md 10.2): the top bar's
 * `/s`, the Multipliers sheet's rows and a tap's parts. Nothing here changes state; the rules
 * live in `effects`, `settle` and `taps`, and these only take them apart for display.
 */
import { statBase } from "@wipe-day/content/blastmap";
import { isFeatureStat, type StatId } from "@wipe-day/content/effects";
import type { Content, LineDef, NodeDef } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import { badgeCount } from "./badges";
import { nodeEffects, ownsNode, sectorCounts } from "./blastmap";
import {
  buffEffects,
  type Conditions,
  type Counts,
  type Effect,
  foldStat,
  fullRate,
  milestoneFactors,
  rates,
  unitRate,
} from "./effects";
import { lineOf } from "./lines";
import { glassYield, type KettleStage, kettleStage, type Yield } from "./prestige";
import { levelEffect, researchEffects } from "./research";
import { conditionsAt, mannedRate } from "./settle";
import type { BaseState } from "./state";
import { hustleFactor, tapParts } from "./taps";

const ONLINE: Conditions = { online: true };

/**
 * The Big Red's readout (03-the-big-red.md 2.1, 4.4): "+12 now · 9/h now · peak 14/h", the
 * Kettle's stage and whether the press would count. Read-only; the web's chip, the cover card
 * and the bot's card share it.
 */
export function bigRedGlance(
  content: Content,
  state: BaseState,
  now: number,
  crowned: boolean,
): Yield & { stage: KettleStage } {
  return { ...glassYield(content, state, now), stage: kettleStage(content, state, now, crowned) };
}

/**
 * The top bar's `/s` (02-the-run.md 3.2): manned lines plus unmanned lines with a cycle
 * running, buffs included. It climbs while you tap and settles back when you stop.
 */
export function shownRate(content: Content, state: BaseState, t: number): number {
  let total = mannedRate(content, state, t);
  const when = conditionsAt(content, state, t);
  for (const [id, ready] of Object.entries(state.run.readyAt)) {
    if (ready <= t || state.run.hands.includes(id)) continue;
    const line = lineOf(content, id);
    const n = state.run.lines[id] ?? 0;
    if (line && n > 0) total += n * unitRate(content, state, line, t, when);
  }
  return total;
}

/** Hustle's meter at `t`: it holds for its grace, then drains. */
export function hustleAt(content: Content, state: BaseState, t: number): number {
  const parts = tapParts(content, state, t);
  const idle = Math.max(0, t - state.run.hustle.at - parts.hold);
  return Math.max(0, state.run.hustle.value - parts.drain * idle);
}

/** One step of the Multipliers sheet: its factor and where it comes from. */
export interface Step {
  id:
    | "milestones"
    | "workshop"
    | "upgrades"
    | "eras"
    | "roster"
    | "nodes"
    | "glow"
    | "morale"
    | "buffs"
    | "other";
  factor: number;
  /** Each source and its own factor: a line, a Workshop item, an upgrade, an era, a tier, a buff. */
  sources: { id: string; factor: number; until?: number }[];
}

/** Every line as if manned, taken apart in the evaluator's order (08-screens.md 2.16). */
export interface Breakdown {
  /** Units owned across all lines. */
  units: number;
  /** Their production before any multiplier: Σ owned × base rate. */
  base: number;
  /** Multiplying steps in order; each step's factor applies on top of those before it. */
  steps: Step[];
  /** base × every factor: `fullRate` at `t`. */
  total: number;
}

const productOf = (effects: readonly Effect[]): number => {
  let value = 1;
  for (const effect of effects) if (effect.op === "more") value *= effect.value;
  return value;
};

/**
 * The full rate at `t` taken apart: lines' base output, then milestones, the Workshop (its
 * items and Line Mks), the shelf's island upgrades, eras, roster tiers, Glow and buffs. Each step's factor is the ratio of
 * the total with and without it, so the steps multiply out to `fullRate` exactly; an effect no
 * step names (a later phase's source) lands in `other`.
 */
export function breakdown(content: Content, state: BaseState, t: number): Breakdown {
  const r = rates(content, state);
  const owned = content.lines
    .map((line) => ({ line, n: state.run.lines[line.id] ?? 0 }))
    .filter((row) => row.n > 0);
  const units = owned.reduce((sum, row) => sum + row.n, 0);
  const base = owned.reduce((sum, row) => sum + row.n * row.line.rate, 0);

  const milestone = new Map<string, Effect[]>();
  for (const { line, n } of owned) {
    const { payout, speed } = milestoneFactors(content, n);
    const list: Effect[] = [];
    if (payout > 1) list.push({ stat: "output", op: "more", value: payout, scope: line.id });
    if (speed > 1) list.push({ stat: "speed", op: "more", value: speed, scope: line.id });
    milestone.set(line.id, list);
  }
  const workshop = researchEffects(content, state).filter(
    (effect) => effect.stat === "output" || effect.stat === "speed",
  );
  const shelf = content.upgrades.filter(
    (upgrade) => upgrade.kind !== "grip" && state.run.upgrades.includes(upgrade.id),
  );
  const eraIndex = TIERS.indexOf(state.run.era);
  const eras = content.eras.filter(
    (era) => TIERS.indexOf(era.id) <= eraIndex && (era.effects?.length ?? 0) > 0,
  );
  const roster = content.milestones.roster.slice(0, state.run.roster);
  const buffs = state.run.buffs.filter((buff) => buff.until > t);
  // The Blast Map's production effects (R4), read at the conditions of this moment.
  const when = conditionsAt(content, state, t);
  const nodes = nodeEffects(content, state.meta).filter(
    (effect) => effect.stat === "output" || effect.stat === "speed",
  );

  /** Σ owned × a unit's output and speed folded over `effects` (per line). */
  const total = (effects: (line: LineDef) => Effect[]): number => {
    let sum = 0;
    for (const { line, n } of owned) {
      const list = effects(line);
      const query = { line };
      const counts: Counts = {
        owned: n,
        hands: state.run.hands.length,
        nukes: state.meta.wipeDays,
        sectors: sectorCounts(content, state.meta),
      };
      const output = foldStat("output", list, line.rate, query, when, counts);
      const speed = foldStat("speed", list, 1, query, when, counts);
      sum += n * output * speed;
    }
    return sum;
  };
  const layers: Array<{ id: Step["id"]; effects: (line: LineDef) => Effect[] }> = [
    { id: "milestones", effects: (line) => milestone.get(line.id) ?? [] },
    { id: "workshop", effects: () => workshop },
    { id: "upgrades", effects: () => shelf.flatMap((upgrade) => upgrade.effects) },
    { id: "eras", effects: () => eras.flatMap((era) => era.effects ?? []) },
    {
      id: "roster",
      effects: () =>
        roster.map((step) => ({
          stat: "output" as const,
          op: "more" as const,
          value: step.payout,
        })),
    },
    { id: "nodes", effects: () => nodes },
  ];

  const steps: Step[] = [];
  const applied: Array<(line: LineDef) => Effect[]> = [];
  let before = base;
  for (const layer of layers) {
    applied.push(layer.effects);
    const after = total((line) => applied.flatMap((get) => get(line)));
    steps.push({ id: layer.id, factor: before > 0 ? after / before : 1, sources: [] });
    before = after;
  }
  const sources = (id: Step["id"]) => steps.find((step) => step.id === id)?.sources ?? [];
  for (const { line } of owned) {
    const factor = productOf(milestone.get(line.id) ?? []);
    if (factor > 1) sources("milestones").push({ id: line.id, factor });
  }
  // Each Workshop item's own factor: the lines with it over the lines without (after milestones).
  const milestoned = total((line) => milestone.get(line.id) ?? []);
  for (const def of content.research) {
    const n = state.run.research[def.id] ?? 0;
    const effect = n > 0 ? levelEffect(def.effect, n) : null;
    if (!effect || (effect.stat !== "output" && effect.stat !== "speed")) continue;
    const factor =
      milestoned > 0
        ? total((line) => [...(milestone.get(line.id) ?? []), effect]) / milestoned
        : 1;
    if (factor > 1 + 1e-12) sources("workshop").push({ id: def.id, factor });
  }
  for (const upgrade of shelf)
    sources("upgrades").push({ id: upgrade.id, factor: productOf(upgrade.effects) });
  for (const era of eras)
    sources("eras").push({ id: era.id, factor: productOf(era.effects ?? []) });
  for (const [index, step] of roster.entries())
    sources("roster").push({
      id: String(content.milestones.roster[index]?.at ?? 0),
      factor: step.payout,
    });
  // Each production node's own factor over the lines with everything before the map.
  const beforeMap = total((line) => applied.slice(0, 5).flatMap((get) => get(line)));
  for (const node of content.blastMap.nodes) {
    if (!state.meta.nodes.includes(node.id)) continue;
    const own = node.effects.filter((e) => e.stat === "output" || e.stat === "speed");
    if (own.length === 0 || beforeMap <= 0) continue;
    const factor =
      total((line) => [...applied.slice(0, 5).flatMap((get) => get(line)), ...own]) / beforeMap;
    if (factor > 1 + 1e-12) sources("nodes").push({ id: node.id, factor });
  }

  steps.push({ id: "glow", factor: r.glow, sources: [] });
  // Morale (D198): its one source is the badge count.
  if (r.morale > 1 + 1e-12)
    steps.push({
      id: "morale",
      factor: r.morale,
      sources: [{ id: String(badgeCount(content, state)), factor: r.morale }],
    });
  before *= r.glow * r.morale;
  const full = fullRate(content, state, t, ONLINE);
  const withoutBuffs = buffs.length
    ? fullRate(content, { ...state, run: { ...state.run, buffs: [] } }, t, ONLINE)
    : full;
  if (buffs.length) {
    steps.push({
      id: "buffs",
      factor: withoutBuffs > 0 ? full / withoutBuffs : 1,
      // What each does to the lines (Frenzy's tap part shows under the tap).
      sources: buffs.map((buff) => ({
        id: buff.kind,
        factor: productOf(
          buffEffects(content, [buff], t).filter((effect) => effect.stat !== "tap"),
        ),
        until: buff.until,
      })),
    });
  }
  // Whatever the named steps miss (a later phase's source), so the sheet always adds up.
  const other = before > 0 ? withoutBuffs / before : 1;
  if (Math.abs(other - 1) > 1e-9) steps.push({ id: "other", factor: other, sources: [] });
  return { units, base, steps, total: full };
}

/** A tap's parts for the Multipliers sheet: Grip's flat part, the share of `/s`, Hustle. */
export function tapGlance(content: Content, state: BaseState, t: number) {
  const parts = tapParts(content, state, t);
  const hustle = hustleFactor(hustleAt(content, state, t), parts.hustleCap, parts.hustlePeak);
  const share = parts.fullValue > 0 ? (parts.base - parts.flatValue) / parts.fullValue : 0;
  return {
    /** A tap's value now, Hustle included (crits aside). */
    value: parts.base * hustle,
    flat: parts.flatValue,
    /** The share of the full rate each tap adds (0.004 per Grip rung). */
    share,
    hustle,
    hustlePeak: parts.hustlePeak,
  };
}

/**
 * The Night Shift as the bot's card and the welcome card read it (06-friends.md 10.2): the
 * window, how much of it the hands have used since the last command, and when they stopped.
 */
export function nightShiftGlance(
  content: Content,
  state: BaseState,
  now: number,
): { window: number; used: number; left: number; full: boolean; stoppedAt: number | null } {
  const window = rates(content, state).nightShift;
  const since = Math.max(0, now - state.run.activeAt);
  const full = since >= window;
  return {
    window,
    used: Math.min(since, window),
    left: Math.max(0, window - since),
    full,
    stoppedAt: full ? state.run.activeAt + window : null,
  };
}

/**
 * What a node does in the player's own numbers (04-blast-map.md 8.2): the state folded with
 * and without it, read by kind. `income` is every line manned (the Multipliers sheet's total)
 * under the conditions of this moment; a node that works only at night, in rain or under
 * Afterglow reports its income under that condition, marked `when`. `tap` is a tap's value
 * before Hustle and crits; `night_shift` is in seconds; `glass` is the next press's gain;
 * `glow` the Glow factor; any other stat comes as `stat` with its fold before and after (an
 * amount from the stat's base when it has one, else a factor from 1). Features and run starts
 * come as `feature`: the blurb says it.
 */
export type NodeEffectLine =
  | { kind: "income"; before: number; after: number; when?: "night" | "rain" | "afterglow" }
  | { kind: "tap"; before: number; after: number }
  | { kind: "night_shift"; before: number; after: number }
  | { kind: "glass"; before: number; after: number }
  | { kind: "glow"; before: number; after: number }
  | { kind: "stat"; stat: StatId; before: number; after: number; additive: boolean }
  | { kind: "feature" };

const INCOME_STATS: ReadonlySet<string> = new Set(["output", "speed", "offline"]);
const TAP_STATS: ReadonlySet<string> = new Set(["tap", "tap_flat", "tap_share"]);
const START_STATS: ReadonlySet<string> = new Set([
  "start_owned",
  "start_era",
  "start_upgrade",
  "keep_hand",
]);
const EVERY_CONDITION: Conditions = { online: true, night: true, rain: true, afterglow: true };

const differ = (a: number, b: number): boolean =>
  Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

export function nodeGlance(
  content: Content,
  state: BaseState,
  node: NodeDef,
  now: number,
): NodeEffectLine[] {
  // "Without" is the state with the node taken out, so an owned node reads the same way.
  const without: BaseState = ownsNode(state.meta, node.id)
    ? { ...state, meta: { ...state.meta, nodes: state.meta.nodes.filter((id) => id !== node.id) } }
    : state;
  const added: BaseState = {
    ...without,
    meta: { ...without.meta, nodes: [...without.meta.nodes, node.id] },
  };
  const lines: NodeEffectLine[] = [];
  const stats = [...new Set(node.effects.map((effect) => effect.stat))];

  if (stats.some((stat) => INCOME_STATS.has(stat))) {
    const here = conditionsAt(content, added, now);
    const before = fullRate(content, without, now, here);
    const after = fullRate(content, added, now, here);
    if (differ(before, after)) lines.push({ kind: "income", before, after });
    else {
      // Only under a condition not met right now: read it as if it were.
      for (const effect of node.effects) {
        const when = effect.when;
        if (when !== "night" && when !== "rain" && when !== "afterglow") continue;
        const forced: Conditions = { ...here, [when]: true };
        const b = fullRate(content, without, now, forced);
        const a = fullRate(content, added, now, forced);
        if (differ(a, b)) {
          lines.push({ kind: "income", before: b, after: a, when });
          break;
        }
      }
    }
  }
  if (stats.some((stat) => TAP_STATS.has(stat))) {
    const before = tapParts(content, without, now).base;
    const after = tapParts(content, added, now).base;
    if (differ(before, after)) lines.push({ kind: "tap", before, after });
  }
  if (stats.includes("night_shift")) {
    const before = rates(content, without).nightShift;
    const after = rates(content, added).nightShift;
    if (differ(before, after)) lines.push({ kind: "night_shift", before, after });
  }
  if (stats.includes("glass_gain")) {
    const before = glassYield(content, without, now).gain;
    const after = glassYield(content, added, now).gain;
    lines.push({ kind: "glass", before, after });
  }
  if (stats.includes("glow_k")) {
    const before = rates(content, without).glow;
    const after = rates(content, added).glow;
    lines.push({ kind: "glow", before, after });
  }
  const counts: Counts = {
    hands: state.run.hands.length,
    nukes: state.meta.wipeDays,
    sectors: sectorCounts(content, added.meta),
  };
  for (const stat of stats) {
    if (
      INCOME_STATS.has(stat) ||
      TAP_STATS.has(stat) ||
      stat === "night_shift" ||
      stat === "glass_gain" ||
      stat === "glow_k"
    )
      continue;
    if (isFeatureStat(stat) || START_STATS.has(stat)) {
      if (!lines.some((line) => line.kind === "feature")) lines.push({ kind: "feature" });
      continue;
    }
    const id = stat as StatId;
    const base = statBase(content, id);
    const effects = node.effects.filter((effect) => effect.stat === stat);
    const additive = base !== null || effects.some((e) => e.op === "add");
    const from = base ?? (additive ? 0 : 1);
    const scope = effects[0]?.scope;
    const query = scope && scope !== "all" ? { kind: scope } : {};
    const fold = (s: BaseState): number =>
      foldStat(id, rates(content, s).effects, from, query, EVERY_CONDITION, counts);
    const before = fold(without);
    const after = fold(added);
    if (differ(before, after)) lines.push({ kind: "stat", stat: id, before, after, additive });
  }
  return lines;
}
