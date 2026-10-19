import { describe, expect, it } from "vitest";
import { FRONT, YARDS, type Yard } from "./yards";

/** Everything outside in `yard`, with Armored's wider x where it has one. */
function places(yard: Yard, wide: boolean): { id: string; x: number; y: number }[] {
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

describe("yards", () => {
  it("keeps R2's camp as the flat yard", () => {
    const flat = YARDS.flat;
    expect(flat.back).toBe(86);
    expect(flat.camera).toBeNull();
    expect(flat.props).toEqual([]);
    expect(flat.view).toEqual({ left: 101, right: 257, top: 40, bottom: 124 });
    expect(flat.spots.kiln).toEqual({ x: 153, y: 90 });
  });

  for (const yard of Object.values(YARDS)) {
    it(`${yard.id}: everything stands on the ground, inside its view`, () => {
      for (const wide of [false, true]) {
        const view = wide ? yard.wide : yard.view;
        for (const place of places(yard, wide)) {
          expect(place.x, place.id).toBeGreaterThanOrEqual(view.left);
          expect(place.x, place.id).toBeLessThanOrEqual(view.right);
          expect(place.y, place.id).toBeGreaterThan(yard.back);
          expect(place.y, place.id).toBeLessThanOrEqual(FRONT);
        }
      }
      for (const prop of yard.props) expect(prop.y).toBeGreaterThan(yard.back);
    });
  }

  for (const yard of [YARDS.terrace, YARDS.camp]) {
    it(`${yard.id}: no two lines crowd one band (12 px apart at least)`, () => {
      const lines = places(yard, false).filter((p) => p.id !== "stockpile");
      for (const a of lines) {
        for (const b of lines) {
          if (a === b || a.y !== b.y) continue;
          expect(Math.abs(a.x - b.x), `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(12);
        }
      }
    });
  }
});
