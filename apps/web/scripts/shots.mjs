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
  "traps",
  "turret",
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
/** A rested shift from the start of `day` (W4b): tired by the evening. */
const SHIFT = (day, tiredHour = 16) => ({
  since: at(day, 0),
  tiredAt: at(day, tiredHour),
  sleepUntil: null,
});
/** The crew a week in: levels, gear, one hurt, two out on missions. */
const CREW = (day) => [
  {
    id: "mara",
    job: null,
    shift: SHIFT(day),
    level: 3,
    xp: 300,
    gear: { weapon: "bow", armor: null },
    injuredUntil: null,
    away: "m7",
  },
  {
    id: "dax",
    job: null,
    shift: SHIFT(day),
    level: 2,
    xp: 180,
    gear: { weapon: null, armor: "leather_vest" },
    injuredUntil: null,
    away: "m7",
  },
  {
    id: "ivo",
    job: null,
    shift: SHIFT(day),
    level: 2,
    xp: 140,
    gear: { weapon: null, armor: null },
    injuredUntil: at(day, 13),
    away: null,
  },
  {
    id: "rook",
    job: { kind: "node", node: "tree" },
    shift: SHIFT(day),
    level: 1,
    xp: 40,
    gear: { weapon: "spear", armor: null },
    injuredUntil: null,
    away: null,
  },
  {
    id: "sela",
    job: { kind: "guard" },
    shift: SHIFT(day),
    level: 1,
    xp: 0,
    gear: { weapon: null, armor: null },
    injuredUntil: null,
    away: null,
  },
];
const KNOWN = ["landing", "tidal_flats", "pine_ridge", "ferry_point", "quarry_hills"];
/** Seven at work late in the season: nodes, two stations, a guard, one asleep, one tired. */
const WORK_CREW = (day, hour = 11) =>
  [
    ["mara", { kind: "node", node: "tree" }, SHIFT(day)],
    ["dax", { kind: "node", node: "stone" }, SHIFT(day)],
    ["ivo", { kind: "guard" }, SHIFT(day)],
    ["rook", { kind: "node", node: "ore" }, SHIFT(day - 1, 9)],
    ["bram", { kind: "station", station: "campfire" }, SHIFT(day)],
    ["otto", { kind: "station", station: "workbench" }, SHIFT(day - 1, 10)],
    [
      "sela",
      { kind: "node", node: "fibre" },
      { since: at(day, hour + 5), tiredAt: at(day, hour + 21), sleepUntil: at(day, hour + 5) },
    ],
  ].map(([id, job, shift], index) => ({
    id,
    level: 2 + (index % 3),
    xp: 200 + index * 40,
    gear: { weapon: index < 2 ? "bow" : null, armor: null },
    injuredUntil: null,
    away: null,
    job,
    shift,
  }));
const ALL_LAND = [
  "landing",
  "tidal_flats",
  "pine_ridge",
  "ferry_point",
  "rust_bay",
  "quarry_hills",
  "stormcap",
  "sulfur_springs",
  "signal_hill",
];
/** A few hours of the island's feed: two friends and the player ("Survivor", id 0). */
const FEED = (day) =>
  [
    [
      0,
      "Survivor",
      {
        type: "mission_back",
        mission: "m40",
        kind: "trip",
        target: "weather_station",
        outcome: "success",
        crew: ["mara"],
        gained: {},
        at: 0,
      },
    ],
    [7, "Nia", { type: "item_found", item: "brass_keycode", from: "power_station", at: 0 }],
    [
      7,
      "Nia",
      {
        type: "mission_back",
        mission: "m31",
        kind: "trip",
        target: "power_station",
        outcome: "partial",
        crew: ["dax"],
        gained: {},
        at: 0,
      },
    ],
    [9, "Tomas the Unusually Long-Named Builder", { type: "build_done", tier: "hqm" }],
    [7, "Nia", { type: "survivor_arrived", survivor: "hale", at: 0, from: "rescue" }],
    [0, "Survivor", { type: "level_up", survivor: "dax", level: 5, at: 0 }],
    [
      9,
      "Tomas the Unusually Long-Named Builder",
      { type: "blueprint_found", recipe: "crossbow", from: "site" },
    ],
  ].map(([playerId, playerName, event], index) => ({
    id: 900 - index,
    at: at(day, 10.8) - index * 2400,
    playerId,
    playerName,
    event,
  }));
/** Late season: Sheet Metal, a radio mast and a dock, the north and the narrows charted. */
const LATE_MAP = (day) => ({
  time: at(day, 11),
  tier: "metal",
  buildings: { ...MIDGAME, radio_mast: 1, dock: 2, bunkhouse: 3 },
  stock: { ...CRAFT_STOCK, food: 2400, fuel: 180, scrap: 900 },
  crew: WORK_CREW(day),
  known: [...ALL_LAND, "rail_yards", "north_dam", "the_narrows"],
  missions: [],
  items: { bandage: 2, copper_keycode: 1, brass_keycode: 1 },
  bonds: { "dax+mara": 4 },
});
const MISSIONS = (day) => [
  {
    id: "m7",
    kind: "trip",
    target: "quarry",
    crew: ["mara", "dax"],
    startedAt: at(day, 10),
    endsAt: at(day, 12.5),
    seed: 7,
    odds: {
      success: 78,
      partial: 89,
      injury: [11, 8],
      minutes: 150,
      rolls: 3,
      loot: 20,
      blueprint: 5,
      fragment: 12,
    },
  },
];
const REPORT = (day, outcome) => ({
  id: "m6",
  kind: "trip",
  target: "beach_wreck",
  outcome,
  crew: ["rook", "sela"],
  gained: outcome === "fail" ? {} : { scrap: 11, rope: 7, food: 18 },
  injured: outcome === "fail" ? [{ id: "rook", until: at(day, 13) }] : [],
  xp: outcome === "fail" ? 5 : 20,
  levelUps: outcome === "success" ? ["sela"] : [],
  revealed: outcome === "success" ? ["rust_bay"] : [],
  blueprint: null,
  at: at(day, 10.5),
  read: false,
});
const MAP_STATE = (day) => ({
  time: at(day, 11),
  tier: "stone",
  buildings: MIDGAME,
  stock: CRAFT_STOCK,
  crew: CREW(day),
  known: KNOWN,
  missions: MISSIONS(day),
  items: { bandage: 2, crate: 2 },
});
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
/**
 * A Stone holdfast on day 9 with the Den open (W5): scrap and goods to trade, today's
 * counter and contracts (one deliverable), one listing up. `extra` overrides any field.
 */
const DEN = (extra = {}) => ({
  time: at(9, 11),
  tier: "stone",
  buildings: MIDGAME,
  stock: { ...CRAFT_STOCK, scrap: 640, fibre: 900, rope: 140 },
  items: { crate: 3, bow: 2, tin_keycode: 1 },
  den: {
    day: 9,
    tier: "stone",
    offers: ["planks_lot", "rope_lot", "leather_lot", "stew_lot", "blueprint_lot"],
    bought: { rope_lot: 1 },
  },
  contracts: {
    day: 9,
    tier: "stone",
    ids: ["net_fibre", "jetty_timber", "rigging_rope"],
    done: [],
  },
  listings: [
    { id: "l1", good: "cloth", amount: 60, price: 18, listedAt: at(9, 8), expiresAt: at(11, 8) },
  ],
  listingSeq: 1,
  casino: { day: 9, wagered: 20, won: 22 },
  panel: "den",
  ...extra,
});

// --- raids (W6) ------------------------------------------------------------------------
/** A Stone holdfast with walls, a watchtower and traps, raiders landing at 21:30 on day 9. */
const RAID = (extra = {}) => ({
  time: at(9, 15),
  tier: "stone",
  buildings: { ...MIDGAME, watchtower: 1, traps: 1 },
  stock: { ...CRAFT_STOCK, timber: 9200, stone: 8400, ingots: 1900, scrap: 420, charge: 2 },
  crew: CREW(9).map((member) => ({ ...member, away: null })),
  raid: { at: at(9, 21.5), seed: 5, n: 2, warned: true },
  raidSeq: 2,
  damaged: false,
  raidReports: [],
  ...extra,
});
const NPC_BREACHED = {
  id: "r3",
  kind: "npc",
  at: at(9, 21.2),
  outcome: "breached",
  chance: 42,
  defence: 18,
  attack: 25,
  lost: { timber: 460, stone: 420, ingots: 95, scrap: 21 },
  gained: {},
  foe: null,
  damaged: true,
  revenge: false,
  read: false,
};
const NPC_HELD = {
  id: "r1",
  kind: "npc",
  at: at(7, 22.1),
  outcome: "held",
  chance: 61,
  defence: 23,
  attack: 15,
  lost: {},
  gained: { scrap: 18, sulfur: 44 },
  foe: null,
  damaged: false,
  revenge: false,
  read: true,
};
const PVP_STATE = (extra = {}) => ({
  on: true,
  lastAttackAt: null,
  hits: {},
  shieldUntil: null,
  revenge: [],
  ...extra,
});
/** Sheet Metal, in the raids, with charges: the PvP tab against Hollis. */
const PVP = (extra = {}) => ({
  ...RAID(),
  time: at(16, 11),
  tier: "metal",
  buildings: { ...MIDGAME, walls: 2, watchtower: 2, traps: 2, turret: 1 },
  stock: { ...CRAFT_STOCK, timber: 38_000, stone: 44_000, ingots: 12_000, scrap: 1100, charge: 14 },
  raid: null,
  raidReports: [NPC_HELD],
  pvp: PVP_STATE(),
  panel: "defence",
  defenceTab: "raids",
  ...extra,
});
const PVP_IN = {
  id: "i1",
  kind: "pvp_in",
  at: at(16, 6),
  outcome: "breached",
  chance: 38,
  defence: 46,
  attack: 60,
  lost: { timber: 3800, stone: 4400, ingots: 1200, scrap: 110 },
  gained: {},
  foe: { id: 9, name: "Hollis" },
  damaged: true,
  revenge: false,
  read: false,
};
const PVP_OUT = {
  id: "o1",
  kind: "pvp_out",
  at: at(16, 11),
  outcome: "breached",
  chance: 31,
  defence: 41,
  attack: 60,
  lost: { charge: 6 },
  gained: { timber: 4200, stone: 5100, ingots: 1850, sulfur: 240, scrap: 150 },
  foe: { id: 9, name: "Hollis" },
  damaged: false,
  revenge: false,
  read: false,
};
const REVENGE = PVP_STATE({
  shieldUntil: at(17, 6),
  revenge: [{ attacker: 9, name: "Hollis", until: at(18, 6) }],
});
const FORT = { ...MIDGAME, walls: 3, watchtower: 3, traps: 3, turret: 3 };

// --- seasons and the legacy layer (W7) ----------------------------------------------------
/** A finished season's card, as the reset archives it. */
const SEASON_ONE = {
  season: 1,
  summary: {
    tier: "hqm",
    tierDays: { twig: 1, wood: 1, stone: 4, metal: 14, hqm: 23 },
    sites: 9,
    bestHaul: 1820,
    crew: 7,
    traded: 640,
    wagered: 420,
    won: 380,
    biggestWin: 120,
    contracts: 12,
    wealth: 48_200,
    ranks: { wealth: 2, builder: 1, explorer: 1, trader: 2, lucky: 2, guard: 1 },
    players: 2,
  },
  ranks: { wealth: 2, builder: 1, explorer: 1, trader: 2, lucky: 2, guard: 1 },
  points: 21,
};
/** The Signal half-way: the foundation done, the tower going up. */
const SIGNAL_TOWER = { stage: 1, given: { frames: 120, plates: 90 }, litAt: null };
const SIGNAL_LIT = { stage: 4, given: {}, litAt: at(25, 22) };
const LATE = (extra = {}) => ({
  time: at(23, 11),
  tier: "hqm",
  buildings: { ...MIDGAME, walls: 3, watchtower: 2 },
  stock: {
    ...CRAFT_STOCK,
    stone: 24_000,
    planks: 900,
    frames: 60,
    plates: 140,
    gears: 30,
    fuel: 200,
  },
  ...extra,
});

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
    name: "map_fresh",
    viewport: [1600, 900],
    state: { time: at(1, 11), view: "map" },
  },
  {
    name: "map_desktop",
    viewport: [1600, 900],
    state: { ...MAP_STATE(7), view: "map" },
  },
  {
    name: "map_site_desktop",
    viewport: [1600, 900],
    state: {
      ...MAP_STATE(7),
      view: "map",
      panel: "map",
      mapFocus: { kind: "site", id: "old_campground" },
    },
  },
  {
    name: "phone_map",
    viewport: [390, 844],
    scale: 3,
    state: { ...MAP_STATE(7), view: "map" },
  },
  {
    name: "phone_map_region",
    viewport: [390, 844],
    scale: 3,
    state: {
      ...MAP_STATE(7),
      view: "map",
      panel: "map",
      mapFocus: { kind: "region", id: "rust_bay" },
    },
  },
  {
    name: "phone_map_site",
    viewport: [390, 844],
    scale: 3,
    state: {
      ...MAP_STATE(7),
      view: "map",
      panel: "map",
      mapFocus: { kind: "site", id: "old_campground" },
    },
  },
  {
    name: "phone_map_site_odds",
    viewport: [390, 844],
    scale: 3,
    state: {
      ...MAP_STATE(7),
      view: "map",
      panel: "map",
      mapFocus: { kind: "site", id: "old_campground" },
    },
    scrollTo: ".panel .odds",
  },
  {
    name: "phone_report_success",
    viewport: [390, 844],
    scale: 3,
    state: { ...MAP_STATE(7), reports: [REPORT(7, "success")], report: "m6" },
  },
  {
    name: "phone_report_fail",
    viewport: [390, 844],
    scale: 3,
    state: { ...MAP_STATE(7), reports: [REPORT(7, "fail")], report: "m6" },
  },
  {
    name: "phone_crew",
    viewport: [390, 844],
    scale: 3,
    state: { ...MAP_STATE(7), panel: "squad" },
  },
  // --- W4b: jobs, rest, the far north and the sea, trip events -----------------------
  {
    name: "phone_crew_jobs",
    viewport: [390, 844],
    scale: 3,
    state: { ...LATE_MAP(20), time: at(20, 9), panel: "squad" },
  },
  {
    name: "phone_crew_tired",
    viewport: [390, 844],
    scale: 3,
    state: { ...LATE_MAP(20), time: at(20, 18), panel: "squad" },
  },
  {
    name: "phone_crew_chip",
    viewport: [390, 844],
    scale: 3,
    state: {
      time: at(4, 11),
      tier: "wood",
      buildings: { workbench: 1, furnace: 1, campfire: 1 },
      stock: { timber: 300, stone: 200, ore: 40, food: 60 },
      crew: CREW(4)
        .slice(0, 4)
        .map((member) => ({ ...member, away: null, job: null, injuredUntil: null })),
      barrel: null,
    },
  },
  {
    name: "phone_map_north",
    viewport: [390, 844],
    scale: 3,
    state: { ...LATE_MAP(20), view: "map" },
  },
  {
    name: "map_north_desktop",
    viewport: [1600, 900],
    state: { ...LATE_MAP(20), view: "map" },
  },
  {
    name: "phone_map_sea_site",
    viewport: [390, 844],
    scale: 3,
    state: {
      ...LATE_MAP(20),
      view: "map",
      panel: "map",
      mapFocus: { kind: "site", id: "submarine_pen" },
    },
  },
  {
    name: "phone_map_sea_odds",
    viewport: [390, 844],
    scale: 3,
    state: {
      ...LATE_MAP(20),
      view: "map",
      panel: "map",
      mapFocus: { kind: "site", id: "submarine_pen" },
    },
    scrollTo: ".panel .odds",
  },
  {
    name: "phone_site_keycode_locked",
    viewport: [390, 844],
    scale: 3,
    state: {
      ...LATE_MAP(20),
      items: {},
      view: "map",
      panel: "map",
      mapFocus: { kind: "site", id: "weather_station" },
    },
    scrollTo: ".panel .odds",
  },
  {
    name: "phone_region_open_water",
    viewport: [390, 844],
    scale: 3,
    state: {
      ...LATE_MAP(20),
      tier: "hqm",
      view: "map",
      panel: "map",
      mapFocus: { kind: "region", id: "open_water" },
    },
  },
  {
    name: "phone_report_events",
    viewport: [390, 844],
    scale: 3,
    state: {
      ...LATE_MAP(20),
      reports: [
        {
          ...REPORT(20, "success"),
          target: "weather_station",
          crew: ["mara", "dax", "ivo"],
          gained: { scrap: 48, plates: 9, fuel: 22 },
          levelUps: [],
          revealed: [],
          events: ["ambush", "stranger"],
          found: ["copper_keycode"],
          rescued: "wren",
        },
      ],
      report: "m6",
    },
  },
  {
    name: "phone_feed",
    viewport: [390, 844],
    scale: 3,
    state: { ...LATE_MAP(20), panel: "feed", feed: FEED(20) },
  },
  {
    name: "desktop_feed",
    viewport: [1600, 900],
    state: { ...LATE_MAP(20), panel: "feed", feed: FEED(20) },
  },
  {
    name: "phone_feed_dot",
    viewport: [390, 844],
    scale: 3,
    state: { ...LATE_MAP(20), feed: FEED(20) },
  },
  {
    name: "scene_workers",
    viewport: [1600, 900],
    state: { ...LATE_MAP(20), time: at(20, 11) },
    // The patched crew walk up from the shore first: give them time to reach their posts.
    settle: 24000,
  },
  {
    name: "scene_workers_night",
    viewport: [1600, 900],
    state: { ...LATE_MAP(20), time: at(20, 22.5), crew: WORK_CREW(20, 22.5) },
    settle: 24000,
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
  // --- the Den (W5) ---
  { name: "phone_den_market", viewport: [390, 844], scale: 3, state: DEN() },
  {
    name: "phone_den_players",
    viewport: [390, 844],
    scale: 3,
    state: DEN(),
    scrollTo: ".panel h3.section:nth-of-type(2)",
  },
  { name: "phone_den_sell", viewport: [390, 844], scale: 3, state: DEN({ denSell: "rope" }) },
  { name: "phone_den_sell_pick", viewport: [390, 844], scale: 3, state: DEN({ denSell: null }) },
  {
    name: "phone_den_contracts",
    viewport: [390, 844],
    scale: 3,
    state: DEN({ denTab: "contracts" }),
  },
  {
    name: "phone_den_wheel",
    viewport: [390, 844],
    scale: 3,
    state: DEN({
      denTab: "games",
      game: "wheel",
      wheelBets: [{ round: Math.floor(at(9, 11) / 30), segment: "crab", amount: 10 }],
      denBets: [
        {
          round: Math.floor(at(9, 11) / 30),
          playerId: 9,
          name: "Hollis",
          segment: "gull",
          amount: 10,
        },
        {
          round: Math.floor(at(9, 11) / 30),
          playerId: 9,
          name: "Hollis",
          segment: "crown",
          amount: 5,
        },
      ],
    }),
  },
  {
    name: "phone_den_slots",
    viewport: [390, 844],
    scale: 3,
    state: DEN({
      denTab: "games",
      game: "slots",
      jackpot: 48_200,
      roll: { game: "slots", result: [3, 3, 3], bet: 10, payout: 400 },
    }),
  },
  {
    name: "phone_den_bones",
    viewport: [390, 844],
    scale: 3,
    state: DEN({
      denTab: "games",
      game: "dice",
      roll: { game: "dice", result: [5, 4], bet: 10, payout: 22 },
    }),
  },
  {
    name: "phone_den_capped",
    viewport: [390, 844],
    scale: 3,
    state: DEN({
      denTab: "games",
      game: "slots",
      casino: { day: 9, wagered: 50, won: 30 },
    }),
  },
  {
    name: "phone_den_closed",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(3, 11), panel: "den" },
  },
  {
    name: "phone_ranks",
    viewport: [390, 844],
    scale: 3,
    state: { ...DEN(), panel: "feed", feedTab: "ranks" },
  },
  { name: "desktop_den", viewport: [1600, 900], state: DEN() },
  {
    name: "desktop_den_wheel",
    viewport: [1600, 900],
    state: DEN({ denTab: "games", game: "wheel" }),
  },
  {
    name: "skiff_day",
    viewport: [390, 844],
    scale: 3,
    state: { ...DEN(), panel: null, time: at(9, 11) },
    clip: [0, 480, 260, 200],
  },
  {
    name: "skiff_night",
    viewport: [390, 844],
    scale: 3,
    state: { ...DEN(), panel: null, time: at(9, 23) },
    clip: [0, 480, 260, 200],
  },
  {
    name: "skiff_desktop",
    viewport: [1600, 900],
    state: { ...DEN(), panel: null, time: at(9, 19) },
  },
  {
    name: "map_den_locked",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(3, 11), view: "map" },
  },
  // Raids (W6).
  { name: "raid_warned_day", viewport: [1600, 900], state: RAID() },
  { name: "raid_warned_night", viewport: [1600, 900], state: RAID({ time: at(9, 20.8) }) },
  { name: "phone_raid_warned", viewport: [390, 844], scale: 3, state: RAID() },
  {
    name: "phone_raid_warned_night",
    viewport: [390, 844],
    scale: 3,
    state: RAID({ time: at(9, 20.8) }),
    clip: [180, 300, 210, 260],
  },
  {
    name: "phone_defence_warned",
    viewport: [390, 844],
    scale: 3,
    state: RAID({ panel: "defence" }),
  },
  {
    name: "phone_defence_damaged",
    viewport: [390, 844],
    scale: 3,
    state: RAID({
      time: at(10, 9),
      raid: null,
      damaged: true,
      raidReports: [NPC_BREACHED, NPC_HELD],
      panel: "defence",
    }),
  },
  {
    name: "phone_defence_calm",
    viewport: [390, 844],
    scale: 3,
    state: RAID({ time: at(8, 11), raid: null, raidReports: [NPC_HELD], panel: "defence" }),
    scrollTo: ".panel h3.section:nth-of-type(2)",
  },
  {
    name: "desktop_damaged",
    viewport: [1600, 900],
    state: RAID({ time: at(10, 9), raid: null, damaged: true, raidReports: [NPC_BREACHED] }),
  },
  {
    name: "phone_raid_report_breached",
    viewport: [390, 844],
    scale: 3,
    state: RAID({
      time: at(10, 9),
      raid: null,
      damaged: true,
      raidReports: [NPC_BREACHED],
      report: "r3",
    }),
  },
  {
    name: "phone_raid_report_held",
    viewport: [390, 844],
    scale: 3,
    state: RAID({ time: at(8, 9), raid: null, raidReports: [NPC_HELD], report: "r1" }),
  },
  {
    name: "phone_pvp_locked",
    viewport: [390, 844],
    scale: 3,
    state: RAID({ raid: null, panel: "defence", defenceTab: "raids" }),
  },
  {
    name: "phone_pvp_join",
    viewport: [390, 844],
    scale: 3,
    state: PVP({ pvp: PVP_STATE({ on: false }) }),
  },
  { name: "phone_pvp_targets", viewport: [390, 844], scale: 3, state: PVP() },
  {
    name: "phone_pvp_shielded",
    viewport: [390, 844],
    scale: 3,
    state: PVP({ rival: { pvp: PVP_STATE({ shieldUntil: at(16, 30) }) } }),
  },
  {
    name: "phone_pvp_revenge",
    viewport: [390, 844],
    scale: 3,
    state: PVP({ damaged: true, raidReports: [PVP_IN, NPC_HELD], pvp: REVENGE }),
  },
  {
    name: "phone_pvp_report_in",
    viewport: [390, 844],
    scale: 3,
    state: PVP({ panel: null, damaged: true, raidReports: [PVP_IN], report: "i1", pvp: REVENGE }),
  },
  {
    name: "phone_pvp_report_won",
    viewport: [390, 844],
    scale: 3,
    state: PVP({
      panel: null,
      raidReports: [PVP_OUT],
      report: "o1",
      pvp: PVP_STATE({ lastAttackAt: at(16, 11), hits: { 9: at(16, 11) } }),
    }),
  },
  {
    name: "phone_camp_confirm",
    viewport: [390, 844],
    scale: 3,
    state: RAID({
      raid: null,
      view: "map",
      known: KNOWN,
      panel: "map",
      mapFocus: { kind: "site", id: "driftwood_camp" },
    }),
    scrollTo: ".panel .cost",
  },
  { name: "map_camps", viewport: [390, 844], scale: 3, state: { ...LATE_MAP(20), view: "map" } },
  {
    name: "desktop_defences",
    viewport: [1600, 900],
    state: PVP({ panel: null, buildings: FORT }),
  },
  {
    name: "desktop_defences_night",
    viewport: [1600, 900],
    state: PVP({ panel: null, time: at(16, 23), buildings: FORT }),
  },
  { name: "desktop_defence_panel", viewport: [1600, 900], state: RAID({ panel: "defence" }) },
  // Seasons and the legacy layer (W7).
  {
    name: "phone_legacy",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(3, 11), panel: "feed", feedTab: "legacy" },
  },
  {
    name: "phone_legacy_bought",
    viewport: [390, 844],
    scale: 3,
    state: {
      time: at(3, 11),
      panel: "feed",
      feedTab: "legacy",
      perks: { steady_hands: 3, deep_cellars: 1, old_maps: 2, old_friend: 1 },
      skin: "driftwood",
      seasonDemo: {
        legacy: {
          points: 2,
          perks: { steady_hands: 3, deep_cellars: 1, old_maps: 2, old_friend: 1 },
          skin: "driftwood",
        },
      },
    },
    scrollTo: ".panel h3.section",
  },
  {
    name: "phone_hall",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(3, 11), panel: "feed", feedTab: "hall" },
  },
  {
    name: "phone_season_over",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(1, 9), seasonDemo: { archived: [SEASON_ONE] }, seasonSeen: 1 },
  },
  {
    name: "desktop_season_over",
    viewport: [1600, 900],
    state: { time: at(1, 9), seasonDemo: { archived: [SEASON_ONE] }, seasonSeen: 1 },
  },
  {
    name: "phone_signal_closed",
    viewport: [390, 844],
    scale: 3,
    state: { time: at(9, 11), panel: "signal" },
  },
  {
    name: "phone_signal_open",
    viewport: [390, 844],
    scale: 3,
    state: LATE({
      panel: "signal",
      seasonDemo: { endsAt: at(27, 20), next: "quiet_raiders", signal: SIGNAL_TOWER },
    }),
  },
  {
    name: "phone_signal_lit",
    viewport: [390, 844],
    scale: 3,
    state: LATE({
      time: at(26, 9),
      panel: "signal",
      seasonDemo: { endsAt: at(27, 20), signal: SIGNAL_LIT },
    }),
  },
  {
    name: "phone_season_ends",
    viewport: [390, 844],
    scale: 3,
    state: LATE({
      seasonDemo: { endsAt: at(27, 20), next: "quiet_raiders", signal: SIGNAL_TOWER },
    }),
  },
  {
    name: "desktop_signal_tower",
    viewport: [1600, 900],
    state: LATE({ seasonDemo: { endsAt: at(27, 20), signal: SIGNAL_TOWER } }),
  },
  {
    name: "desktop_signal_lit_night",
    viewport: [1600, 900],
    state: LATE({ time: at(26, 22), seasonDemo: { endsAt: at(27, 20), signal: SIGNAL_LIT } }),
  },
  {
    name: "desktop_skin_beacon",
    viewport: [1600, 900],
    state: { ...DEN(), panel: null, skin: "beacon" },
  },
  {
    name: "desktop_skin_rust",
    viewport: [1600, 900],
    state: { ...DEN(), panel: null, tier: "metal", skin: "rust" },
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
      const {
        time,
        panel,
        station,
        recipe,
        view,
        mapFocus,
        report,
        weather,
        welcome,
        feed,
        denTab,
        denSell,
        game,
        feedTab,
        roll,
        spin,
        denBets,
        jackpot,
        defenceTab,
        rival,
        seasonDemo,
        seasonSeen,
        ...base
      } = state;
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
        view: view ?? "base",
        mapFocus: mapFocus ?? null,
        report: report ?? null,
        demoOpen: false,
        toasts: [],
        welcomeBack: welcome ? { awaySeconds: 3 * 3600, events: [] } : null,
        ...(feed ? { feed, feedSeen: 0 } : {}),
        denTab: denTab ?? "market",
        denSell,
        game: game ?? "wheel",
        feedTab: feedTab ?? "feed",
        roll: roll ? { ...roll, at: 0 } : null,
        spin: spin ?? null,
        defenceTab: defenceTab ?? "defence",
        // The season-over card only where a shot asks for it.
        seasonSeen: seasonSeen ?? 99,
      });
      if (rival) world.demoRival(rival);
      if (seasonDemo) world.demoSeason(seasonDemo);
      if (panel === "signal") void world.loadSignal();
      if (panel === "feed" && (feedTab === "legacy" || feedTab === "hall")) void world.loadLegacy();
      if (panel === "defence") void world.loadRaids();
      if (denBets || jackpot !== undefined)
        world.demoDen({
          ...(denBets ? { bets: denBets } : {}),
          ...(jackpot !== undefined ? { jackpot } : {}),
        });
      if (panel === "den") void world.loadDen();
      if (panel === "feed" && feedTab === "ranks") void world.loadRanks();
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
