import en from "@wipe-day/content/locale/en.json";
import { type BaseState, newBase } from "@wipe-day/domain/state";
import { describe, expect, it } from "vitest";
import { content } from "../state/world";
import { tickerKeys, tickerPick } from "./tickerLines";

const KEYS = Object.keys(en.ticker);
const HANDS = new Map(content.lines.map((line) => [line.id, line.hand]));

const base = (patch: Partial<BaseState["run"]> = {}): BaseState => {
  const fresh = newBase(content, 1_700_000_000, 7);
  return { ...fresh, run: { ...fresh.run, ...patch } };
};

describe("the news ticker (12-feel.md 9.4)", () => {
  it("ships thirty lines, each with a condition the ticker knows", () => {
    expect(KEYS).toHaveLength(30);
    const known = new Set([
      "any",
      "clear",
      "rain",
      "fog",
      "night",
      ...content.eras.map((era) => era.id),
      ...content.lines.map((line) => line.hand),
    ]);
    for (const key of KEYS) expect(known.has(key.replace(/_\d+$/, ""))).toBe(true);
  });

  it("shows only what is true: the weather, the era, the hands on shift", () => {
    const lines = tickerKeys(KEYS, base({ hands: ["beachcomber"] }), "rain", 12, HANDS);
    expect(lines).toContain("ticker.rain_1");
    expect(lines).toContain("ticker.mara_1");
    expect(lines).toContain("ticker.twig_1");
    expect(lines).not.toContain("ticker.fog_1");
    expect(lines).not.toContain("ticker.dax_1");
    expect(lines).not.toContain("ticker.stone_1");
    expect(lines).not.toContain("ticker.night_1");
    const night = tickerKeys(KEYS, base(), "clear", 23, HANDS);
    expect(night).toContain("ticker.night_1");
    // The sun's lines keep to the day.
    expect(night).not.toContain("ticker.clear_1");
    expect(tickerKeys(KEYS, base(), "clear", 19.5, HANDS)).not.toContain("ticker.clear_2");
    expect(tickerKeys(KEYS, base(), "clear", 10, HANDS)).toContain("ticker.clear_2");
  });

  it("shows every true line once before any repeats", () => {
    const lines = ["a", "b", "c", "d", "e"];
    for (const pass of [0, 1, 7]) {
      const seen = new Set<string | null>();
      for (let i = 0; i < lines.length; i += 1) seen.add(tickerPick(lines, pass * 5 + i));
      expect(seen.size).toBe(lines.length);
    }
    expect(tickerPick([], 3)).toBeNull();
  });
});
