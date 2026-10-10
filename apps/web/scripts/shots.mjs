/**
 * Headless screenshot review for the web client (D44): loads the dev server in Chromium (demo
 * mode), puts the store into each state of `SHOTS`, and saves PNGs plus a contact sheet to
 * preview/web/. Usage: pnpm web:shots [--url http://localhost:5173/?demo] [--only name]
 *
 * The list per phase is docs/redesign/08-screens.md section 8; R0 has the bare island only.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../../preview/web");
const urlArg = process.argv.indexOf("--url");
const url = urlArg >= 0 ? process.argv[urlArg + 1] : "http://localhost:5173/?demo";
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

const DAY = 86_400;
/** Seconds on the demo's game clock: day `day` (from 1) at `hour` (UTC; shots render in UTC). */
const at = (day, hour) => (day - 1) * DAY + hour * 3600;
/** A fixed animation clock, so clouds and waves sit in the same place every run. */
const WALL = 1_791_400_000;

const DESKTOP = [1600, 900];
const PHONE = [390, 844];

/**
 * Each shot: `viewport`, `scale` (device pixels), `state`, and optionally `taps` and `clip`.
 * In `state`, `time` pins the game clock and `wall` the animation clock (both paused);
 * `demoOpen` opens the demo drawer; every other key overwrites that field of the run
 * (`RunState` in the domain). `taps: [count, x, y]` taps the land through the store after the
 * patch and catches the floater in flight (the animation clock then runs). `clip` also saves a
 * 1:1 crop `{name}__zoom.png` ([x, y, width, height] in CSS pixels).
 */
const SHOTS = [
  {
    name: "bare_island",
    viewport: DESKTOP,
    state: { time: at(1, 10), wall: WALL },
    clip: [640, 0, 320, 110],
  },
  {
    name: "phone_bare_island",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10), wall: WALL },
    clip: [60, 0, 270, 100],
  },
  {
    name: "phone_bare_island_tapping",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10), wall: WALL, supplies: 1234.6, made: 1234.6, taps: 410 },
    taps: [6, 230, 640],
    clip: [120, 520, 220, 180],
  },
  {
    name: "phone_bare_island_big",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10), wall: WALL, supplies: 1.234e36, made: 1.234e36, taps: 10 },
    clip: [60, 0, 270, 100],
  },
  {
    name: "bare_island_night",
    viewport: DESKTOP,
    state: { time: at(1, 23), wall: WALL, supplies: 999_999, made: 999_999, taps: 12 },
    clip: [640, 0, 320, 110],
  },
  {
    name: "bare_island_drawer",
    viewport: DESKTOP,
    state: { time: at(1, 10), wall: WALL, demoOpen: true },
    clip: [0, 560, 320, 340],
  },
  {
    name: "phone_bare_island_drawer",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10), wall: WALL, demoOpen: true },
  },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const done = [];
  for (const shot of SHOTS) {
    if (only && !shot.name.includes(only)) continue;
    const [width, height] = shot.viewport;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: shot.scale ?? 1,
      timezoneId: "UTC",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(() => (window.__wipeDay?.frames ?? 0) > 5, null, {
      timeout: 20_000,
    });
    await page.waitForFunction(() => window.__wipeDay?.store.getState().phase === "playing", null, {
      timeout: 20_000,
    });
    await page.evaluate((state) => {
      const { store, clocks } = window.__wipeDay;
      const { time, wall, demoOpen, ...run } = state;
      clocks.game.setPaused(true);
      if (time !== undefined) clocks.game.set(time);
      clocks.wall.setPaused(true);
      if (wall !== undefined) clocks.wall.set(wall);
      const world = store.getState();
      world.demoPatch(run);
      store.setState({ demoOpen: demoOpen === true, toasts: [] });
    }, shot.state);
    if (shot.taps) {
      // Let the scene pick up the patch, tap with the animation clock running, then catch the
      // floater in flight (at least 12 frames, so slow software rendering gets past its pop).
      await page.waitForTimeout(300);
      const frames = await page.evaluate(([count, x, y]) => {
        window.__wipeDay.clocks.wall.setPaused(false);
        window.__wipeDay.tap(count, x, y);
        return window.__wipeDay.frames;
      }, shot.taps);
      await page.waitForTimeout(350);
      await page.waitForFunction((target) => window.__wipeDay.frames >= target, frames + 12, {
        timeout: 20_000,
      });
      await page.evaluate(() => {
        window.__wipeDay.frozen = true;
      });
    } else {
      await page.waitForTimeout(shot.settle ?? 1200);
    }
    if (shot.clip) {
      const [x, y, clipWidth, clipHeight] = shot.clip;
      await page.screenshot({
        path: path.join(outDir, `${shot.name}__zoom.png`),
        clip: { x, y, width: clipWidth, height: clipHeight },
      });
    }
    const file = path.join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file });
    done.push({ ...shot, file: `${shot.name}.png`, errors });
    process.stdout.write(
      `${shot.name}${errors.length ? ` (${errors.length} console errors)` : ""}\n`,
    );
    await context.close();
  }
  await browser.close();

  const cards = done
    .map(
      (shot) =>
        `<figure><img src="${shot.file}" alt="${shot.name}" loading="lazy"><figcaption>${shot.name} · ${shot.viewport.join("×")}${
          shot.errors.length ? ` · <b style="color:#f05252">${shot.errors.length} errors</b>` : ""
        }</figcaption></figure>`,
    )
    .join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>Wipe Day web preview</title>
<style>body{margin:0;padding:24px;background:#1b1a18;color:#ece8df;font:14px/1.4 system-ui}h1{font-size:18px;margin:0 0 16px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:20px}figure{margin:0}img{width:100%;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.5)}
figcaption{margin-top:6px;color:#a49e93}</style><h1>Wipe Day web client · ${new Date().toISOString()}</h1><main>${cards}</main>`;
  await writeFile(path.join(outDir, "index.html"), html);
  const failures = done.filter((shot) => shot.errors.length > 0);
  for (const shot of failures)
    process.stdout.write(`\n${shot.name}:\n  ${shot.errors.join("\n  ")}\n`);
  process.stdout.write(`\n${done.length} shots -> ${outDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
