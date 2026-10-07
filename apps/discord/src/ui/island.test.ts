import { loadGame } from "@wipe-day/content/load";
import type { FeedItem } from "@wipe-day/domain/feed";
import { words } from "@wipe-day/domain/words";
import { describe, expect, it } from "vitest";
import { NOTES, NOW } from "../render/fixtures";
import { feedMessages, newsMessage, noteScreen } from "./island";
import { lintScreen } from "./screen";

const { content, locale } = loadGame();
const w = words(locale, content);

const built = (id: number, name: string, at = NOW): FeedItem => ({
  id,
  at,
  playerId: 1,
  playerName: name,
  event: { type: "build_done", tier: "stone" },
});

describe("the feed channel", () => {
  it("posts the web feed's own sentence, with the name bold and escaped", () => {
    const [message] = feedMessages(w, [built(1, "Ana_the*Bold")], NOW);
    expect(message).toBe(w.feedLine(built(1, "x").event as never, "**Ana\\_the\\*Bold**"));
  });

  it("says when a caught-up item happened, and splits long batches", () => {
    const [late] = feedMessages(w, [built(1, "Nia", NOW - 3600)], NOW);
    expect(late).toMatch(/ · <t:\d+:R>$/);
    const many = Array.from({ length: 80 }, (_, index) => built(index + 1, "N".repeat(30)));
    const messages = feedMessages(w, many, NOW);
    expect(messages.length).toBeGreaterThan(1);
    for (const message of messages) expect(message.length).toBeLessThanOrEqual(2000);
    expect(messages.join("\n").split("\n")).toHaveLength(80);
  });
});

describe("season news", () => {
  it("announces the end with the next season's modifier", () => {
    const text = newsMessage(w, content, {
      kind: "announced",
      season: {
        number: 1,
        startedAt: NOW - 86400,
        endsAt: NOW + 7 * 86400,
        modifier: null,
        next: "storm_season",
      },
    });
    expect(text).toContain(`<t:${NOW + 7 * 86400}:R>`);
    expect(text).toContain("**Storm Season**");
    expect(text).not.toContain("⟦");
  });

  it("names the winners with their titles", () => {
    const text = newsMessage(w, content, {
      kind: "ended",
      ended: 1,
      season: { number: 2, startedAt: NOW, endsAt: null, modifier: null, next: null },
      winners: [{ category: "signal", name: "Otto", value: 1 }],
    });
    expect(text).toContain("Keeper of the Signal: **Otto**");
    expect(text).toContain("Season 2 begins now.");
    expect(text).not.toContain("⟦");
  });
});

describe("a DM", () => {
  it("offers the base, the game where it matters, and DMs off", () => {
    for (const note of NOTES) {
      const screen = noteScreen(w, note);
      expect(lintScreen(screen)).toEqual([]);
      const row = screen.rows[0];
      const labels = row?.kind === "buttons" ? row.buttons.map((button) => button.label) : [];
      expect(labels).toEqual(["Show my base", "Open the game", "Turn DMs off"]);
      expect(row?.kind === "buttons" && row.buttons[1]?.url).toBe(note.url);
    }
  });
});
