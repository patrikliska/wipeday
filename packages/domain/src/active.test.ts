import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { breakBarrel, progressTasks, rollTasks, settleBarrel, utcDay } from "./active";
import { type BaseState, newBase, total } from "./base";
import { pickWeighted, rng, seedOf } from "./rng";
import { settleAll } from "./settle";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const { barrels } = content.active;

describe("rng", () => {
  it("is deterministic and roughly uniform", () => {
    const a = rng(42);
    const b = rng(42);
    expect([a.next(), a.next(), a.int(1, 6)]).toEqual([b.next(), b.next(), b.int(1, 6)]);
    const counts: [number, number, number] = [0, 0, 0];
    const random = rng(7);
    for (let i = 0; i < 3000; i++) counts[pickWeighted(random, [1, 2, 3]) as 0 | 1 | 2] += 1;
    expect(counts[0]).toBeGreaterThan(350);
    expect(counts[2]).toBeGreaterThan(counts[0]);
    expect(seedOf(1, 2)).not.toBe(seedOf(2, 1));
  });
});

describe("barrels", () => {
  it("washes up on schedule, drifts off if ignored, and skips missed ones", () => {
    const base = newBase(content, T0, 1);
    const first = base.nextBarrelAt;
    expect(settleBarrel(content, base, first - 1).state.barrel).toBeNull();
    const live = settleBarrel(content, base, first + 60);
    expect(live.events).toEqual([
      { type: "barrel_spawned", expiresAt: first + barrels.expiresMinutes * 60 },
    ]);
    expect(live.state.barrel).toMatchObject({ spawnedAt: first });
    expect(live.state.nextBarrelAt).toBe(first + barrels.everyMinutes * 60);
    const gone = settleBarrel(content, live.state, (live.state.barrel?.expiresAt ?? 0) + 1);
    expect(gone.state.barrel).toBeNull();
    expect(gone.events).toEqual([]);

    // Away for three intervals: the last one is still fresh, the others are gone.
    const away = settleBarrel(content, base, first + 3 * barrels.everyMinutes * 60 + 60);
    expect(away.state.barrel?.spawnedAt).toBe(first + 3 * barrels.everyMinutes * 60);
  });

  it("breaks into loot seeded per base, once", () => {
    const base = newBase(content, T0, 1);
    const live = settleBarrel(content, base, base.nextBarrelAt).state;
    const broken = breakBarrel(content, live, base.nextBarrelAt + 10);
    if (!broken.ok) throw new Error("expected ok");
    expect(total(broken.gained)).toBeGreaterThan(0);
    expect(breakBarrel(content, broken.state, base.nextBarrelAt + 11)).toEqual({
      ok: false,
      reason: "no_barrel",
    });
    const again = breakBarrel(content, live, base.nextBarrelAt + 10);
    expect(again.ok && again.gained).toEqual(broken.gained);
    // Another base's barrel at the same moment rolls differently.
    const other = newBase(content, T0, 2);
    const otherLive = settleBarrel(content, other, other.nextBarrelAt).state;
    expect(otherLive.barrel?.seed).not.toBe(live.barrel?.seed);
  });
});

describe("daily tasks", () => {
  it("rolls the same tasks for everyone on a day, skipping what a base cannot do", () => {
    const base = newBase(content, T0, 1);
    const day = utcDay(T0);
    const a = rollTasks(content, base, day);
    const b = rollTasks(content, { ...base, stock: { timber: 1 } }, day);
    expect(a.ids).toEqual(b.ids);
    expect(a.ids).toHaveLength(content.active.tasks.perDay);
    for (const id of a.ids) {
      const task = content.active.tasks.pool.find((candidate) => candidate.id === id);
      expect(task?.requires).toBeUndefined();
    }
    const settled = settleAll(content, base, T0).state;
    expect(settled.tasks.day).toBe(day);
    expect(settleAll(content, settled, T0 + 86400).state.tasks.day).toBe(day + 1);
  });

  it("pays a task the moment its target is reached, once", () => {
    const base: BaseState = {
      ...newBase(content, T0, 1),
      tasks: { day: utcDay(T0), ids: ["gather_4"], progress: {}, done: [] },
    };
    const three = progressTasks(content, base, "gather", 3);
    expect(three.events).toEqual([]);
    const four = progressTasks(content, three.state, "gather", 1);
    expect(four.events).toEqual([
      { type: "task_done", task: "gather_4", reward: { scrap: 5, timber: 200 } },
    ]);
    expect(four.state.stock).toMatchObject({ scrap: 5, timber: 200 });
    const five = progressTasks(content, four.state, "gather", 1);
    expect(five.events).toEqual([]);
    expect(five.state.stock.timber).toBe(200);
    expect(progressTasks(content, base, "craft", 1).state).toBe(base);
  });
});
