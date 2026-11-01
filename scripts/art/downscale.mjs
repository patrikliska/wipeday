// node downscale.mjs <in.png> <out.png> <divisor>: a pixel-art downscale through Retro Diffusion's
// free k-centroid tool (/v2/edit/tools/k_centroid_downscale), which keeps edges and colours
// where nearest-neighbour would drop every other pixel. Used for the skyline layers (D209).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const K = /^RETRO_DIFFUSION_API_KEY=(.+)$/m.exec(env)?.[1]?.trim();
if (!K) throw new Error("no key");
const [input, output, divisor] = process.argv.slice(2);
const png = fs.readFileSync(input);
const width = Math.round(png.readUInt32BE(16) / Number(divisor));
const height = Math.round(png.readUInt32BE(20) / Number(divisor));
const res = await fetch("https://api.retrodiffusion.ai/v2/edit/tools/k_centroid_downscale", {
  method: "POST",
  headers: { "X-RD-Token": K, "Content-Type": "application/json" },
  body: JSON.stringify({ input_image: png.toString("base64"), width, height }),
});
const body = await res.json().catch(() => ({}));
const image = body.base64_images?.[0] ?? body.result?.base64_images?.[0];
if (!res.ok || !image) {
  console.log("failed", res.status, JSON.stringify(body).slice(0, 300));
  process.exit(1);
}
fs.writeFileSync(output, Buffer.from(image, "base64"));
console.log(
  `${path.basename(output)} ${width}x${height} cost ${body.balance_cost ?? body.result?.balance_cost ?? 0}`,
);
