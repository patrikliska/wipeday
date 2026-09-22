import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverPaths } from "../paths";
import { Locale } from "../ui/locale";
import { ContentError, formatProblem, loadContent } from "./load";

const paths = discoverPaths();
const locale = Locale.load(join(paths.locale, "en.json"));

/** A private copy of the real data dir with one file patched. */
function dataWith(file: string, patch: (text: string) => string): string {
  const dir = mkdtempSync(join(tmpdir(), "wipe-day-data-"));
  cpSync(paths.data, dir, { recursive: true });
  writeFileSync(join(dir, file), patch(readFileSync(join(dir, file), "utf8")));
  return dir;
}

function problemsOf(dir: string, withLocale = locale): string[] {
  try {
    loadContent(dir, withLocale);
    return [];
  } catch (error) {
    if (error instanceof ContentError) return error.problems.map(formatProblem);
    throw error;
  }
}

describe("the shipped data files", () => {
  it("load with no problems", () => {
    const content = loadContent(paths.data, locale);
    expect(content.resources.map((resource) => resource.id)).toContain("sulfur_ore");
    expect(content.monuments).toHaveLength(14);
  });
});

describe("validation", () => {
  it("reports every problem at once, with file and id", () => {
    const dir = dataWith("resources.json5", (text) =>
      text
        .replace('id: "stone"', 'id: "wood"')
        .replace('id: "cloth"', 'id: "Bad-Id"')
        .replace('kind: "currency"', 'kind: "gold", cost: -5'),
    );
    const problems = problemsOf(dir);
    expect(problems).toContain("resources.json5 `wood`: id is used more than once");
    expect(problems.some((p) => p.includes("`Bad-Id`") && p.includes("snake_case"))).toBe(true);
    expect(problems.some((p) => p.includes("`scrap`") && p.includes("kind"))).toBe(true);
    expect(problems.some((p) => p.includes("`scrap`") && p.includes("cost"))).toBe(true);
  });

  it("requires a locale name for every entity", () => {
    const problems = problemsOf(paths.data, Locale.fromObject({}));
    expect(problems).toContain("resources.json5 `wood`: missing locale key `resource.wood.name`");
    expect(problems).toContain("base_tiers.json5 `hqm`: missing locale key `base_tier.hqm.name`");
  });

  it("requires a contiguous monument chain gated by real keycards", () => {
    const dir = dataWith("monuments.json5", (text) =>
      text.replace("order: 3,", "order: 30,").replace('"keycard_red"', '"syringe"'),
    );
    const problems = problemsOf(dir);
    expect(problems.some((p) => p.includes("no gaps or repeats"))).toBe(true);
    expect(problems.some((p) => p.includes("`syringe` is not a keycard item"))).toBe(true);
  });

  it("requires base tiers to match the theme's tier list", () => {
    const dir = dataWith("base_tiers.json5", (text) => text.replace('id: "twig"', 'id: "mud"'));
    expect(problemsOf(dir).some((p) => p.includes("must list exactly [twig, wood"))).toBe(true);
  });
});
