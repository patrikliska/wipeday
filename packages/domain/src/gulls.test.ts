/**
 * Crows (id `gull`; D197, D238): a seeded grid of crossings never under 120 s apart, one in
 * twenty a Magpie, each claimable once inside its window.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { applyCommand } from "./commands";
import { outputRate } from "./flotsam";
import { crossing, gullAt } from "./gulls";
import { type BaseState, newBase } from "./state";

const shipped = loadContent(contentPaths.data, loadLocale());
const content = { ...shipped, achievements: { ...shipped.achievements, moralePer: 0 } };
const T0 = 1_700_000_000;
const rules = content.flotsam.gulls;

const started = (seed = 9, patch: Partial<BaseState["run"]> = {}): BaseState => {
  const base = newBase(content, T0, seed);
  return {
    ...base,
    run: {
      ...base.run,
      startedAt: T0,
      lines: { beachcomber: 10 },
      hands: ["beachcomber"],
      ...patch,
    },
  };
};

describe("the crow grid", () => {
  it("never crosses under 120 s apart, the first from firstAfterSeconds", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const state = started(seed);
      let previous = crossing(content, state, T0, 0);
      expect(previous.at).toBeGreaterThanOrEqual(T0 + rules.firstAfterSeconds);
      for (let k = 1; k < 50; k++) {
        const next = crossing(content, state, T0, k);
        expect(next.at - previous.at, `seed ${seed} k ${k}`).toBeGreaterThanOrEqual(120);
        expect(next.at - previous.at).toBeLessThanOrEqual(rules.every + rules.jitter);
        previous = next;
      }
    }
  });

  it("makes one in twenty a Magpie, faster", () => {
    let elite = 0;
    const state = started(4);
    for (let k = 0; k < 20_000; k++) {
      const slot = crossing(content, state, T0, k);
      if (slot.elite) {
        elite += 1;
        expect(slot.cross).toBe(rules.eliteCrossSeconds);
      }
    }
    expect(elite / 20_000).toBeGreaterThan(0.045);
    expect(elite / 20_000).toBeLessThan(0.055);
  });

  it("shows the crow crossing now, and none once it is caught", () => {
    const state = started();
    const slot = crossing(content, state, T0, 2);
    const now = Math.ceil(slot.at);
    expect(gullAt(content, state, now)?.k).toBe(2);
    expect(gullAt(content, state, Math.floor(slot.at) - 1)).toBeNull();
    const caught = { ...state, run: { ...state.run, gulls: { caught: 1, last: 2 } } };
    expect(gullAt(content, caught, now)).toBeNull();
    expect(gullAt(content, { ...state, run: { ...state.run, startedAt: null } }, now)).toBeNull();
  });
});

describe("claim_gull", () => {
  it("pays its seconds of output once; then claimed; outside its window gone", () => {
    const state = started();
    const slot = crossing(content, state, T0, 3);
    const now = Math.ceil(slot.at);
    const command = { type: "claim_gull", run: state.run.n, k: 3 } as const;
    const first = applyCommand(content, state, command, now);
    expect(first.ok).toBe(true);
    const pay = (slot.elite ? rules.eliteSeconds : rules.seconds) * outputRate(content, state, now);
    expect(first.state.run.supplies - state.run.supplies).toBeGreaterThan(pay * 0.999);
    expect(first.state.run.gulls).toEqual({ caught: 1, last: 3 });
    expect(first.state.meta.stats.gulls).toBe(1);
    expect(first.events).toContainEqual(expect.objectContaining({ type: "gull_caught", k: 3 }));
    const again = applyCommand(content, first.state, command, now);
    expect(again.ok === false && again.refusal).toEqual({ reason: "claimed" });
    // An earlier crow can no longer be claimed once a later one was.
    const earlier = applyCommand(content, first.state, { ...command, k: 2 }, now);
    expect(earlier.ok === false && earlier.refusal).toEqual({ reason: "claimed" });
    const late = applyCommand(content, state, command, Math.ceil(slot.until) + 1);
    expect(late.ok === false && late.refusal).toMatchObject({ reason: "gone" });
    const early = applyCommand(content, state, command, Math.floor(slot.at) - 5);
    expect(early.ok === false && early.refusal).toEqual({ reason: "gone", at: slot.at });
    const stale = applyCommand(content, state, { ...command, run: 7 }, now);
    expect(stale.ok === false && stale.refusal).toEqual({ reason: "stale_run" });
  });

  it("pays a Magpie six times a crow", () => {
    const state = started();
    let k = 0;
    while (!crossing(content, state, T0, k).elite) k++;
    const slot = crossing(content, state, T0, k);
    const now = Math.ceil(slot.at);
    const result = applyCommand(content, state, { type: "claim_gull", run: 1, k }, now);
    const caught = result.events.find((event) => event.type === "gull_caught");
    expect(caught?.type === "gull_caught" && caught.elite).toBe(true);
    expect(caught?.type === "gull_caught" ? caught.value : 0).toBeCloseTo(
      rules.eliteSeconds * outputRate(content, state, now),
      6,
    );
  });
});
