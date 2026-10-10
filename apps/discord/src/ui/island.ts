/**
 * What the bot posts and sends that is not `/base` (W8):
 *
 * - a DM: one notification (the words the API made for the web's push), with the natural
 *   follow-ups: the base right here, the game at the right place, and DMs off;
 * - the feed channel: the island feed's items, in the very sentences the web's feed shows
 *   (`@wipe-day/domain/words`), from the same events. Seasons no longer end (D128), so there
 *   is no season news; R2's Wipe Days are the next news.
 */
import type { FeedItem } from "@wipe-day/domain/feed";
import type { DmNote } from "@wipe-day/domain/wire";
import type { Words } from "@wipe-day/domain/words";
import { escapeMarkdown } from "discord.js";
import { idOf } from "./customId";
import { relative } from "./home";
import type { Screen } from "./screen";
import type { Tone } from "./theme";

const NOTE_TONE: Record<DmNote["kind"], Tone> = {
  night_shift_over: "warning",
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
