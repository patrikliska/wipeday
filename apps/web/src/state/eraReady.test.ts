import { type BaseState, newBase } from "@wipe-day/domain/state";
import { describe, expect, it } from "vitest";
import { type AdvisorView, computeAdvisor, eraReadyWatcher } from "./advisor";
import { type GameEvent, on } from "./events";
import { seedPace } from "./pace";
import { content } from "./world";

const T0 = 1_700_000_000;

const viewAt = (now: number, supplies: number, n = 1): AdvisorView => {
  const fresh = newBase(content, T0, 7);
  const base: BaseState = {
    ...fresh,
    run: { ...fresh.run, n, startedAt: T0 - 60, supplies, lines: { beachcomber: 12 } },
  };
  seedPace(6, now * 1000);
  return computeAdvisor(base, now, now * 1000);
};

/** Runs `steps` through one watcher and returns the eras it called ready. */
function told(steps: Array<[previous: AdvisorView | null, next: AdvisorView]>): string[] {
  const heard: string[] = [];
  const off = on((event: GameEvent) => {
    if (event.type === "era_ready") heard.push(event.era);
  });
  const watch = eraReadyWatcher();
  for (const [previous, next] of steps) watch(previous, next);
  off();
  return heard;
}

describe("the era plate's tick (D245)", () => {
  it("tells once when the next era turns affordable while watched", () => {
    const saving = viewAt(T0, 1_400);
    const ready = viewAt(T0 + 1, 1_600);
    const spent = viewAt(T0 + 2, 100);
    const again = viewAt(T0 + 3, 1_700);
    expect(
      told([
        [null, saving],
        [saving, ready],
        [ready, spent],
        [spent, again],
      ]),
    ).toEqual(["wood"]);
  });

  it("says nothing for an era already affordable on arrival or after a jump of the clock", () => {
    expect(told([[null, viewAt(T0, 1_600)]])).toEqual([]);
    expect(told([[viewAt(T0, 100), viewAt(T0 + 3600, 1_600)]])).toEqual([]);
  });

  it("tells again in the next run", () => {
    const run1 = viewAt(T0, 1_400, 1);
    const ready1 = viewAt(T0 + 1, 1_600, 1);
    const run2 = viewAt(T0 + 2, 1_400, 2);
    const ready2 = viewAt(T0 + 3, 1_600, 2);
    expect(
      told([
        [null, run1],
        [run1, ready1],
        [ready1, run2],
        [run2, ready2],
      ]),
    ).toEqual(["wood", "wood"]);
  });
});
