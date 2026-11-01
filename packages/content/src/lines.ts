/**
 * The lines' numbers from their formula (docs/redesign/02-the-run.md 2.1): rung i costs
 * costBase × costRatio^(i−1), makes rateBase × rateRatio^(i−1) a second per unit, cycles in
 * cycleBase × cycleRatio^(i−1) seconds and grows by growthBase − growthStep × (i−1) a unit;
 * its hand costs handFactor times its first unit. A row may override any of them.
 */
import type { LineDef, LineFormula } from "./schema";
import type { Tier } from "./tiers";

export interface LineRow {
  id: string;
  rung: number;
  era: Tier;
  hand: string;
  product: string;
  maxOwned: number;
  cost?: number | undefined;
  rate?: number | undefined;
  cycle?: number | undefined;
  growth?: number | undefined;
}

export function deriveLine(formula: LineFormula, row: LineRow): LineDef {
  const step = row.rung - 1;
  const cost = row.cost ?? formula.costBase * formula.costRatio ** step;
  return {
    id: row.id,
    rung: row.rung,
    era: row.era,
    hand: row.hand,
    product: row.product,
    maxOwned: row.maxOwned,
    cost,
    rate: row.rate ?? formula.rateBase * formula.rateRatio ** step,
    cycle: row.cycle ?? formula.cycleBase * formula.cycleRatio ** step,
    growth: row.growth ?? formula.growthBase - formula.growthStep * step,
    handPrice: formula.handFactor * cost,
  };
}

/** Every line, sorted by rung. */
export function deriveLines(formula: LineFormula, rows: readonly LineRow[]): LineDef[] {
  return rows.map((row) => deriveLine(formula, row)).sort((a, b) => a.rung - b.rung);
}
