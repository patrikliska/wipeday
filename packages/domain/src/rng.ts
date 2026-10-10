/**
 * Seeded randomness for the domain. Every roll takes a seed, so a tap can be replayed in a
 * test, the client predicts what the server rolls, and the simulator is deterministic.
 * mulberry32: small, fast, good enough for games.
 *
 * Every roll is `rng(seedOf(run.seed, SEED.<tag>, index))`: numbers only, never a clock value
 * (docs/redesign/09-architecture.md 3.1).
 */

/** The tags that keep each kind of roll on its own stream. */
export const SEED = {
  /** A run's seed from the base's seed and the nuke count. */
  run: 0x52554e,
  /** Whether tap number k crits. */
  crit: 0xc417,
  /** The gap before flotsam arrival k. */
  flotsam: 0xf107,
  /** Which kind arrival k is. */
  kind: 0x4b1d,
  /** Which line a Drowned Drone boosts. */
  drone: 0xd403,
  /** The nuke's flight variant. */
  flight: 0xf119,
  /** The Magnet's hauls (on the base's seed: they span runs). */
  magnet: 0x3a6e,
} as const;

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
