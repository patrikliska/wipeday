import { describe, expect, it } from "vitest";
import paletteHex from "../../../../packages/content/art/palette.json";
import { type PixelMask, WEAR_STEPS, type WearKind, wearPixels } from "./wear";

const PALETTE = new Set((paletteHex as string[]).map((hex) => Number.parseInt(hex.slice(1), 16)));

/** A mask of `width` × `height`, opaque where `solid` says, in a mid grey. */
function mask(width: number, height: number, solid: (x: number, y: number) => boolean): PixelMask {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rgba.set([120, 118, 112, solid(x, y) ? 255 : 0], i);
    }
  }
  return { width, height, rgba };
}

// A rounded boulder, and a tree: a 6 px trunk under a wide crown.
const rock = mask(38, 28, (x, y) => (x - 19) ** 2 / 19 ** 2 + (y - 28) ** 2 / 26 ** 2 < 1);
const tree = mask(30, 50, (x, y) => (y > 30 ? x >= 12 && x < 18 : y > 4 && x > 2 && x < 27));

describe("pixel wear", () => {
  it("shows nothing on a fresh target", () => {
    for (const kind of ["tree", "stone", "wreck"] as WearKind[]) {
      expect(wearPixels(kind === "tree" ? tree : rock, kind, 0)).toEqual([]);
    }
  });

  it("grows with every step, on the sprite's own pixels, in the palette", () => {
    for (const kind of ["stone", "ore", "sulfur", "wreck"] as WearKind[]) {
      let previous = 0;
      for (let level = 1; level <= WEAR_STEPS; level++) {
        const pixels = wearPixels(rock, kind, level);
        expect(pixels.length).toBeGreaterThan(previous);
        previous = pixels.length;
        for (const p of pixels) {
          expect(rock.rgba[(p.y * rock.width + p.x) * 4 + 3]).toBe(255);
          expect(PALETTE.has(p.color)).toBe(true);
        }
      }
    }
  });

  it("is the same every time for the same target", () => {
    expect(wearPixels(rock, "ore", 3)).toEqual(wearPixels(rock, "ore", 3));
  });

  it("notches the trunk from the left, deeper with every step", () => {
    const depth = (level: number) =>
      Math.max(...wearPixels(tree, "tree", level).map((p) => p.x)) - 12 + 1;
    expect(depth(1)).toBeLessThan(depth(WEAR_STEPS));
    for (const p of wearPixels(tree, "tree", WEAR_STEPS)) {
      expect(p.x).toBeGreaterThanOrEqual(12);
      expect(p.x).toBeLessThan(18);
      expect(Math.abs(p.y - 43)).toBeLessThanOrEqual(2);
    }
  });
});
