/**
 * Daily quests (D248, D257): the island's three for the day, the same for every friend; progress
 * is a counter's growth since the roll; the roll pays what the old day met and left unclaimed.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { applyCommand, type Command, type CommandResult } from "./commands";
import { nextQuestRoll, questOf, questProgress, questsOf, rollQuestIds } from "./quests";
import { type BaseState, newBase } from "./state";
import { islandDay } from "./weather";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const DAY = 86_400;

const fresh = (seed = 1): BaseState => newBase(content, T0, seed);
const ok = (result: CommandResult): BaseState => {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.refusal)}`);
  return result.state;
};
const run = (state: BaseState, command: Command, now = T0) =>
  applyCommand(content, state, command, now);
const counting = (state: BaseState, stat: keyof BaseState["meta"]["stats"], n: number) => ({
  ...state,
  meta: { ...state.meta, stats: { ...state.meta.stats, [stat]: state.meta.stats[stat] + n } },
});

describe("the day's roll (D257)", () => {
  it("draws perDay distinct quests for a day, the same for every base, different across days", () => {
    const day = islandDay(content, T0);
    const ids = rollQuestIds(content, day);
    expect(ids).toHaveLength(content.quests.perDay);
    expect(new Set(ids).size).toBe(ids.length);
    const a = run(fresh(1), { type: "ping" }).state;
    const b = run(fresh(2), { type: "ping" }).state;
    expect(a.meta.quests.ids).toEqual(ids);
    expect(b.meta.quests.ids).toEqual(ids);
    expect(a.meta.quests.day).toBe(day);
    expect(a.meta.quests.snapshot).toEqual(a.meta.stats);
    const days = new Set<string>();
    for (let d = day; d < day + 30; d++) days.add(rollQuestIds(content, d).join(","));
    expect(days.size).toBeGreaterThan(10);
  });

  it("rolls on the first command and reports it; a command inside the day does not", () => {
    const first = run(fresh(), { type: "ping" });
    expect(first.events.map((event) => event.type)).toContain("quests_rolled");
    const second = run(first.state, { type: "ping" }, T0 + 60);
    expect(second.events.map((event) => event.type)).not.toContain("quests_rolled");
    expect(second.state.meta.quests).toBe(first.state.meta.quests);
    expect(nextQuestRoll(content, T0)).toBeGreaterThan(T0);
    expect(islandDay(content, nextQuestRoll(content, T0))).toBe(islandDay(content, T0) + 1);
    expect(islandDay(content, nextQuestRoll(content, T0) - 1)).toBe(islandDay(content, T0));
  });
});

describe("claim_quest", () => {
  it("counts growth since the roll, pays each and the set once, refuses twice and unmet", () => {
    let state = run(fresh(), { type: "ping" }).state;
    const quests = questsOf(content, state);
    expect(quests).toHaveLength(3);
    const [first] = quests;
    if (!first) throw new Error("no quests");
    const day = state.meta.quests.day;
    // Lifetime counters already high before the roll count for nothing.
    expect(questProgress(state, first)).toEqual({ value: 0, goal: first.n });
    const unmet = run(state, { type: "claim_quest", day, id: first.id });
    expect(unmet.ok).toBe(false);
    if (!unmet.ok) expect(unmet.refusal).toEqual({ reason: "unmet", value: 0, goal: first.n });
    let scrap = 0;
    for (const [i, quest] of quests.entries()) {
      state = counting(state, quest.stat, quest.n);
      expect(questProgress(state, quest).value).toBe(quest.n);
      const result = run(state, { type: "claim_quest", day, id: quest.id }, T0 + i);
      state = ok(result);
      for (const pay of content.quests.pays.each) if ("scrap" in pay) scrap += pay.scrap;
      const last = i === quests.length - 1;
      if (last) {
        for (const pay of content.quests.pays.set) if ("scrap" in pay) scrap += pay.scrap;
        expect(result.events.map((event) => event.type)).toContain("quest_set_done");
        expect(state.meta.drops.held[1]).toBe(1);
        expect(state.meta.quests.setPaid).toBe(true);
      } else {
        expect(result.events.map((event) => event.type)).not.toContain("quest_set_done");
      }
      expect(state.meta.scrap).toBe(scrap);
      expect(state.meta.stats.scrap).toBe(scrap);
      const again = run(state, { type: "claim_quest", day, id: quest.id }, T0 + i);
      expect(again.ok).toBe(false);
      if (!again.ok) expect(again.refusal.reason).toBe("claimed");
    }
    expect(state.meta.stats.quests).toBe(3);
    const stale = run(state, { type: "claim_quest", day: day - 1, id: first.id });
    if (!stale.ok) expect(stale.refusal.reason).toBe("stale");
    const unknown = run(state, { type: "claim_quest", day, id: "nope" });
    if (!unknown.ok) expect(unknown.refusal.reason).toBe("unknown");
    expect(questOf(content, "nope")).toBeUndefined();
  });

  it("pays met, unclaimed quests at the next day's roll, the set too, and draws the new day", () => {
    let state = run(fresh(4), { type: "ping" }).state;
    const quests = questsOf(content, state);
    for (const quest of quests) state = counting(state, quest.stat, quest.n);
    // Nobody clicked. The next day's first command pays everything the day earned.
    const tomorrow = nextQuestRoll(content, T0) + 5;
    const rolled = run(state, { type: "ping" }, tomorrow);
    const types = rolled.events.map((event) => event.type);
    expect(types.filter((type) => type === "quest_claimed")).toHaveLength(quests.length);
    expect(types).toContain("quest_set_done");
    expect(types).toContain("quests_rolled");
    let scrap = 0;
    for (const pay of content.quests.pays.each)
      if ("scrap" in pay) scrap += pay.scrap * quests.length;
    for (const pay of content.quests.pays.set) if ("scrap" in pay) scrap += pay.scrap;
    expect(rolled.state.meta.scrap).toBe(scrap);
    expect(rolled.state.meta.drops.held[1]).toBe(1);
    expect(rolled.state.meta.quests.day).toBe(islandDay(content, tomorrow));
    expect(rolled.state.meta.quests.claimed).toEqual([]);
    expect(rolled.state.meta.quests.setPaid).toBe(false);
    expect(rolled.state.meta.quests.snapshot).toEqual(rolled.state.meta.stats);
    // Even a refused command rolls the day (the roll is time's, like settle).
    const refused = run(state, { type: "buy_line", line: "reactor", count: 1 }, tomorrow);
    expect(refused.ok).toBe(false);
    expect(refused.state.meta.quests.day).toBe(islandDay(content, tomorrow));
    expect(refused.state.meta.scrap).toBe(scrap);
    // A day skipped entirely pays nothing and rolls that day's set.
    const skipped = run(rolled.state, { type: "ping" }, tomorrow + 2 * DAY);
    expect(skipped.state.meta.scrap).toBe(scrap);
    expect(skipped.state.meta.quests.day).toBe(islandDay(content, tomorrow + 2 * DAY));
  });
});
