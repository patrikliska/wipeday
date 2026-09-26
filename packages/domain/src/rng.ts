/**
 * Seeded randomness for the domain. Every roll takes a seed, so a click can
 * be replayed in a test and the simulator is deterministic. mulberry32:
 * small, fast, good enough for loot tables.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number;
}

export function rng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
  };
}

/** Mixes several integers into one seed (order matters). */
export function seedOf(...parts: number[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    hash = Math.imul(hash ^ (part >>> 0), 0x01000193) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995) >>> 0;
  }
  return hash >>> 0;
}

/** Picks an index by weight. Weights must be non-negative and not all zero. */
export function pickWeighted(random: Rng, weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = random.next() * total;
  for (const [index, weight] of weights.entries()) {
    roll -= weight;
    if (roll < 0) return index;
  }
  return weights.length - 1;
}
