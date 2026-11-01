/**
 * Sample answers from the API for `pnpm preview` and the tests: real bases from the shared
 * domain (`newBase`), patched by hand (no rule runs here, `boundary.test.ts`). Time is fixed,
 * so the previews and snapshots never drift.
 */
import type { Content } from "@wipe-day/content/schema";
import type { FeedItem } from "@wipe-day/domain/feed";
import type { BaseState } from "@wipe-day/domain/state";
import { newBase } from "@wipe-day/domain/state";
import type { BotHome, DmNote } from "@wipe-day/domain/wire";
import type { Last } from "../ui/home";

/** A Wednesday evening, UTC. */
export const NOW = 1_791_406_800;
/** Discord's longest display name: 32 characters. */
export const LONGEST_NAME = "Wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww";

export interface HomeFixture {
  state: string;
  home: BotHome;
  last?: Last;
}

type Patch = {
  run?: Partial<BaseState["run"]>;
  meta?: Partial<BaseState["meta"]>;
  stats?: Partial<BaseState["meta"]["stats"]>;
};

function home(
  content: Content,
  name: string,
  patch: Patch = {},
  change: Partial<BotHome> = {},
): BotHome {
  const base = newBase(content, NOW - 600, 7);
  const state: BaseState = {
    ...base,
    run: { ...base.run, activeAt: NOW - 60, ...patch.run },
    meta: { ...base.meta, ...patch.meta, stats: { ...base.meta.stats, ...patch.stats } },
  };
  return {
    serverNow: NOW,
    version: 12,
    player: { id: 1, name, avatarUrl: null },
    state,
    welcomeBack: null,
    discordDm: true,
    loginUrl: "https://wipeday.example/api/auth/link?t=preview",
    ...change,
  };
}

/** The Stone run at minute 48 with six hands: what the shots call FIRST_NUKE. */
const STONE_RUN: Partial<BaseState["run"]> = {
  era: "stone",
  startedAt: NOW - 2880,
  firstBuyAt: NOW - 2870,
  afterglowFrom: NOW - 2870,
  supplies: 3.1e9,
  made: 5.8e10,
  madeAtActive: 5.8e10,
  taps: 9000,
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
};

/** A player past onboarding: the lifetime counters the Stone run implies. */
const STONE_STATS: Partial<BaseState["meta"]["stats"]> = { units: 197, hands: 6, eras: 2 };

export function homeFixtures(content: Content): HomeFixture[] {
  return [
    // Run 1, minute 1: nobody on shift, nothing runs; Open the game leads, the tap hint.
    { state: "first_minute", home: home(content, "Nia") },
    // The first launch crowned (made 58B, the delta at 10): the Big Red's line and next step.
    {
      state: "crowned",
      home: home(content, "Nia", { run: STONE_RUN, stats: STONE_STATS }),
    },
    // Away three hours on a 2 h window: stalled, Collect leads.
    {
      state: "stalled",
      home: home(content, "Nia", {
        run: { ...STONE_RUN, made: 6.1e10, activeAt: NOW - 3 * 3600 },
        stats: STONE_STATS,
        meta: {
          wipeDays: 3,
          nukes: 3,
          lifetime: 2.95e15,
          glass: { ever: 240, held: 100, level: 240, spent: 140 },
          nodes: ["ground_zero", "packed_crate", "hot_coals"],
        },
      }),
    },
    // A third of the window used, nothing crowned: the running line, Open the game leads.
    {
      state: "running",
      home: home(content, "Nia", {
        run: { ...STONE_RUN, made: 1e9, madeAtActive: 9e8, activeAt: NOW - 40 * 60 },
        stats: STONE_STATS,
        meta: {
          wipeDays: 12,
          nukes: 12,
          lifetime: 3e16,
          glass: { ever: 2154, held: 320, level: 2154, spent: 1834 },
          nodes: ["ground_zero", "packed_crate", "hot_coals", "steady_hands"],
        },
      }),
    },
    // A 7-digit glass chip and the longest name.
    {
      state: "rich",
      home: home(content, LONGEST_NAME, {
        run: STONE_RUN,
        stats: STONE_STATS,
        meta: {
          wipeDays: 240,
          nukes: 261,
          lifetime: 1e30,
          glass: { ever: 9_876_543, held: 1_234_567, level: 9_876_543, spent: 8_641_976 },
          nodes: ["ground_zero", "packed_crate"],
        },
      }),
    },
    // After a Collect: what the hands worked and made.
    {
      state: "collected",
      home: home(content, "Nia", { run: { ...STONE_RUN, activeAt: NOW }, stats: STONE_STATS }),
      last: { kind: "collected", seconds: 2 * 3600, gain: 4.2e12, hands: 6 },
    },
    {
      state: "dm_off",
      home: home(content, "Nia", {}, { discordDm: false }),
      last: { kind: "dm", on: false },
    },
    { state: "stale", home: home(content, "Nia"), last: { kind: "stale" } },
  ];
}

export const NOTES: DmNote[] = [
  {
    discordId: "123456789012345678",
    kind: "night_shift_over",
    title: "The Night Shift is over",
    body: "Your hands have stopped. Check in to start the next shift.",
    url: "https://wipeday.example/",
  },
];

const nuked = (
  id: number,
  playerName: string,
  n: number,
  gain: number,
  extra: Partial<Extract<FeedItem["event"], { type: "nuked" }>> = {},
): FeedItem => ({
  id,
  at: NOW - 120,
  playerId: id,
  playerName,
  event: {
    type: "nuked",
    n,
    wipeDay: n,
    gain,
    ever: gain * 4,
    glowBefore: 1.5,
    glowAfter: 1.8,
    doubling: false,
    flight: "u_turn",
    pays: { drop: 1, scrap: 0 },
    news: { folded: 0, glass: 0 },
    summary: {} as never,
    ...extra,
  },
});

/** Every kind of feed line (06-friends.md 2.3): first, plain, folded, a new flight, a milestone, Armored. */
export const FEED: FeedItem[] = [
  nuked(1, "Mira", 1, 10),
  nuked(2, "Patrik", 4, 144),
  nuked(3, "Ivo", 5, 86, { news: { folded: 2, glass: 200 } }),
  nuked(4, "Patrik", 2, 30, { flight: "loop_the_loop" }),
  nuked(5, "Mira", 50, 61_000),
  {
    id: 6,
    at: NOW - 3600,
    playerId: 3,
    playerName: "Ivo",
    event: { type: "era_reached", era: "hqm", at: 86_400, first: true },
  },
];
