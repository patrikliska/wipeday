/**
 * Wear on a pixel target (R2 Feel S3): as the taps toward the next fell add up, the target shows
 * up to four steps of damage drawn on the art grid, in the art's own palette. The rocks crack
 * (a dark seam with a pale lip, one more per step), the crashed plane's plates tear open (a dark
 * hole under a bent, bright edge), and the dead tree takes a notch on the side it falls to,
 * deeper with every step. Every mark lands only on the sprite's own pixels, so it never floats
 * off the silhouette, and the same target always wears the same way (seeded by its kind).
 *
 * `wearPixels` is pure (tested); `drawPixelWear` reads the sprite's pixels once per texture.
 */
import type { Graphics, Texture } from "pixi.js";
import paletteHex from "../../../../packages/content/art/palette.json";
import { ART } from "./pixel";

export type WearKind = "tree" | "stone" | "ore" | "sulfur" | "wreck";

/** A sprite's pixels: size and RGBA, row by row. */
export interface PixelMask {
  width: number;
  height: number;
  rgba: Uint8ClampedArray | Uint8Array;
}

export interface WearPixel {
  x: number;
  y: number;
  color: number;
}

const PALETTE: readonly number[] = (paletteHex as string[]).map((hex) =>
  Number.parseInt(hex.slice(1), 16),
);

/** The palette's colour nearest to (r, g, b). */
export function nearest(r: number, g: number, b: number): number {
  let best = PALETTE[0] ?? 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (const c of PALETTE) {
    const dr = ((c >> 16) & 255) - r;
    const dg = ((c >> 8) & 255) - g;
    const db = (c & 255) - b;
    // Weighted for the eye: green counts most.
    const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** A small seeded generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS: Record<WearKind, number> = { tree: 11, stone: 23, ore: 37, sulfur: 41, wreck: 53 };

/** Steps of wear a target shows (0 fresh, 4 nearly felled). */
export const WEAR_STEPS = 4;

export function wearPixels(mask: PixelMask, kind: WearKind, level: number): WearPixel[] {
  if (level <= 0) return [];
  const { width: w, height: h, rgba } = mask;
  const alpha = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : (rgba[(y * w + x) * 4 + 3] ?? 0);
  const opaque = (x: number, y: number) => alpha(x, y) > 128;
  const interior = (x: number, y: number) =>
    opaque(x, y) && opaque(x - 1, y) && opaque(x + 1, y) && opaque(x, y - 1) && opaque(x, y + 1);
  const rgb = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * 4;
    return [rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0];
  };
  /** The palette's shade of the pixel under (x, y), darker (< 1) or lighter (> 1). */
  const shadeAt = (x: number, y: number, f: number, lift = 0) => {
    const [r, g, b] = rgb(x, y);
    return nearest(
      Math.min(255, r * f + lift),
      Math.min(255, g * f + lift),
      Math.min(255, b * f + lift),
    );
  };
  const out: WearPixel[] = [];
  const steps = Math.min(level, WEAR_STEPS);

  if (kind === "tree") {
    // The trunk 6 px above the ground: the opaque run nearest the middle.
    const row = h - 7;
    const mid = Math.floor(w / 2);
    let left = -1;
    let right = -1;
    for (let x = 0; x < w; x++) {
      if (!opaque(x, row)) continue;
      let end = x;
      while (opaque(end + 1, row)) end++;
      if (left < 0 || Math.abs((x + end) / 2 - mid) < Math.abs((left + right) / 2 - mid)) {
        left = x;
        right = end;
      }
      x = end;
    }
    if (left < 0) return out;
    // The notch is cut on the side the tree falls to (the left), up to 60% of the trunk.
    const depth = Math.max(1, Math.round((steps / WEAR_STEPS) * (right - left + 1) * 0.6));
    for (let dy = -2; dy <= 2; dy++) {
      const y = row + dy;
      const d = depth - Math.abs(dy);
      for (let i = 0; i < d; i++) {
        const x = left + i;
        if (!opaque(x, y)) continue;
        // Pale fresh wood on the cut faces; the back of the cut in shadow.
        const back = i === d - 1 || Math.abs(dy) === 2;
        out.push({ x, y, color: back ? shadeAt(x, y, 0.4) : nearest(217, 185, 138) });
      }
    }
    return out;
  }

  // Rocks and the plate: marks start on interior pixels in the upper three quarters, apart.
  let top = 0;
  while (top < h && ![...Array(w).keys()].some((x) => opaque(x, top))) top++;
  const random = rng(SEEDS[kind]);
  const starts: Array<[number, number]> = [];
  const candidates: Array<[number, number]> = [];
  for (let y = top + 2; y < top + (h - top) * 0.75; y++) {
    for (let x = 1; x < w - 1; x++) if (interior(x, y)) candidates.push([x, y]);
  }
  for (let tries = 0; starts.length < WEAR_STEPS && tries < 200 && candidates.length > 0; tries++) {
    const pick = candidates[Math.floor(random() * candidates.length)];
    if (!pick) break;
    const [x, y] = pick;
    if (starts.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) < 7)) continue;
    starts.push(pick);
  }
  const marked = new Set<number>();
  const put = (x: number, y: number, color: number) => {
    if (marked.has(y * w + x)) return;
    marked.add(y * w + x);
    out.push({ x, y, color });
  };

  for (const [sx, sy] of starts.slice(0, steps)) {
    if (kind === "wreck") {
      // A torn plate: a dark hole, the bent edge above it catching the light, a rivet.
      for (const [dx, dy] of [
        [0, 1],
        [1, 1],
        [2, 1],
        [1, 2],
      ] as const) {
        if (opaque(sx + dx, sy + dy)) put(sx + dx, sy + dy, shadeAt(sx + dx, sy + dy, 0.25));
      }
      for (const dx of [-1, 0, 1, 2]) {
        if (opaque(sx + dx, sy)) put(sx + dx, sy, shadeAt(sx + dx, sy, 1.45, 40));
      }
      continue;
    }
    // A crack runs down 3-5 px, wandering a pixel either way, with a pale lip to its right.
    const length = 3 + Math.floor(random() * 3);
    let x = sx;
    let y = sy;
    const path: Array<[number, number]> = [];
    for (let i = 0; i < length && interior(x, y); i++) {
      path.push([x, y]);
      y += 1;
      const turn = random();
      x += turn < 0.3 ? -1 : turn > 0.7 ? 1 : 0;
    }
    for (const [px, py] of path) put(px, py, shadeAt(px, py, 0.35));
    for (const [px, py] of path) {
      if (interior(px + 1, py) && !marked.has(py * w + px + 1)) {
        put(px + 1, py, shadeAt(px + 1, py, 1.3, 24));
      }
    }
  }
  return out;
}

const masks = new WeakMap<Texture, PixelMask | null>();

/** The texture's pixels, read once through a canvas (null if the browser will not). */
function maskOf(texture: Texture): PixelMask | null {
  if (masks.has(texture)) return masks.get(texture) ?? null;
  let mask: PixelMask | null = null;
  const { x, y, width, height } = texture.frame;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const image = texture.source.resource as CanvasImageSource | undefined;
  if (ctx && image) {
    ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
    mask = { width, height, rgba: ctx.getImageData(0, 0, width, height).data };
  }
  masks.set(texture, mask);
  return mask;
}

/**
 * Draws `level` steps of wear for a sprite standing on its bottom centre (`artSprite`), in the
 * sprite's parent's units (stage units: one art pixel is ART).
 */
export function drawPixelWear(g: Graphics, texture: Texture, kind: WearKind, level: number): void {
  g.clear();
  const mask = maskOf(texture);
  if (!mask) return;
  const ox = Math.floor(mask.width / 2);
  for (const p of wearPixels(mask, kind, level)) {
    g.rect((p.x - ox) * ART, (p.y - mask.height) * ART, ART, ART).fill(p.color);
  }
}
