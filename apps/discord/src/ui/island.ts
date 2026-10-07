/**
 * What the bot posts and sends that is not `/base` (W8):
 *
 * - a DM: one notification (the words the API made for the web's push), with the natural
 *   follow-ups: the base right here, the game at the right place, and DMs off;
 * - the feed channel: the island feed's items, in the very sentences the web's feed shows
 *   (`@wipe-day/domain/words`), from the same events;
 * - season news: the end announced, the reset done, and its winners.
 */
import type { Content } from "@wipe-day/content/schema";
import type { FeedItem } from "@wipe-day/domain/feed";
import type { DmNote, SeasonNews } from "@wipe-day/domain/wire";
import type { Words } from "@wipe-day/domain/words";
import { escapeMarkdown } from "discord.js";
import { idOf } from "./customId";
import { dateTime, relative } from "./home";
import type { Screen } from "./screen";
import type { Tone } from "./theme";

const NOTE_TONE: Record<DmNote["kind"], Tone> = {
  party_back: "success",
  raided: "danger",
  raid_warning: "warning",
  arrivals: "success",
  builds_done: "success",
  sold: "success",
};

export function noteScreen(words: Words, note: DmNote): Screen {
  const t = words.t;
  return {
    id: "note",
    kind: "root",
    tone: NOTE_TONE[note.kind],
    title: note.title,
    status: note.body,
    details: [],
    rows: [
      {
        kind: "buttons",
        buttons: [
          {
            customId: idOf({ screen: "note", action: "base" }),
            label: t("discord.button.base"),
            style: "primary",
          },
          { customId: "", url: note.url, label: t("discord.button.open"), style: "secondary" },
          {
            customId: idOf({ screen: "note", action: "dm_off" }),
            label: t("discord.button.dm_off"),
            style: "secondary",
          },
        ],
      },
    ],
  };
}

/** Older than this, a caught-up feed line says when it happened. */
const LATE_AFTER = 300;
/** Discord's limit for a message's text. */
const MAX_MESSAGE = 2000;

/** Feed items as channel messages, oldest first, each within Discord's length limit. */
export function feedMessages(words: Words, items: FeedItem[], now: number): string[] {
  const lines = items.map((item) => {
    const line = words.feedLine(item.event, `**${escapeMarkdown(item.playerName)}**`);
    return now - item.at > LATE_AFTER ? `${line} · ${relative(item.at)}` : line;
  });
  const messages: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current && current.length + 1 + line.length > MAX_MESSAGE) {
      messages.push(current);
      current = "";
    }
    current = current ? `${current}\n${line}` : line;
  }
  if (current) messages.push(current);
  return messages;
}

/** A season's news as one channel message. */
export function newsMessage(words: Words, content: Content, news: SeasonNews): string {
  const t = words.t;
  const modifier = (id: string | null) =>
    id && content.seasons.modifiers.some((m) => m.id === id)
      ? { name: t(`modifier.${id}.name`), blurb: t(`modifier.${id}.blurb`) }
      : null;
  if (news.kind === "announced") {
    const { season } = news;
    const lines = [
      t("discord.news.announced", {
        number: season.number,
        when: relative(season.endsAt ?? 0),
        date: dateTime(season.endsAt ?? 0),
      }),
    ];
    const next = modifier(season.next);
    if (next) lines.push(t("discord.news.next", next));
    return lines.join("\n");
  }
  const lines = [t("discord.news.ended", { number: news.ended })];
  if (news.winners.length > 0) {
    lines.push("", t("discord.news.winners"));
    for (const winner of news.winners) {
      lines.push(
        t("discord.news.winner", {
          title: t(`legacy.title_${winner.category}`),
          name: escapeMarkdown(winner.name),
        }),
      );
    }
  }
  const next = modifier(news.season.modifier);
  lines.push(
    "",
    next
      ? t("discord.news.started", { number: news.season.number, ...next })
      : t("discord.news.started_plain", { number: news.season.number }),
  );
  return lines.join("\n");
}
