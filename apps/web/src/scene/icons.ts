/**
 * The content icons (D141) as Pixi textures, so the scene draws the very icon the panels show:
 * a line's product on its pile and on its floater (02-the-run.md 1.2), and flotsam on the water
 * (CLAUDE.md 6.2: one icon per kind, used identically everywhere). The SVGs are bundled as
 * text, drawn white once at load onto a canvas, and tinted per use. Until a texture has loaded
 * (or for an id without a file) callers fall back to a plain dot in the product's colour.
 */
import { Texture } from "pixi.js";

const sources = import.meta.glob<string>("../../../../packages/content/icons/product/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});
const flotsamSources = import.meta.glob<string>(
  "../../../../packages/content/icons/flotsam/*.svg",
  { query: "?raw", import: "default", eager: true },
);

/** Pixels per side: icons are drawn at up to 24 CSS px, at DPR 2 at most (flotsam at 48). */
const SIZE = 64;
const FLOTSAM_SIZE = 112;
const textures = new Map<string, Texture>();
const flotsamTextures = new Map<string, Texture>();

function idOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1, -".svg".length);
}

function rasterise(svg: string, size = SIZE): Promise<Texture> {
  const white = svg.replaceAll("currentColor", "#ffffff");
  const sized = white.replace("<svg ", `<svg width="${size}" height="${size}" `);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no 2d context"));
        return;
      }
      ctx.drawImage(image, 0, 0, size, size);
      resolve(Texture.from(canvas));
    };
    image.onerror = () => reject(new Error("icon did not load"));
    image.src = url;
  });
}

/** Loads every product and flotsam icon; resolves when all are in (a broken one is skipped). */
export async function loadProductIcons(): Promise<void> {
  const load =
    (into: Map<string, Texture>, size: number) =>
    async ([path, svg]: [string, string]) => {
      try {
        into.set(idOf(path), await rasterise(svg, size));
      } catch {
        // The fallback dot stands in for it.
      }
    };
  await Promise.all([
    ...Object.entries(sources).map(load(textures, SIZE)),
    ...Object.entries(flotsamSources).map(load(flotsamTextures, FLOTSAM_SIZE)),
  ]);
}

/** A flotsam kind's icon, white (tint it), or null while it loads. */
export function flotsamTexture(id: string): Texture | null {
  return flotsamTextures.get(id) ?? null;
}

/** The product's icon, white (tint it), or null while it loads or when there is none. */
export function productTexture(id: string): Texture | null {
  return textures.get(id) ?? null;
}
