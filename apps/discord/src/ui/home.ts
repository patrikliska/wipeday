/**
 * `/base`: the API's answer turned into the message. Pure: the base and what the last click did
 * go in, plain data comes out, so tests and `pnpm preview` see exactly what Discord gets.
 *
 * Card v2, minimal (docs/redesign/06-friends.md 10.2; R4 S3, D271): text fields only, no
 * picture: the era and the Wipe Days, the idle rate, the glass chip with Glow, the Night Shift
 * line, the Big Red's line from the shared glance, and a status line (what the last click did,
 * else the shift's state or the one next step the advisor would crown). Buttons: Collect leads
 * when the window is stalled or at least half used, else Open the game; DMs on or off. The bot
 * has no rules of its own: everything here is a read-only view from `@wipe-day/domain/glance`
 * and `advisor` (`boundary.test.ts`).
 */
import type { Content } from "@wipe-day/content/schema";
import { crown, tapHintLive } from "@wipe-day/domain/advisor";
import { bigRedGlance, nightShiftGlance, shownRate } from "@wipe-day/domain/glance";
import type { BotHome } from "@wipe-day/domain/wire";
import { duration, type Words } from "@wipe-day/domain/words";
import { idOf } from "./customId";
import type { Screen } from "./screen";
import { tierColor } from "./theme";

/** What the bot needs to describe a base: the content and the shared words. */
export interface Lexicon {
  content: Content;
  words: Words;
}

/** What the last click did, for the status line (rule 7: feedback on everything). */
export type Last =
  | { kind: "stale" }
  | { kind: "dm"; on: boolean }
  /** Collect went through: the hands worked `seconds` for `gain`, and a fresh window starts. */
  | { kind: "collected"; seconds: number; gain: number; hands: number };

/** `<t:…:R>`: a countdown each reader's Discord renders and keeps ticking, in their language. */
export const relative = (at: number): string => `<t:${Math.trunc(at)}:R>`;
/** `<t:…:f>`: a date and time in each reader's own time zone. */
export const dateTime = (at: number): string => `<t:${Math.trunc(at)}:f>`;

/** Collect leads from half a window used (06 10.3). */
const COLLECT_LEADS_FROM = 0.5;

/** The `/base` message. */
export function homeScreen(lexicon: Lexicon, home: BotHome, last?: Last): Screen {
  const { content, words } = lexicon;
  const t = words.t;
  const { state } = home;
  const now = home.serverNow;
  const era = words.tierName(state.run.era);
  const shift = nightShiftGlance(content, state, now);
  const hands = state.run.hands.length;
  const rate = shownRate(content, state, now);
  const pick = crown(content, state, now, { income: rate, tapShare: 0, tapRate: 0 });
  const crowned = pick.kind === "nuke";
  const glance = bigRedGlance(content, state, now, crowned);

  const details: string[] = [
    state.meta.wipeDays > 0
      ? t("discord.card.subtitle", { era, n: state.meta.wipeDays })
      : t("discord.card.subtitle_first", { era }),
    rate > 0
      ? t("discord.card.rate", { rate: words.fmtRate(rate) })
      : hands > 0
        ? t("discord.card.rate_stopped")
        : t("discord.card.rate_none"),
  ];
  if (state.meta.wipeDays > 0)
    details.push(
      t("discord.card.glass", {
        glass: words.fmtCount(state.meta.glass.held),
        glow: fmtFactor(glance.glowBefore),
      }),
    );
  details.push(
    hands === 0
      ? t("discord.card.night_shift_nobody")
      : shift.full
        ? t("discord.card.night_shift_full", { when: relative(shift.stoppedAt ?? now) })
        : t("discord.card.night_shift", {
            used: duration(shift.used),
            window: duration(shift.window),
          }),
  );
  if (glance.stage !== "hidden") {
    const made = words.fmt(state.run.made, "held");
    if (glance.pressable)
      details.push(
        t(crowned ? "discord.card.big_red_crowned" : "discord.card.big_red", {
          glass: words.fmtCount(glance.gain),
        }),
      );
    else
      details.push(
        t(glance.first ? "discord.card.big_red_locked" : "discord.card.big_red_later", {
          threshold: words.fmt(glance.launchAt - state.meta.lifetime, "cost"),
          made,
        }),
      );
  }

  const status = statusLine(lexicon, home, shift, hands, crowned, last);
  // Collect leads when the shift is over or half used; the game's link otherwise (06 10.3).
  const collectLeads = hands > 0 && (shift.full || shift.used / shift.window >= COLLECT_LEADS_FROM);
  const collect = {
    customId: idOf({ screen: "base", action: "collect" }),
    label: t("discord.button.collect"),
    style: collectLeads ? ("primary" as const) : ("secondary" as const),
  };
  const open = {
    customId: "",
    url: home.loginUrl,
    label: t("discord.button.open"),
    style: collectLeads ? ("secondary" as const) : ("primary" as const),
  };
  return {
    id: "base",
    kind: "root",
    tone: "neutral",
    accent: tierColor[state.run.era],
    title: t("discord.title", {
      name: home.player.name,
      island: words.islandName(state.run.island),
    }),
    status,
    details,
    hint: t("discord.dm_footer", {
      state: t(home.discordDm ? "discord.dm_state_on" : "discord.dm_state_off"),
    }),
    rows: [
      {
        kind: "buttons",
        buttons: [
          ...(collectLeads ? [collect, open] : [open, collect]),
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

function statusLine(
  lexicon: Lexicon,
  home: BotHome,
  shift: ReturnType<typeof nightShiftGlance>,
  hands: number,
  crowned: boolean,
  last: Last | undefined,
): string {
  const { content, words } = lexicon;
  const t = words.t;
  if (last?.kind === "stale") return t("discord.status.stale");
  if (last?.kind === "dm") return t(last.on ? "discord.status.dm_on" : "discord.status.dm_off");
  if (last?.kind === "collected")
    return last.hands === 0
      ? t("discord.status.collected_nobody")
      : t("discord.status.collected", {
          time: duration(last.seconds),
          gain: words.fmt(last.gain, "cost"),
          window: duration(shift.window),
        });
  // The one next step, only where the game itself would crown it (D244): the Big Red, or the
  // tap hint while the player is new. No buying advice.
  if (crowned) return t("discord.next_action.big_red");
  if (tapHintLive(content, home.state)) return t("discord.next_action.tap");
  if (hands === 0) return t("discord.status.nobody");
  if (shift.full) return t("discord.status.stalled");
  return t("discord.status.running", { when: relative(home.state.run.activeAt + shift.window) });
}

/** `×2.17`: the web's factor format (08-screens.md 3.5), three significant digits. */
function fmtFactor(value: number): string {
  return String(Number(value.toPrecision(3)));
}
