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

describe("the /base card v2 (06-friends.md 10.2; R4 S3)", () => {
  it("passes the zero-tutorial lint in every state, with no missing string", () => {
    for (const fixture of fixtures) {
      const screen = homeScreen(lexicon, fixture.home, fixture.last);
      expect(lintScreen(screen), fixture.state).toEqual([]);
      const text = [screen.title, screen.status, ...screen.details, screen.hint].join("\n");
      expect(text, fixture.state).not.toContain("⟦");
      expect(buttons(screen).filter((button) => button.style === "primary")).toHaveLength(1);
      expect(buttons(screen).map((button) => button.label)).toContain("Collect");
    }
  });

  it("names the era and the Wipe Days, the rate, the glass with Glow, the Night Shift", () => {
    const first = screenOf("first_minute");
    expect(first.title).toBe("Nia on Saltmarsh");
    expect(first.details[0]).toBe("Twig era · first run");
    expect(first.details[1]).toContain("Nothing runs by itself yet");
    expect(first.details.some((line) => line.includes("Crater glass"))).toBe(false);
    expect(first.details).toContain("Night Shift: nobody on shift yet");
    expect(first.status).toBe("Open the game and tap the tree.");
    expect(primary(first)?.label).toBe("Open the game");

    const running = screenOf("running");
    expect(running.details[0]).toBe("Stone era · Wipe Days: 12");
    expect(running.details[1]).toMatch(/^\*\*\+[\d.]+[kMBT]?\/s\*\*$/);
    expect(running.details).toContainEqual(
      expect.stringMatching(/^Crater glass \*\*320\*\* · Glow ×[\d.]+$/),
    );
    expect(running.details).toContain("Night Shift 40m of 2h");
    expect(running.status).toMatch(/^Your hands work until <t:\d+:R>\./);
    expect(primary(running)?.label).toBe("Open the game");
  });

  it("puts Collect first when the shift is stalled, and says what a Collect did", () => {
    const stalled = screenOf("stalled");
    expect(primary(stalled)?.label).toBe("Collect");
    expect(stalled.details).toContainEqual(
      expect.stringMatching(/^Night Shift full: your hands stopped <t:\d+:R>$/),
    );
    expect(stalled.status).toContain("Collect to start them again");
    const collected = screenOf("collected");
    expect(collected.status).toBe(
      "Collected: your hands worked 2h (+4.20T). A fresh 2h Night Shift starts now.",
    );
  });

  it("carries the Big Red's line from the shared glance, crowned or waiting", () => {
    const crowned = screenOf("crowned");
    expect(crowned.details).toContain("👑 The Big Red is crowned: +10 glass now");
    expect(crowned.status).toBe("The Big Red is crowned: open the game to flip the lid.");
    const running = screenOf("running");
    expect(running.details).toContainEqual(
      expect.stringMatching(/^The Big Red: the next glass at .+ made \(.+ now\)$/),
    );
  });

  it("formats a 7-digit chip through the shared formatter and keeps the longest name", () => {
    const rich = screenOf("rich");
    expect(rich.title).toContain("Wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww");
    expect(rich.details).toContainEqual(expect.stringContaining("Crater glass **1.23M**"));
  });

  it("says what the last click did, and offers DMs on or off", () => {
    expect(screenOf("dm_off").status).toBe("DMs are off. Turn them back on here any time.");
    expect(buttons(screenOf("dm_off")).some((button) => button.label === "Turn DMs on")).toBe(true);
    expect(buttons(screenOf("stale")).some((button) => button.label === "Turn DMs off")).toBe(true);
    expect(screenOf("stale").status).toContain("older bot");
  });
});
