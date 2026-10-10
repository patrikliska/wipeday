import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ICON_ACCENTS, ICON_KINDS, iconAccent, iconsWanted, lintIcon } from "./icons";
import { loadGame } from "./load";
import { contentPaths } from "./paths";

const files = readdirSync(contentPaths.icons, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((dir) =>
    readdirSync(join(contentPaths.icons, dir.name)).map((name) => ({
      kind: dir.name,
      name,
      svg: readFileSync(join(contentPaths.icons, dir.name, name), "utf8"),
    })),
  );

const FINE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="currentColor">' +
  '<path fill="#e3a32f" stroke="currentColor" stroke-width="3" d="M4 4H44V44H4Z"/></svg>';

describe("the icon rules (D141)", () => {
  it("pass a file that keeps them", () => {
    expect(lintIcon(FINE, "scrap")).toEqual([]);
    expect(iconAccent(FINE)).toBe("#e3a32f");
  });

  it("name every rule a file breaks", () => {
    const bad =
      '<svg xmlns="http://www.w3.org/2000/svg" width="48" viewBox="0 0 24 24">' +
      '<text>A</text><path id="a" fill="#123456" stroke="#e3a32f" stroke-width="2" d="M0 0"/>' +
      '<image href="x.png"/><linearGradient/></svg>';
    expect(lintIcon(bad, "Bad-Id")).toEqual([
      "the id is not snake_case, 2-32 chars",
      'the root needs viewBox="0 0 48 48"',
      "the root has a width or height",
      "uses <text>",
      "uses a raster <image>",
      "uses a gradient",
      "uses an external reference",
      "uses an id attribute",
      "#123456 is not one of the icon accents",
      "2 fixed colours (at most one accent)",
      "stroke-width 2 is under 3",
    ]);
    expect(lintIcon("<path/>")).toEqual(["no <svg> root"]);
  });
});

describe("the shipped icons", () => {
  it("live in a known kind folder and are all .svg", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const { kind, name } of files) {
      expect(ICON_KINDS, `${kind}/${name}`).toContain(kind);
      expect(name, `${kind}/${name}`).toMatch(/\.svg$/);
    }
  });

  it.each(files.map((file) => [`${file.kind}/${file.name}`, file] as const))(
    "%s keeps the rules",
    (_, { name, svg }) => {
      expect(lintIcon(svg, name.replace(/\.svg$/, ""))).toEqual([]);
    },
  );

  it("use only listed accents", () => {
    for (const { kind, name, svg } of files) {
      const accent = iconAccent(svg);
      if (accent) expect(Object.keys(ICON_ACCENTS), `${kind}/${name}`).toContain(accent);
    }
  });
});

// A missing icon never blocks a phase: the lettered tile stands in (D141). They show as todos.
const { content } = loadGame();
const drawn = new Set(files.map((file) => `${file.kind}/${file.name.replace(/\.svg$/, "")}`));
const missing = iconsWanted(content).filter(({ kind, id }) => !drawn.has(`${kind}/${id}`));
describe("icons the content names", () => {
  for (const { kind, id } of missing) it.todo(`${kind}/${id} (the lettered tile stands in)`);
  it("are mostly drawn", () => {
    expect(missing.length).toBeLessThan(iconsWanted(content).length);
  });
});
