/**
 * `pnpm icons`: the icon review sheet (D141). Every `packages/content/icons/<kind>/<id>.svg`
 * is linted against the file rules and rendered with resvg at 16, 24 and 48 px, white on the
 * dark HUD background and dark on light, into `preview/icons/`:
 *
 * - `index.html`: the contact sheet, one row per icon, with its lint and ink numbers;
 * - `sheet-dark.png` / `sheet-light.png`: the same as one image per theme;
 * - `strip16-dark.png` / `strip16-light.png`: every icon at a real 16 px, zoomed 3x
 *   without smoothing, side by side, to compare silhouettes;
 * - `png/<kind>__<id>@<size>-<theme>.png`.
 *
 * Exits non-zero when a file breaks a rule.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { ROOT } from "../config";

const ICONS = join(ROOT, "packages", "content", "icons");
const OUT = join(ROOT, "preview", "icons");
mkdirSync(join(OUT, "png"), { recursive: true });

/** Kinds in the order they are drawn (docs/redesign/07-what-changes.md 8). */
const KINDS = ["currency", "product", "line", "tier", "tool", "target", "flotsam", "ui", "nav"];
const SIZES = [16, 24, 48] as const;
const THEMES = {
  dark: { bg: "#1b1a18", fg: "#ece8df", label: "#a49e93" },
  light: { bg: "#ece8df", fg: "#1b1a18", label: "#5d594f" },
} as const;
type Theme = keyof typeof THEMES;

/** The fixed accents an icon may use: the scene palette and the HUD tokens. */
const ACCENTS = new Set([
  ...hexes(read("apps/web/src/scene/palette.ts"), /0x([0-9a-f]{6})\b/gi),
  ...hexes(read("apps/web/src/styles/tokens.css"), /#([0-9a-f]{6})\b/gi),
]);

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function hexes(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => `#${(match[1] ?? "").toLowerCase()}`);
}

interface Icon {
  kind: string;
  id: string;
  svg: string;
  problems: string[];
  /** Ink bounds in viewBox units and the share of the 48-box that is covered. */
  box: { x0: number; y0: number; x1: number; y1: number };
  ink: number;
  accent: string | undefined;
}

const FORBIDDEN: [RegExp, string][] = [
  [/<text\b/, "<text>"],
  [/<image\b/, "raster <image>"],
  [/<(filter|fe[A-Z]\w*)\b/, "filter"],
  [/Gradient\b/, "gradient"],
  [/<(pattern|mask|clipPath|use|style|script|foreignObject)\b/, "a forbidden element"],
  [/\bhref=/, "an external reference"],
  [/url\(/, "a url() reference"],
  [/\sid=/, "an id attribute"],
];

function lint(svg: string): { problems: string[]; accent: string | undefined } {
  const problems: string[] = [];
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  if (!root.includes('viewBox="0 0 48 48"')) problems.push('root needs viewBox="0 0 48 48"');
  if (/\s(width|height)=/.test(root)) problems.push("root has a width or height");
  for (const [pattern, what] of FORBIDDEN) if (pattern.test(svg)) problems.push(`uses ${what}`);
  const colours = new Set<string>();
  for (const [, , value = ""] of svg.matchAll(/\b(fill|stroke|color)="([^"]+)"/g)) {
    if (value === "currentColor" || value === "none" || value === "evenodd") continue;
    const colour = value.toLowerCase();
    if (!ACCENTS.has(colour)) problems.push(`${value} is not in palette.ts or tokens.css`);
    colours.add(colour);
  }
  if (colours.size > 1) problems.push(`${colours.size} fixed colours (at most one accent)`);
  for (const [, width = ""] of svg.matchAll(/stroke-width="([^"]+)"/g)) {
    if (Number(width) < 3) problems.push(`stroke-width ${width} is under 3`);
  }
  return { problems, accent: [...colours][0] };
}

function render(svg: string, size: number, theme: Theme, background = true): Resvg {
  const { bg, fg } = THEMES[theme];
  const tinted = svg.replace("<svg ", `<svg color="${fg}" `);
  return new Resvg(tinted, {
    fitTo: { mode: "width", value: size },
    ...(background ? { background: bg } : {}),
  });
}

/** Renders at 10 px a unit and reads the alpha channel for the ink box and coverage. */
function measure(svg: string): { box: Icon["box"]; ink: number } {
  const scale = 10;
  const image = render(svg, 48 * scale, "dark", false).render();
  const { width, height, pixels } = image;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  let covered = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3] ?? 0;
      if (alpha < 128) continue;
      covered++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return {
    box: { x0: x0 / scale, y0: y0 / scale, x1: (x1 + 1) / scale, y1: (y1 + 1) / scale },
    ink: covered / (width * height),
  };
}

const icons: Icon[] = [];
for (const kind of readdirSync(ICONS).sort((a, b) => rank(a) - rank(b))) {
  for (const file of readdirSync(join(ICONS, kind)).filter((name) => name.endsWith(".svg"))) {
    const svg = readFileSync(join(ICONS, kind, file), "utf8");
    const id = file.slice(0, -4);
    const { problems, accent } = lint(svg);
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(id)) problems.push("id is not snake_case, 2-32 chars");
    const { box, ink } = measure(svg);
    const margin = 2 - 0.25;
    if (box.x0 < margin || box.y0 < margin || box.x1 > 48 - margin || box.y1 > 48 - margin) {
      problems.push(`ink reaches ${fmt(box)}, inside the 2-unit margin`);
    }
    icons.push({ kind, id, svg, problems, box, ink, accent });
  }
}

function rank(kind: string): number {
  const index = KINDS.indexOf(kind);
  return index < 0 ? KINDS.length : index;
}

function fmt(box: Icon["box"]): string {
  const n = (value: number) => value.toFixed(1);
  return `${n(box.x0)},${n(box.y0)}-${n(box.x1)},${n(box.y1)}`;
}

const png = (icon: Icon, size: number, theme: Theme) =>
  `png/${icon.kind}__${icon.id}@${size}-${theme}.png`;
const dataUri = (buffer: Buffer) => `data:image/png;base64,${buffer.toString("base64")}`;

const pngs = new Map<string, Buffer>();
for (const icon of icons) {
  for (const theme of Object.keys(THEMES) as Theme[]) {
    for (const size of SIZES) {
      const buffer = render(icon.svg, size, theme).render().asPng();
      pngs.set(png(icon, size, theme), buffer);
      writeFileSync(join(OUT, png(icon, size, theme)), buffer);
    }
  }
}

/** One image per theme: per icon its label, 16 px, 16 px zoomed 4x, 24 px and 48 px. */
function sheet(theme: Theme): Buffer {
  const { bg, label } = THEMES[theme];
  const columns = 6;
  const cell = { w: 236, h: 96 };
  const rows = Math.ceil(icons.length / columns);
  const parts = icons.map((icon, index) => {
    const x = (index % columns) * cell.w + 12;
    const y = Math.floor(index / columns) * cell.h + 8;
    const img = (size: number, dx: number, dy: number, zoom = 1) =>
      `<image x="${x + dx}" y="${y + dy}" width="${size * zoom}" height="${size * zoom}" image-rendering="optimizeSpeed" href="${dataUri(pngs.get(png(icon, size, theme)) ?? Buffer.alloc(0))}"/>`;
    const flag = icon.problems.length > 0 ? " !" : "";
    return [
      `<text x="${x}" y="${y + 11}" font-family="Arial" font-size="11" fill="${label}">${icon.kind}/${icon.id}${flag}</text>`,
      img(16, 0, 40),
      img(16, 24, 18, 4),
      img(24, 96, 36),
      img(48, 128, 24),
      `<text x="${x + 182}" y="${y + 52}" font-family="Arial" font-size="10" fill="${label}">${Math.round(icon.ink * 100)}%</text>`,
    ].join("");
  });
  const width = columns * cell.w + 12;
  const height = rows * cell.h + 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${bg}"/>${parts.join("")}</svg>`;
  return new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "Arial" } })
    .render()
    .asPng();
}

/** Every icon at a real 16 px, zoomed 3x without smoothing, 14 to a row. */
function strip(theme: Theme): Buffer {
  const { bg } = THEMES[theme];
  const perRow = 14;
  const step = 16 * 3 + 12;
  const parts = icons.map((icon, index) => {
    const x = (index % perRow) * step + 12;
    const y = Math.floor(index / perRow) * step + 12;
    return `<image x="${x}" y="${y}" width="48" height="48" image-rendering="optimizeSpeed" href="${dataUri(pngs.get(png(icon, 16, theme)) ?? Buffer.alloc(0))}"/>`;
  });
  const width = perRow * step + 12;
  const height = Math.ceil(icons.length / perRow) * step + 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${bg}"/>${parts.join("")}</svg>`;
  return new Resvg(svg).render().asPng();
}

for (const theme of Object.keys(THEMES) as Theme[]) {
  writeFileSync(join(OUT, `sheet-${theme}.png`), sheet(theme));
  writeFileSync(join(OUT, `strip16-${theme}.png`), strip(theme));
}

const rows = icons.map((icon) => {
  const cells = (Object.keys(THEMES) as Theme[]).map((theme) => {
    const { bg } = THEMES[theme];
    const imgs = SIZES.map((size) => `<img src="${png(icon, size, theme)}" alt="">`).join("");
    const zoom = `<img class="zoom" src="${png(icon, 16, theme)}" alt="">`;
    return `<td style="background:${bg}">${imgs}${zoom}</td>`;
  });
  const notes = icon.problems.length
    ? `<span class="bad">${icon.problems.join("; ")}</span>`
    : `ink ${Math.round(icon.ink * 100)}%, box ${fmt(icon.box)}${icon.accent ? `, accent ${icon.accent}` : ""}`;
  return `<tr><th>${icon.kind}/${icon.id}</th>${cells.join("")}<td>${notes}</td></tr>`;
});
writeFileSync(
  join(OUT, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Wipe Day icons</title>
<style>
body{font:14px system-ui,sans-serif;background:#888;margin:16px}
table{border-collapse:collapse}td,th{padding:6px 10px;text-align:left}
th{font-weight:600;background:#ddd}td:last-child{background:#eee;font-size:12px}
img{vertical-align:middle;margin-right:10px}.zoom{width:64px;height:64px;image-rendering:pixelated}
.bad{color:#b00;font-weight:600}
</style>
<h1>${icons.length} icons</h1>
<p><img src="strip16-dark.png" alt=""><br><img src="strip16-light.png" alt=""></p>
<table>${rows.join("\n")}</table>`,
);

for (const icon of icons) {
  const status = icon.problems.length ? `  ${icon.problems.join("; ")}` : "";
  console.log(
    `${`${icon.kind}/${icon.id}`.padEnd(24)} ink ${String(Math.round(icon.ink * 100)).padStart(2)}%  box ${fmt(icon.box)}${status}`,
  );
}
const broken = icons.filter((icon) => icon.problems.length > 0);
console.log(
  `\n${icons.length} icons, ${broken.length} with problems -> ${join(OUT, "index.html")}`,
);
if (broken.length > 0) process.exitCode = 1;
