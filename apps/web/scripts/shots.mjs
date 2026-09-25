/**
 * Headless screenshot review for the web prototype: loads the dev server in
 * Chromium, puts the store into a set of states and saves PNGs plus a contact
 * sheet to preview/web/. Usage: pnpm web:shots [--url http://localhost:5173]
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../../preview/web");
const urlArg = process.argv.indexOf("--url");
const url = urlArg >= 0 ? process.argv[urlArg + 1] : "http://localhost:5173/";
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

const DAY = 86_400;
const at = (day, hour) => day * DAY + hour * 3600;

/** Each shot: viewport, store patch, optional actions, settle time. */
const SHOTS = [
  { name: "desktop_day", viewport: [1600, 900], state: { clock: at(3, 11) } },
  { name: "desktop_morning", viewport: [1600, 900], state: { clock: at(3, 7) } },
  { name: "desktop_dusk", viewport: [1600, 900], state: { clock: at(3, 18.6) } },
  { name: "desktop_night", viewport: [1600, 900], state: { clock: at(3, 23) } },
  {
    name: "desktop_rain",
    viewport: [1600, 900],
    state: { clock: at(3, 14), weather: "rain" },
    settle: 4500,
  },
  {
    name: "desktop_fog",
    viewport: [1600, 900],
    state: { clock: at(3, 8), weather: "fog" },
    settle: 4500,
  },
  {
    name: "desktop_twig",
    viewport: [1600, 900],
    state: {
      clock: at(1, 12),
      tier: "twig",
      tool: "rock",
      lastGatherAt: 0,
      items: {},
      furnace: { owned: false, jobs: [] },
    },
  },
  {
    name: "desktop_stone",
    viewport: [1600, 900],
    state: {
      clock: at(9, 12),
      tier: "stone",
      items: { workbench: 1, crate: 3, campfire: 1, kiln: 1 },
    },
  },
  {
    name: "desktop_metal",
    viewport: [1600, 900],
    state: {
      clock: at(15, 12),
      tier: "metal",
      items: { workbench: 1, crate: 4, campfire: 1, kiln: 1, press: 1, lantern: 1 },
    },
  },
  {
    name: "desktop_hqm_night",
    viewport: [1600, 900],
    state: {
      clock: at(24, 22),
      tier: "hqm",
      items: { workbench: 1, crate: 6, campfire: 1, kiln: 1, press: 1, lantern: 1 },
    },
  },
  {
    name: "desktop_building",
    viewport: [1600, 900],
    state: { clock: at(5, 12), build: { tier: "stone", endsAt: at(5, 15) } },
  },
  {
    name: "desktop_panel_build",
    viewport: [1600, 900],
    state: { clock: at(3, 11), panel: "build" },
  },
  {
    name: "desktop_panel_craft",
    viewport: [1600, 900],
    state: { clock: at(3, 11), panel: "craft" },
  },
  {
    name: "desktop_panel_furnace",
    viewport: [1600, 900],
    state: {
      clock: at(3, 11),
      panel: "furnace",
      furnace: {
        owned: true,
        jobs: [{ input: "ore", output: "ingots", amount: 400, startedAt: at(3, 9), taken: 0 }],
      },
    },
  },
  {
    name: "desktop_panel_inventory",
    viewport: [1600, 900],
    state: { clock: at(3, 11), panel: "inventory" },
  },
  {
    name: "desktop_panel_squad",
    viewport: [1600, 900],
    state: { clock: at(3, 11), panel: "squad" },
  },
  {
    name: "desktop_panel_tasks",
    viewport: [1600, 900],
    state: { clock: at(3, 11), panel: "tasks" },
  },
  { name: "desktop_away", viewport: [1600, 900], state: { clock: at(3, 11), showAway: true } },
  { name: "desktop_ultrawide", viewport: [2560, 1080], state: { clock: at(3, 11) } },
  { name: "laptop", viewport: [1366, 768], state: { clock: at(3, 11) } },
  { name: "phone_day", viewport: [390, 844], scale: 3, state: { clock: at(3, 11) } },
  { name: "phone_night", viewport: [390, 844], scale: 3, state: { clock: at(3, 23) } },
  {
    name: "phone_panel_build",
    viewport: [390, 844],
    scale: 3,
    state: { clock: at(3, 11), panel: "build" },
  },
  {
    name: "phone_away",
    viewport: [390, 844],
    scale: 3,
    state: { clock: at(3, 11), showAway: true },
  },
  { name: "phone_landscape", viewport: [844, 390], scale: 3, state: { clock: at(3, 11) } },
  { name: "tablet", viewport: [820, 1180], scale: 2, state: { clock: at(3, 11) } },
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
    await page.evaluate((state) => {
      const store = window.__wipeDay.store;
      store.setState({
        showAway: false,
        panel: null,
        paused: true,
        demoOpen: false,
        toasts: [],
        ...state,
      });
    }, shot.state);
    await page.waitForTimeout(shot.settle ?? 1600);
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
figcaption{margin-top:6px;color:#a49e93}</style><h1>Wipe Day web prototype · ${new Date().toISOString()}</h1><main>${cards}</main>`;
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
