/**
 * `/base`: the API's answer turned into the card's props and the message around it. Pure:
 * the base, the time and what the last click did go in, plain data comes out, so tests and
 * `pnpm preview` see exactly what Discord gets.
 *
 * Every number here comes from the shared domain's read-only helpers (what is waiting, the
 * store's fill, the advisor's next step); every change goes through the API's commands.
 * The bot has no rules of its own (W8).
 *
 * The one obvious action (CLAUDE.md 6.3 rule 1) is the advisor's: Collect or Gather when it
 * says so and they would do something, otherwise the link into the game, with the next
 * step written under the card.
 */
import { initials, resourceColor, resourceInitials } from "@wipe-day/content/look";
import type { Amounts, Content } from "@wipe-day/content/schema";
import { advise } from "@wipe-day/domain/advisor";
import {
  accrued,
  type BaseState,
  gatherReadyAt,
  isStorageFull,
  storageCap,
  total,
} from "@wipe-day/domain/base";
import { jobEndsAt } from "@wipe-day/domain/craft";
import { raidWarned } from "@wipe-day/domain/raids";
import { seasonDay } from "@wipe-day/domain/signal";
import type { BotHome } from "@wipe-day/domain/wire";
import { duration, type Words } from "@wipe-day/domain/words";
import type { BaseCardProps, CardResource } from "../render/cards/base";
import { idOf } from "./customId";
import type { Button, Screen } from "./screen";
import { tierColor } from "./theme";

/** What the bot needs to describe a base: the content and the shared words. */
export interface Lexicon {
  content: Content;
  words: Words;
}

/** What the last click did, for the status line (rule 7: feedback on everything). */
export type Last =
  | { kind: "banked"; gained: Amounts }
  | { kind: "gathered"; gained: Amounts }
  | { kind: "nothing" }
  | { kind: "full" }
  | { kind: "cooldown"; readyAt: number }
  | { kind: "refused" }
  | { kind: "stale" }
  | { kind: "dm"; on: boolean };

/** `<t:…:R>`: a countdown each reader's Discord renders and keeps ticking, in their language. */
export const relative = (at: number): string => `<t:${Math.trunc(at)}:R>`;
/** `<t:…:f>`: a date and time in each reader's own time zone. */
export const dateTime = (at: number): string => `<t:${Math.trunc(at)}:f>`;

/** Gathered and smelted resources the base has met, in display order (the web's top bar). */
function known(content: Content, state: BaseState): string[] {
  return content.resources
    .filter((resource) => resource.kind !== "part" && state.stock[resource.id] !== undefined)
    .map((resource) => resource.id);
}

function cardResource(words: Words, id: string, amount: number): CardResource {
  const name = words.resourceName(id);
  return {
    id,
    name,
    amount,
    color: resourceColor(id),
    letters: resourceInitials(id) ?? initials(name),
  };
}

export function cardProps({ content, words }: Lexicon, home: BotHome, now: number): BaseCardProps {
  const { state } = home;
  const cap = storageCap(content, state);
  const ids = known(content, state).filter((id) => id !== "scrap");
  const capped = ids.filter(
    (id) => content.resources.find((r) => r.id === id)?.kind !== "currency",
  );
  let fullest = { name: words.resourceName(capped[0] ?? "timber"), amount: 0 };
  for (const id of capped) {
    const amount = state.stock[id] ?? 0;
    if (amount > fullest.amount) fullest = { name: words.resourceName(id), amount };
  }
  const tierName = words.tierName(state.tier);
  return {
    playerName: home.player.name,
    tier: state.tier,
    subtitle: words.t("discord.card.subtitle", {
      tier: tierName,
      day: seasonDay({ startedAt: home.seasonStartedAt }, now),
      season: home.season.number,
    }),
    tierLetters: initials(tierName),
    scrap: cardResource(words, "scrap", state.stock.scrap ?? 0),
    cap,
    fullest,
    resources: ids.map((id) => cardResource(words, id, state.stock[id] ?? 0)),
    labels: {
      storage: words.t("discord.card.storage"),
      full: words.t("discord.card.full", { resource: fullest.name }),
      empty: words.t("discord.card.empty"),
    },
  };
}

/** Which button is the one obvious action. */
type Primary = "collect" | "gather" | "open";

/**
 * The status line, where the eye lands after the title: what the last click did, or else
 * the one obvious next step.
 */
function statusLine(
  words: Words,
  last: Last | undefined,
  full: boolean,
  primary: Primary,
  next: string | null,
): string {
  const t = words.t;
  switch (last?.kind) {
    case "banked":
    case "gathered": {
      const gains = words.gainLines(last.gained, 4);
      if (gains.length === 0) return t(full ? "discord.status.full" : "discord.status.nothing");
      return t(`discord.status.${last.kind}`, { gains: gains.join(", ") });
    }
    case "nothing":
      return t("discord.status.nothing");
    case "full":
      return t("discord.status.full");
    case "cooldown":
      return t("discord.status.cooldown", { when: relative(last.readyAt) });
    case "refused":
      return t("discord.status.refused");
    case "stale":
      return t("discord.status.stale");
    case "dm":
      return t(last.on ? "discord.status.dm_on" : "discord.status.dm_off");
    default:
      if (primary !== "open") return t(`discord.status.${primary}`);
      if (next) return next;
      return t(full ? "discord.status.full" : "discord.status.default");
  }
}

/** What the builders, stations, parties, raiders and the season are doing: one line each. */
function timers({ content, words }: Lexicon, home: BotHome, now: number): string[] {
  const { state, season } = home;
  const t = words.t;
  const lines: string[] = [];

  const build = state.construction[0];
  if (build) {
    const what =
      build.target.kind === "tier"
        ? t("discord.building_tier", { tier: words.tierName(build.target.tier) })
        : t("discord.building_level", {
            building: t(`building.${build.target.building}.name`),
            level: build.target.level,
          });
    lines.push(t("discord.building", { what, when: relative(build.endsAt) }));
  }

  // The job each station is on, soonest done first: "8× Planks, 6× Rope".
  const running = Object.values(state.production)
    .map((queue) => queue[0])
    .filter((job) => job !== undefined)
    .sort((a, b) => jobEndsAt(a) - jobEndsAt(b));
  const first = running[0];
  if (first) {
    const named = running
      .slice(0, 2)
      .map((job) => `${job.count - job.done}× ${words.outputName(job.recipe)}`)
      .join(", ");
    const what =
      running.length > 2
        ? t("discord.crafting_more", { what: named, count: running.length - 2 })
        : named;
    lines.push(
      t(running.length > 1 ? "discord.crafting_many" : "discord.crafting", {
        what,
        when: relative(jobEndsAt(first)),
      }),
    );
  }

  for (const mission of [...state.missions].sort((a, b) => a.endsAt - b.endsAt).slice(0, 3)) {
    const crew = mission.crew.map((id) => words.survivorName(id)).join(", ");
    lines.push(
      mission.kind === "trip"
        ? t("discord.trip", {
            crew,
            site: words.siteName(mission.target),
            when: relative(mission.endsAt),
          })
        : t("discord.scout", {
            crew,
            region: words.regionName(mission.target),
            when: relative(mission.endsAt),
          }),
    );
  }

  if (state.raid && raidWarned(content, state, now))
    lines.push(t("discord.raid", { when: relative(state.raid.at) }));
  if (season.endsAt !== null)
    lines.push(t("discord.season_ends", { number: season.number, when: relative(season.endsAt) }));
  return lines;
}

/** The `/base` message, without the card's picture (the caller renders and attaches it). */
export function homeScreen(lexicon: Lexicon, home: BotHome, now: number, last?: Last): Screen {
  const { content, words } = lexicon;
  const t = words.t;
  const { state } = home;
  const waiting = accrued(content, state, now);
  const hasWaiting = total(waiting) >= 1;
  const full = !hasWaiting && isStorageFull(content, state, now);
  const readyAt = gatherReadyAt(content, state);
  const gatherReady = readyAt <= now;
  const advice = advise(content, state, now);
  const primary: Primary =
    advice === "collect" && hasWaiting
      ? "collect"
      : advice === "gather" && gatherReady
        ? "gather"
        : "open";

  const waitingLine = hasWaiting
    ? t("discord.waiting", { gains: words.gainLines(waiting, 3).join(" · ") })
    : full
      ? t("discord.waiting_full", { resource: cardProps(lexicon, home, now).fullest.name })
      : t("discord.waiting_none");

  const collect: Button = {
    customId: idOf({ screen: "base", action: "collect" }),
    label: hasWaiting
      ? t("discord.button.collect")
      : t(full ? "discord.button.collect_full" : "discord.button.collect_none"),
    style: primary === "collect" ? "primary" : "secondary",
    ...(hasWaiting ? {} : { disabled: true }),
  };
  const gather: Button = {
    customId: idOf({ screen: "base", action: "gather" }),
    label: gatherReady
      ? t("discord.button.gather")
      : t("discord.button.gather_wait", { time: duration(readyAt - now) }),
    style: primary === "gather" ? "primary" : "secondary",
    ...(gatherReady ? {} : { disabled: true }),
  };
  const open: Button = {
    customId: "",
    url: home.loginUrl,
    label: t("discord.button.open"),
    style: primary === "open" ? "primary" : "secondary",
  };

  const next =
    advice !== "collect" && advice !== "gather"
      ? t("discord.next", { what: t(`discord.next_action.${advice}`) })
      : null;
  const status = statusLine(words, last, full, primary, next);
  const hint = [
    // The next step is the status line, unless a click's result took its place.
    ...(next && primary === "open" && status !== next ? [next] : []),
    t("discord.dm_footer", {
      state: t(home.discordDm ? "discord.dm_state_on" : "discord.dm_state_off"),
    }),
  ].join("\n");
  // The one obvious action leads its row.
  const actions = [collect, gather, open].sort(
    (a, b) => Number(b.style === "primary") - Number(a.style === "primary"),
  );

  return {
    id: "base",
    kind: "root",
    tone: "neutral",
    accent: tierColor[state.tier],
    title: t("discord.title", { name: home.player.name }),
    status,
    details: [waitingLine, ...timers(lexicon, home, now)],
    hint,
    rows: [
      { kind: "buttons", buttons: actions },
      {
        kind: "buttons",
        buttons: [
          {
            customId: idOf({ screen: "base", action: "refresh" }),
            label: t("discord.button.refresh"),
            style: "secondary",
          },
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
