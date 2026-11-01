import { describe, expect, it } from "vitest";
import { CLEAR, cloudPixels, LIT, RIM, SHADE } from "./clouds";

describe("cloudPixels", () => {
  it("is the same cloud for the same seed, and a different one for another", () => {
    const a = cloudPixels(3, 0.5);
    expect(cloudPixels(3, 0.5)).toEqual(a);
    expect(cloudPixels(4, 0.5).tones).not.toEqual(a.tones);
  });

  it("grows with size and stays in its bounds", () => {
    for (let seed = 0; seed < 40; seed++) {
      const small = cloudPixels(seed, 0);
      const big = cloudPixels(seed, 1);
      expect(big.width).toBeGreaterThan(small.width);
      expect(small.width).toBeGreaterThanOrEqual(18);
      expect(big.width).toBeLessThanOrEqual(58);
      expect(big.height).toBeLessThanOrEqual(18);
      expect(small.tones.length).toBe(small.width * small.height);
    }
  });

  it("has a flat, shaded base, a lit body and a bright rim", () => {
    for (let seed = 0; seed < 40; seed++) {
      const { width, height, tones } = cloudPixels(seed, seed / 40);
      const row = (y: number) => Array.from(tones.slice(y * width, (y + 1) * width));
      // The bottom row is solid between its rounded ends, all in shade.
      expect(row(height - 1).slice(2, width - 2)).toEqual(Array(width - 4).fill(SHADE));
      expect(tones).toContain(LIT);
      expect(tones).toContain(RIM);
      // The top row is not a slab: the bumps leave clear sky between them.
      expect(row(0)).toContain(CLEAR);
    }
  });
});
