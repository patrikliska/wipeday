/**
 * The effects evaluator (D135; docs/redesign/09-architecture.md 5.5): one test per op in the
 * fold order, scope and conditions, monotonicity over 10,000 seeded random effect sets, and a
 * per-stat bound. The bounds against the Blast Map's real ceilings arrive with its data (R2).
 */
import { type Effect, STAT_IDS, STATS, type StatId } from "@wipe-day/content/effects";
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { foldStat } from "./effects";
import { rng } from "./rng";

const content = loadContent(contentPaths.data, loadLocale());
const beach = content.lines[0];
const loom = content.lines[3];
if (!beach || !loom) throw new Error("lines missing");

const e = (stat: StatId, op: Effect["op"], value: number, extra: Partial<Effect> = {}): Effect => ({
  stat,
  op,
  value,
  ...extra,
});

describe("the fold, one op at a time", () => {
  it("adds `add`s to the base", () => {
    expect(foldStat("output", [e("output", "add", 2), e("output", "add", 3)], 10)).toBe(15);
  });

  it("sums `inc`s, then multiplies once: (base + add) × (1 + Σinc)", () => {
    const effects = [e("output", "inc", 0.5), e("output", "inc", 0.25), e("output", "add", 2)];
    expect(foldStat("output", effects, 10)).toBe(12 * 1.75);
  });

  it("multiplies `more`s after everything else", () => {
    const effects = [e("output", "more", 2), e("output", "inc", 1), e("output", "more", 3)];
    expect(foldStat("output", effects, 1)).toBe(1 * 2 * 2 * 3);
  });

  it("takes the best `set` as the base: higher where higher is better, lower where lower", () => {
    expect(foldStat("crit_mult", [e("crit_mult", "set", 5), e("crit_mult", "set", 10)], 1)).toBe(
      10,
    );
    expect(
      foldStat("magnet_hours", [e("magnet_hours", "set", 20), e("magnet_hours", "set", 22)], 24),
    ).toBe(20);
    expect(foldStat("crit_mult", [e("crit_mult", "set", 10), e("crit_mult", "add", 2)], 1)).toBe(
      12,
    );
  });

  it("leaves `unlock` out of numbers, and other stats alone", () => {
    expect(foldStat("output", [e("keep_hand", "unlock", 1), e("speed", "more", 2)], 7)).toBe(7);
  });

  it("scales `per` effects by what they count, never past their `max`", () => {
    const per = e("output", "inc", 0.01, { per: "owned", max: 0.5 });
    expect(foldStat("output", [per], 10, {}, { online: true }, { owned: 20 })).toBeCloseTo(12, 12);
    expect(foldStat("output", [per], 10, {}, { online: true }, { owned: 900 })).toBeCloseTo(15, 12);
    const more = e("output", "more", 1.1, { per: "hands", max: 2 });
    expect(foldStat("output", [more], 1, {}, { online: true }, { hands: 30 })).toBe(2);
  });

  it("applies a scoped effect to its line or its era only", () => {
    const effects = [
      e("output", "more", 2, { scope: "loom" }),
      e("output", "more", 3, { scope: "twig" }),
    ];
    expect(foldStat("output", effects, 1, { line: loom })).toBe(2);
    expect(foldStat("output", effects, 1, { line: beach })).toBe(3);
    expect(foldStat("output", effects, 1, {})).toBe(1);
    expect(foldStat("output", [e("output", "more", 5, { scope: "all" })], 1, { line: beach })).toBe(
      5,
    );
  });

  it("applies a conditional effect only while its condition holds", () => {
    const away = e("offline", "more", 1.5, { when: "offline" });
    const here = e("output", "more", 2, { when: "online" });
    expect(foldStat("offline", [away], 1, {}, { online: false })).toBe(1.5);
    expect(foldStat("offline", [away], 1, {}, { online: true })).toBe(1);
    expect(foldStat("output", [here], 1, {}, { online: true })).toBe(2);
    expect(foldStat("output", [here], 1, {}, { online: false })).toBe(1);
    const rain = e("output", "more", 2, { when: "rain" });
    expect(foldStat("output", [rain], 1, {}, { online: true, rain: true })).toBe(2);
    expect(foldStat("output", [rain], 1, {}, { online: true })).toBe(1);
  });
});

/** A random effect that makes its stat no worse (a non-keystone source, D135). */
function randomEffect(next: () => number, stat: StatId): Effect | null {
  const def = STATS[stat];
  if (def.better === "none") return null;
  const ops = def.ops.filter((op) => op !== "unlock");
  const op = ops[Math.floor(next() * ops.length)];
  if (!op) return null;
  const higher = def.better === "higher";
  switch (op) {
    // Values keep a lower-is-better stat positive, as real data does (a cooldown below zero
    // means nothing, and multiplying a negative by less than 1 would raise it).
    case "add":
      return e(stat, op, higher ? next() * 5 : -next() * 0.5);
    case "inc":
      return e(stat, op, higher ? next() * 0.5 : -next() * 0.05);
    case "more":
      return e(stat, op, higher ? 1 + next() * 2 : 0.5 + next() * 0.5);
    case "set":
      // A `set` must beat the base (10 here) to be allowed outside keystones.
      return e(stat, op, higher ? 10 + next() * 10 : 10 - next() * 5);
    default:
      return null;
  }
}

describe("monotonicity (10,000 seeded random effect sets)", () => {
  it("never makes a stat worse by adding one more non-keystone source", () => {
    const random = rng(2026);
    const next = () => random.next();
    const stats = STAT_IDS.filter((stat) => STATS[stat].better !== "none");
    for (let round = 0; round < 10_000; round++) {
      const stat = stats[Math.floor(next() * stats.length)] as StatId;
      const set: Effect[] = [];
      const size = Math.floor(next() * 6);
      for (let i = 0; i < size; i++) {
        const effect = randomEffect(next, stat);
        if (effect) set.push(effect);
      }
      const extra = randomEffect(next, stat);
      if (!extra) continue;
      const before = foldStat(stat, set, 10);
      const after = foldStat(stat, [...set, extra], 10);
      const message = `${stat} round ${round}: ${JSON.stringify(extra)} on ${JSON.stringify(set)}`;
      if (STATS[stat].better === "higher")
        expect(after, message).toBeGreaterThanOrEqual(before - 1e-9);
      else expect(after, message).toBeLessThanOrEqual(before + 1e-9);
    }
  });
});

describe("a per-stat bound", () => {
  it("keeps a full set under (base + Σadd) × (1 + Σinc) × Πmore of its largest values", () => {
    const random = rng(7);
    const next = () => random.next();
    for (let round = 0; round < 2_000; round++) {
      const stat = "output" as const;
      const effects: Effect[] = [];
      for (let i = 0; i < 12; i++) {
        const effect = randomEffect(next, stat);
        if (effect) effects.push(effect);
      }
      const add = effects.filter((x) => x.op === "add").reduce((sum, x) => sum + x.value, 0);
      const inc = effects.filter((x) => x.op === "inc").reduce((sum, x) => sum + x.value, 0);
      const more = effects
        .filter((x) => x.op === "more")
        .reduce((product, x) => product * x.value, 1);
      const bound = (1 + add) * (1 + inc) * more;
      expect(foldStat(stat, effects, 1)).toBeLessThanOrEqual(bound * (1 + 1e-12));
      // A ceiling in data would bound the same product: the content check uses this fold (R2).
      expect(Number.isFinite(foldStat(stat, effects, 1))).toBe(true);
    }
  });
});
