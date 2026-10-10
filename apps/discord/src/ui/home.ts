/**
 * `/base`: the API's answer turned into the message. Pure: the base and what the last click did
 * go in, plain data comes out, so tests and `pnpm preview` see exactly what Discord gets.
 *
 * Until R2 the island is being rebuilt (the redesign, D127): `/base` says so and links into the
 * game, which is the one obvious action (CLAUDE.md 6.3 rule 1). Card v2, with the rate, the
 * Night Shift and Collect, comes in R2 (docs/redesign/06-friends.md 10). The bot has no rules of
 * its own (W8).
 */
import type { Content } from "@wipe-day/content/schema";
import type { BotHome } from "@wipe-day/domain/wire";
import type { Words } from "@wipe-day/domain/words";
import { idOf } from "./customId";
import type { Screen } from "./screen";
import { tierColor } from "./theme";

/** What the bot needs to describe a base: the content and the shared words. */
export interface Lexicon {
  content: Content;
  words: Words;
}

/** What the last click did, for the status line (rule 7: feedback on everything). */
export type Last = { kind: "stale" } | { kind: "dm"; on: boolean };

/** `<t:…:R>`: a countdown each reader's Discord renders and keeps ticking, in their language. */
export const relative = (at: number): string => `<t:${Math.trunc(at)}:R>`;
/** `<t:…:f>`: a date and time in each reader's own time zone. */
export const dateTime = (at: number): string => `<t:${Math.trunc(at)}:f>`;

function statusLine(words: Words, last: Last | undefined): string {
  const t = words.t;
  if (last?.kind === "stale") return t("discord.status.stale");
  if (last?.kind === "dm") return t(last.on ? "discord.status.dm_on" : "discord.status.dm_off");
  return t("discord.rebuilding");
}

/** The `/base` message. */
export function homeScreen(lexicon: Lexicon, home: BotHome, last?: Last): Screen {
  const { words } = lexicon;
  const t = words.t;
  return {
    id: "base",
    kind: "root",
    tone: "neutral",
    accent: tierColor[home.state.run.era],
    title: t("discord.title", {
      name: home.player.name,
      island: words.islandName(home.state.run.island),
    }),
    status: statusLine(words, last),
    details: [],
    hint: t("discord.dm_footer", {
      state: t(home.discordDm ? "discord.dm_state_on" : "discord.dm_state_off"),
    }),
    rows: [
      {
        kind: "buttons",
        buttons: [
          { customId: "", url: home.loginUrl, label: t("discord.button.open"), style: "primary" },
          {
            customId: idOf({ screen: "base", action: home.discordDm ? "dm_off" : "dm_on" }),
            label: t(home.discordDm ? "discord.button.dm_off" : "discord.button.dm_on"),
            style: "secondary",
          },
        ],
      },
    ],
  };
}
