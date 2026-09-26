/**
 * PNG resizing without a new dependency: resvg rasterises an SVG that embeds
 * the source picture at the target size. Good enough for icons (bilinear).
 */
import { Resvg } from "@resvg/resvg-js";

export function resizePng(png: Buffer, width: number, height: number): Buffer {
  const href = `data:image/png;base64,${png.toString("base64")}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="${href}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/></svg>`;
  return new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
}
