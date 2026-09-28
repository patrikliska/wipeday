import { describe, expect, it } from "vitest";
import { Locale } from "./locale";

const sample = Locale.fromObject({
  resource: { wood: { name: "Wood" } },
  error: { missing: "You need {amount} more {what}." },
});

describe("Locale", () => {
  it("flattens nested objects to dotted keys", () => {
    expect(sample.t("resource.wood.name")).toBe("Wood");
    expect(sample.has("resource.wood")).toBe(false);
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(sample.t("error.missing", { amount: "2.1k", what: "stone" })).toBe(
      "You need 2.1k more stone.",
    );
    expect(sample.t("error.missing", { amount: 5 })).toBe("You need 5 more {what}.");
  });

  it("shows a missing key instead of throwing", () => {
    expect(sample.t("nope.nothing")).toBe("⟦nope.nothing⟧");
  });

  it("rejects non-string leaves", () => {
    expect(() => Locale.fromObject({ count: 3 })).toThrow(/count/);
  });
});
