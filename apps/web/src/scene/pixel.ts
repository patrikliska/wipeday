/**
 * The pixel grid (D188): one art pixel is `ART` stage units, every sprite is drawn at exactly
 * that scale with nearest-neighbour sampling, and anything placed on the grid sits on whole art
 * pixels. The camera (`Scene.layout`) keeps the zoom a whole number of device pixels per art
 * pixel, so the grid survives every screen.
 *
 * The art is `packages/content/art/scene/<kind>/<id>.png`, bundled by Vite and loaded once at
 * start; a missing file is not an error: callers keep their procedural drawing (the stand-in
 * scene) for it, so the island never breaks while the art arrives one piece at a time.
 */
import { Assets, Rectangle, Sprite, Texture } from "pixi.js";

/** Stage units per art pixel: the 1600×900 stage is 320×180 art pixels. */
export const ART = 5;

const urls = import.meta.glob<string>("../../../../packages/content/art/scene/**/*.png", {
  query: "?url",
  import: "default",
  eager: true,
});

const textures = new Map<string, Texture>();

/** "kind/id" from a glob path. */
function keyOf(path: string): string {
  const parts = path.slice(0, -".png".length).split("/");
  return `${parts.at(-2)}/${parts.at(-1)}`;
}

/** Loads every scene sprite (nearest-neighbour). Safe to call twice. */
export async function loadArt(): Promise<void> {
  if (textures.size > 0) return;
  await Promise.all(
    Object.entries(urls).map(async ([path, url]) => {
      const texture = await Assets.load<Texture>({ src: url, data: { scaleMode: "nearest" } });
      texture.source.scaleMode = "nearest";
      textures.set(keyOf(path), texture);
    }),
  );
}

/** The texture for "kind/id", or null when that art does not exist (yet). */
export function art(key: string): Texture | null {
  return textures.get(key) ?? null;
}

/** Whether "kind/id" has art. */
export const hasArt = (key: string): boolean => textures.has(key);

/**
 * A sprite of "kind/id" at the grid's scale, standing on its bottom centre: the anchor falls on
 * a whole art pixel (an odd width leans left), so the sprite stays on the grid.
 */
export function artSprite(key: string, texture = art(key)): Sprite | null {
  if (!texture) return null;
  const sprite = new Sprite(texture);
  const w = texture.frame.width;
  sprite.anchor.set(Math.floor(w / 2) / w, 1);
  sprite.scale.set(ART);
  return sprite;
}

/** The frames of a sprite sheet of `cols` × `rows` equal cells, row by row. */
export function frames(key: string, cols: number, rows: number): Texture[] {
  const sheet = art(key);
  if (!sheet) return [];
  const w = Math.floor(sheet.frame.width / cols);
  const h = Math.floor(sheet.frame.height / rows);
  const out: Texture[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push(
        new Texture({
          source: sheet.source,
          frame: new Rectangle(sheet.frame.x + c * w, sheet.frame.y + r * h, w, h),
        }),
      );
    }
  }
  return out;
}

/**
 * A strip of a texture (art pixels `y` to `y + h`) as a texture of its own, so a tiling sprite
 * repeats only that strip (the ground tile's grass top, its dirt face).
 */
export function strip(key: string, y: number, h: number): Texture | null {
  const tile = art(key);
  if (!tile) return null;
  const image = tile.source.resource as CanvasImageSource;
  const canvas = document.createElement("canvas");
  canvas.width = tile.frame.width;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, tile.frame.x, tile.frame.y + y, tile.frame.width, h, 0, 0, canvas.width, h);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
}

/** `value` (stage units) on the nearest whole art pixel. */
export const snap = (value: number): number => Math.round(value / ART) * ART;
