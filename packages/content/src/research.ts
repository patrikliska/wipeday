/**
 * The Workshop's items (docs/game-design.md 5.12; D185, D194): tier items priced by formula and
 * one Line Mk per line with its own prices. Browser-safe: the domain, the web client and the
 * content checks share these.
 */
import type { z } from "zod";
import type { Effect, Op, StatId } from "./effects";
import type { LineDef, ResearchDef, researchFileSchema } from "./schema";
import { TIERS, type Tier } from "./tiers";

export type ResearchFile = z.infer<typeof researchFileSchema>;

/** The era tier `k` (1-based) opens with: tiers 1-2 Twig, 3-4 Timber, 5-6 Stone, 7-8 Sheet Metal. */
export function tierEra(k: number): Tier {
  return TIERS[Math.min(TIERS.length - 1, Math.ceil(k / 2) - 1)] ?? "twig";
}

export function deriveResearch(lines: readonly LineDef[], file: ResearchFile): ResearchDef[] {
  const out: ResearchDef[] = [];
  const { base, tierRatio, growth } = file.price;
  for (const [index, tier] of file.tiers.entries()) {
    const k = index + 1;
    for (const item of tier.items) {
      out.push({
        id: item.id,
        kind: "tier",
        tier: k,
        era: tier.era,
        levels: item.levels,
        effect: item.effect,
        base: base * tierRatio ** (k - 1),
        growth,
        costs: [],
        needOwned: [],
        pocket: false,
      });
    }
  }
  const { lineMk } = file;
  for (const line of lines) {
    const costs = lineMk.levels.map((level) => line.cost * level.costFactor);
    out.push({
      id: `${line.id}_mk`,
      kind: "mk",
      tier: 0,
      era: line.era,
      levels: lineMk.levels.length,
      effect: { ...lineMk.effect, scope: line.id },
      base: costs[0] ?? 0,
      growth: 1,
      costs,
      needOwned: lineMk.levels.map((level) => level.needOwned),
      line: line.id,
      pocket: lineMk.pocket,
    });
  }
  return out;
}

/** `n` levels of an item's effect as one effect: add and inc sum, more compounds. */
export function levelEffect(effect: Effect, n: number): Effect {
  return { ...effect, value: effect.op === "more" ? effect.value ** n : effect.value * n };
}

/** The price of `k` more levels from level `n` (closed form for tier items). */
export function levelsCost(def: ResearchDef, n: number, k: number): number {
  if (k <= 0) return 0;
  if (def.kind === "mk") {
    let sum = 0;
    for (let i = n; i < n + k; i += 1) sum += def.costs[i] ?? Number.POSITIVE_INFINITY;
    return sum;
  }
  const g = def.growth;
  const first = def.base * g ** n;
  return g === 1 ? first * k : (first * (g ** k - 1)) / (g - 1);
}

/**
 * The stats a Workshop item may use: those the crown scores in closed form (advisor.ts), so every
 * item can be crowned. A content check refuses any other.
 */
export const SCORED = {
  output: ["inc", "more"],
  speed: ["more"],
  tap_flat: ["add", "more"],
  hustle_max: ["add"],
  night_shift: ["add"],
  offline: ["more"],
} as const satisfies Partial<Record<StatId, readonly Op[]>>;

export type ScoredStat = keyof typeof SCORED;

export function isScored(effect: Effect): effect is Effect & { stat: ScoredStat } {
  const ops = (SCORED as Partial<Record<StatId, readonly Op[]>>)[effect.stat];
  return ops?.includes(effect.op) ?? false;
}
