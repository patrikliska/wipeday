/**
 * The prestige shape (D132, N21): the glass level over lifetime supplies and Glow, the boost
 * from glass ever earned. Constants in `prestige.json5`.
 */
import type { Content } from "@wipe-day/content/schema";
import type { Amount } from "./amount";

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

/** Lifetime supplies needed for glass level `level` (the inverse of `glassLevel`). */
export function lifetimeFor(content: Content, level: number): Amount {
  const { l0, exponent } = content.prestige;
  return l0 * level ** (1 / exponent);
}

/** Glow: 1 + k × √(glass ever). `k` is `glowK` unless an effect changes it. */
export function glow(content: Content, glassEver: Amount, k = content.prestige.glowK): number {
  return 1 + k * Math.sqrt(Math.max(0, glassEver));
}
