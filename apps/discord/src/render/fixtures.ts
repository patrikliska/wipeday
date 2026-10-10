/**
 * Sample answers from the API for `pnpm preview` and the tests: real bases from the shared
 * domain (`newBase`). Time is fixed, so the previews and snapshots never drift.
 */
import type { Content } from "@wipe-day/content/schema";
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

function home(content: Content, name: string, change: Partial<BotHome> = {}): BotHome {
  return {
    serverNow: NOW,
    version: 12,
    player: { id: 1, name, avatarUrl: null },
    state: newBase(content, NOW - 600, 7),
    welcomeBack: null,
    discordDm: true,
    loginUrl: "https://wipeday.example/api/auth/link?t=preview",
    ...change,
  };
}

export function homeFixtures(content: Content): HomeFixture[] {
  return [
    { state: "rebuilding", home: home(content, "Nia") },
    {
      state: "dm_off",
      home: home(content, "Nia", { discordDm: false }),
      last: { kind: "dm", on: false },
    },
    { state: "stale", home: home(content, LONGEST_NAME), last: { kind: "stale" } },
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
