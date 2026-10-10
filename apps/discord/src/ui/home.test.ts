import { loadGame } from "@wipe-day/content/load";
import { words } from "@wipe-day/domain/words";
import { describe, expect, it } from "vitest";
import { homeFixtures } from "../render/fixtures";
import { homeScreen } from "./home";
import { type Button, lintScreen, type Screen } from "./screen";

const { content, locale } = loadGame();
const lexicon = { content, words: words(locale, content) };
const fixtures = homeFixtures(content);

const screenOf = (state: string): Screen => {
  const found = fixtures.find((candidate) => candidate.state === state);
  if (!found) throw new Error(`no ${state} fixture`);
  return homeScreen(lexicon, found.home, found.last);
};
const buttons = (screen: Screen): Button[] =>
  screen.rows.flatMap((row) => (row.kind === "buttons" ? row.buttons : []));
const primary = (screen: Screen) => buttons(screen).find((button) => button.style === "primary");

describe("the /base message until R2", () => {
  it("passes the zero-tutorial lint in every state, with no missing string", () => {
    for (const fixture of fixtures) {
      const screen = homeScreen(lexicon, fixture.home, fixture.last);
      expect(lintScreen(screen), fixture.state).toEqual([]);
      const text = [screen.title, screen.status, ...screen.details, screen.hint].join("\n");
      expect(text, fixture.state).not.toContain("⟦");
    }
  });

  it("says the island is being rebuilt and makes Open the game the one primary", () => {
    const screen = screenOf("rebuilding");
    expect(screen.title).toBe("Nia on Saltmarsh");
    expect(screen.status).toContain("being rebuilt");
    expect(primary(screen)?.label).toBe("Open the game");
    expect(primary(screen)?.url).toContain("/api/auth/link?t=");
    expect(buttons(screen).filter((button) => button.style === "primary")).toHaveLength(1);
  });

  it("offers no Collect or Gather: the bot changes nothing until R2", () => {
    for (const fixture of fixtures) {
      const labels = buttons(homeScreen(lexicon, fixture.home, fixture.last)).map((b) => b.label);
      expect(labels.some((label) => /Collect|Gather/.test(label))).toBe(false);
    }
  });

  it("says what the last click did, and offers DMs on or off", () => {
    expect(screenOf("dm_off").status).toBe("DMs are off. Turn them back on here any time.");
    expect(buttons(screenOf("dm_off")).some((button) => button.label === "Turn DMs on")).toBe(true);
    expect(buttons(screenOf("rebuilding")).some((button) => button.label === "Turn DMs off")).toBe(
      true,
    );
    expect(screenOf("stale").status).toContain("older bot");
  });
});
