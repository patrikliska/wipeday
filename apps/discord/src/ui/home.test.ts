import { loadGame } from "@wipe-day/content/load";
import { words } from "@wipe-day/domain/words";
import { describe, expect, it } from "vitest";
import { homeFixtures, NOW } from "../render/fixtures";
import { homeScreen } from "./home";
import { type Button, lintScreen, type Screen } from "./screen";

const { content, locale } = loadGame();
const lexicon = { content, words: words(locale, content) };
const fixtures = homeFixtures(content);

const screenOf = (state: string): Screen => {
  const found = fixtures.find((candidate) => candidate.state === state);
  if (!found) throw new Error(`no ${state} fixture`);
  return homeScreen(lexicon, found.home, NOW, found.last);
};
const buttons = (screen: Screen): Button[] =>
  screen.rows.flatMap((row) => (row.kind === "buttons" ? row.buttons : []));
const primary = (screen: Screen) => buttons(screen).find((button) => button.style === "primary");

describe("the /base message", () => {
  it("passes the zero-tutorial lint in every state, with no missing string", () => {
    for (const fixture of fixtures) {
      const screen = homeScreen(lexicon, fixture.home, NOW, fixture.last);
      expect(lintScreen(screen), fixture.state).toEqual([]);
      const text = [screen.title, screen.status, ...screen.details, screen.hint].join("\n");
      expect(text, fixture.state).not.toContain("⟦");
    }
  });

  it("makes the advisor's action the one primary, and puts it first", () => {
    expect(primary(screenOf("new"))?.label).toBe("Gather");
    expect(primary(screenOf("filling"))?.label).toBe("Collect");
    const busy = screenOf("busy");
    expect(primary(busy)?.url).toContain("/api/auth/link?t=");
    expect(buttons(busy)[0]).toBe(primary(busy));
    // The next step is where the eye lands.
    expect(busy.status).toBe("Next, in the game: post a guard, raiders are coming.");
  });

  it("explains every button it locks", () => {
    const full = buttons(screenOf("full"));
    expect(full.find((button) => button.label.startsWith("Collect"))).toMatchObject({
      label: "Collect · store full",
      disabled: true,
    });
    const waiting = buttons(screenOf("waiting"));
    expect(waiting.find((button) => button.label.startsWith("Gather"))).toMatchObject({
      label: "Gather · 8m",
      disabled: true,
    });
  });

  it("says what the last click did, and keeps the next step in the small print", () => {
    const banked = screenOf("banked");
    expect(banked.status).toBe("Banked +214 Timber, +80 Stone, +12 Iron Ore.");
    expect(banked.hint).toContain("Next, in the game:");
    expect(screenOf("cooldown").status).toBe(`Gather is ready again <t:${NOW + 240}:R>.`);
  });

  it("tells the timers as live Discord timestamps", () => {
    const busy = screenOf("busy");
    expect(busy.details).toEqual([
      expect.stringMatching(/^\*\*Waiting\*\* \+/),
      expect.stringMatching(/^\*\*Builders\*\* Walls level 1, done <t:\d+:R>$/),
      expect.stringMatching(/^\*\*Crafting\*\* 8× Planks, 6× Rope, the first done <t:\d+:R>$/),
      expect.stringMatching(/^\*\*Scouting\*\* Ivo in Quarry Hills, back <t:\d+:R>$/),
      expect.stringMatching(/^\*\*Out\*\* Mara, Dax at the Cannery, back <t:\d+:R>$/),
      expect.stringMatching(/^\*\*Raiders\*\* sighted: they land <t:\d+:R>\.$/),
      expect.stringMatching(/^\*\*Season 1\*\* ends <t:\d+:R>\.$/),
    ]);
  });

  it("offers DMs off when they are on, and on when they are off", () => {
    expect(buttons(screenOf("busy")).some((button) => button.label === "Turn DMs off")).toBe(true);
    expect(buttons(screenOf("full")).some((button) => button.label === "Turn DMs on")).toBe(true);
  });
});
