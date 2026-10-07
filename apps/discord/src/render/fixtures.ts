/**
 * Sample answers from the API for `pnpm preview` and the tests: real bases from the shared
 * domain (`newBase`), pushed into the states worth looking at. Time is fixed, so the
 * previews and snapshots never drift.
 */
import type { Content } from "@wipe-day/content/schema";
import { type BaseState, newBase, storageCap } from "@wipe-day/domain/base";
import type { BotHome, DmNote } from "@wipe-day/domain/wire";
import type { Last } from "../ui/home";

/** A Wednesday evening, UTC. */
export const NOW = 1_791_406_800;
const DAY = 86_400;
/** Discord's longest display name: 32 characters. */
export const LONGEST_NAME = "Wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww";

export interface HomeFixture {
  state: string;
  home: BotHome;
  last?: Last;
}

function home(base: BaseState, name: string, change: Partial<BotHome> = {}): BotHome {
  return {
    serverNow: NOW,
    version: 12,
    player: { id: 1, name, avatarUrl: null },
    seasonStartedAt: NOW - 5 * DAY - 3600,
    season: {
      number: 1,
      startedAt: NOW - 5 * DAY - 3600,
      endsAt: null,
      modifier: null,
      next: null,
    },
    state: base,
    welcomeBack: null,
    discordDm: true,
    loginUrl: "https://wipeday.example/api/auth/link?t=preview",
    ...change,
  };
}

export function homeFixtures(content: Content): HomeFixture[] {
  const fresh = newBase(content, NOW - 600, 7);

  // Day 2, timber: a few hours away, the store filling up, Gather cooling down.
  const timber: BaseState = {
    ...newBase(content, NOW - DAY, 7),
    tier: "wood",
    stock: { timber: 1840, stone: 1210, ore: 320, fibre: 410, scrap: 260, food: 90 },
    lastCollectedAt: NOW - 5 * 3600,
    lastGatherAt: NOW - 120,
  };

  // Day 6, stone: builders, a station, a party and a scout out, raiders sighted.
  const stone: BaseState = {
    ...newBase(content, NOW - 6 * DAY, 7),
    tier: "stone",
    stock: {
      timber: 6200,
      stone: 4300,
      ore: 1800,
      ingots: 420,
      sulfur_ore: 230,
      fibre: 2100,
      hide: 320,
      fat: 140,
      food: 800,
      scrap: 3150,
      planks: 40,
    },
    buildings: { workbench: 2, furnace: 1, campfire: 1, warehouse: 2, loom: 1, watchtower: 1 },
    lastCollectedAt: NOW - 1800,
    lastGatherAt: NOW - 30,
    construction: [
      {
        target: { kind: "building", building: "walls", level: 1 },
        startedAt: NOW - 3600,
        endsAt: NOW + 2 * 3600 + 900,
      },
    ],
    production: {
      workbench: [
        { recipe: "planks", count: 12, done: 4, unitSeconds: 300, startedAt: NOW - 1200 },
      ],
      loom: [{ recipe: "rope", count: 6, done: 0, unitSeconds: 600, startedAt: NOW - 120 }],
    },
    missions: [
      {
        id: "m7",
        kind: "trip",
        target: "cannery",
        crew: ["mara", "dax"],
        startedAt: NOW - 3600,
        endsAt: NOW + 3 * 3600,
        seed: 1,
        odds: {
          success: 60,
          partial: 90,
          injury: [5],
          minutes: 240,
          rolls: 3,
          loot: 0,
          blueprint: 0,
          fragment: 0,
          events: {},
        },
      },
      {
        id: "m8",
        kind: "scout",
        target: "quarry_hills",
        crew: ["ivo"],
        startedAt: NOW - 600,
        endsAt: NOW + 1500,
        seed: 2,
        odds: {
          success: 100,
          partial: 100,
          injury: [0],
          minutes: 35,
          rolls: 0,
          loot: 0,
          blueprint: 0,
          fragment: 0,
          events: {},
        },
      },
    ],
    raid: { at: NOW + 2 * 3600, seed: 5, n: 1, warned: true },
  };

  // The store is full: nothing accrues, and Collect says why it cannot help.
  const cap = storageCap(content, timber);
  const full: BaseState = {
    ...timber,
    stock: { timber: cap, stone: cap, ore: 900, fibre: 600, scrap: 500, food: 120 },
    lastCollectedAt: NOW - 3600,
    lastGatherAt: NOW - 3 * 3600,
  };

  // The longest name, seven-digit numbers, every resource.
  const rich: BaseState = {
    ...stone,
    tier: "hqm",
    stock: Object.fromEntries(
      content.resources
        .filter((resource) => resource.kind !== "part")
        .map((resource, index) => [resource.id, 1_234_567 + index * 911_000]),
    ),
    construction: [],
    production: {},
    missions: [],
    raid: null,
  };

  return [
    { state: "new", home: home(fresh, "Nia") },
    { state: "waiting", home: home(timber, "Nia") },
    // About to fill: the advisor says bank it, and Collect is the one obvious action.
    {
      state: "filling",
      home: home({ ...timber, stock: { ...timber.stock, timber: cap - 40 } }, "Nia"),
    },
    {
      state: "banked",
      home: home({ ...timber, lastCollectedAt: NOW }, "Nia"),
      last: { kind: "banked", gained: { timber: 214, stone: 80, ore: 12 } },
    },
    {
      state: "busy",
      home: home(stone, "Nia", {
        season: {
          number: 1,
          startedAt: NOW - 5 * DAY,
          endsAt: NOW + 6 * DAY,
          modifier: null,
          next: "storm_season",
        },
      }),
    },
    { state: "full", home: home(full, "Nia", { discordDm: false }) },
    {
      state: "cooldown",
      home: home(timber, "Nia"),
      last: { kind: "cooldown", readyAt: NOW + 240 },
    },
    { state: "long", home: home(rich, LONGEST_NAME) },
  ];
}

export const NOTES: DmNote[] = [
  {
    discordId: "123456789012345678",
    kind: "party_back",
    title: "Your party is back",
    body: "Cannery: a success. Come and see the haul.",
    url: "https://wipeday.example/?report=m7",
  },
  {
    discordId: "123456789012345678",
    kind: "raided",
    title: "Raiders!",
    body: "They got in and took 420 Timber, 180 Stone, 60 Ore.",
    url: "https://wipeday.example/?report=r3",
  },
];
