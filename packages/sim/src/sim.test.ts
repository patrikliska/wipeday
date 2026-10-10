import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { CHECKS, checkPacing, phaseIndex, simulate } from "./sim";

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
    expect(seconds).toBeLessThan(10);
  });

  it("has a check for every assertion a shipped phase switched on", () => {
    const shipped = phaseIndex(content.pacing.shipped);
    const due = content.pacing.assertions.filter((a) => phaseIndex(a.on) <= shipped);
    expect(due.length).toBeGreaterThan(0);
    for (const assertion of due) expect(CHECKS[assertion.check], assertion.check).toBeDefined();
  });

  it("is deterministic: the same archetype and days give the same life", () => {
    for (const [name, archetype] of Object.entries(content.pacing.archetypes)) {
      expect(simulate(content, name, archetype, 7)).toEqual(simulate(content, name, archetype, 7));
    }
  });

  it("plays every archetype: taps, purchases and hands, with every number finite", () => {
    for (const [name, archetype] of Object.entries(content.pacing.archetypes)) {
      if (archetype.startDay !== undefined) continue;
      const life = simulate(content, name, archetype, 3);
      const last = life.days.at(-1);
      expect(last?.taps, name).toBeGreaterThan(0);
      expect(last?.owned, name).toBeGreaterThan(0);
      expect(Number.isFinite(life.largest), name).toBe(true);
    }
  });
});
