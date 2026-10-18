/**
 * Read-only views of a base for the HUD (docs/redesign/09-architecture.md 10.2): the top bar's
 * `/s`, the Multipliers sheet's rows and a tap's parts. Nothing here changes state; the rules
 * live in `effects`, `settle` and `taps`, and these only take them apart for display.
 */
import type { Content, LineDef } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import {
  buffEffects,
  type Conditions,
  type Effect,
  foldStat,
  fullRate,
  milestoneFactors,
  rates,
  unitRate,
} from "./effects";
import { lineOf } from "./lines";
import { levelEffect, researchEffects } from "./research";
import { conditionsAt, mannedRate } from "./settle";
import type { BaseState } from "./state";
import { hustleFactor, tapParts } from "./taps";

const ONLINE: Conditions = { online: true };

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
  id: "milestones" | "workshop" | "upgrades" | "eras" | "roster" | "glow" | "buffs" | "other";
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

  /** Σ owned × a unit's output and speed folded over `effects` (per line). */
  const total = (effects: (line: LineDef) => Effect[]): number => {
    let sum = 0;
    for (const { line, n } of owned) {
      const list = effects(line);
      const query = { line };
      const counts = { owned: n, hands: state.run.hands.length };
      const output = foldStat("output", list, line.rate, query, ONLINE, counts);
      const speed = foldStat("speed", list, 1, query, ONLINE, counts);
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

  steps.push({ id: "glow", factor: r.glow, sources: [] });
  before *= r.glow * r.morale;
  const full = fullRate(content, state, t, ONLINE);
  const withoutBuffs = buffs.length
    ? fullRate(content, { ...state, run: { ...state.run, buffs: [] } }, t, ONLINE)
    : full;
  if (buffs.length) {
    steps.push({
      id: "buffs",
      factor: withoutBuffs > 0 ? full / withoutBuffs : 1,
      sources: buffs.map((buff) => ({
        id: buff.kind,
        factor: productOf(buffEffects(content, [buff], t)),
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
