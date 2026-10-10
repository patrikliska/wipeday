import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { duration, numberFormat, suffixesOf, words } from "./words";

const missing: string[] = [];
const locale = loadLocale(contentPaths.localeFile, (key) => missing.push(key));
const content = loadContent(contentPaths.data, locale);
const w = words(locale, content);
const sci = numberFormat(suffixesOf(locale), true);

describe("the formatter (docs/redesign/09-architecture.md 2.4)", () => {
  // Input, fmt held, fmt cost, fmtRate, scientific (cost).
  const table: [number, string, string, string, string][] = [
    [0.4, "0", "0", "0.4/s", "0"],
    [8.25, "8", "8", "8.25/s", "8"],
    [999.6, "999", "1.00k", "1.00k/s", "1.00k"],
    [1_234, "1.23k", "1.23k", "1.23k/s", "1.23k"],
    [12_400, "12.4k", "12.4k", "12.4k/s", "12.4k"],
    [999_999, "999k", "1.00M", "1.00M/s", "1.00e6"],
    [1.5e15, "1.50Qa", "1.50Qa", "1.50Qa/s", "1.50e15"],
    [2.7e16, "27.0Qa", "27.0Qa", "27.0Qa/s", "2.70e16"],
    [9.99e35, "999Dc", "999Dc", "999Dc/s", "9.99e35"],
    [1.23e36, "1.23e36", "1.23e36", "1.23e36/s", "1.23e36"],
  ];
  for (const [input, held, cost, rate, scientific] of table) {
    it(`prints ${input}`, () => {
      expect(w.fmt(input, "held")).toBe(held);
      expect(w.fmt(input, "cost")).toBe(cost);
      expect(w.fmtRate(input)).toBe(rate);
      expect(sci.fmt(input, "cost")).toBe(scientific);
    });
  }

  it("promotes a mantissa that rounds to 1,000 and floors what is held", () => {
    expect(w.fmt(999_499, "cost")).toBe("999k");
    expect(w.fmt(999_500, "cost")).toBe("1.00M");
    expect(w.fmt(1_999, "held")).toBe("1.99k");
    expect(w.fmt(1_230, "held")).toBe("1.23k");
    expect(w.fmt(1e33, "held")).toBe("1.00Dc");
    expect(w.fmt(9.995e35, "cost")).toBe("1.00e36");
  });

  it("keeps trailing zeros so a ticking counter keeps its width", () => {
    expect(w.fmt(1_000)).toBe("1.00k");
    expect(w.fmt(10_000)).toBe("10.0k");
    expect(w.fmt(100_000)).toBe("100k");
  });

  it("prints negatives, NaN and Infinity", () => {
    expect(w.fmt(-1_234)).toBe("-1.23k");
    expect(w.fmt(-42)).toBe("-42");
    expect(w.fmt(Number.NaN)).toBe("—");
    expect(w.fmt(Number.POSITIVE_INFINITY)).toBe("—");
    expect(w.fmtRate(Number.NaN)).toBe("—");
    expect(w.fmtRate(0)).toBe("0/s");
  });

  it("counts with separators below a million", () => {
    expect(w.fmtCount(2_154)).toBe("2,154");
    expect(w.fmtCount(999_999)).toBe("999,999");
    expect(w.fmtCount(12)).toBe("12");
    expect(w.fmtCount(1_500_000)).toBe("1.50M");
  });
});

describe("duration", () => {
  it("uses two units at most", () => {
    expect(duration(45)).toBe("45s");
    expect(duration(12 * 60)).toBe("12m");
    expect(duration(3 * 3600 + 20 * 60)).toBe("3h 20m");
    expect(duration(2 * 86400 + 4 * 3600 + 59)).toBe("2d 4h");
    expect(duration(-5)).toBe("0s");
  });
});

describe("names", () => {
  it("come from the locale, for every line, hand and product", () => {
    for (const line of content.lines) {
      expect(w.lineName(line.id)).not.toMatch(/⟦/);
      expect(w.crewName(line.hand)).not.toMatch(/⟦/);
      expect(w.resourceName(line.product)).not.toMatch(/⟦/);
    }
    expect(w.islandName("saltmarsh")).toBe("Saltmarsh");
    expect(missing).toEqual([]);
  });
});
