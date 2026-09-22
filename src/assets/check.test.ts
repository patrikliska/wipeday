import { describe, expect, it } from "vitest";
import { closest, inspectFile, type Report, reportFails } from "./check";
import type { AssetSpec, Folder, Format } from "./spec";

function spec(file: string, folder: Folder, format: Format, size: number): AssetSpec {
  return {
    file,
    folder,
    format,
    width: size,
    height: size,
    depicts: "x",
    rustRef: "",
    usedIn: [],
    phase: 1,
    status: "missing",
  };
}

/** A minimal PNG header: signature + IHDR with the given dimensions. */
function pngHeader(width: number, height: number, totalBytes = 33): Buffer {
  const bytes = Buffer.alloc(Math.max(33, totalBytes));
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "latin1");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

describe("inspectFile", () => {
  it("accepts a correct PNG", () => {
    expect(inspectFile(spec("wood.png", "icons_256", "png", 256), pngHeader(256, 256))).toEqual([]);
  });

  it("reports a wrong size with both sizes", () => {
    expect(inspectFile(spec("wood.png", "icons_256", "png", 256), pngHeader(512, 512))).toEqual([
      "wrong size: is 512x512, must be 256x256",
    ]);
  });

  it("reports an oversize emoji", () => {
    const problems = inspectFile(
      spec("wood.png", "emoji_128", "png", 128),
      pngHeader(128, 128, 300 * 1024),
    );
    expect(problems).toEqual(["too big for an emoji: 300 KB, max 256 KB"]);
  });

  it("reports a JPG supplied as PNG", () => {
    // SOI, then a SOF0 segment declaring 256x256.
    const jpg = Buffer.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x00, 0x01, 0x00, 0x03, 0, 0, 0, 0,
    ]);
    const problems = inspectFile(spec("wood.png", "icons_256", "png", 256), jpg);
    expect(problems).toEqual(["wrong format: is JPG, must be PNG, transparent background"]);
  });

  it("rejects a non-font in the fonts folder", () => {
    expect(inspectFile(spec("A.ttf", "fonts", "ttf", 0), Buffer.from("not a font"))).toEqual([
      "not a TrueType/OpenType font",
    ]);
  });
});

it("suggests the intended name for typos", () => {
  const specs = [spec("sulfur_ore.png", "icons_256", "png", 256)];
  expect(closest("sulfur-ore.png", "icons_256", specs)).toBe("sulfur_ore.png");
  expect(closest("unrelated.png", "icons_256", specs)).toBeNull();
});

it("fails only for assets due in the current phase", () => {
  const report: Report = {
    specs: [],
    invalid: [],
    unlisted: [],
    missing: [{ folder: "icons_256", file: "c4.png", phase: 5, problem: "missing" }],
  };
  expect(reportFails(report, 1)).toBe(false);
  expect(reportFails(report, 5)).toBe(true);
});
