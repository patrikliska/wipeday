/**
 * Headless screenshot review for the web client (D44): loads the dev server in Chromium (demo
 * mode), puts the store into each state of `SHOTS`, and saves PNGs plus a contact sheet to
 * preview/web/. Usage: pnpm web:shots [--url http://localhost:5173/?demo] [--only name]
 *
 * The list per phase is docs/redesign/08-screens.md section 8. Each phone shot is audited: every
 * visible button and scene tap area at least 44 × 44 CSS px, the target's tap box at least
 * 120 px tall (N27), at most one crowned element; a failure is listed under the shot and makes
 * the run exit non-zero.
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
/**
 * Seconds on the demo's game clock: day `day` (from 1) at `hour` on the island's clock, which
 * runs at UTC+1 (errata E9).
 */
const at = (day, hour) => (day - 1) * DAY + (hour - 1) * 3600;
/** A fixed animation clock, so clouds and waves sit in the same place every run. */
const WALL = 1_791_400_000;

const DESKTOP = [1600, 900];
const LAPTOP = [1366, 768];
const TABLET = [820, 1180];
const PHONE = [390, 844];
const PHONE_LANDSCAPE = [844, 390];

/** Lines owned at about 10:30 of run 1 in the Stone era, with six hands (the P1 script). */
const STONE_RUN = {
  era: "stone",
  supplies: 31.2e6,
  made: 31.2e6,
  taps: 3200,
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
  target: { taps: 22, felled: 64 },
};

const ALL_LINES = [
  "beachcomber",
  "campfire",
  "garden",
  "loom",
  "workbench",
  "kiln",
  "furnace",
  "tannery",
  "press",
  "dock",
  "generator",
  "radio_mast",
  "shipbreaker",
  "reactor",
];
const every = (n) => Object.fromEntries(ALL_LINES.map((id) => [id, n]));

/**
 * Each shot: `viewport`, `scale` (device pixels), `state`, and optionally `clip`, `taps`, `ff`.
 * In `state`, `time` pins the game clock and `wall` the animation clock (both paused);
 * `weather` moves `time` by whole days until the island has that weather at that hour;
 * `demoOpen` opens the demo drawer; every other key overwrites that field of the run
 * (`RunState`). `taps: [rounds, perRound]` taps the target through the store, a sixth of a
 * second apart; `ff` plays that many seconds of scene time after the patch and the taps (60 fps
 * steps, deterministic), then the frame is frozen. `clip` also saves a 1:1 crop
 * `{name}__zoom.png` ([x, y, width, height] in CSS pixels). `press` holds a finger on the
 * target through the fast-forward (hold to work).
 */
const SHOTS = [
  {
    name: "phone_first_tap",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 6.6), wall: WALL, weather: "clear" },
  },
  {
    name: "phone_first_buy",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 8.5),
      wall: WALL,
      weather: "clear",
      supplies: 7,
      made: 31,
      taps: 31,
      target: { taps: 31, felled: 0 },
      lines: { beachcomber: 1 },
    },
    ff: 1.2,
  },
  {
    name: "phone_taps",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      supplies: 420,
      made: 980,
      taps: 130,
      target: { taps: 10, felled: 3 },
      lines: { beachcomber: 9, campfire: 2 },
      hustle: { value: 54, at: at(1, 9) },
    },
    taps: [6, 1],
    ff: 0.1,
    clip: [70, 140, 250, 300],
  },
  {
    name: "phone_hold",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      supplies: 420,
      made: 980,
      taps: 130,
      target: { taps: 10, felled: 3 },
      lines: { beachcomber: 9, campfire: 2 },
      hustle: { value: 30, at: at(1, 9) },
    },
    press: true,
    ff: 0.9,
    clip: [70, 140, 250, 300],
  },
  {
    name: "phone_fell",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      supplies: 820,
      made: 1400,
      taps: 159,
      target: { taps: 39, felled: 3 },
      lines: { beachcomber: 11, campfire: 4 },
      hustle: { value: 70, at: at(1, 9) },
    },
    taps: [1, 1],
    ff: 0.55,
    clip: [20, 120, 350, 330],
  },
  {
    name: "phone_timber_era",
    viewport: PHONE,
    scale: 2,
    before: { era: "twig", lines: { beachcomber: 12, campfire: 6, garden: 2 } },
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      era: "wood",
      eraAt: { wood: 36 },
      supplies: 40,
      made: 1700,
      taps: 210,
      target: { taps: 0, felled: 5 },
      lines: { beachcomber: 12, campfire: 6, garden: 2 },
    },
    ff: 0.4,
  },
  {
    name: "phone_hand_hired",
    viewport: PHONE,
    scale: 2,
    before: { era: "wood", lines: { beachcomber: 14, campfire: 8, garden: 3, loom: 1 } },
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      era: "wood",
      supplies: 80,
      made: 3900,
      taps: 250,
      lines: { beachcomber: 14, campfire: 8, garden: 3, loom: 1 },
      hands: ["beachcomber"],
    },
    ff: 1.0,
  },
  {
    name: "phone_stone_day",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN },
    ff: 3,
  },
  {
    name: "phone_stone_dusk",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 18.2), wall: WALL, weather: "clear", ...STONE_RUN },
    ff: 3,
  },
  {
    name: "phone_stone_night",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 23), wall: WALL, weather: "clear", ...STONE_RUN },
    ff: 3,
  },
  {
    name: "phone_stone_rain",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 12), wall: WALL, weather: "rain", ...STONE_RUN },
    ff: 3,
  },
  {
    name: "phone_stone_fog",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 9), wall: WALL, weather: "fog", ...STONE_RUN },
    ff: 3,
  },
  {
    name: "phone_lines_1",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 11),
      wall: WALL,
      weather: "clear",
      era: "hqm",
      lines: every(1),
      supplies: 1e15,
      made: 1e15,
    },
    ff: 1,
  },
  {
    name: "phone_lines_25",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 11),
      wall: WALL,
      weather: "clear",
      era: "hqm",
      lines: every(25),
      supplies: 1e15,
      made: 1e15,
    },
    ff: 1,
  },
  {
    name: "phone_lines_100",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 11),
      wall: WALL,
      weather: "clear",
      era: "hqm",
      lines: every(100),
      hands: ALL_LINES,
      supplies: 1e15,
      made: 1e15,
    },
    ff: 3,
  },
  {
    name: "phone_wreck",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 11),
      wall: WALL,
      weather: "clear",
      era: "hqm",
      lines: every(100),
      hands: ALL_LINES,
      target: { taps: 70, felled: 12 },
      supplies: 1e15,
      made: 1e15,
    },
    ff: 3,
    clip: [70, 160, 250, 260],
  },
  {
    name: "phone_metal_vent",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 11),
      wall: WALL,
      weather: "clear",
      era: "metal",
      lines: { ...every(30), shipbreaker: 0, reactor: 0 },
      hands: ALL_LINES.slice(0, 10),
      target: { taps: 60, felled: 40 },
      supplies: 1e12,
      made: 1e12,
    },
    ff: 3,
    clip: [70, 160, 250, 260],
  },
  {
    name: "desktop_day",
    viewport: DESKTOP,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN },
    ff: 3,
  },
  {
    name: "desktop_lines_100",
    viewport: DESKTOP,
    state: {
      time: at(1, 11),
      wall: WALL,
      weather: "clear",
      era: "hqm",
      lines: every(100),
      hands: ALL_LINES,
      supplies: 1e15,
      made: 1e15,
    },
    ff: 3,
  },
  {
    name: "desktop_night_metal",
    viewport: DESKTOP,
    state: {
      time: at(1, 23),
      wall: WALL,
      weather: "clear",
      era: "metal",
      lines: { ...every(30), shipbreaker: 0, reactor: 0 },
      hands: ALL_LINES.slice(0, 10),
      supplies: 1e12,
      made: 1e12,
    },
    ff: 3,
  },
  {
    name: "laptop",
    viewport: LAPTOP,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN },
    ff: 3,
  },
  {
    name: "tablet",
    viewport: TABLET,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN },
    ff: 3,
  },
  {
    name: "phone_landscape",
    viewport: PHONE_LANDSCAPE,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN },
    ff: 3,
  },
];

/** Moves `time` by whole days (same hour) until the island has `weather` then. */
async function pickTime(page, time, weather) {
  if (!weather) return time;
  return page.evaluate(
    ([t, want]) => {
      for (let day = 0; day < 400; day++) {
        const candidate = t + day * 86_400;
        // The whole next 15 minutes, so a shot's few seconds stay in the same weather.
        if (
          window.__wipeDay.weatherAt(candidate) === want &&
          window.__wipeDay.weatherAt(candidate + 900) === want
        )
          return candidate;
      }
      return t;
    },
    [time, weather],
  );
}

/** Visible buttons and scene tap areas under 44 px, the target's box, and crowns. */
async function audit(page, width) {
  return page.evaluate((viewportWidth) => {
    const problems = [];
    const phone = viewportWidth <= 430;
    const small = (box) => box.width < 44 || box.height < 44;
    if (phone) {
      for (const element of document.querySelectorAll("button, a, [role=button]")) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (rect.width === 0 || rect.height === 0 || style.visibility === "hidden") continue;
        if (small(rect)) {
          const label =
            element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.className;
          problems.push(
            `button "${label}" is ${Math.round(rect.width)}×${Math.round(rect.height)}`,
          );
        }
      }
      for (const box of window.__wipeDay.hitBoxes?.() ?? []) {
        if (small(box)) problems.push(`scene ${box.name} is ${box.width}×${box.height}`);
      }
    }
    const target = window.__wipeDay.target?.();
    if (target && target.height < 120)
      problems.push(`the target's box is ${target.height} px tall (N27: 120)`);
    const crowns = [...document.querySelectorAll(".primary, [data-crown]")].filter(
      (element) => element.getBoundingClientRect().width > 0,
    ).length;
    if (crowns > 1) problems.push(`${crowns} crowned elements (one per view)`);
    return problems;
  }, width);
}

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
    const { weather, ...state } = shot.state;
    state.time = await pickTime(page, state.time, weather);
    if (state.hustle) state.hustle = { ...state.hustle, at: state.time };
    await page.evaluate(
      ([state, before]) => {
        const { store, clocks } = window.__wipeDay;
        const { time, wall, demoOpen, ...run } = state;
        // Present now: the Night Shift runs and manned lines cycle.
        if (time !== undefined) run.activeAt ??= time;
        clocks.game.setPaused(true);
        if (time !== undefined) clocks.game.set(time);
        clocks.wall.setPaused(true);
        if (wall !== undefined) clocks.wall.set(wall);
        // `before`: the run as it stood a moment earlier, so the scene animates the change.
        if (before) {
          store.getState().demoPatch(before);
          window.__wipeDay.fastForward?.(0.1);
        }
        store.getState().demoPatch(run);
        store.setState({ demoOpen: demoOpen === true, toasts: [] });
      },
      [state, shot.before ?? null],
    );
    if (shot.taps) {
      const [rounds, perRound] = shot.taps;
      await page.evaluate(
        ([rounds, perRound]) => {
          const hook = window.__wipeDay;
          for (let round = 0; round < rounds; round++) {
            hook.tap(perRound);
            hook.fastForward(1 / 6);
          }
        },
        [rounds, perRound],
      );
    }
    if (shot.press) {
      // A finger held still on the target: hold to work.
      const box = await page.evaluate(() => window.__wipeDay.target());
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
      await page.mouse.down();
    }
    await page.evaluate((seconds) => {
      window.__wipeDay.fastForward?.(seconds);
      window.__wipeDay.frozen = true;
    }, shot.ff ?? 0.2);
    await page.waitForTimeout(400);
    if (shot.clip) {
      const [x, y, clipWidth, clipHeight] = shot.clip;
      await page.screenshot({
        path: path.join(outDir, `${shot.name}__zoom.png`),
        clip: { x, y, width: clipWidth, height: clipHeight },
      });
    }
    const file = path.join(outDir, `${shot.name}.png`);
    await page.screenshot({ path: file });
    const problems = await audit(page, width);
    done.push({ ...shot, file: `${shot.name}.png`, errors, problems });
    const notes = [
      errors.length ? `${errors.length} console errors` : "",
      problems.length ? `${problems.length} audit problems` : "",
    ]
      .filter(Boolean)
      .join(", ");
    process.stdout.write(`${shot.name}${notes ? ` (${notes})` : ""}\n`);
    await context.close();
  }
  await browser.close();

  const cards = done
    .map((shot) => {
      const zoom = shot.clip
        ? `<img src="${shot.name}__zoom.png" alt="${shot.name} zoom" loading="lazy">`
        : "";
      const problems = shot.problems.length
        ? `<ul class="audit">${shot.problems.map((p) => `<li>${p}</li>`).join("")}</ul>`
        : "";
      return `<figure><img src="${shot.file}" alt="${shot.name}" loading="lazy">${zoom}<figcaption>${shot.name} · ${shot.viewport.join("×")}${
        shot.errors.length ? ` · <b style="color:#f05252">${shot.errors.length} errors</b>` : ""
      }</figcaption>${problems}</figure>`;
    })
    .join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>Wipe Day web preview</title>
<style>body{margin:0;padding:24px;background:#1b1a18;color:#ece8df;font:14px/1.4 system-ui}h1{font-size:18px;margin:0 0 16px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:20px}figure{margin:0}img{width:100%;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.5);margin-bottom:6px}
figcaption{margin-top:6px;color:#a49e93}.audit{color:#f05252;margin:4px 0 0;padding-left:18px}</style><h1>Wipe Day web client · ${new Date().toISOString()}</h1><main>${cards}</main>`;
  await writeFile(path.join(outDir, "index.html"), html);
  for (const shot of done.filter((item) => item.errors.length > 0))
    process.stdout.write(`\n${shot.name}:\n  ${shot.errors.join("\n  ")}\n`);
  const failed = done.filter((item) => item.problems.length > 0);
  for (const shot of failed)
    process.stdout.write(`\n${shot.name} audit:\n  ${shot.problems.join("\n  ")}\n`);
  process.stdout.write(`\n${done.length} shots -> ${outDir}\n`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
