import { describe, expect, it } from "vitest";
import { PILE_CAP, pileSlots } from "./stockpile";
import { squashStep } from "./target";

describe("pileSlots", () => {
  const slots = pileSlots();

  it("fills bottom up on whole art pixels, on the pallet's deck", () => {
    expect(slots).toHaveLength(PILE_CAP);
    for (const slot of slots) {
      expect(Number.isInteger(slot.x)).toBe(true);
      expect(Number.isInteger(slot.y)).toBe(true);
      // The pallet is 15 px wide, centred: no piece's middle hangs off it.
      expect(Math.abs(slot.x)).toBeLessThanOrEqual(7);
      expect(slot.y).toBeLessThanOrEqual(-5);
    }
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]?.y ?? 0).toBeLessThanOrEqual((slots[i - 1]?.y ?? 0) + 1);
    }
  });

  it("is a heap, not a tower: wider than tall", () => {
    const xs = slots.map((s) => s.x);
    const ys = slots.map((s) => s.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
  });
});

describe("squashStep", () => {
  it("squashes in whole pixels, stretches once, then rests", () => {
    expect(squashStep(0)).toEqual([2, -2]);
    expect(squashStep(0.5)).toEqual([1, -1]);
    expect(squashStep(0.9)).toEqual([-1, 1]);
    expect(squashStep(1)).toEqual([0, 0]);
  });
});
