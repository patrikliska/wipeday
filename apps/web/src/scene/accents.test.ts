import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ICON_ACCENTS } from "@wipe-day/content/icons";
import { describe, expect, it } from "vitest";

/** D141: an icon's one accent is a colour the scene or the HUD already uses. */
describe("the icon accents", () => {
  const here = import.meta.dirname;
  const palette = readFileSync(join(here, "palette.ts"), "utf8").toLowerCase();
  const tokens = readFileSync(join(here, "..", "styles", "tokens.css"), "utf8").toLowerCase();

  it.each(Object.keys(ICON_ACCENTS))("%s is in palette.ts or tokens.css", (hex) => {
    const inPalette = palette.includes(`0x${hex.slice(1)}`);
    const inTokens = tokens.includes(hex);
    expect(inPalette || inTokens).toBe(true);
  });
});
