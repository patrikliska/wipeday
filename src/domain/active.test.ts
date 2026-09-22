import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../content/load";
import { discoverPaths } from "../paths";
import { Locale } from "../ui/locale";
import {
  breakBarrel,
  hitNode,
  nodeRunAlive,
  progressTasks,
  rollTasks,
  settleAll,
  settleBarrel,
  startNodeRun,
  utcDay,
} from "./active";
import { type BaseState, gather, newBase, total } from "./base";
import { pickWeighted, rng, seedOf } from "./rng";

const paths = discoverPaths();
const content = loadContent(paths.data, Locale.load(join(paths.locale, "en.json")));
const T0 = 1_700_000_000;
const { node, barrels } = content.active;

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

describe("node run", () => {
  const started = () => {
    const gathered = gather(content, newBase(content, T0), T0);
    if (!gathered.ok) throw new Error("gather");
    return startNodeRun(content, gathered.state, T0, 123);
  };

  it("banks a slice of the gather bonus per hit and ends perfect after maxHits", () => {
    let state = started();
    const run = state.nodeRun;
    if (!run) throw new Error("no run");
    expect(run.perHit).toEqual({ wood: 6, stone: 4 });
    let gainedTotal = 0;
    for (let hit = 1; hit <= node.maxHits; hit++) {
      const marker = state.nodeRun?.marker ?? -1;
      const result = hitNode(content, state, T0 + hit, marker);
      if (!result.ok) throw new Error("expected ok");
      gainedTotal += total(result.gained);
      state = result.state;
      expect(state.nodeRun?.hits).toBe(hit);
    }
    expect(state.nodeRun?.ended).toBe("perfect");
    expect(gainedTotal).toBe(node.maxHits * 10);
    expect(state.stock).toEqual({ wood: 60 + 30, stone: 40 + 20 });
    expect(hitNode(content, state, T0 + 10, 0)).toMatchObject({ ok: false, reason: "over" });
  });

  it("moves the marker every hit, deterministically for a seed", () => {
    const a = started();
    const b = started();
    expect(a.nodeRun?.marker).toBe(b.nodeRun?.marker);
    const marker = a.nodeRun?.marker ?? 0;
    const next = hitNode(content, a, T0 + 1, marker);
    if (!next.ok) throw new Error("expected ok");
    expect(next.run.marker).not.toBe(marker);
    expect(next.run.marker).toBeLessThan(node.positions);
  });

  it("a wrong button ends the run with nothing gained; a late press fades it", () => {
    const state = started();
    const wrong = ((state.nodeRun?.marker ?? 0) + 1) % node.positions;
    const missed = hitNode(content, state, T0 + 1, wrong);
    if (!missed.ok) throw new Error("expected ok");
    expect(missed.run.ended).toBe("missed");
    expect(missed.gained).toEqual({});
    expect(nodeRunAlive(content, missed.state, T0 + 1)).toBe(false);

    const late = hitNode(
      content,
      state,
      T0 + node.hitWindowSeconds + 1,
      state.nodeRun?.marker ?? 0,
    );
    expect(late).toMatchObject({ ok: false, reason: "over" });
    expect(settleAll(content, state, T0 + node.hitWindowSeconds + 1).state.nodeRun?.ended).toBe(
      "faded",
    );
  });
});

describe("barrels", () => {
  it("washes up on schedule, vanishes if ignored, and skips missed ones", () => {
    const base = newBase(content, T0);
    const first = base.nextBarrelAt;
    expect(settleBarrel(content, base, first - 1).barrel).toBeNull();
    const live = settleBarrel(content, base, first + 60);
    expect(live.barrel).toMatchObject({
      spawnedAt: first,
      expiresAt: first + barrels.expiresMinutes * 60,
    });
    expect(live.nextBarrelAt).toBe(first + barrels.everyMinutes * 60);

    const ignored = settleBarrel(content, live, live.barrel?.expiresAt ?? 0 + 1);
    expect(settleBarrel(content, live, (live.barrel?.expiresAt ?? 0) + 1).barrel).toBeNull();
    expect(ignored.nextBarrelAt).toBe(live.nextBarrelAt);

    // Away for three intervals: the last one is still fresh, the others are gone.
    const away = settleBarrel(content, base, first + 3 * barrels.everyMinutes * 60 + 60);
    expect(away.barrel?.spawnedAt).toBe(first + 3 * barrels.everyMinutes * 60);
    expect(away.nextBarrelAt).toBe(first + 4 * barrels.everyMinutes * 60);
  });

  it("breaks into seeded loot, once", () => {
    const base = newBase(content, T0);
    const live = settleBarrel(content, base, base.nextBarrelAt);
    const broken = breakBarrel(content, live, base.nextBarrelAt + 10);
    if (!broken.ok) throw new Error("expected ok");
    expect(
      total(broken.loot.resources) + Object.values(broken.loot.items).reduce((a, b) => a + b, 0),
    ).toBeGreaterThan(0);
    expect(broken.state.barrel).toBeNull();
    expect(breakBarrel(content, broken.state, base.nextBarrelAt + 11)).toEqual({
      ok: false,
      reason: "no_barrel",
    });
    const again = breakBarrel(content, live, base.nextBarrelAt + 10);
    if (!again.ok) throw new Error("expected ok");
    expect(again.loot).toEqual(broken.loot);
    expect(breakBarrel(content, live, live.barrel?.expiresAt ?? 0 + 1)).toMatchObject({ ok: true });
    expect(breakBarrel(content, live, (live.barrel?.expiresAt ?? 0) + 1)).toEqual({
      ok: false,
      reason: "expired",
    });
  });
});

describe("daily tasks", () => {
  it("rolls the same tasks for everyone on a day, skipping what a player cannot do", () => {
    const base = newBase(content, T0);
    const day = utcDay(T0);
    const a = rollTasks(content, base, day);
    const b = rollTasks(content, { ...base, stock: { wood: 1 } }, day);
    expect(a.ids).toEqual(b.ids);
    expect(a.ids).toHaveLength(content.active.tasks.perDay);
    for (const id of a.ids) {
      const task = content.active.tasks.pool.find((candidate) => candidate.id === id);
      expect(task?.requires).toBeUndefined();
    }
    expect(rollTasks(content, base, day + 1).ids).not.toEqual(a.ids);
    const settled = settleAll(content, base, T0).state;
    expect(settled.tasks.day).toBe(day);
    expect(settleAll(content, settled, T0 + 86400).state.tasks.day).toBe(day + 1);
  });

  it("pays a task the moment its target is reached, once", () => {
    const base: BaseState = {
      ...newBase(content, T0),
      tasks: { day: utcDay(T0), ids: ["gather_4"], progress: {}, done: [] },
    };
    const three = progressTasks(content, base, "gather", 3);
    expect(three.completed).toEqual([]);
    expect(three.state.tasks.progress.gather_4).toBe(3);
    const four = progressTasks(content, three.state, "gather", 1);
    expect(four.completed.map((done) => done.task.id)).toEqual(["gather_4"]);
    expect(four.state.stock).toMatchObject({ scrap: 5, wood: 200 });
    expect(four.state.tasks.done).toEqual(["gather_4"]);
    const five = progressTasks(content, four.state, "gather", 1);
    expect(five.completed).toEqual([]);
    expect(five.state.stock.wood).toBe(200);
    expect(progressTasks(content, base, "craft", 1).state).toBe(base);
  });
});
