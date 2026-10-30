import { describe, expect, it } from "vitest";
import { phoneCover } from "../state/layout";
import { FRONT, yard } from "./yards";

/** Everything outside, with Armored's wider x where it has one. */
function places(wide: boolean): { id: string; x: number; y: number }[] {
  const at = (id: string, spot: { x: number; y: number }) => ({
    id,
    x: (wide ? yard.wideX[id] : undefined) ?? spot.x,
    y: (wide ? yard.wideY[id] : undefined) ?? spot.y,
  });
  return [
    at("target", yard.target),
    at("stockpile", yard.stockpile),
    at("house", yard.house),
    at("kettle", yard.kettle),
    at("rowboat", yard.rowboat),
    ...Object.entries(yard.spots).map(([id, spot]) => at(id, spot)),
  ];
}

/** How wide the widest sprite that stands at each place is (art px), from the installed art. */
const WIDTHS: Record<string, number> = {
  kettle: 28,
  rowboat: 16,
  shipbreaker: 38,
  dock: 26,
  kiln: 24,
  beachcomber: 30,
};

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
    const lines = places(false).filter((p) => !["stockpile", "kettle", "rowboat"].includes(p.id));
    for (const a of lines) {
      for (const b of lines) {
        if (a === b || a.y !== b.y) continue;
        expect(Math.abs(a.x - b.x), `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("keeps the Kettle and the rowboat clear of their band's neighbours (R4)", () => {
    for (const wide of [false, true]) {
      const all = [
        ...places(wide),
        ...yard.props.map((prop) => ({ id: prop.id, x: prop.x, y: prop.y })),
      ];
      const width = (id: string) => WIDTHS[id] ?? (id === "car" ? 39 : id === "rock" ? 28 : 16);
      for (const id of ["kettle", "rowboat"]) {
        const me = all.find((place) => place.id === id);
        if (!me) throw new Error(id);
        for (const other of all) {
          if (other === me || other.y !== me.y) continue;
          // Armored's camp only has the shipbreaker; the Twig to Sheet Metal camps never show it.
          if (other.id === "shipbreaker" && !wide) continue;
          const gap = Math.abs(other.x - me.x) - (width(id) + width(other.id)) / 2;
          expect(gap, `${id} / ${other.id} (${wide ? "wide" : "camp"})`).toBeGreaterThanOrEqual(-1);
        }
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
