import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { ARCHETYPES, checkPacing, simulate } from "./sim";

const content = loadContent(contentPaths.data, loadLocale());

describe("the simulator", () => {
  it("meets the pacing targets in data/pacing.json5 (what `pnpm sim check` asserts)", () => {
    const failures = checkPacing(content, 35).filter((result) => !result.warning);
    expect(failures.map((result) => result.message)).toEqual([]);
  });

  it("is deterministic: the same archetype and days give the same run", () => {
    for (const archetype of ARCHETYPES) {
      expect(simulate(content, archetype, 7)).toEqual(simulate(content, archetype, 7));
    }
  });
});
