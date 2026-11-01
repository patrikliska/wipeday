import { describe, expect, it } from "vitest";
import {
  filmLength,
  frameAt,
  type Geometry,
  IMPACT,
  phases,
  REDUCED_MS,
  skipTo,
  VARIANTS,
} from "./cinematic";

/** A phone's view of the yard (stage units): 156 art px wide, the pad on the back terrace. */
const GEOMETRY: Geometry = {
  pad: { x: 680, y: 375 },
  base: { x: 830, y: 560 },
  view: { left: 505, right: 1285, top: -400, bottom: 620 },
};

describe("the cinematic (03-the-big-red.md 7)", () => {
  it("is a pure function of the variant, the seed and the time", () => {
    for (const variant of VARIANTS) {
      for (const ms of [0, 1000, 2000, IMPACT[variant] + 100, IMPACT[variant] + 1500]) {
        const a = frameAt(variant, 7, ms, GEOMETRY);
        const b = frameAt(variant, 7, ms, GEOMETRY);
        expect(a).toEqual(b);
      }
      const seeded = frameAt(variant, 7, IMPACT[variant] + 1500, GEOMETRY);
      const other = frameAt(variant, 8, IMPACT[variant] + 1500, GEOMETRY);
      expect(seeded.cloud).not.toEqual(other.cloud);
    }
  });

  it("names its phases in order and ends after the postcard", () => {
    for (const variant of VARIANTS) {
      const at = phases(variant);
      const order = [
        at.scramble,
        at.ignite,
        at.liftoff,
        at.flight,
        at.whistle,
        at.flash,
        at.fireball,
        at.cloud,
        at.settle,
      ];
      for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1] ?? 0);
      expect(frameAt(variant, 1, at.ignite, GEOMETRY).phase).toBe("ignite");
      expect(frameAt(variant, 1, at.cloud, GEOMETRY).phase).toBe("cloud");
      expect(skipTo(variant)).toBeLessThan(filmLength(variant, false));
      expect(frameAt(variant, 1, filmLength(variant, false), GEOMETRY).done).toBe(true);
      expect(frameAt(variant, 1, filmLength(variant, false) - 1, GEOMETRY).done).toBe(false);
    }
  });

  it("keeps the island until the flash, then shows the crater with the sign dropping in", () => {
    const impact = IMPACT.u_turn;
    expect(frameAt("u_turn", 1, impact - 10, GEOMETRY).crater).toBe(false);
    expect(frameAt("u_turn", 1, impact - 10, GEOMETRY).kettle.visible).toBe(true);
    const flash = frameAt("u_turn", 1, impact + 100, GEOMETRY);
    expect(flash.crater).toBe(true);
    expect(flash.kettle.visible).toBe(false);
    expect(flash.flash).toBe(1);
    expect(flash.fireball).not.toBeNull();
    expect(frameAt("u_turn", 1, impact + 2200, GEOMETRY).sign).toBe(0);
    expect(frameAt("u_turn", 1, impact + 2650, GEOMETRY).sign).toBeCloseTo(1, 9);
    // A small blast: no sign, a modest flash, no zoom punch.
    const fizzle = frameAt("fizzle", 1, IMPACT.fizzle + 2650, GEOMETRY);
    expect(fizzle.sign).toBe(0);
    expect(frameAt("fizzle", 1, IMPACT.fizzle + 100, GEOMETRY).flash).toBeLessThan(1);
    expect(frameAt("fizzle", 1, IMPACT.fizzle + 150, GEOMETRY).punch).toBe(1);
  });

  it("flies inside the view and lands on the base", () => {
    for (const variant of VARIANTS) {
      for (let ms = 1400; ms < IMPACT[variant]; ms += 50) {
        const { kettle } = frameAt(variant, 3, ms, GEOMETRY);
        expect(kettle.x, `${variant} @${ms}`).toBeGreaterThan(GEOMETRY.view.left - 60);
        expect(kettle.x, `${variant} @${ms}`).toBeLessThan(GEOMETRY.view.right + 60);
        expect(kettle.y, `${variant} @${ms}`).toBeGreaterThan(GEOMETRY.view.top - 60);
      }
      const last = frameAt(variant, 3, IMPACT[variant] - 1, GEOMETRY).kettle;
      if (variant === "fizzle") expect(Math.abs(last.y - GEOMETRY.pad.y)).toBeLessThan(2);
      else {
        expect(Math.abs(last.x - GEOMETRY.base.x)).toBeLessThan(12);
        expect(Math.abs(last.y - GEOMETRY.base.y)).toBeLessThan(12);
      }
    }
  });

  it("under reduced motion cross-fades to the crater in 2.5 s with no shake or flash", () => {
    for (const ms of [0, 300, 900, 1500, 2400]) {
      const frame = frameAt("u_turn", 1, ms, GEOMETRY, { reduced: true });
      expect(frame.flash).toBe(0);
      expect(frame.shake).toEqual({ x: 0, y: 0 });
      expect(frame.punch).toBe(1);
    }
    expect(frameAt("u_turn", 1, 300, GEOMETRY, { reduced: true }).crater).toBe(false);
    expect(frameAt("u_turn", 1, 1500, GEOMETRY, { reduced: true }).crater).toBe(true);
    expect(frameAt("u_turn", 1, REDUCED_MS, GEOMETRY, { reduced: true }).done).toBe(true);
    expect(filmLength("loop_the_loop", true)).toBe(REDUCED_MS);
  });
});
