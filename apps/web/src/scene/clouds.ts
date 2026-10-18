/**
 * Pixel clouds (R2 Feel S3, D218): each cloud is drawn on the art grid from its own seed, a row
 * of round bumps on a flat base, lit from the top left with a bright rim, its underside in
 * shade. Every cloud in the sky has a different seed, so no two are alike and a 2k screen shows
 * no repeat (D208). The tones are greys tinted by the palette's cloud colour for the hour.
 */
import { Texture } from "pixi.js";
import { hash } from "./util";

/** Tones in a cloud's pixel map. */
export const CLEAR = 0;
export const LIT = 1;
export const SHADE = 2;
export const RIM = 3;

export interface CloudPixels {
  width: number;
  height: number;
  /** One tone per pixel, row by row. */
  tones: Uint8Array;
}

/**
 * The pixels of cloud `seed`, `size` 0 (small, far) to 1 (big, near): 18 to 58 art px across,
 * 7 to 18 tall.
 */
export function cloudPixels(seed: number, size: number): CloudPixels {
  const r = (k: number) => hash(seed * 31.7 + k * 7.3);
  const width = Math.round(18 + size * 30 + r(1) * 10);
  const height = Math.round(7 + size * 8 + r(2) * 3);
  const base = height - 1;
  // Round bumps along the base, a dome: big in the middle, small at the ends, each a little
  // different, so the top is a row of lumps with dips between them.
  const bumps: { cx: number; cy: number; radius: number }[] = [];
  const count = 2 + Math.floor(width / 12);
  for (let i = 0; i < count; i++) {
    const along = (i + 0.5) / count;
    const middle = 1 - Math.abs(along - 0.5) * 2;
    const radius = Math.min(
      base / 1.5,
      Math.max(2, height * (0.3 + 0.38 * middle) * (0.75 + r(10 + i) * 0.5)),
    );
    const cx = along * (width - 1) + (r(20 + i) - 0.5) * 2;
    bumps.push({ cx, cy: base - radius * 0.5, radius });
  }
  const inside = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y > base) return false;
    // The flat base: three rows, rounded off at the ends.
    if (y >= base - 2 && x >= 2 && x <= width - 3) return true;
    for (const b of bumps) {
      const dx = x - b.cx;
      const dy = y - b.cy;
      if (dx * dx + dy * dy <= b.radius * b.radius) return true;
    }
    return false;
  };
  const tones = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      // The underside in shade, its upper edge stepping every few pixels; the right edge too.
      const shadeRows = 2 + (r(40 + Math.floor(x / 4)) < 0.5 ? 1 : 0);
      let tone = LIT;
      if (y > base - shadeRows || !inside(x + 1, y)) tone = SHADE;
      else if (!inside(x, y - 1) && x < width * 0.7) tone = RIM;
      tones[y * width + x] = tone;
    }
  }
  return { width, height, tones };
}

const TONE_RGB: Readonly<Record<number, readonly [number, number, number]>> = {
  [LIT]: [235, 230, 239],
  [SHADE]: [196, 188, 207],
  [RIM]: [255, 255, 255],
};

/** Cloud `seed` as a nearest-neighbour texture, one texel per art pixel. */
export function cloudTexture(seed: number, size: number): Texture {
  const { width, height, tones } = cloudPixels(seed, size);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const image = ctx.createImageData(width, height);
    tones.forEach((tone, i) => {
      const rgb = TONE_RGB[tone];
      if (!rgb) return;
      image.data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
    });
    ctx.putImageData(image, 0, 0);
  }
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
}
