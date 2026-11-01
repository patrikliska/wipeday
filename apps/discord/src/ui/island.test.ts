import { loadGame } from "@wipe-day/content/load";
import type { FeedItem } from "@wipe-day/domain/feed";
import { words } from "@wipe-day/domain/words";
import { describe, expect, it } from "vitest";
import { NOTES, NOW } from "../render/fixtures";
import { feedMessages, noteScreen } from "./island";
import { lintScreen } from "./screen";

const { content, locale } = loadGame();
const w = words(locale, content);

/** A Wipe Day's feed item (R4): the fourth, +144 glass. */
const built = (id: number, name: string, at = NOW): FeedItem => ({
  id,
  at,
  playerId: 1,
  playerName: name,
  event: {
    type: "nuked",
    n: 4,
    wipeDay: 4,
    gain: 144,
    ever: 500,
    glowBefore: 1,
    glowAfter: 2,
    doubling: false,
    flight: "u_turn",
    pays: { drop: 1, scrap: 0 },
    news: { folded: 0, glass: 0 },
    summary: {} as never,
  },
});

describe("the feed channel", () => {
  it("posts the web feed's own sentence, with the name bold and escaped", () => {
    const [message] = feedMessages(w, [built(1, "Ana_the*Bold")], NOW);
    expect(message).toBe(
      "**Ana\\_the\\*Bold** pressed the Big Red. Wipe Day #4 on Saltmarsh: +144 crater glass.",
    );
  });

  it("says when a caught-up item happened, and splits long batches", () => {
    const [late] = feedMessages(w, [built(1, "Nia", NOW - 3600)], NOW);
    expect(late).toMatch(/ · <t:\d+:R>$/);
    const many = Array.from({ length: 200 }, (_, index) => built(index + 1, "N".repeat(30)));
    const messages = feedMessages(w, many, NOW);
    expect(messages.length).toBeGreaterThan(1);
    for (const message of messages) expect(message.length).toBeLessThanOrEqual(2000);
    expect(messages.join("\n").split("\n")).toHaveLength(200);
  });
});

describe("a DM", () => {
  it("offers the island, the game where it matters, and DMs off", () => {
    for (const note of NOTES) {
      const screen = noteScreen(w, note);
      expect(lintScreen(screen)).toEqual([]);
      const row = screen.rows[0];
      const labels = row?.kind === "buttons" ? row.buttons.map((button) => button.label) : [];
      expect(labels).toEqual(["Show my island", "Open the game", "Turn DMs off"]);
      expect(row?.kind === "buttons" && row.buttons[1]?.url).toBe(note.url);
    }
  });
});
