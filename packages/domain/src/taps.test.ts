/**
 * The taps batch (D134, N10; docs/redesign/09-architecture.md 6.3): the bucket never
 * over-credits whatever a client claims, an honest tapper is never clamped, unmanned lines run
 * busy-until, Hustle and crits behave, all seeded.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import type { Content } from "@wipe-day/content/schema";
import { describe, expect, it } from "vitest";
import { applyCommand, type Command } from "./commands";
import { rng } from "./rng";
import { type BaseState, newBase } from "./state";
import { afterglowAt, applyTaps, hustleFactor } from "./taps";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const { perSecond, burst } = content.tap.bucket;

const fresh = (patch: Partial<BaseState["run"]> = {}): BaseState => {
  const base = newBase(content, T0, 3);
  return { ...base, run: { ...base.run, ...patch } };
};

const taps = (count: number, from: number, to: number): Command => ({
  type: "taps",
  count,
  from,
  to,
});

describe("the bucket (N10)", () => {
  it("never credits more than burst + perSecond × elapsed, whatever the batches claim", () => {
    for (let seed = 1; seed <= 2_000; seed++) {
      const random = rng(seed);
      let state = fresh();
      let now = T0;
      for (let step = random.int(1, 40); step > 0; step--) {
        now += random.int(0, 3);
        // Adversarial: counts up to 120, times in the future, the past, or reversed.
        const from = now + random.int(-50, 50);
        const to = now + random.int(-50, 3600);
        state = applyCommand(content, state, taps(random.int(1, 120), from, to), now).state;
      }
      const limit = burst + perSecond * (now - T0);
      expect(state.run.taps, `seed ${seed}`).toBeLessThanOrEqual(limit);
      expect(state.run.bucket.at, `seed ${seed}`).toBeLessThanOrEqual(now);
    }
  });

  it("never clamps an honest tapper: at most 15 a second, times in order", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const random = rng(seed * 13);
      let state = fresh();
      let sent = 0;
      let t = T0;
      for (let second = 0; second < 300; second++) {
        t += 1;
        const count = random.int(0, perSecond);
        if (count === 0) continue;
        sent += count;
        state = applyCommand(content, state, taps(count, t, t), t).state;
      }
      expect(state.run.taps, `seed ${seed}`).toBe(sent);
    }
  });

  it("credits a batch replayed after its record expired only from tokens left", () => {
    let state = applyCommand(content, fresh(), taps(30, T0, T0), T0).state;
    expect(state.run.taps).toBe(30);
    // An hour later the same batch arrives again: its times clamp to the last refill.
    state = applyCommand(content, state, taps(30, T0, T0), T0 + 3600).state;
    expect(state.run.taps).toBe(30 + (burst - 30));
  });

  it("never moves the bucket's clock back", () => {
    let state = applyCommand(content, fresh(), taps(5, T0 + 10, T0 + 10), T0 + 10).state;
    state = applyCommand(content, state, taps(5, T0, T0 + 2), T0 + 11).state;
    expect(state.run.bucket.at).toBe(T0 + 10);
  });
});

describe("unmanned lines: busy-until (resolution 3.3)", () => {
  const kiln = content.lines.find((line) => line.id === "kiln");
  if (!kiln) throw new Error("no kiln");
  const owned = (n: number) => fresh({ era: "wood", lines: { kiln: n }, supplies: 0 });
  // The Timber era doubles every line and the flat tap (eras.json5).
  const ERA = 2;

  it("runs one cycle at a time: a tap a second on the 19 s Kiln pays once every 19 s", () => {
    let state = owned(1);
    for (let t = 0; t < 19 * 5; t++) {
      state = applyCommand(content, state, taps(1, T0 + t, T0 + t), T0 + t).state;
    }
    // The fifth cycle (19.2 s each) ends at 96 s: look after it.
    state = applyCommand(content, state, { type: "ping" }, T0 + 100).state;
    const perCycle = ERA * kiln.rate * kiln.cycle;
    // A tap is worth ERA with no Glow or Grip, at most twice that at Hustle's peak.
    const tapValue = state.run.taps * ERA;
    expect(state.run.made - tapValue).toBeGreaterThan(perCycle * 4.99);
    expect(state.run.made).toBeLessThan(perCycle * 5.01 + tapValue * 2);
  });

  it("keeps a line faster than the taps busy, as if manned: 6 a second on the 0.6 s Beachcomber", () => {
    const beachcomber = content.lines.find((line) => line.id === "beachcomber");
    if (!beachcomber) throw new Error("no beachcomber");
    // Whole-second batches, as the client sends them (`from` and `to` the same second).
    let state = fresh({ lines: { beachcomber: 1 } });
    let cycles = 0;
    let direct = 0;
    for (let t = 0; t < 60; t++) {
      const result = applyCommand(content, state, taps(6, T0 + t, T0 + t), T0 + t);
      state = result.state;
      for (const event of result.events) {
        if (event.type !== "tapped") continue;
        cycles += event.cycles;
        direct += event.direct;
      }
    }
    // 60 s of tapping covers 100 cycles of 0.6 s back to back (D176), and each one pays.
    expect(cycles).toBe(Math.ceil(60 / beachcomber.cycle));
    expect(state.run.readyAt.beachcomber).toBeGreaterThanOrEqual(T0 + 60);
    state = applyCommand(content, state, { type: "ping" }, T0 + 70).state;
    expect(state.run.made - direct).toBeCloseTo(cycles * beachcomber.rate * beachcomber.cycle, 9);
  });

  it("starts cycles only inside the batch's seconds, never more than the taps credited", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const random = rng(seed * 7);
      let state = fresh({ lines: { beachcomber: random.int(1, 60), campfire: random.int(0, 30) } });
      let t = T0;
      for (let step = 0; step < 40; step++) {
        t += random.int(0, 3);
        const from = t;
        const to = t + random.int(0, 4);
        const before = state.run.readyAt;
        const result = applyCommand(content, state, taps(random.int(1, 12), from, to), to);
        state = result.state;
        t = to;
        const tapped = result.events.find((event) => event.type === "tapped");
        if (tapped?.type !== "tapped") continue;
        const lines = Object.keys(state.run.readyAt).length;
        expect(tapped.cycles, `seed ${seed}`).toBeLessThanOrEqual(tapped.credited * lines);
        for (const [id, ready] of Object.entries(state.run.readyAt)) {
          if (ready === before[id]) continue;
          // A line took new cycles only if it was free before the batch's last second ended.
          expect(Math.max(from, before[id] ?? from), `seed ${seed}`).toBeLessThan(to + 1);
        }
      }
    }
  });

  it("pays the cycle in flight even when tapping stopped, at its end", () => {
    const state = applyCommand(content, owned(2), taps(1, T0, T0), T0).state;
    expect(state.run.readyAt.kiln).toBeCloseTo(T0 + kiln.cycle, 9);
    const before = applyCommand(content, state, { type: "ping" }, T0 + 10).state;
    const after = applyCommand(content, state, { type: "ping" }, T0 + 30).state;
    expect(after.run.made - before.run.made).toBeCloseTo(ERA * 2 * kiln.rate * kiln.cycle, 6);
  });

  it("hands the cycle in flight to a hire, paid at once", () => {
    const state = applyCommand(content, owned(1), taps(1, T0, T0), T0).state;
    const hired = applyCommand(
      content,
      { ...state, run: { ...state.run, supplies: 1e12 } },
      { type: "hire_hand", line: "kiln" },
      T0 + 5,
    );
    if (!hired.ok) throw new Error("hire refused");
    expect(hired.state.run.readyAt.kiln).toBeUndefined();
    expect(hired.state.run.made - state.run.made).toBeCloseTo(ERA * kiln.rate * kiln.cycle, 6);
  });
});

describe("Hustle, crits and Afterglow", () => {
  it("pays a tap ×1 on an empty meter, up to ×2 on a full one (N20)", () => {
    const { cap, peak } = content.tap.hustle;
    expect(hustleFactor(0, cap, peak)).toBe(1);
    expect(hustleFactor(cap, cap, peak)).toBe(2);
    expect(hustleFactor(cap * 3, cap, peak)).toBe(2);
    const value = (hustle: number) => {
      const state = fresh({ hustle: { value: hustle, at: T0 } });
      const event = applyTaps(content, state, { count: 1, from: T0, to: T0 }, T0).events[0];
      return event?.type === "tapped" ? event.direct : Number.NaN;
    };
    // The flat tap is 1 on a fresh island; the tap's own +1 counts before it is valued.
    expect(value(0)).toBeCloseTo(hustleFactor(1, cap, peak), 12);
    expect(value(cap)).toBe(2);
  });

  it("builds Hustle per credited tap, holds it for its grace, then drains it", () => {
    let state = applyCommand(content, fresh(), taps(30, T0, T0), T0).state;
    expect(state.run.hustle.value).toBe(30);
    state = applyCommand(content, state, taps(1, T0 + 2, T0 + 2), T0 + 2).state;
    expect(state.run.hustle.value).toBe(31);
    // 2 s of grace, then 10 a second.
    state = applyCommand(content, state, taps(1, T0 + 5, T0 + 5), T0 + 5).state;
    expect(state.run.hustle.value).toBe(31 - 10 + 1);
  });

  it("rolls crits from the tap's index, so the client predicts the server", () => {
    const lucky: Content = {
      ...content,
      buffs: {
        luck: [
          { stat: "crit_chance", op: "add", value: 0.5 },
          { stat: "crit_mult", op: "set", value: 10 },
        ],
      },
    };
    const state = fresh({ buffs: [{ kind: "luck", until: T0 + 100 }] });
    const a = applyTaps(lucky, state, { count: 30, from: T0, to: T0 }, T0);
    const b = applyTaps(lucky, state, { count: 30, from: T0, to: T0 }, T0);
    expect(a).toEqual(b);
    const tapped = a.events[0];
    if (tapped?.type !== "tapped") throw new Error("no tapped event");
    expect(tapped.crits).toBeGreaterThan(5);
    expect(tapped.crits).toBeLessThan(25);
    // Each crit pays ten taps' worth instead of one (Hustle aside): the value shows it.
    const plain = applyTaps(content, fresh(), { count: 30, from: T0, to: T0 }, T0).events[0];
    if (plain?.type !== "tapped") throw new Error("no tapped event");
    expect(tapped.value).toBeGreaterThan(plain.value * 2);
    // After the buff, no more crits.
    const late = applyTaps(
      lucky,
      fresh({ buffs: [{ kind: "luck", until: T0 + 1 }], bucket: { tokens: 45, at: T0 + 5 } }),
      { count: 30, from: T0 + 5, to: T0 + 5 },
      T0 + 5,
    );
    expect(late.events[0]?.type === "tapped" && late.events[0].crits).toBe(0);
  });

  it("gives Afterglow from run 2 on, halving every 5 minutes from the first tap", () => {
    const run2 = { ...fresh({ afterglowFrom: T0 }), meta: { ...fresh().meta, nukes: 1 } };
    expect(afterglowAt(content, run2, T0)).toBe(3);
    expect(afterglowAt(content, run2, T0 + 300)).toBeCloseTo(2, 12);
    expect(afterglowAt(content, run2, T0 + 1800)).toBe(1);
    expect(afterglowAt(content, fresh({ afterglowFrom: T0 }), T0)).toBe(1);
  });
});
