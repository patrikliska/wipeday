import { type ReactElement, useEffect, useState } from "react";

/**
 * The scene's pixel art in the HUD (D188): a line's sprite on its shop card, drawn at the largest
 * whole zoom that fits `box` CSS px, nearest-neighbour, so a card shows exactly what the island
 * shows. The PNGs are the scene's own (`packages/content/art/scene/line/`); their sizes are read
 * once on load. A missing file draws `fallback` (the icon).
 */
const urls = import.meta.glob<string>("../../../../packages/content/art/scene/line/*.png", {
  query: "?url",
  import: "default",
  eager: true,
});

const URLS = new Map<string, string>();
for (const [path, url] of Object.entries(urls)) {
  const id = path.split("/").at(-1)?.slice(0, -".png".length) ?? "";
  URLS.set(`line/${id}`, url);
}

const sizes = new Map<string, { w: number; h: number }>();
const waiting = new Map<string, Array<() => void>>();

function load(key: string, url: string): void {
  if (sizes.has(key) || waiting.has(key)) return;
  waiting.set(key, []);
  const image = new Image();
  image.onload = () => {
    sizes.set(key, { w: image.naturalWidth, h: image.naturalHeight });
    for (const done of waiting.get(key) ?? []) done();
    waiting.delete(key);
  };
  image.src = url;
}

// Every card's art is small: read all the sizes at start, so a card never waits for its own.
if (typeof Image !== "undefined") for (const [key, url] of URLS) load(key, url);

export const hasPixelArt = (key: string): boolean => URLS.has(key);

export function PixelArt({
  id,
  box,
  fallback,
}: {
  id: string;
  box: number;
  fallback: ReactElement;
}) {
  const url = URLS.get(id);
  const [size, setSize] = useState(() => sizes.get(id) ?? null);
  useEffect(() => {
    if (!url) return;
    const known = sizes.get(id);
    if (known) {
      setSize(known);
      return;
    }
    load(id, url);
    const done = () => setSize(sizes.get(id) ?? null);
    waiting.get(id)?.push(done);
  }, [id, url]);
  if (!url) return fallback;
  if (!size) return <span className="pixel-art" style={{ width: box, height: box }} />;
  const zoom = Math.max(1, Math.floor(box / Math.max(size.w, size.h)));
  return (
    <img
      className="pixel-art"
      src={url}
      alt=""
      draggable={false}
      width={size.w * zoom}
      height={size.h * zoom}
    />
  );
}
