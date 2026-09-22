import { describe, expect, it } from "vitest";
import { abbrev, delta, duration, perHour, relativeTimestamp } from "./format";

describe("abbrev", () => {
  it("keeps small numbers verbatim", () => {
    expect(abbrev(0)).toBe("0");
    expect(abbrev(999)).toBe("999");
    expect(abbrev(-42)).toBe("-42");
  });

  it("abbreviates thousands and up", () => {
    expect(abbrev(1_000)).toBe("1k");
    expect(abbrev(1_234)).toBe("1.2k");
    expect(abbrev(12_449)).toBe("12.4k");
    expect(abbrev(123_456)).toBe("123k");
    expect(abbrev(1_200_000)).toBe("1.2M");
    expect(abbrev(9_999_999)).toBe("9.9M");
    expect(abbrev(2_500_000_000)).toBe("2.5B");
  });

  it("rounds toward zero, never up", () => {
    expect(abbrev(1_999)).toBe("1.9k");
    expect(abbrev(999_999)).toBe("999k");
    expect(abbrev(-1_999)).toBe("-1.9k");
  });
});

describe("delta and rates", () => {
  it("always carries a sign", () => {
    expect(delta(214)).toBe("+214");
    expect(delta(0)).toBe("+0");
    expect(delta(-1_250)).toBe("-1.2k");
    expect(perHour(120)).toBe("+120/h");
  });
});

describe("duration", () => {
  it("uses two units at most", () => {
    expect(duration(45)).toBe("45s");
    expect(duration(12 * 60)).toBe("12m");
    expect(duration(2 * 3_600 + 5 * 60)).toBe("2h 5m");
    expect(duration(3 * 3_600)).toBe("3h");
    expect(duration(3 * 86_400 + 4 * 3_600 + 59)).toBe("3d 4h");
    expect(duration(-5)).toBe("0s");
  });
});

it("relative timestamps use Discord markup", () => {
  expect(relativeTimestamp(1_700_000_000.9)).toBe("<t:1700000000:R>");
});
