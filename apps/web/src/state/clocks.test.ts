import { describe, expect, it } from "vitest";
import { DEMO_START, demoClocks, jumps, untilNextMorning } from "./clocks";

describe("the demo clocks (D138)", () => {
  it("run the game clock at 1×", () => {
    expect(demoClocks.game.scale).toBe(1);
    expect(demoClocks.wall.scale).toBe(1);
    expect(DEMO_START % 86_400).toBe(8 * 3600);
  });

  it("jump the game clock only: a jump never moves the wall clock (rule 6.3.9)", () => {
    demoClocks.game.setPaused(true);
    demoClocks.wall.setPaused(true);
    demoClocks.game.set(DEMO_START);
    const wall = demoClocks.wall.nowMs();
    jumps.hour();
    expect(demoClocks.game.now()).toBe(DEMO_START + 3600);
    jumps.sixHours();
    expect(demoClocks.game.now()).toBe(DEMO_START + 7 * 3600);
    jumps.nextMorning();
    expect(demoClocks.game.now()).toBe(DEMO_START + 86_400);
    expect(demoClocks.wall.nowMs()).toBe(wall);
  });

  it("find the next 08:00, never zero", () => {
    expect(untilNextMorning(8 * 3600)).toBe(86_400);
    expect(untilNextMorning(7 * 3600)).toBe(3600);
    expect(untilNextMorning(23 * 3600)).toBe(9 * 3600);
  });
});
