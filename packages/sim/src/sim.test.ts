import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import {
  CHECKS,
  checkPacing,
  earlyStops,
  type Life,
  PRICE_CAPS,
  phaseIndex,
  priceCuts,
  type RunRow,
  scenarioStop,
  simulate,
} from "./sim";

const content = loadContent(contentPaths.data, loadLocale());

describe("simulator v2", () => {
  it("passes every assertion switched on so far, in under 10 s (what `pnpm sim check` asserts)", () => {
    const started = performance.now();
    const verdicts = checkPacing(content, "test");
    const seconds = (performance.now() - started) / 1000;
    const bad = verdicts.filter(
      (verdict) => verdict.status === "fail" || verdict.status === "missing",
    );
    expect(bad).toEqual([]);
    // CLAUDE.md 9 asks under 10 s. The real nuke loop (R4 S1) put the profile at 21 s on the
    // owner's machine; R4 S4 (D272) brought the domain's folds and the profile back: 2.7× faster,
    // measured on that machine while a game held 40% of its cores (34 s before, 12.8 s after).
    expect(seconds).toBeLessThan(10);
    // vitest's own limit sits above the budget, so a slow run fails on the budget, by name.
  }, 60_000);

  it("plays each archetype in the quick profile only as long as a due assertion reads it (D236)", () => {
    const shipped = phaseIndex(content.pacing.shipped);
    const due = content.pacing.assertions.filter((a) => phaseIndex(a.on) <= shipped);
    const stops = earlyStops(content, due);
    // N9 reads the active at days 14, 30 and 60; `quickDays` keeps the quick profile at 14.
    expect(stops?.active).toEqual({ day: 14, runs: 5 });
    // N19 reads everyone's first week from day 2 (R3), but the optimal player's `quickDays` keeps it at run 1.
    expect(stops?.optimal).toEqual({ day: 1, runs: 5 });
    // The scrap row reads the late joiner's first week from its day 2 too (start day 30).
    expect(stops?.lateJoiner?.day).toBe(37);
    // A check whose reach is unknown plays every life to the profile's last day.
    expect(earlyStops(content, [...due, { n: "N99", on: "R1", check: "gaps" }])).toBeNull();
  });

  it("has a check for every assertion a shipped phase switched on", () => {
    const shipped = phaseIndex(content.pacing.shipped);
    const due = content.pacing.assertions.filter((a) => phaseIndex(a.on) <= shipped);
    expect(due.length).toBeGreaterThan(0);
    for (const assertion of due) expect(CHECKS[assertion.check], assertion.check).toBeDefined();
  });

  it("plays every archetype deterministically: taps, purchases, hands, every number finite", () => {
    // Two days each, twice (the first nukes and the map): about 3 s alone.
    for (const [name, archetype] of Object.entries(content.pacing.archetypes)) {
      const life = simulate(content, name, archetype, 2);
      expect(life).toEqual(simulate(content, name, archetype, 2));
      if (archetype.startDay !== undefined) continue;
      const last = life.days.at(-1);
      expect(last?.taps, name).toBeGreaterThan(0);
      expect(last?.owned, name).toBeGreaterThan(0);
      expect(Number.isFinite(life.largest), name).toBe(true);
    }
  }, 20_000);

  it("measures the map's price cuts at their caps (errata E25): no shipped cut is below one", () => {
    const rows = priceCuts(content);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.shipped, `${row.stat} ${row.scope}`).toBeLessThanOrEqual(1);
      expect(row.all, `${row.stat} ${row.scope}`).toBeLessThanOrEqual(row.shipped);
      if (row.cap !== null)
        expect(row.shipped, `${row.stat} ${row.scope}`).toBeGreaterThanOrEqual(row.cap);
    }
    expect(PRICE_CAPS.upgrade_cost).toBe(0.25);
    expect(PRICE_CAPS.era_cost).toBe(0.5);
  });

  it("N13 fails on a flat fixture: five nukes under ×1.3 with nothing opening in the next three", () => {
    const assertion = content.pacing.assertions.find(
      (row) => row.check === "flattening" && row.on === "R4",
    );
    const check = CHECKS.flattening;
    if (!assertion || !check) throw new Error("no N13 row or check");
    const run = (n: number, power: number, wipeDay: number): RunRow => ({
      n,
      start: 0,
      end: 1,
      made: 1,
      glass: 1,
      orders: 0,
      fuelled: false,
      wipeDay,
      nodes: 0,
      lit: 0,
      power,
      passedAt: null,
    });
    const life = (powers: number[], from: number): Life => ({
      name: "fixture",
      days: [],
      runs: powers.map((power, i) => run(i + 1, power, from + i)),
      firstHandSeconds: null,
      beats: {},
      stuck: { early: 0, online: 0 },
      checkIns: [],
      income: { firstMinute: { tapDriven: 0, made: 0 }, later: { direct: 0, made: 0 } },
      snapshots: {},
      largest: 0,
      steps: 0,
    });
    // Wipe Days 60-64: the agenda lists nothing past 50, so a ×1.28 stretch is flat.
    const flat = check(assertion, { content, lives: [life([1.05, 1.05, 1.05, 1.05, 1.05], 60)] });
    expect(flat.ok).toBe(false);
    expect(flat.detail).toContain("fixture runs 1-5");
    // ×1.34 over the same five is not.
    const rising = check(assertion, { content, lives: [life([1.06, 1.06, 1.06, 1.06, 1.06], 60)] });
    expect(rising.ok).toBe(true);
  });

  it("ends the autoclicker's quick session with its first press; --full plays it out (D272)", () => {
    const scenario = content.pacing.scenarios.autoclicker;
    if (!scenario) throw new Error("no autoclicker scenario");
    expect(scenario.quickRuns).toBe(1);
    const quick = simulate(
      content,
      "autoclicker",
      scenario,
      1,
      1,
      [],
      scenarioStop(scenario, true),
    );
    const full = simulate(
      content,
      "autoclicker",
      scenario,
      1,
      1,
      [],
      scenarioStop(scenario, false),
    );
    // The same run 1 (N2 reads its press), then the quick life ends inside run 2.
    expect(quick.runs[0]).toEqual(full.runs[0]);
    expect(quick.runs).toHaveLength(2);
    expect(full.runs.length).toBeGreaterThan(2);
  }, 20_000);
});
