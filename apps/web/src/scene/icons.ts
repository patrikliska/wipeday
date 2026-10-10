/**
 * The content icons (D141) as Pixi textures, so the scene draws the very icon the panels show:
 * a line's product on its pile and on its floater (02-the-run.md 1.2). The SVGs are bundled as
 * text, drawn white once at load onto a canvas, and tinted per use. Until a texture has loaded
 * (or for an id without a file) callers fall back to a plain dot in the product's colour.
 */
import { Texture } from "pixi.js";

const sources = import.meta.glob<string>("../../../../packages/content/icons/product/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Pixels per side: icons are drawn at up to 24 CSS px, at DPR 2 at most. */
const SIZE = 64;
const textures = new Map<string, Texture>();

function idOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1, -".svg".length);
}

function rasterise(svg: string): Promise<Texture> {
  const white = svg.replaceAll("currentColor", "#ffffff");
  const sized = white.replace("<svg ", `<svg width="${SIZE}" height="${SIZE}" `);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no 2d context"));
        return;
      }
      ctx.drawImage(image, 0, 0, SIZE, SIZE);
      resolve(Texture.from(canvas));
    };
    image.onerror = () => reject(new Error("icon did not load"));
    image.src = url;
  });
}

/** Loads every product icon; resolves when all are in (a broken one is skipped). */
export async function loadProductIcons(): Promise<void> {
  await Promise.all(
    Object.entries(sources).map(async ([path, svg]) => {
      try {
        textures.set(idOf(path), await rasterise(svg));
      } catch {
        // The fallback dot stands in for it.
      }
    }),
  );
}

/** The product's icon, white (tint it), or null while it loads or when there is none. */
export function productTexture(id: string): Texture | null {
  return textures.get(id) ?? null;
}
