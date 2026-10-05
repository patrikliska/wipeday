/**
 * Renders the app icons (home screen, notifications) from one SVG drawn here:
 * the holdfast's hut on its island under a dusk sky, in the scene's palette.
 * Usage: node apps/web/scripts/icons.mjs (writes apps/web/public/icon-*.png).
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../public");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2c3e63"/><stop offset="1" stop-color="#cd6a3b"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="356" cy="176" r="54" fill="#ffd25a"/>
  <rect y="352" width="512" height="160" fill="#2c6a92"/>
  <path d="M60 372 Q256 268 452 372 Z" fill="#d9c893"/>
  <path d="M92 366 Q256 286 420 366 Z" fill="#7fa55a"/>
  <path d="M176 300 L256 236 L336 300 Z" fill="#7a4a2a"/>
  <rect x="192" y="300" width="128" height="62" fill="#b07840"/>
  <rect x="242" y="320" width="28" height="42" fill="#3a2615"/>
  <rect x="300" y="250" width="12" height="40" fill="#5a3d26"/>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await writeFile(path.join(out, name), await page.screenshot({ type: "png" }));
}
await browser.close();
process.stdout.write(`icons -> ${out}\n`);
