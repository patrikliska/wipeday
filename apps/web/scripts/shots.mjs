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
const url = urlArg >= 0 ? process.argv[urlArg + 1] : "http://localhost:5173/?demo";
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

const DAY = 86_400;
const at = (day, hour) => day * DAY + hour * 3600;

/** Every building type (buildings.json5), for the "whole base" shots. */
const BUILDINGS = [
  "workbench",
  "furnace",
  "campfire",
  "warehouse",
  "garden",
  "loom",
  "bunkhouse",
  "lights",
  "tannery",
  "kiln",
  "press",
  "watchtower",
  "walls",
  "generator",
  "radio_mast",
  "dock",
];
const allAt = (level) => Object.fromEntries(BUILDINGS.map((id) => [id, level]));
/** A believable mid-game base: the early buildings at level 1 and 2. */
const MIDGAME = {
  workbench: 2,
  furnace: 2,
  campfire: 2,
  warehouse: 1,
  garden: 2,
  loom: 1,
  bunkhouse: 1,
  lights: 1,
  kiln: 1,
  walls: 1,
};
/** Mid-game stock with parts, for the crafting shots. */
const CRAFT_STOCK = {
  timber: 4200,
  stone: 3100,
  ore: 900,
  ingots: 640,
  fibre: 380,
  hide: 120,
  fat: 40,
  food: 150,
  scrap: 60,
  planks: 45,
  rope: 0,
  cloth: 10,
  plates: 12,
};
/** Two stations at work: planks at the workbench, a queue at the loom. */
const BUSY = (day) => ({
  workbench: [
    { recipe: "planks", count: 20, done: 6, unitSeconds: 120, startedAt: at(day, 11) - 780 },
    { recipe: "frames", count: 4, done: 0, unitSeconds: 300, startedAt: at(day, 11) + 1620 },
  ],
  loom: [{ recipe: "rope", count: 8, done: 2, unitSeconds: 180, startedAt: at(day, 11) - 400 }],
});

/**
 * Each shot: viewport, state patch, settle time. The page runs in demo mode (`?demo`). In the
 * patch, `time` sets the demo game clock (seconds into the demo season, which starts at the
 * epoch), `panel`, `weather` and `welcome` set the HUD, and every other key overwrites that
 * field of the base (`BaseState` in the domain). Optional: `act` fires a store
 * action after the patch (for effects such as floating gains), `click` clicks a
 * point in CSS pixels instead (starting a node run), `clip` also saves
 * a 1:1 crop `{name}__zoom.png` ([x, y, width, height] in CSS pixels), `scrollTo` scrolls
 * the element matching that selector to the top of its panel before the picture.
 */
const SHOTS = [
  { name: "desktop_day", viewport: [1600, 900], state: { time: at(3, 11) } },
  { name: "desktop_morning", viewport: [1600, 900], state: { time: at(3, 7) } },
  { name: "desktop_dusk", viewport: [1600, 900], state: { time: at(3, 18.6) } },
  { name: "desktop_night", viewport: [1600, 900], state: { time: at(3, 23) } },
  {
    name: "desktop_rain",
    viewport: [1600, 900],
    state: { time: at(3, 14), weather: "rain" },
    settle: 4500,
  },
  {
    name: "desktop_fog",
    viewport: [1600, 900],
    state: { time: at(3, 8), weather: "fog" },
    settle: 4500,
  },
  {
    name: "desktop_twig",
    viewport: [1600, 900],
    state: {
      time: at(1, 12),
      tier: "twig",
      toolId: "rock",
      lastGatherAt: 0,
      items: {},
      buildings: {},
      furnaceJobs: [],
    },
  },
  {
    name: "desktop_stone",
    viewport: [1600, 900],
    state: {
      time: at(9, 12),
      tier: "stone",
      items: { crate: 3 },
      buildings: MIDGAME,
    },
  },
  {
    name: "desktop_metal",
    viewport: [1600, 900],
    state: {
      time: at(15, 12),
      tier: "metal",
      items: { crate: 4 },
      buildings: allAt(2),
    },
  },
  {
    name: "desktop_hqm_night",
    viewport: [1600, 900],
    state: {
      time: at(24, 22),
      tier: "hqm",
      items: { crate: 6 },
      buildings: allAt(3),
    },
  },
  {
    name: "desktop_building",
    viewport: [1600, 900],
    state: {
      time: at(5, 12),
      construction: [
        { target: { kind: "tier", tier: "stone" }, startedAt: at(5, 11), endsAt: at(5, 15) },
      ],
    },
  },
  {
    name: "desktop_panel_build",
    viewport: [1600, 900],
    state: { time: at(3, 11), panel: "build" },
  },
  {
    name: "desktop_panel_buildings",
    viewport: [1600, 900],
    state: { time: at(9, 11), tier: "stone", buildings: MIDGAME, panel: "build" },
    scrollTo: ".panel h3.section:nth-of-type(3)",
  },
  {
    name: "desktop_panel_craft",
    viewport: [1600, 900],
    state: { time: at(3, 11), panel: "craft" },
  },
  {
    name: "desktop_craft_busy",
    viewport: [1600, 900],
    state: {
      time: at(9, 11),
      tier: "stone",
      buildings: MIDGAME,
      stock: CRAFT_STOCK,
      production: BUSY(9),
      panel: "craft",
      station: "workbench",
    },
  },
  {
    name: "desktop_recipe_frames",
    viewport: [1600, 900],
    state: {
      time: at(9, 11),
      tier: "stone",
      buildings: MIDGAME,
      stock: CRAFT_STOCK,
      panel: "craft",
      recipe: "frames",
    },
  },
  {
    name: "desktop_panel_furnace",
    viewport: [1600, 900],
    state: {
      time: at(3, 11),
      panel: "furnace",
      furnaceJobs: [
        {
          input: "ore",
          output: "ingots",
          amount: 400,
          perHour: 120,
          startedAt: at(3, 9),
          collected: 0,
        },
      ],
    },
  },
  {
    name: "desktop_panel_inventory",
    viewport: [1600, 900],
    state: {
      time: at(9, 11),
      tier: "stone",
      buildings: MIDGAME,
      stock: CRAFT_STOCK,
      items: { crate: 3, bow: 1, roast: 2, stew: 1 },
      wellFed: { percent: 10, until: at(9, 13) },
      panel: "inventory",
    },
  },
  {
    name: "desktop_panel_squad",
    viewport: [1600, 900],
    state: { time: at(3, 11), panel: "squad" },
  },
  {
    name: "desktop_panel_tasks",
    viewport: [1600, 900],
    state: { time: at(3, 11), panel: "tasks" },
  },
  { name: "desktop_away", viewport: [1600, 900], state: { time: at(3, 11), welcome: true } },
  {
    name: "furnace_idle",
    viewport: [1920, 1080],
    state: { time: at(3, 11), furnaceJobs: [] },
    clip: [641, 540, 300, 260],
  },
  {
    name: "furnace_lit",
    viewport: [1920, 1080],
    state: {
      time: at(3, 11),
      furnaceJobs: [
        {
          input: "ore",
          output: "ingots",
          amount: 400,
          perHour: 120,
          startedAt: at(3, 10),
          collected: 0,
        },
      ],
    },
    clip: [641, 540, 300, 260],
  },
  {
    name: "furnace_night_hqm",
    viewport: [1920, 1080],
    state: {
      time: at(24, 22),
      tier: "hqm",
      items: { crate: 6 },
      buildings: allAt(3),
      furnaceJobs: [
        {
          input: "ore",
          output: "ingots",
          amount: 900,
          perHour: 1200,
          startedAt: at(24, 21.8),
          collected: 0,
        },
      ],
    },
    clip: [361, 500, 620, 320],
  },
  {
    name: "node_marker",
    viewport: [1920, 1080],
    state: { time: at(3, 11) },
    click: [651, 849],
    clip: [520, 694, 280, 220],
  },
  {
    name: "node_hits",
    viewport: [1920, 1080],
    state: { time: at(3, 22) },
    click: [651, 849],
    hits: 2,
    clip: [480, 614, 360, 300],
  },
  {
    name: "node_perfect",
    viewport: [1920, 1080],
    state: { time: at(3, 11) },
    click: [651, 849],
    hits: 5,
    clip: [480, 614, 360, 300],
  },
  {
    name: "ore_node",
    viewport: [1920, 1080],
    scale: 2,
    state: { time: at(3, 11) },
    clip: [570, 754, 190, 130],
  },
  {
    // Nodes hit but not worked out keep standing with cuts and cracks (D76).
    name: "worn_nodes",
    viewport: [1920, 1080],
    scale: 2,
    state: { time: at(3, 11), toolId: "stone_tools", wear: { ore_1: 3, tree_1: 4, stone_1: 2 } },
    clip: [540, 560, 480, 340],
  },
  {
    name: "barrel",
    viewport: [1920, 1080],
    scale: 2,
    state: { time: at(3, 11) },
    clip: [411, 735, 170, 170],
  },
  {
    name: "sulfur_node",
    viewport: [1920, 1080],
    scale: 2,
    state: { time: at(3, 11) },
    clip: [1358, 812, 190, 120],
  },
  {
    name: "stone_node",
    viewport: [1920, 1080],
    scale: 2,
    state: { time: at(3, 11) },
    clip: [1241, 780, 150, 100],
  },
  {
    name: "nodes_depleted",
    viewport: [1920, 1080],
    state: {
      time: at(3, 11),
      // Back at `until` (game seconds); how far each regrow pie is follows from the kind's respawn.
      depleted: {
        tree_1: at(3, 11) + 10,
        tree_2: at(3, 11) + 5,
        ore_1: at(3, 11) + 15,
        stone_1: at(3, 11) + 18,
        sulfur_1: at(3, 11) + 100,
      },
    },
    settle: 2500,
    clip: [500, 640, 1080, 300],
  },
  {
    name: "survivors",
    viewport: [1920, 1080],
    scale: 2,
    state: { time: at(3, 11) },
    clip: [921, 650, 260, 160],
  },
  {
    name: "buildings_level1",
    viewport: [1920, 1080],
    state: { time: at(9, 11), tier: "stone", items: { crate: 2 }, buildings: allAt(1) },
  },
  {
    name: "buildings_level3",
    viewport: [1920, 1080],
    state: { time: at(24, 11), tier: "hqm", items: { crate: 6 }, buildings: allAt(3) },
  },
  {
    name: "buildings_night",
    viewport: [1920, 1080],
    state: { time: at(24, 22), tier: "hqm", items: { crate: 6 }, buildings: allAt(3) },
  },
  {
    name: "buildings_construction",
    viewport: [1920, 1080],
    state: {
      time: at(9, 11),
      tier: "stone",
      buildings: MIDGAME,
      construction: [
        {
          target: { kind: "building", building: "warehouse", level: 2 },
          startedAt: at(9, 10),
          endsAt: at(9, 12),
        },
        {
          target: { kind: "building", building: "bunkhouse", level: 2 },
          startedAt: at(9, 10),
          endsAt: at(9, 13),
        },
      ],
    },
  },
  {
    name: "phone_buildings",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(9, 11), tier: "stone", items: { crate: 3 }, buildings: MIDGAME },
  },
  {
    name: "phone_buildings_full",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(24, 11), tier: "hqm", items: { crate: 6 }, buildings: allAt(3) },
  },
  {
    name: "desktop_ultrawide",
    viewport: [2560, 1080],
    state: { time: at(3, 11) },
  },
  { name: "laptop", viewport: [1366, 768], state: { time: at(3, 11) } },
  {
    name: "desktop_gains",
    viewport: [1920, 1080],
    state: { time: at(3, 11), lastGatherAt: 0 },
    act: "gather",
    clip: [801, 320, 500, 220],
  },
  { name: "phone_day", viewport: [390, 844], scale: 3, state: { time: at(3, 11) } },
  { name: "phone_night", viewport: [390, 844], scale: 3, state: { time: at(3, 23) } },
  {
    name: "phone_gains",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(3, 11), lastGatherAt: 0 },
    act: "gather",
    clip: [95, 330, 270, 140],
  },
  {
    name: "phone_panel_build",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(3, 11), panel: "build" },
  },
  {
    // Three stations at work, no panel: the rings over them and the kiln's smoke.
    name: "stations_busy",
    viewport: [1920, 1080],
    state: {
      time: at(9, 11),
      tier: "stone",
      buildings: MIDGAME,
      stock: CRAFT_STOCK,
      production: {
        ...BUSY(9),
        kiln: [
          { recipe: "charcoal", count: 6, done: 1, unitSeconds: 240, startedAt: at(9, 11) - 330 },
        ],
      },
    },
    clip: [760, 480, 900, 260],
  },
  {
    name: "stations_busy_night",
    viewport: [1920, 1080],
    state: {
      time: at(9, 22),
      tier: "stone",
      buildings: MIDGAME,
      stock: CRAFT_STOCK,
      production: {
        workbench: [
          { recipe: "planks", count: 20, done: 6, unitSeconds: 120, startedAt: at(9, 22) - 780 },
        ],
        kiln: [
          { recipe: "charcoal", count: 6, done: 1, unitSeconds: 240, startedAt: at(9, 22) - 330 },
        ],
      },
    },
  },
  {
    name: "phone_craft",
    viewport: [390, 844],
    scale: 3,
    state: {
      time: at(9, 11),
      tier: "stone",
      buildings: MIDGAME,
      stock: CRAFT_STOCK,
      production: BUSY(9),
      panel: "craft",
      station: "workbench",
    },
  },
  {
    // A new player's first look at the bow: planks in hand, rope still to make.
    name: "phone_recipe_bow",
    viewport: [390, 844],
    scale: 3,
    state: {
      time: at(2, 11),
      tier: "wood",
      buildings: { workbench: 1, campfire: 1, loom: 1 },
      stock: { timber: 900, stone: 400, fibre: 60, planks: 12 },
      panel: "craft",
      recipe: "bow",
    },
  },
  {
    name: "phone_recipe_bow_tree",
    viewport: [390, 844],
    scale: 3,
    state: {
      time: at(2, 11),
      tier: "wood",
      buildings: { workbench: 1, campfire: 1, loom: 1 },
      stock: { timber: 900, stone: 400, fibre: 60, planks: 12 },
      panel: "craft",
      recipe: "bow",
    },
    scrollTo: ".panel .needs",
  },
  {
    name: "phone_inventory",
    viewport: [390, 844],
    scale: 3,
    state: {
      time: at(9, 11),
      tier: "stone",
      buildings: MIDGAME,
      stock: CRAFT_STOCK,
      items: { crate: 3, bow: 1, roast: 2 },
      wellFed: { percent: 10, until: at(9, 13) },
      panel: "inventory",
    },
    scrollTo: ".panel h3.section",
  },
  {
    name: "phone_panel_buildings",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(9, 11), tier: "stone", buildings: MIDGAME, panel: "build" },
    scrollTo: ".panel h3.section:nth-of-type(3)",
  },
  {
    name: "phone_panel_buildings_busy",
    viewport: [390, 844],
    scale: 3,
    state: {
      time: at(9, 11),
      tier: "stone",
      buildings: MIDGAME,
      panel: "build",
      construction: [
        {
          target: { kind: "building", building: "warehouse", level: 2 },
          startedAt: at(9, 10),
          endsAt: at(9, 12),
        },
        {
          target: { kind: "building", building: "bunkhouse", level: 2 },
          startedAt: at(9, 10),
          endsAt: at(9, 13),
        },
      ],
    },
  },
  {
    name: "phone_away",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(3, 11), welcome: true },
  },
  { name: "phone_landscape", viewport: [844, 390], scale: 3, state: { time: at(3, 11) } },
  { name: "tablet", viewport: [820, 1180], scale: 2, state: { time: at(3, 11) } },
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
    await page.waitForFunction(() => window.__wipeDay?.store.getState().phase === "playing", null, {
      timeout: 20_000,
    });
    await page.evaluate((state) => {
      // The demo clock stops at the shot's moment. Upkeep, collection and the barrel are anchored
      // to that moment so jumping days ahead neither decays the base nor fills storage.
      const { store, clocks } = window.__wipeDay;
      const { time, panel, station, recipe, weather, welcome, ...base } = state;
      clocks.game.setPaused(true);
      if (time !== undefined) clocks.game.set(time);
      const now = Math.floor(clocks.game.nowMs() / 1000);
      const world = store.getState();
      world.demoPatch({
        upkeepPaidUntil: now,
        lastCollectedAt: now - 3600,
        lastGatherAt: now - 20 * 60,
        nextBarrelAt: now + 4 * 3600,
        barrel: { spawnedAt: now - 15 * 60, expiresAt: now + 30 * 60, seed: 42 },
        production: {},
        ...base,
      });
      world.tick();
      if (weather) world.setWeather(weather);
      store.setState({
        panel: panel ?? null,
        station: station ?? "workbench",
        recipe: recipe ?? null,
        demoOpen: false,
        toasts: [],
        welcomeBack: welcome ? { awaySeconds: 3 * 3600, events: [] } : null,
      });
    }, shot.state);
    if (shot.act || shot.click) {
      // Let the scene pick up the patch, fire the action, then catch the effect in flight:
      // at least 450 ms and 12 frames, so slow software rendering still gets past the pop.
      await page.waitForTimeout(400);
      if (shot.click) await page.mouse.click(shot.click[0], shot.click[1]);
      for (let hit = 0; hit < (shot.hits ?? 0); hit++) {
        await page.waitForTimeout(500);
        const point = await page.evaluate(() => window.__wipeDay.nodeMarker?.() ?? null);
        if (point) await page.mouse.click(point.x, point.y);
      }
      const frames = await page.evaluate((act) => {
        if (act) window.__wipeDay.store.getState()[act]();
        return window.__wipeDay.frames;
      }, shot.act ?? null);
      await page.waitForTimeout(450);
      await page.waitForFunction((target) => window.__wipeDay.frames >= target, frames + 12, {
        timeout: 20_000,
      });
      await page.evaluate(() => {
        window.__wipeDay.frozen = true;
      });
    } else {
      await page.waitForTimeout(shot.settle ?? 1600);
    }
    if (shot.scrollTo) {
      await page.evaluate((selector) => {
        document.querySelector(selector)?.scrollIntoView({ block: "start" });
      }, shot.scrollTo);
      await page.waitForTimeout(200);
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
