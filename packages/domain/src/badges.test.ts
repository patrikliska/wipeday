/**
 * Badges (D198, D239): earned once after the command that meets them, never on a refusal or
 * inside settle; each raises Morale by moralePer.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { BADGE_EVENTS, BADGE_STATS } from "@wipe-day/content/schema";
import { describe, expect, it } from "vitest";
import { badgeCount, badgeProgress, moraleOf } from "./badges";
import { applyCommand } from "./commands";
import { rates } from "./effects";
import type { GameEvent } from "./events";
import { settle } from "./settle";
import { type BaseState, newBase } from "./state";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const badge = (id: string) => {
  const def = content.achievements.badges.find((b) => b.id === id);
  if (!def) throw new Error(id);
  return def;
};

const fresh = (patch: Partial<BaseState["run"]> = {}): BaseState => {
  const base = newBase(content, T0, 2);
  return { ...base, run: { ...base.run, ...patch } };
};

describe("badges", () => {
  it("are earned once, with one badge_unlocked event", () => {
    const state = fresh({ supplies: 100 });
    const first = applyCommand(
      content,
      state,
      { type: "buy_line", line: "beachcomber", count: 1 },
      T0,
    );
    expect(first.state.meta.badges.first_line).toBe(T0);
    expect(first.events).toContainEqual({ type: "badge_unlocked", id: "first_line" });
    const second = applyCommand(
      content,
      first.state,
      { type: "buy_line", line: "beachcomber", count: 1 },
      T0 + 5,
    );
    expect(second.state.meta.badges.first_line).toBe(T0);
    expect(second.events.filter((e) => e.type === "badge_unlocked")).toEqual([]);
  });

  it("are never earned on a refusal, nor by settle", () => {
    // Supplies of 777: Lucky Sevens is met, but the purchase is refused.
    const state = fresh({ supplies: 777 });
    const refused = applyCommand(content, state, { type: "buy_era", era: "metal" }, T0);
    expect(refused.ok).toBe(false);
    expect(refused.state.meta.badges).toEqual({});
    expect(settle(content, state, T0 + 10).state.meta.badges).toEqual({});
    const ping = applyCommand(content, state, { type: "ping" }, T0);
    expect(ping.state.meta.badges.lucky_sevens).toBe(T0);
  });

  it("read event fields, Lte bounds and the island's clock", () => {
    const state = fresh({ supplies: 1e9, startedAt: T0 - 30 });
    const era = applyCommand(content, state, { type: "buy_era", era: "wood" }, T0);
    expect(era.state.meta.badges.timber_era).toBe(T0);
    expect(era.state.meta.badges.timber_sprint).toBe(T0);
    const slow = applyCommand(
      content,
      { ...state, run: { ...state.run, startedAt: T0 - 600 } },
      { type: "buy_era", era: "wood" },
      T0,
    );
    expect(slow.state.meta.badges.timber_era).toBe(T0);
    expect(slow.state.meta.badges.timber_sprint).toBeUndefined();
  });

  it("raise Morale by moralePer each, on lines and taps", () => {
    const state = fresh();
    const two = {
      ...state,
      meta: { ...state.meta, badges: { first_line: T0, first_hand: T0, gone_badge: T0 } },
    };
    expect(badgeCount(content, two)).toBe(2);
    expect(moraleOf(content, two)).toBeCloseTo(1 + 2 * content.achievements.moralePer, 12);
    expect(rates(content, two).morale).toBeCloseTo(moraleOf(content, two), 12);
    expect(rates(content, two).tapGlobal / rates(content, state).tapGlobal).toBeCloseTo(
      moraleOf(content, two),
      12,
    );
  });

  it("show progress for counters and none for one-off conditions", () => {
    const state = fresh();
    const counted = {
      ...state,
      meta: { ...state.meta, stats: { ...state.meta.stats, taps: 420 } },
    };
    expect(badgeProgress(content, badge("taps_1k"), counted)).toEqual({ value: 420, goal: 1000 });
    expect(badgeProgress(content, badge("first_magpie"), counted)).toBeNull();
  });

  it("name only real counters and events (the content's lists match the domain)", () => {
    const stats: Record<(typeof BADGE_STATS)[number], number> = fresh().meta.stats;
    expect(Object.keys(stats).length).toBeGreaterThanOrEqual(BADGE_STATS.length);
    // A compile-time check: every badge event is a GameEvent type.
    const types: GameEvent["type"][] = [...BADGE_EVENTS];
    expect(types).toHaveLength(BADGE_EVENTS.length);
  });

  it("find Slept Through It on the Collect after a full window", () => {
    const state = fresh({ activeAt: T0 - 10 * 3600, settledAt: T0 - 10 * 3600 });
    const collect = applyCommand(content, state, { type: "collect" }, T0);
    expect(collect.state.meta.badges.slept_through).toBe(T0);
    expect(collect.state.meta.badges.first_collect).toBe(T0);
    const soon = fresh({ activeAt: T0 - 60, settledAt: T0 - 60 });
    expect(
      applyCommand(content, soon, { type: "collect" }, T0).state.meta.badges.slept_through,
    ).toBeUndefined();
  });
});
