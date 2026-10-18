import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVENT_TYPES } from "../state/events";
import { cueOf } from "./director";
import { sounds } from "./map";
import { VOICES } from "./voices";

const PUBLIC = join(__dirname, "..", "..", "public", "sound");

describe("the sound map", () => {
  it("names every event on the bus, and nothing else", () => {
    expect(Object.keys(sounds.events).sort()).toEqual([...EVENT_TYPES].sort());
  });

  it("gives every cue a voice the game has", () => {
    for (const [id, cue] of Object.entries(sounds.cues))
      expect(Object.hasOwn(VOICES, cue.voice), `${id}: ${cue.voice}`).toBe(true);
  });

  it("has every file built in both formats, with the pack's licence beside it", () => {
    for (const cue of Object.values(sounds.cues)) {
      for (const file of cue.files) {
        expect(existsSync(join(PUBLIC, `${file}.ogg`)), `${file}.ogg`).toBe(true);
        expect(existsSync(join(PUBLIC, `${file}.mp3`)), `${file}.mp3`).toBe(true);
        const source = file.slice(0, file.indexOf("/"));
        expect(existsSync(join(PUBLIC, source, "License.txt")), source).toBe(true);
      }
    }
  });

  it("plays the era's own tap and fell, and buzzes on a fell but never on a tap", () => {
    const tap = cueOf({ type: "tap_at", x: 0, y: 0, gain: 1, count: 1, target: "ore" });
    expect(tap).toEqual({ cue: "tap_ore" });
    expect(cueOf({ type: "felled", target: "wreck", count: 1, value: 5 })).toEqual({
      cue: "fell_wreck",
      buzz: [20],
    });
    expect(cueOf({ type: "ui", action: "close" })?.cue).toBe("ui_close");
    expect(cueOf({ type: "go_tap" })).toBeNull();
  });
});
