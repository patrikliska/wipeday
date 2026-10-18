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
/** Timber with the yard's kiln and the cabin's loom and workbench, hands on four lines. */
const TIMBER_YARD = {
  era: "wood",
  eraAt: { wood: 52 },
  runAge: 330,
  research: {
    sharper_hooks: 8,
    dry_kindling: 5,
    raised_beds: 3,
    spare_wicks: 2,
    calloused_thumbs: 3,
  },
  supplies: 2.4e4,
  made: 9.1e4,
  taps: 900,
  lines: { beachcomber: 25, campfire: 14, garden: 8, kiln: 1, loom: 6, workbench: 2 },
  hands: ["beachcomber", "campfire", "garden", "loom"],
  upgrades: ["stone_tools"],
  target: { taps: 10, felled: 20 },
};

const STONE_RUN = {
  era: "stone",
  runAge: 630,
  research: {
    sharper_hooks: 25,
    dry_kindling: 25,
    raised_beds: 22,
    spare_wicks: 6,
    calloused_thumbs: 10,
    camp_routine: 21,
    greased_axles: 14,
    banked_coals: 8,
    tally_sticks: 17,
    steady_rhythm: 5,
    tarred_twine: 14,
    sharp_chisels: 11,
    turf_lids: 9,
    oiled_pulleys: 8,
    tool_ledger: 9,
    timber_frames: 6,
    camp_kitchen: 5,
    hide_mitts: 4,
    crew_rations: 5,
    storm_shutters: 2,
    beachcomber_mk: 1,
    campfire_mk: 1,
    garden_mk: 1,
  },
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
  upgrades: ["stone_tools", "sorting_tables", "iron_tools"],
  roster: 0,
  target: { taps: 22, felled: 64 },
};

/** Timber four minutes in: the Workshop open two minutes, its first levels bought (D199). */
const WORKSHOP_TIMBER = {
  ...TIMBER_YARD,
  runAge: 250,
  supplies: 3.1e3,
  research: {
    sharper_hooks: 9,
    dry_kindling: 6,
    raised_beds: 2,
    spare_wicks: 1,
    calloused_thumbs: 4,
    camp_routine: 2,
    tally_sticks: 1,
  },
};

/** Later in the Stone era, saving for Loom Mk II (246M) at about 2.8M/s. */
const SAVING_RUN = {
  ...STONE_RUN,
  supplies: 283e3,
  made: 2.1e8,
  taps: 5200,
  lines: {
    beachcomber: 70,
    campfire: 65,
    garden: 65,
    loom: 59,
    workbench: 14,
    kiln: 18,
    furnace: 2,
  },
  hands: ["beachcomber", "campfire", "garden", "loom"],
  upgrades: ["stone_tools", "sorting_tables", "iron_tools", "salvaged_tools"],
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

/** Twig a few minutes in: the three Twig lines, one hand, the tree half worn. */
const TWIG_HERO = {
  supplies: 420,
  made: 980,
  taps: 130,
  target: { taps: 10, felled: 3 },
  lines: { beachcomber: 9, campfire: 2, garden: 1 },
  hands: [],
};

/** Twig, the Workshop just open (2:10): Mara on the Beachcombers, the tree half worn. */
const WORKSHOP_OPENS = {
  ...TWIG_HERO,
  runAge: 130,
  supplies: 95,
  made: 2600,
  lines: { beachcomber: 14, campfire: 4, garden: 1 },
  hands: ["beachcomber"],
};

/** Sheet Metal with every line to its Rain Catcher, radio mast and generator; ten hands. */
const METAL_RUN = {
  time: at(1, 11),
  wall: WALL,
  weather: "clear",
  era: "metal",
  lines: { ...every(30), shipbreaker: 0, reactor: 0 },
  hands: ALL_LINES.slice(0, 10),
  supplies: 1e12,
  made: 1e12,
};

/** Armored, every line at 100 and every hand. */
const HQM_RUN = {
  time: at(1, 11),
  wall: WALL,
  weather: "clear",
  era: "hqm",
  lines: every(100),
  hands: ALL_LINES,
  supplies: 1e15,
  made: 1e15,
};

/**
 * Each shot: `viewport`, `scale` (device pixels), `state`, and optionally `clip`, `taps`, `ff`.
 * In `state`, `time` pins the game clock and `wall` the animation clock (both paused);
 * `weather` moves `time` by whole days until the island has that weather at that hour;
 * `demoOpen` opens the demo drawer; `ui` sets the HUD (`expanded`, `tab`, `bulk`, `panel`,
 * `sheet`, `boughtOpen`, `scientific`); `pace` is the player's taps a second over the last
 * minute (default 6), which the crown weighs; every other key overwrites that field of the run
 * (`RunState`). `taps: [rounds, perRound]` taps the target through the store, a sixth of a
 * second apart; `ff` plays that many seconds of scene time after the patch and the taps (60 fps
 * steps, deterministic), then the frame is frozen. `clip` also saves a 1:1 crop
 * `{name}__zoom.png` ([x, y, width, height] in CSS pixels). `press` holds a finger on the
 * target through the fast-forward (hold to work). `send` sends a command through the store after
 * the patch (a refusal shows its toast); `scrollRows: "end"` scrolls the open shop list down and
 * `scroll` scrolls any element (a selector) to its end.
 *
 * Flotsam and away (R1 S4), in `state`: `runAge` starts the run that many seconds before `time`;
 * `flotsamAge` puts an arrival on the water that many seconds old (run 1's crate, or the first
 * of `flotsamKind` once one was caught); `away` moves the game clock on that many seconds after
 * the patch and shows the welcome-back card; `collect` presses its Collect.
 */
const PHONE_SHORT = [390, 664];

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
    name: "phone_bulk",
    viewport: PHONE,
    scale: 2,
    before: {
      era: "wood",
      lines: { beachcomber: 18, campfire: 11, garden: 5, loom: 2 },
      hands: ["beachcomber", "campfire"],
    },
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      era: "wood",
      supplies: 2.4e3,
      made: 9e3,
      taps: 420,
      lines: { beachcomber: 18, campfire: 11, garden: 5, loom: 2 },
      hands: ["beachcomber", "campfire"],
      upgrades: ["stone_tools"],
      ui: { bulk: 10 },
    },
    ff: 1,
  },
  {
    name: "phone_drawer_lines",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { expanded: true },
    },
    ff: 1,
  },
  {
    name: "phone_drawer_upgrades",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      lines: { ...STONE_RUN.lines, furnace: 12 },
      ui: { expanded: true, tab: "upgrades", boughtOpen: true },
    },
    ff: 1,
  },
  // Saving up (D177): Loom Mk II scores best but is 87 s away, so the crown waits on the tap
  // hint and the row leads the collapsed drawer unpainted; the expanded drawer crowns it.
  {
    name: "phone_saving",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...SAVING_RUN },
    ff: 1,
  },
  {
    name: "phone_saving_drawer",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...SAVING_RUN,
      ui: { expanded: true, tab: "upgrades" },
    },
    ff: 1,
  },
  {
    name: "phone_locked_rows",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      lines: { ...STONE_RUN.lines, furnace: 12 },
      ui: { expanded: true, bulk: "max" },
    },
    scrollRows: "end",
    ff: 1,
  },
  {
    name: "phone_refusal",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN, supplies: 31.2e3 },
    send: { type: "buy_era", era: "metal" },
    ff: 0.4,
  },
  {
    name: "phone_multipliers",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      roster: 1,
      buffs: [{ kind: "rally", until: at(1, 10.5) + 41 }],
      hustle: { value: 60, at: at(1, 10.5) },
      ui: { sheet: "multipliers" },
    },
    ff: 0.5,
  },
  {
    name: "phone_crew",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN, ui: { panel: "crew" } },
    ff: 0.5,
  },
  {
    name: "phone_settings",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { panel: "settings" },
    },
    ff: 0.5,
  },
  {
    name: "phone_numbers_dc",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 11),
      wall: WALL,
      weather: "clear",
      era: "metal",
      lines: { ...every(400), shipbreaker: 0, reactor: 0 },
      hands: ALL_LINES.slice(0, 12),
      supplies: 9.99e35,
      made: 9.99e35,
    },
    ff: 1,
  },
  {
    name: "phone_numbers_sci",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 11),
      wall: WALL,
      weather: "clear",
      era: "metal",
      lines: { ...every(400), shipbreaker: 0, reactor: 0 },
      hands: ALL_LINES.slice(0, 12),
      supplies: 1.234e36,
      made: 1.234e36,
      ui: { scientific: true, expanded: true },
    },
    ff: 1,
  },
  {
    name: "phone_short",
    viewport: PHONE_SHORT,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN },
    ff: 1,
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
    name: "phone_flotsam",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      era: "wood",
      supplies: 4.1e5,
      made: 5.6e5,
      taps: 1100,
      lines: { beachcomber: 25, campfire: 14, garden: 8, loom: 3, workbench: 1 },
      hands: ["beachcomber", "campfire", "garden"],
      upgrades: ["stone_tools"],
      target: { taps: 12, felled: 27 },
      runAge: 184,
      flotsamAge: 3,
    },
    clip: [0, 360, 390, 200],
    ff: 1,
  },
  {
    name: "phone_flotsam_caught",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      era: "wood",
      supplies: 4.1e5,
      made: 5.6e5,
      taps: 1100,
      lines: { beachcomber: 25, campfire: 14, garden: 8, loom: 3, workbench: 1 },
      hands: ["beachcomber", "campfire", "garden"],
      upgrades: ["stone_tools"],
      target: { taps: 12, felled: 27 },
      runAge: 186,
      flotsamAge: 6,
    },
    send: { type: "claim_flotsam", run: 1, k: 0 },
    clip: [0, 300, 390, 260],
    ff: 0.3,
  },
  {
    name: "phone_flotsam_rally",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      runAge: 1800,
      flotsamAge: 6,
      flotsamKind: "fuel_drum",
    },
    sendFlotsam: true,
    clip: [0, 0, 390, 520],
    ff: 0.4,
  },
  {
    name: "phone_flotsam_sank",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      era: "wood",
      supplies: 4.1e5,
      made: 5.6e5,
      taps: 1100,
      lines: { beachcomber: 25, campfire: 14, garden: 8, loom: 3, workbench: 1 },
      hands: ["beachcomber", "campfire", "garden"],
      upgrades: ["stone_tools"],
      target: { taps: 12, felled: 27 },
      runAge: 194,
      flotsamAge: 13.5,
    },
    clip: [0, 300, 390, 260],
    ff: 3,
  },
  {
    name: "phone_flotsam_night",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 23),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      runAge: 1800,
      flotsamAge: 9,
      flotsamKind: "fuel_drum",
    },
    clip: [0, 360, 390, 200],
    ff: 0.5,
  },
  {
    name: "phone_flotsam_fog",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "fog",
      ...STONE_RUN,
      runAge: 1800,
      flotsamAge: 5,
      flotsamKind: "adrenaline",
    },
    clip: [0, 360, 390, 200],
    ff: 0.5,
  },
  {
    name: "phone_flotsam_rain",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 12),
      wall: WALL,
      weather: "rain",
      ...STONE_RUN,
      runAge: 1800,
      flotsamAge: 5,
      flotsamKind: "crate",
    },
    clip: [0, 360, 390, 200],
    ff: 0.5,
  },
  {
    name: "phone_rally_cap",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      buffs: [
        { kind: "rally", until: at(1, 10.5) + 41 },
        { kind: "adrenaline", until: at(1, 10.5) + 9 },
      ],
      hustle: { value: 80, at: at(1, 10.5) },
    },
    taps: [10, 4],
    clip: [0, 0, 390, 470],
    ff: 0.2,
  },
  {
    name: "phone_odds",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      era: "wood",
      supplies: 4.1e5,
      made: 5.6e5,
      taps: 1100,
      lines: { beachcomber: 25, campfire: 14, garden: 8, loom: 3, workbench: 1 },
      hands: ["beachcomber", "campfire", "garden"],
      upgrades: ["stone_tools"],
      target: { taps: 12, felled: 27 },
      runAge: 120,
      ui: { sheet: "odds" },
    },
    ff: 0.5,
  },
  {
    name: "phone_settings_odds",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { panel: "settings" },
    },
    scroll: ".panel-sheet .panel-scroll",
    ff: 0.5,
  },
  {
    name: "phone_welcome_full",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 21.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      away: 2 * DAY + 3 * 3600,
    },
    ff: 0.5,
  },
  {
    name: "phone_welcome_short",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 23.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      away: 90 * 60,
    },
    ff: 0.5,
  },
  {
    name: "phone_welcome_nohands",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 6.5),
      wall: WALL,
      weather: "clear",
      supplies: 820,
      made: 2400,
      taps: 400,
      lines: { beachcomber: 9, campfire: 2 },
      target: { taps: 10, felled: 9 },
      away: 3 * 3600,
    },
    ff: 0.5,
  },
  {
    name: "phone_welcome_collected",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 21.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      away: 9 * 3600 + 40 * 60,
      collect: true,
    },
    ff: 0.35,
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
  // Big screens (the owner's 2k monitor, D208): the ground must never show a repeat.
  {
    name: "desktop_tall_rain",
    viewport: [1700, 1340],
    state: { time: at(1, 9), wall: WALL, weather: "rain" },
    ff: 0.5,
  },
  {
    name: "desktop_2k",
    viewport: [2560, 1440],
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...TIMBER_YARD },
    ff: 1.5,
  },
  // The house (D206): Timber's yard with the cabin and its hint, then the cabin open.
  {
    name: "phone_timber_yard",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 9), wall: WALL, weather: "clear", ...TIMBER_YARD },
    ff: 1.5,
  },
  {
    name: "phone_house_open",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 9), wall: WALL, weather: "clear", ...TIMBER_YARD, ui: { house: true } },
    ff: 1.5,
  },
  {
    name: "desktop_house_open",
    viewport: DESKTOP,
    state: { time: at(1, 9), wall: WALL, weather: "clear", ...TIMBER_YARD, ui: { house: true } },
    ff: 1.5,
  },
  {
    name: "desktop_flotsam",
    viewport: DESKTOP,
    state: {
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      era: "wood",
      supplies: 4.1e5,
      made: 5.6e5,
      taps: 1100,
      lines: { beachcomber: 25, campfire: 14, garden: 8, loom: 3, workbench: 1 },
      hands: ["beachcomber", "campfire", "garden"],
      upgrades: ["stone_tools"],
      target: { taps: 12, felled: 27 },
      runAge: 184,
      flotsamAge: 4,
    },
    ff: 1,
  },
  {
    name: "desktop_welcome",
    viewport: DESKTOP,
    state: {
      time: at(1, 21.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      away: 2 * DAY + 3 * 3600,
    },
    ff: 0.5,
  },
  {
    name: "desktop_first_tap",
    viewport: DESKTOP,
    state: { time: at(1, 6.6), wall: WALL, weather: "clear" },
  },
  {
    name: "desktop_upgrades",
    viewport: DESKTOP,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      lines: { ...STONE_RUN.lines, furnace: 12 },
      ui: { tab: "upgrades" },
    },
    ff: 1,
  },
  {
    name: "desktop_multipliers",
    viewport: DESKTOP,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { sheet: "multipliers" },
    },
    ff: 1,
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
  // R2 Feel S3: Stone to Armored in pixel art, the back row clear of the front, wear on the grid.
  {
    name: "s3_tree_wear",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10), wall: WALL, weather: "clear", target: { taps: 36, felled: 2 } },
    ff: 0.5,
    clip: [70, 260, 250, 260],
  },
  {
    name: "s3_stone_wear",
    viewport: DESKTOP,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...TIMBER_YARD,
      target: { taps: 46, felled: 20 },
    },
    ff: 1.5,
  },
  {
    name: "s3_ore",
    viewport: DESKTOP,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      target: { taps: 70, felled: 64 },
    },
    ff: 3,
  },
  {
    name: "s3_metal",
    viewport: DESKTOP,
    state: { ...METAL_RUN, time: at(1, 10.5), target: { taps: 85, felled: 40 } },
    ff: 3,
  },
  {
    name: "s3_metal_phone",
    viewport: PHONE,
    scale: 2,
    state: { ...METAL_RUN, time: at(1, 10.5), target: { taps: 85, felled: 40 } },
    ff: 3,
  },
  {
    name: "s3_hqm",
    viewport: DESKTOP,
    state: { ...HQM_RUN, target: { taps: 100, felled: 12 } },
    ff: 3,
  },
  {
    name: "s3_hqm_phone",
    viewport: PHONE,
    scale: 2,
    state: { ...HQM_RUN, target: { taps: 100, felled: 12 } },
    ff: 3,
  },
  {
    name: "s3_hqm_2k",
    viewport: [2560, 1440],
    state: { ...HQM_RUN, weather: "rain" },
    ff: 3,
  },
  {
    name: "s3_hqm_night",
    viewport: DESKTOP,
    state: { ...HQM_RUN, time: at(1, 23) },
    ff: 3,
  },
  {
    name: "s3_house_stone",
    viewport: DESKTOP,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN, ui: { house: true } },
    ff: 3,
  },
  {
    name: "s3_house_stone_phone",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN, ui: { house: true } },
    ff: 3,
  },
  {
    name: "s3_house_metal",
    viewport: DESKTOP,
    state: { ...METAL_RUN, time: at(1, 10.5), ui: { house: true } },
    ff: 3,
  },
  {
    name: "s3_house_hqm_phone",
    viewport: PHONE,
    scale: 2,
    state: { ...HQM_RUN, ui: { house: true } },
    ff: 3,
  },
  // R2 Feel S3, the hero tap (D217): chips arc onto the stockpile at 6 taps a second; a full
  // pile sells its top piece; a fell lands three pieces and shakes; each era's chips.
  {
    name: "s3_hero_phone",
    viewport: PHONE,
    scale: 2,
    state: {
      ...TWIG_HERO,
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
    },
    taps: [7, 1],
    ff: 0.12,
    clip: [60, 280, 300, 190],
  },
  {
    name: "s3_hero_full",
    viewport: DESKTOP,
    state: { ...TWIG_HERO, time: at(1, 9.5), wall: WALL, weather: "clear" },
    taps: [16, 1],
    ff: 0.3,
    clip: [300, 420, 520, 300],
  },
  {
    name: "s3_hero_fell",
    viewport: PHONE,
    scale: 2,
    state: {
      ...TWIG_HERO,
      time: at(1, 9),
      wall: WALL,
      weather: "clear",
      target: { taps: 39, felled: 3 },
    },
    taps: [4, 1],
    ff: 0.2,
    clip: [60, 280, 300, 190],
  },
  {
    name: "s3_hero_stone",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...TIMBER_YARD },
    taps: [9, 1],
    ff: 0.4,
    clip: [60, 280, 300, 190],
  },
  {
    name: "s3_hero_ore",
    viewport: DESKTOP,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN },
    taps: [8, 1],
    ff: 0.4,
  },
  {
    name: "s3_hero_sulfur_phone",
    viewport: PHONE,
    scale: 2,
    state: { ...METAL_RUN, target: { taps: 4, felled: 80 } },
    taps: [10, 1],
    ff: 0.4,
  },
  {
    name: "s3_hero_hqm_phone",
    viewport: PHONE,
    scale: 2,
    state: { ...HQM_RUN, target: { taps: 4, felled: 120 } },
    taps: [10, 1],
    ff: 0.4,
  },
  {
    name: "s3_clouds_dusk_phone",
    viewport: PHONE,
    scale: 2,
    state: { ...TWIG_HERO, time: at(1, 19), wall: WALL, weather: "clear" },
    ff: 0.2,
  },
  {
    name: "s3_clouds_rain",
    viewport: DESKTOP,
    state: { ...TWIG_HERO, time: at(1, 12), wall: WALL, weather: "rain" },
    ff: 0.2,
  },
  // R2 Feel S4, the HUD (12-feel.md 13): the Feel Board's views, the dock, sheets, the cards in
  // fixed order with the crown in place and the Best buy chip, the lamp, the ticker.
  ...["day", "dusk", "night", "rain"].map((sky) => ({
    name: sky === "day" ? "s4_desktop_hero" : `s4_desktop_hero_${sky}`,
    viewport: [1440, 810],
    state: {
      time: at(1, sky === "dusk" ? 19.2 : sky === "night" ? 23 : 10.5),
      wall: WALL,
      weather: sky === "rain" ? "rain" : "clear",
      ...TIMBER_YARD,
    },
    ff: 2.5,
  })),
  ...["day", "dusk", "night", "rain"].map((sky) => ({
    name: sky === "day" ? "s4_phone_hero" : `s4_phone_hero_${sky}`,
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, sky === "dusk" ? 19.2 : sky === "night" ? 23 : 10.5),
      wall: WALL,
      weather: sky === "rain" ? "rain" : "clear",
      ...TIMBER_YARD,
    },
    ff: 2.5,
  })),
  {
    name: "s4_phone_first_minute",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      supplies: 12,
      made: 60,
      taps: 60,
      target: { taps: 60, felled: 1 },
      lines: { beachcomber: 2 },
    },
    ff: 2.5,
  },
  {
    name: "s4_phone_hire",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      era: "wood",
      eraAt: { wood: 36 },
      supplies: 2600,
      made: 4200,
      taps: 380,
      target: { taps: 4, felled: 9 },
      lines: { beachcomber: 12, campfire: 2 },
    },
    ff: 2.5,
  },
  {
    name: "s4_desktop_hire",
    viewport: [1440, 810],
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      era: "wood",
      eraAt: { wood: 36 },
      supplies: 2600,
      made: 4200,
      taps: 380,
      target: { taps: 4, felled: 9 },
      lines: { beachcomber: 12, campfire: 2 },
    },
    ff: 2.5,
  },
  {
    name: "s4_phone_drawer_cards",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { expanded: true },
    },
    ff: 2.5,
  },
  {
    name: "s4_phone_drawer_shelf",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { expanded: true, tab: "upgrades" },
    },
    ff: 2.5,
  },
  {
    name: "s4_phone_stone",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN },
    ff: 2.5,
  },
  {
    name: "s4_desktop_stone",
    viewport: [1440, 810],
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN },
    ff: 2.5,
  },
  // The crown out of sight: the chip shows; pressed, the list scrolls to the card and pulses it.
  {
    name: "s4_desktop_best_buy",
    viewport: [1440, 810],
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      lines: { ...STONE_RUN.lines, tannery: 3, press: 1 },
      hands: [...STONE_RUN.hands, "furnace"],
    },
    scrollRows: "end",
    ff: 2.5,
  },
  {
    name: "s4_desktop_best_buy_pressed",
    viewport: [1440, 810],
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      lines: { ...STONE_RUN.lines, tannery: 3, press: 1 },
      hands: [...STONE_RUN.hands, "furnace"],
    },
    scrollRows: "end",
    click: ".best-buy",
    ff: 0.3,
  },
  // Three purchases in a row: the cards keep their order (D186); the harness checks it.
  {
    name: "s4_phone_order_kept",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { expanded: true },
    },
    orderSends: [
      { type: "buy_line", line: "kiln", count: 1 },
      { type: "buy_line", line: "beachcomber", count: 1 },
      { type: "buy_line", line: "furnace", count: 1 },
    ],
    ff: 2.5,
  },
  {
    name: "s4_phone_dock_badges",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...TIMBER_YARD, crewNew: 2 },
    ff: 2.5,
  },
  {
    name: "s4_desktop_sheet_crew",
    viewport: [1440, 810],
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN, ui: { panel: "crew" } },
    ff: 2.5,
  },
  {
    name: "s4_phone_sheet_crew",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN, ui: { panel: "crew" } },
    ff: 2.5,
  },
  {
    name: "s4_desktop_sheet_settings",
    viewport: [1440, 810],
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { panel: "settings" },
    },
    ff: 2.5,
  },
  ...["day", "night"].map((sky) => ({
    name: sky === "day" ? "s4_welcome_back_lamp" : "s4_welcome_back_lamp_night",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, sky === "night" ? 22 : 13),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      away: 13 * 3600,
    },
    ff: 2.5,
  })),
  {
    name: "s4_welcome_back_lamp_left",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 15), wall: WALL, weather: "clear", ...STONE_RUN, away: 90 * 60 },
    ff: 2.5,
  },
  {
    name: "s4_ticker",
    viewport: [1440, 810],
    state: { time: at(1, 10.5), wall: WALL, weather: "rain", ...TIMBER_YARD },
    ff: 2.5,
    clip: [300, 690, 760, 120],
  },
  {
    name: "s4_phone_numbers_big",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...HQM_RUN,
      supplies: 9.99e35,
      made: 9.99e35,
    },
    ff: 2.5,
  },
  {
    name: "s4_phone_short",
    viewport: PHONE_SHORT,
    scale: 2,
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN },
    ff: 2.5,
  },
  // R2 Feel S6, the Workshop and the 2 h Night Shift (08-screens.md 8.3): the column's and the
  // drawer's Workshop tab, the dock's place when it opens, the hint, a level caught mid-flash,
  // three levels bought in a row with the tiles in place, the welcome card at 2 h and 4 h.
  ...["day", "night"].flatMap((sky) => [
    {
      name: `s6_desktop_research${sky === "night" ? "_night" : ""}`,
      viewport: [1440, 810],
      state: {
        time: at(1, sky === "night" ? 22.5 : 10.5),
        wall: WALL,
        weather: "clear",
        ...WORKSHOP_TIMBER,
        ui: { tab: "research" },
      },
      ff: 2.5,
    },
    {
      name: `s6_phone_research${sky === "night" ? "_night" : ""}`,
      viewport: PHONE,
      scale: 2,
      state: {
        time: at(1, sky === "night" ? 22.5 : 10.5),
        wall: WALL,
        weather: "clear",
        ...WORKSHOP_TIMBER,
        ui: { expanded: true, tab: "research" },
      },
      ff: 2.5,
    },
  ]),
  {
    name: "s6_phone_workshop_opens",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...WORKSHOP_OPENS,
      workshopNew: true,
    },
    ff: 2.5,
  },
  {
    name: "s6_desktop_workshop_opens",
    viewport: [1440, 810],
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...WORKSHOP_OPENS,
      workshopNew: true,
      ui: { tab: "research" },
    },
    ff: 2.5,
  },
  {
    name: "s6_phone_research_first",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...WORKSHOP_OPENS,
      ui: { expanded: true, tab: "research" },
    },
    ff: 2.5,
  },
  {
    name: "s6_desktop_research_stone",
    viewport: [1440, 810],
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "rain",
      ...STONE_RUN,
      ui: { tab: "research" },
    },
    scrollRows: "end",
    ff: 2.5,
  },
  {
    name: "s6_phone_research_big",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...HQM_RUN,
      runAge: 5400,
      supplies: 9.99e35,
      made: 9.99e35,
      ui: { expanded: true, tab: "research" },
    },
    scrollRows: "end",
    ff: 2.5,
  },
  {
    name: "s6_desktop_research_flash",
    viewport: [1440, 810],
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...WORKSHOP_TIMBER,
      ui: { tab: "research" },
    },
    juice: [{ type: "buy_research", item: "sharper_hooks", count: 1 }],
    ff: 2.5,
  },
  {
    name: "s6_phone_research_flash",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...WORKSHOP_TIMBER,
      ui: { expanded: true, tab: "research" },
    },
    juice: [{ type: "buy_research", item: "spare_wicks", count: 1 }],
    ff: 2.5,
  },
  {
    name: "s6_desktop_research_order",
    viewport: [1440, 810],
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...WORKSHOP_TIMBER,
      supplies: 5e5,
      ui: { tab: "research" },
    },
    orderSends: [
      { type: "buy_research", item: "dry_kindling", count: "max" },
      { type: "buy_research", item: "spare_wicks", count: 1 },
      { type: "buy_research", item: "tarred_twine", count: 1 },
    ],
    ff: 2.5,
  },
  {
    name: "s6_welcome_lamp_2h",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 13),
      wall: WALL,
      weather: "clear",
      ...TIMBER_YARD,
      research: {},
      away: 3 * 3600,
    },
    ff: 2.5,
  },
  {
    name: "s6_welcome_lamp_4h_left",
    viewport: PHONE,
    scale: 2,
    state: { time: at(1, 13), wall: WALL, weather: "clear", ...STONE_RUN, away: 90 * 60 },
    ff: 2.5,
  },
  // R2 Feel S5, sound and juice (12-feel.md 3.2): a purchase caught mid-flash (the card's gold
  // flash and level pop, the line's flash and pop), Collect's coins in the air, the tap's gain
  // with its icon, the credits sheet.
  {
    name: "s5_desktop_buy_flash",
    viewport: [1440, 810],
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...STONE_RUN },
    juice: [
      { type: "buy_line", line: "campfire", count: 1 },
      { type: "buy_line", line: "beachcomber", count: 1 },
    ],
    ff: 2.5,
  },
  {
    name: "s5_phone_buy_flash",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { expanded: true },
    },
    juice: [{ type: "buy_line", line: "beachcomber", count: 1 }],
    ff: 2.5,
  },
  {
    name: "s5_desktop_mk_flash",
    viewport: [1440, 810],
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      supplies: 7e8,
      ui: { tab: "research" },
    },
    juice: [{ type: "buy_research", item: "beachcomber_mk", count: 1 }],
    ff: 2.5,
  },
  {
    name: "s5_desktop_tap_gain",
    viewport: [1440, 810],
    state: { time: at(1, 10.5), wall: WALL, weather: "clear", ...TIMBER_YARD },
    taps: [6, 2],
    ff: 0.15,
  },
  {
    name: "s5_phone_collect_coins",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 13),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      away: 5 * 3600,
      collect: true,
    },
    ff: 0.42,
  },
  {
    name: "s5_desktop_credits",
    viewport: [1440, 810],
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { sheet: "credits" },
    },
    ff: 2.5,
  },
  {
    name: "s5_phone_credits",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { sheet: "credits" },
    },
    ff: 2.5,
  },
  {
    name: "s5_phone_settings_end",
    viewport: PHONE,
    scale: 2,
    state: {
      time: at(1, 10.5),
      wall: WALL,
      weather: "clear",
      ...STONE_RUN,
      ui: { panel: "settings" },
    },
    scroll: ".panel-scroll",
    ff: 2.5,
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
    // A view is what is not inert: a sheet makes the rest of the HUD inert (6.3 rule 1).
    const crowns = [...document.querySelectorAll(".primary, [data-crown]")].filter(
      (element) => element.getBoundingClientRect().width > 0 && !element.closest("[inert]"),
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
    // Entrance slides and fades would be caught half-way: shots show the settled layout.
    await page.addStyleTag({
      content:
        ".drawer, .column, .dock, .sheet, .sheet-backdrop, .toast, .ticker-line, .best-buy { animation: none !important; transition: none !important; }",
    });
    await page.waitForFunction(() => (window.__wipeDay?.frames ?? 0) > 5, null, {
      timeout: 20_000,
    });
    await page.waitForFunction(() => window.__wipeDay?.store.getState().phase === "playing", null, {
      timeout: 20_000,
    });
    const { weather, ...state } = shot.state;
    const asked = state.time;
    state.time = await pickTime(page, state.time, weather);
    if (state.hustle) state.hustle = { ...state.hustle, at: state.time };
    // A weather pick moves whole days: running buffs move with it.
    if (state.buffs)
      state.buffs = state.buffs.map((buff) => ({
        ...buff,
        until: buff.until + state.time - asked,
      }));
    await page.evaluate(
      ([state, before]) => {
        const { store, clocks, ui: uiStore } = window.__wipeDay;
        const {
          time,
          wall,
          demoOpen,
          ui,
          pace,
          runAge,
          flotsamAge,
          flotsamKind,
          away,
          collect,
          crewNew,
          workshopNew,
          ...run
        } = state;
        if (runAge !== undefined) run.startedAt = time - runAge;
        // Present now: the Night Shift runs and manned lines cycle.
        if (time !== undefined) run.activeAt ??= time;
        // ...and nothing made before the patch counts as made while away.
        if (run.made !== undefined) run.madeAtActive ??= run.made;
        clocks.game.setPaused(true);
        if (time !== undefined) clocks.game.set(time);
        clocks.wall.setPaused(true);
        if (wall !== undefined) clocks.wall.set(wall);
        // The player taps 6 a second unless the shot says (the crown weighs taps by it); set
        // before the patch, which is what makes the crown look again.
        window.__wipeDay.pace(pace ?? 6);
        // `before`: the run as it stood a moment earlier, so the scene animates the change.
        if (before) {
          store.getState().demoPatch(before);
          window.__wipeDay.fastForward?.(0.1);
        }
        store.getState().demoPatch(run);
        if (flotsamAge !== undefined) {
          // An arrival on the water: run 1's guaranteed crate, or the first of a kind after it.
          const k = flotsamKind ? window.__wipeDay.flotsamK(flotsamKind) : 0;
          store.getState().demoPatch({
            flotsam: { k, at: time - flotsamAge, caught: flotsamKind ? 1 : 0, last: k - 1 },
          });
        }
        store.setState({ demoOpen: demoOpen === true, toasts: [] });
        // The HUD: collapsed drawer on the Lines tab at ×1, nothing open, unless the shot says.
        uiStore.setState({
          expanded: false,
          tab: "lines",
          bulk: 1,
          panel: null,
          sheet: null,
          boughtOpen: false,
          house: false,
          scientific: false,
          motion: "device",
          crownInView: true,
          focusAt: 0,
          ...ui,
        });
        // The Crew badge counts hands hired since the sheet last showed them: none new, unless
        // the shot says how many.
        const after = store.getState().base.run;
        uiStore.setState({
          crewSeen: {
            run: after.n,
            hands: Math.max(0, after.hands.length - (crewNew ?? 0)),
          },
          // The Workshop's badge: every open item seen, or none when the shot says it just opened.
          workshopSeen: { run: after.n, items: workshopNew ? 0 : 999 },
        });
        if (away) {
          clocks.game.set(time + away);
          store.getState().checkAway();
          if (collect) store.getState().collect();
        }
      },
      [state, shot.before ?? null],
    );
    if (shot.sendFlotsam) {
      // Catches what floats now (its run and index), as a tap on it would.
      await page.evaluate(() => {
        const hook = window.__wipeDay;
        hook.fastForward?.(1 / 60);
        const run = hook.store.getState().base.run;
        hook.store.getState().send({ type: "claim_flotsam", run: run.n, k: run.flotsam.k });
      });
    }
    if (shot.send) {
      // A command through the store, as a button would send it (a refusal shows its toast),
      // after one frame, so the scene has drawn what the command touches (flotsam).
      await page.evaluate((command) => {
        window.__wipeDay.fastForward?.(1 / 60);
        window.__wipeDay.store.getState().send(command);
      }, shot.send);
    }
    const extra = [];
    if (shot.orderSends) {
      // Purchases one after another: the shop's cards must keep their order (D186).
      const order = () =>
        page.evaluate(() =>
          [...document.querySelectorAll(".card, .tile")].map((card) => card.dataset.key).join(" "),
        );
      await page.waitForTimeout(150);
      const before = await order();
      for (const command of shot.orderSends) {
        await page.evaluate((command) => {
          window.__wipeDay.fastForward?.(1 / 60);
          window.__wipeDay.store.getState().send(command);
        }, command);
        await page.waitForTimeout(150);
        const now = await order();
        if (now !== before)
          extra.push(`the cards moved after ${command.type} ${command.line ?? ""}: ${now}`);
      }
    }
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
    if (shot.scroll) {
      await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) element.scrollTop = element.scrollHeight;
      }, shot.scroll);
      await page.waitForTimeout(100);
    }
    if (shot.scrollRows === "end") {
      await page.evaluate(() => {
        const list = document.querySelector(".cards");
        if (list) list.scrollTop = list.scrollHeight;
      });
      await page.waitForTimeout(100);
    }
    if (shot.click) {
      // After any scroll: the Best buy chip shows once its card is out of sight.
      await page.waitForTimeout(250);
      await page.click(shot.click);
      await page.waitForTimeout(900);
    }
    if (shot.juice) {
      // Purchases on the settled view, caught mid-flash: the scene steps 60 ms, the cards' CSS
      // runs in real time for about as long.
      await page.evaluate((commands) => {
        const hook = window.__wipeDay;
        for (const command of commands) hook.store.getState().send(command);
        hook.fastForward?.(0.06);
      }, shot.juice);
      await page.waitForTimeout(shot.juiceMs ?? 60);
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
    const problems = [...extra, ...(await audit(page, width))];
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
