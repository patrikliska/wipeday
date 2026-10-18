import { readFileSync } from "node:fs";
import { join } from "node:path";
import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import { loadGame } from "./load";
import { contentPaths } from "./paths";
import { checkSounds, fillCue, templateFields } from "./sounds";

const { content, locale } = loadGame();
const raw = JSON5.parse(readFileSync(join(contentPaths.data, "sounds.json5"), "utf8"));
const values = {
  target: content.targets.map((target) => target.id),
  kind: content.flotsam.kinds.map((kind) => kind.id),
  action: ["open", "close", "switch"],
};

describe("sounds.json5", () => {
  it("is valid and every event's cue exists for every value of its template", () => {
    const { sounds, problems } = checkSounds(raw, values);
    expect(problems).toEqual([]);
    expect(sounds).not.toBeNull();
  });

  it("credits every source it uses, with its licence, in the locale", () => {
    const { sounds } = checkSounds(raw, values);
    for (const source of sounds?.sources ?? []) {
      expect(locale.has(`credits.source.${source.id}`), source.id).toBe(true);
      expect(locale.has(`credits.licence.${source.licence}`), source.licence).toBe(true);
    }
  });

  it("reports a cue an event names but nobody defined", () => {
    const broken = structuredClone(raw);
    broken.events.felled.cue = "topple_{target}";
    const { problems } = checkSounds(broken, values);
    expect(problems).toContain("event felled: cue topple_tree is not defined");
  });

  it("reports a file from an unlisted source", () => {
    const broken = structuredClone(raw);
    broken.cues.buy.files = ["somewhere_else/coins"];
    const { problems } = checkSounds(broken, values);
    expect(problems).toContain("cue buy: somewhere_else/coins names no listed source");
  });
});

describe("cue templates", () => {
  it("lists and fills their fields", () => {
    expect(templateFields("claim_{kind}")).toEqual(["kind"]);
    expect(fillCue("tap_{target}", { target: "ore" })).toBe("tap_ore");
    expect(fillCue("tap_{target}", {})).toBeNull();
    expect(fillCue("buy", {})).toBe("buy");
  });
});
