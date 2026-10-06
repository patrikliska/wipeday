import { loadContent, loadLocale } from "@wipe-day/content/load";
import { RTP_RANGE } from "@wipe-day/content/parse";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { measureAll } from "./rtp";

const content = loadContent(contentPaths.data, loadLocale());

describe("the casino's return over a million rounds per bet option (roadmap W5)", () => {
  const rows = measureAll(content);

  it.each(rows.map((row) => [`${row.game} ${row.option ?? ""}`.trim(), row] as const))(
    "%s is within one point of its exact odds and keeps the Den's edge",
    (_name, row) => {
      expect(Math.abs(row.measured - row.exact)).toBeLessThan(0.01);
      expect(row.exact).toBeGreaterThanOrEqual(RTP_RANGE.min);
      expect(row.exact).toBeLessThanOrEqual(RTP_RANGE.max);
    },
  );

  it("hits the slots jackpot about as often as the odds say", () => {
    const slots = rows.find((row) => row.game === "slots");
    // 1 in ~6,300: about 158 in a million; well inside 100-220.
    expect(slots?.jackpots).toBeGreaterThan(100);
    expect(slots?.jackpots).toBeLessThan(220);
  });
});
