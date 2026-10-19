import { describe, expect, it } from "vitest";
import { phoneCover } from "../state/layout";
import { FRONT, yard } from "./yards";

/** Everything outside, with Armored's wider x where it has one. */
function places(wide: boolean): { id: string; x: number; y: number }[] {
  const at = (id: string, spot: { x: number; y: number }) => ({
    id,
    x: (wide ? yard.wideX[id] : undefined) ?? spot.x,
    y: spot.y,
  });
  return [
    at("target", yard.target),
    at("stockpile", yard.stockpile),
    at("house", yard.house),
    ...Object.entries(yard.spots).map(([id, spot]) => at(id, spot)),
  ];
}

describe("the yard", () => {
  it("stands everything on the ground, inside its view", () => {
    for (const wide of [false, true]) {
      const view = wide ? yard.wide : yard.view;
      for (const place of places(wide)) {
        expect(place.x, place.id).toBeGreaterThanOrEqual(view.left);
        expect(place.x, place.id).toBeLessThanOrEqual(view.right);
        expect(place.y, place.id).toBeGreaterThan(yard.back);
        expect(place.y, place.id).toBeLessThanOrEqual(FRONT);
      }
    }
    for (const prop of yard.props) expect(prop.y).toBeGreaterThan(yard.back);
  });

  it("crowds no band: two lines 12 px apart at least", () => {
    const lines = places(false).filter((p) => p.id !== "stockpile");
    for (const a of lines) {
      for (const b of lines) {
        if (a === b || a.y !== b.y) continue;
        expect(Math.abs(a.x - b.x), `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("puts every terrace step between the far edge and the front", () => {
    for (const step of yard.steps) {
      expect(step).toBeGreaterThan(yard.back);
      expect(step).toBeLessThan(FRONT);
    }
  });

  it("knows what the phone's dock and drawer cover (tokens.css)", () => {
    expect(phoneCover(844)).toBe(358);
    expect(phoneCover(640)).toBe(270);
  });
});
