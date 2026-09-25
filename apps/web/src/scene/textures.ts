/**
 * Textures generated on a canvas at runtime: gradients and soft glows. Cached
 * by key so a gradient is drawn once per distinct colour set.
 */
import { Texture } from "pixi.js";
import { css } from "./util";

const cache = new Map<string, Texture>();

function canvasTexture(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  draw(ctx);
  const texture = Texture.from(canvas);
  cache.set(key, texture);
  // Colours are quantised by the callers, so the cache stays small; entries are never destroyed
  // because a sprite may still show one. Pixi's texture GC reclaims what goes unused.
  return texture;
}

/** A vertical gradient, 2 px wide: stretch it. Stops are [offset 0..1, colour]. */
export function verticalGradient(stops: Array<[number, number]>): Texture {
  const quantised = stops.map(([o, c]) => [o, c & 0xf8f8f8] as [number, number]);
  const key = `v:${quantised.map(([o, c]) => `${o.toFixed(3)}-${c.toString(16)}`).join(",")}`;
  return canvasTexture(key, 2, 256, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    for (const [offset, color] of quantised) {
      gradient.addColorStop(Math.min(1, Math.max(0, offset)), css(color));
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);
  });
}

/** A soft round glow: opaque centre fading to transparent. Tint it, blend it additively. */
export function glowTexture(size = 256): Texture {
  return canvasTexture(`glow:${size}`, size, size, (ctx) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
    gradient.addColorStop(0.7, "rgba(255,255,255,0.12)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

/** A soft-edged disc for clouds, fog and smoke. */
export function puffTexture(size = 128): Texture {
  return canvasTexture(`puff:${size}`, size, size, (ctx) => {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.1,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.7)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}
