/**
 * The wasteland's ground, painted once (D208, D209): one flat stretch seen from slightly above,
 * from seeded noise that never repeats (a tile repeated across a 2k screen showed its period).
 *
 * From the far edge down: the walkable surface (dusty ochre with streaks, specks and the odd
 * stone, paler at its far edge where it meets the skyline), its sunlit front edge, a reddish
 * rim, a near-black lip, the shadow under it, then dirt that darkens with depth, dithered (no
 * hard bands), with scattered pebbles and a few embedded stones, in the Scene Mock's colours.
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
  sand: "#fddba4",
  sandSpeck: "#e2b27c",
  sandShade: "#d6a26a",
  wet: "#a35f4d",
  lip: "#150c19",
  under: "#2f1822",
  dirt: "#502f30",
  dirtSpeck: "#402437",
  deep: "#2f1822",
  bedrock: "#150c19",
  pebble: "#816252",
  pebbleDark: "#6e4d4c",
  stone: "#584d44",
  stoneLight: "#717061",
} as const;

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

export interface GroundPiece {
  /** Art pixels across and down. */
  width: number;
  height: number;
  /** Rows of walkable surface above the front edge (the far edge is row 0). */
  surface: number;
  seed: number;
  /** Rows below the lip over which the dirt darkens to bedrock. */
  darken: number;
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
    const lipAt = edge + 3;
    for (let y = 0; y < h; y++) {
      const r = hash(x, y, seed);
      let colour: string;
      if (y < edge) {
        // The surface: paler toward the far edge, long streaks, specks and glints.
        const far = 1 - y / edge;
        const streak = noise(x * 0.25 + y * 9, seed + 2, 6) > 0.45;
        colour =
          r < far * 0.55
            ? C.far
            : streak && r < 0.6
              ? C.streak
              : r < 0.07
                ? C.speck
                : r < 0.1
                  ? C.glint
                  : C.dust;
      } else if (y === edge) colour = r < 0.3 ? C.shine : C.edge;
      else if (y < lipAt) colour = r < 0.5 ? C.sandShade : C.wet;
      else if (y < lipAt + 2) colour = C.lip;
      else if (y < lipAt + 4) colour = r < 0.3 ? C.dirtSpeck : C.under;
      else {
        // Dirt, darkening with depth by dithering toward the deeper colours.
        const depth = (y - lipAt - 4) / piece.darken;
        const d = depth + (hash(x, y, seed + 3) - 0.5) * 0.35;
        colour =
          d > 1
            ? C.bedrock
            : d > 0.62
              ? r < 0.15
                ? C.bedrock
                : C.deep
              : d > 0.3
                ? r < 0.2
                  ? C.deep
                  : C.dirtSpeck
                : r < 0.05
                  ? C.dirtSpeck
                  : r < 0.08
                    ? C.under
                    : C.dirt;
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
    // Pebbles and stones in the dirt, scattered (seeded, never in a grid).
    if (hash(x, 3, seed + 13) < 0.02) {
      const y = lipAt + 6 + Math.floor(hash(x, 4, seed) * Math.max(1, h - lipAt - 10));
      set(x, y, C.pebble);
      set(x + 1, y, C.pebble);
      set(x, y + 1, C.lip);
      set(x + 1, y + 1, C.lip);
    }
    if (hash(x, 5, seed + 17) < 0.006) {
      const y = lipAt + 8 + Math.floor(hash(x, 6, seed) * Math.max(1, h - lipAt - 16));
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dy * dy > 5) continue;
          const rim = dx * dx + dy * dy >= 4;
          set(x + dx, y + dy, rim ? C.lip : dy < 0 ? C.stoneLight : C.stone);
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
}
