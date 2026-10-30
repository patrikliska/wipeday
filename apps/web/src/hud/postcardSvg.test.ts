import { describe, expect, it } from "vitest";
import { type PostcardLook, postcardSvg } from "./postcardSvg";

const LOOK: PostcardLook = {
  wipeDay: 4,
  gain: 186,
  flight: "loop_the_loop",
  sky: { top: "#7fa6bf", mid: "#c9bca6", horizon: "#f0c9a0" },
  night: false,
  greeting: "Greetings from",
  place: "Ground Zero",
  stamp: "+186",
  postmark: "SALTMARSH · 29 OCT 2026",
  seed: 7,
};

describe("the postcard's front (03-the-big-red.md 8.1)", () => {
  it("is one SVG with the sign, the stamp and the title, the same every time", () => {
    const svg = postcardSvg(LOOK);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("WIPE DAY #4");
    expect(svg).toContain("+186");
    expect(svg).toContain("GROUND ZERO");
    expect(svg).toContain("GREETINGS FROM");
    expect(postcardSvg(LOOK)).toBe(svg);
  });

  it("shows no sign for a small blast and escapes its text", () => {
    const svg = postcardSvg({ ...LOOK, wipeDay: null, place: "Puddle <of> Glass & Co" });
    expect(svg).not.toContain("WIPE DAY");
    expect(svg).toContain("PUDDLE &lt;OF&gt; GLASS &amp; CO");
  });

  it("draws stars at night and a different path per flight", () => {
    expect(postcardSvg({ ...LOOK, night: true })).toContain("#f2f4ff");
    expect(postcardSvg({ ...LOOK, night: false })).not.toContain("#f2f4ff");
    expect(postcardSvg({ ...LOOK, flight: "u_turn" })).not.toBe(postcardSvg(LOOK));
  });
});
