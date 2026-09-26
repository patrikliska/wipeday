import { describe, expect, it } from "vitest";
import { manualClock, scaledClock, systemClock } from "./clock";

const T0 = 1_700_000_000;

describe("systemClock", () => {
  it("reads whole seconds of real time", () => {
    const before = Math.floor(Date.now() / 1000);
    const now = systemClock.now();
    expect(Number.isInteger(now)).toBe(true);
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(before + 1);
  });
});

describe("manualClock", () => {
  it("stands still until moved", () => {
    const clock = manualClock(T0);
    expect(clock.now()).toBe(T0);
    clock.advance(90);
    expect(clock.now()).toBe(T0 + 90);
    clock.set(T0 - 5);
    expect(clock.now()).toBe(T0 - 5);
  });

  it("rounds fractional seconds down in now() but keeps them in nowMs()", () => {
    const clock = manualClock(T0);
    clock.advance(1.5);
    expect(clock.now()).toBe(T0 + 1);
    expect(clock.nowMs()).toBe((T0 + 1.5) * 1000);
  });
});

describe("scaledClock", () => {
  it("runs `scale` times faster than its source", () => {
    const real = manualClock(T0);
    const game = scaledClock({ start: 0, scale: 240, source: real });
    real.advance(10);
    expect(game.now()).toBe(2400);
  });

  it("does not jump when the speed changes", () => {
    const real = manualClock(T0);
    const game = scaledClock({ start: 0, scale: 10, source: real });
    real.advance(10);
    game.setScale(1);
    expect(game.now()).toBe(100);
    real.advance(10);
    expect(game.now()).toBe(110);
  });

  it("stops while paused and resumes from where it stopped", () => {
    const real = manualClock(T0);
    const game = scaledClock({ start: 0, scale: 2, source: real });
    real.advance(5);
    game.setPaused(true);
    real.advance(100);
    expect(game.now()).toBe(10);
    game.setPaused(false);
    real.advance(1);
    expect(game.now()).toBe(12);
  });

  it("jumps with set and advance, also while paused", () => {
    const real = manualClock(T0);
    const game = scaledClock({ start: 0, scale: 3, source: real });
    game.setPaused(true);
    game.advance(3600);
    expect(game.now()).toBe(3600);
    game.set(50);
    real.advance(10);
    expect(game.now()).toBe(50);
    game.setPaused(false);
    real.advance(10);
    expect(game.now()).toBe(80);
  });
});
