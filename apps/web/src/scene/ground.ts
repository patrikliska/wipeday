/**
 * The wasteland's ground, painted once (D208, D209, D246): the yard seen from above, from seeded
 * noise that never repeats (a tile repeated across a 2k screen showed its period).
 *
 * From the far edge down: the walkable surface (dusty ochre with streaks, specks, broad trodden
 * and pale patches finer toward the back, dry tufts and the odd stone, hazy over its far half),
 * crossed by the terraces' risers; past the front edge the ground runs on toward the viewer and
 * darkens into the foreground's shade, dithered. No cliff: the camera looks down. The Scene
 * Mock's colours.
 */
import { Texture } from "pixi.js";

/** The mock tile's colours, top to bottom. */
const C = {
  far: "#d6a26a",
  dust: "#ab7e5a",
  streak: "#a35f4d",
  speck: "#816252",
  glint: "#d6a26a",
  debris: "#502f30",
  edge: "#d6a26a",
  shine: "#f5cf81",
  sandShade: "#d6a26a",
  wet: "#a35f4d",
  under: "#2f1822",
  dirt: "#502f30",
  pebble: "#816252",
  pebbleDark: "#6e4d4c",
  stoneLight: "#717061",
  tuft: "#72774a",
  tuftDark: "#454e35",
} as const;

/** Rows of a terrace's riser: its sunlit lip, its face, and the shadow it throws. */
const RISER = 6;

/** A deterministic hash of two integers and a seed, in [0, 1). */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1-D value noise in [-1, 1]: three octaves of interpolated hashes (no period). */
function noise(x: number, seed: number, scale: number): number {
  let total = 0;
  let amplitude = 1;
  let sum = 0;
  for (let octave = 0; octave < 3; octave++) {
    const f = x / scale;
    const i = Math.floor(f);
    const t = f - i;
    const s = t * t * (3 - 2 * t);
    const a = hash(i, octave, seed) * 2 - 1;
    const b = hash(i + 1, octave, seed) * 2 - 1;
    total += (a + (b - a) * s) * amplitude;
    sum += amplitude;
    amplitude *= 0.5;
    scale /= 2.3;
  }
  return total / sum;
}

/** Smooth 2-D value noise in [-1, 1] (bilinear over hashed cells; no period). */
function noise2(x: number, y: number, seed: number, sx: number, sy: number): number {
  const fx = x / sx;
  const fy = y / sy;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const ux = tx * tx * (3 - 2 * tx);
  const uy = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}

export interface GroundPiece {
  /** Art pixels across and down. */
  width: number;
  height: number;
  /** Rows of walkable surface above the front edge (the far edge is row 0). */
  surface: number;
  seed: number;
  /** Rows past the front edge over which the near ground darkens into shade. */
  darken: number;
  /** Terrace steps: the row (from the far edge) each raised band's things stand on. */
  steps: readonly number[];
}

/** The ground as a nearest-neighbour texture (1 texel = 1 art pixel). */
export function paintGround(piece: GroundPiece): Texture {
  const { width: w, height: h, seed } = piece;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Texture.EMPTY;
  const image = ctx.createImageData(w, h);
  const data = image.data;
  const rgb = new Map<string, [number, number, number]>();
  const set = (x: number, y: number, colour: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    let c = rgb.get(colour);
    if (!c) {
      c = [
        Number.parseInt(colour.slice(1, 3), 16),
        Number.parseInt(colour.slice(3, 5), 16),
        Number.parseInt(colour.slice(5, 7), 16),
      ];
      rgb.set(colour, c);
    }
    const i = (y * w + x) * 4;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 255;
  };

  for (let x = 0; x < w; x++) {
    // The front edge waves a pixel or two; the far edge is straight (the skyline sits on it).
    const edge = piece.surface + Math.round(noise(x, seed, 30) * 1.4);
    // Each terrace's riser: a sunlit lip two rows in front of its band's feet, a darker face
    // under it, and a row of shadow on the band below; it waves like the front edge.
    const risers = piece.steps.map(
      (step, i) => step + 2 + Math.round(noise(x, seed + 40 + i, 24) * 1.2),
    );
    for (let y = 0; y < h; y++) {
      const r = hash(x, y, seed);
      let colour: string;
      const riser = risers.find((at) => y >= at && y < at + RISER);
      if (riser !== undefined && y < edge) {
        const row = y - riser;
        colour =
          row === 0
            ? r < 0.4
              ? C.shine
              : C.edge
            : row === 1
              ? r < 0.5
                ? C.sandShade
                : C.edge
              : row === 2
                ? C.wet
                : row < 5
                  ? r < 0.2
                    ? C.dirt
                    : C.under
                  : r < 0.5
                    ? C.debris
                    : C.speck;
      } else if (y < edge) {
        // The surface: paler toward the far edge, long streaks, specks and glints.
        const far = Math.max(0, 1 - (y / edge) * 1.8) ** 1.4;
        const streak = noise(x * 0.25 + y * 9, seed + 2, 6) > 0.45;
        // Broad patches: trodden earth and pale drifts, finer toward the back.
        const depth = y / edge;
        const patch = noise2(x, y, seed + 21, 10 + depth * 16, 4 + depth * 5);
        colour =
          r < far * 0.55
            ? C.far
            : patch > 0.42 && r < 0.55
              ? r < 0.2
                ? C.debris
                : C.speck
              : patch < -0.5 && r < 0.6
                ? C.far
                : streak && r < 0.6
                  ? C.streak
                  : r < 0.07
                    ? C.speck
                    : r < 0.1
                      ? C.glint
                      : C.dust;
      } else {
        // No cliff: the camera looks down, so the ground runs on toward the viewer and darkens
        // into the foreground's shade, dithered.
        const near = (y - edge) / piece.darken + (hash(x, y, seed + 5) - 0.5) * 0.3;
        const patch = noise2(x, y, seed + 21, 30, 12);
        colour =
          near > 0.75
            ? patch > 0.35 && r < 0.3
              ? C.speck
              : r < 0.06
                ? C.speck
                : r < 0.3
                  ? C.under
                  : C.debris
            : near > 0.4
              ? r < 0.35
                ? C.debris
                : r < 0.7
                  ? C.speck
                  : C.streak
              : patch > 0.4 && r < 0.5
                ? C.speck
                : r < 0.25 + near
                  ? C.streak
                  : r < 0.32 + near
                    ? C.speck
                    : C.dust;
      }
      set(x, y, colour);
    }
    // Debris on the surface: a stone or a scrap of metal now and then, with its shadow.
    if (hash(x, 1, seed + 11) < 0.03) {
      const y = 2 + Math.floor(hash(x, 2, seed) * Math.max(1, edge - 4));
      set(x, y, hash(x, 7, seed) < 0.5 ? C.pebble : C.stoneLight);
      set(x + 1, y, C.pebbleDark);
      set(x, y + 1, C.debris);
      set(x + 1, y + 1, C.debris);
    }
    // Pebbles in the near ground, scattered (seeded, never in a grid), lit from above.
    if (hash(x, 3, seed + 13) < 0.025) {
      const y = edge + 12 + Math.floor(hash(x, 4, seed) * Math.max(1, h - edge - 16));
      set(x, y, C.pebble);
      set(x + 1, y, C.pebbleDark);
      set(x, y + 1, C.under);
      set(x + 1, y + 1, C.under);
    }
    // Dry tufts: a few pixels of olive, bigger and more of them in front.
    if (hash(x, 8, seed + 23) < 0.05) {
      const y = 3 + Math.floor(hash(x, 9, seed) ** 0.6 * Math.max(1, edge - 5));
      if (!risers.some((at) => y >= at - 2 && y < at + RISER + 1)) {
        const big = y / edge > 0.5;
        set(x, y, C.tuft);
        set(x, y - 1, hash(x, 10, seed) < 0.5 ? C.tuft : C.tuftDark);
        if (big) {
          set(x + 1, y, C.tuftDark);
          set(x - 1, y - 1, C.tuft);
          set(x + 1, y - 2, C.tuft);
        }
        set(x, y + 1, C.debris);
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
}
