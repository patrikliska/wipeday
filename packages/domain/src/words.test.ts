import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import type { FeedEvent } from "./feed";
import { abbrev, duration, words } from "./words";

const missing: string[] = [];
const locale = loadLocale(contentPaths.localeFile, (key) => missing.push(key));
const content = loadContent(contentPaths.data, locale);
const w = words(locale, content);

describe("abbrev", () => {
  it("keeps small numbers verbatim and abbreviates the rest toward zero", () => {
    expect(abbrev(0)).toBe("0");
    expect(abbrev(999)).toBe("999");
    expect(abbrev(-42)).toBe("-42");
    expect(abbrev(1_000)).toBe("1k");
    expect(abbrev(12_449)).toBe("12.4k");
    expect(abbrev(123_456)).toBe("123k");
    expect(abbrev(1_999)).toBe("1.9k");
    expect(abbrev(9_999_999)).toBe("9.9M");
    expect(abbrev(2_500_000_000)).toBe("2.5B");
  });
});

describe("duration", () => {
  it("uses two units at most", () => {
    expect(duration(45)).toBe("45s");
    expect(duration(12 * 60)).toBe("12m");
    expect(duration(3 * 3600 + 20 * 60)).toBe("3h 20m");
    expect(duration(2 * 86_400 + 4 * 3600 + 59)).toBe("2d 4h");
    expect(duration(-5)).toBe("0s");
  });
});

describe("feed lines", () => {
  const site = content.sites[0]?.id ?? "";
  const survivor = content.crew[0]?.id ?? "";
  const item = content.items[0]?.id ?? "";
  const report = {
    id: "r1",
    kind: "npc",
    at: 0,
    outcome: "breached",
    chance: 40,
    defence: 10,
    attack: 20,
    lost: { timber: 40 },
    gained: {},
    foe: null,
    damaged: true,
    revenge: false,
    read: false,
  } as const;
  const events: FeedEvent[] = [
    {
      type: "mission_back",
      mission: "m1",
      kind: "trip",
      target: site,
      outcome: "success",
      crew: [survivor],
      gained: {},
      at: 0,
    },
    { type: "survivor_arrived", survivor, at: 0, from: "rescue" },
    { type: "build_done", tier: "stone" },
    { type: "level_up", survivor, level: 3 },
    { type: "blueprint_found", recipe: item, from: "barrel" },
    { type: "item_found", item, from: site },
    { type: "sold", listing: "l1", good: "timber", amount: 1200, price: 340, at: 0 },
    { type: "big_win", game: "slots", bet: 50, payout: 2500, at: 0 },
    { type: "jackpot_won", amount: 12_000, at: 0 },
    { type: "raid_landed", report },
    { type: "raid_launched", report, target: 2, targetName: "Ana", paid: {} },
    { type: "signal_lit" },
  ] as FeedEvent[];

  it("has a sentence for every feed event, naming who", () => {
    for (const event of events) {
      const line = w.feedLine(event, "Nell");
      expect(line, event.type).toContain("Nell");
      expect(line, event.type).not.toContain("⟦");
    }
    expect(missing).toEqual([]);
  });

  it("formats amounts with the one formatter", () => {
    expect(w.feedLine(events[6] as FeedEvent, "Nell")).toContain("1.2k");
    expect(w.gainLines({ timber: 1500, stone: 20, ore: 0 }, 5)).toEqual([
      "+1.5k Timber",
      "+20 Stone",
    ]);
  });
});
