/**
 * R1's frame check (docs/roadmap.md R1, "Done when"): thirty seconds at 15 taps a second on a
 * busy island must hold 55 fps with at most 12 live floaters. Drives the running dev server
 * (`pnpm web`) in Chromium on the machine's GPU, in real time, and reads the `__wipeDay` frame
 * counter once a second. Usage: pnpm web:perf [--url http://localhost:5173/?demo] [--seconds 30]
 * [--headed] [--throttle 4] (CPU slowed n times, a rough stand-in for a mid phone; the owner's
 * phone check stays the acceptance, 08-screens.md 4.6).
 */
import { chromium } from "playwright";

const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const url = arg("--url", "http://localhost:5173/?demo");
const seconds = Number(arg("--seconds", "30"));
const headed = process.argv.includes("--headed");
const throttle = Number(arg("--throttle", "1"));

const browser = await chromium.launch({
  headless: !headed,
  args: ["--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"],
});
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
).newPage();
if (throttle > 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
}
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__wipeDay?.store.getState().phase === "playing");
const renderer = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const info = gl?.getExtension("WEBGL_debug_renderer_info");
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
});
// A busy run: the Stone era at about 10:30 with six hands, so lines pop and float too.
await page.evaluate(() => {
  const { store, clocks } = window.__wipeDay;
  store.getState().demoPatch({
    era: "stone",
    activeAt: Math.floor(clocks.game.now()),
    lines: {
      beachcomber: 62,
      campfire: 48,
      garden: 36,
      loom: 26,
      workbench: 14,
      kiln: 9,
      furnace: 2,
    },
    hands: ["beachcomber", "campfire", "garden", "loom", "workbench", "kiln"],
  });
});
await page.waitForTimeout(1500);

const samples = await page.evaluate(
  (total) =>
    new Promise((resolve) => {
      const hook = window.__wipeDay;
      const out = [];
      let frames = hook.frames;
      let maxFloaters = 0;
      let maxParticles = 0;
      const tapper = setInterval(() => hook.tap(1), 1000 / 15);
      const watch = setInterval(() => {
        const counts = hook.counts();
        maxFloaters = Math.max(maxFloaters, counts.floaters);
        maxParticles = Math.max(maxParticles, counts.particles);
      }, 50);
      const sampler = setInterval(() => {
        out.push({ fps: hook.frames - frames, floaters: maxFloaters, particles: maxParticles });
        frames = hook.frames;
        maxFloaters = 0;
        maxParticles = 0;
        if (out.length >= total) {
          clearInterval(tapper);
          clearInterval(watch);
          clearInterval(sampler);
          resolve(out);
        }
      }, 1000);
    }),
  seconds,
);
await browser.close();

const fps = samples.map((sample) => sample.fps);
const sorted = [...fps].sort((a, b) => a - b);
const mean = fps.reduce((sum, value) => sum + value, 0) / fps.length;
const floaters = Math.max(...samples.map((sample) => sample.floaters));
const particles = Math.max(...samples.map((sample) => sample.particles));
const low = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
process.stdout.write(`renderer: ${renderer}\n`);
process.stdout.write(`fps per second: ${fps.join(" ")}\n`);
process.stdout.write(
  `mean ${mean.toFixed(1)} fps, 5th percentile ${low}, min ${sorted[0]}; floaters at most ${floaters} (cap 12), particles at most ${particles} (cap 160)\n`,
);
const ok = mean >= 55 && floaters <= 12 && particles <= 160;
process.stdout.write(ok ? "PASS\n" : "FAIL\n");
process.exitCode = ok ? 0 : 1;
