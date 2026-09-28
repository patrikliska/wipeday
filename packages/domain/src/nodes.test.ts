import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { type BaseState, newBase, total } from "./base";
import { endNodeRun, hitNode, nodeSlice, nodeStatus, settleNodes } from "./nodes";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const { maxHits, perfectBonusHits, hitWindowSeconds, graceSeconds } = content.active.node;
const tree = content.nodeKinds.find((kind) => kind.id === "tree");
const ore = content.nodeKinds.find((kind) => kind.id === "ore");
if (!tree || !ore) throw new Error("need tree and ore kinds");

const base = (): BaseState => newBase(content, T0, 1);

function run(state: BaseState, node: string, runId: string, hits: number, from = T0): BaseState {
  let next = state;
  for (let hit = 1; hit <= hits; hit++) {
    const result = hitNode(content, next, from + hit, node, runId, hit);
    if (!result.ok) throw new Error(`hit ${hit}: ${result.refusal.code}`);
    next = result.state;
  }
  return next;
}

describe("node runs", () => {
  it("banks a slice per hit, a bonus for a full run, then the node goes down", () => {
    // Rock: 120 timber/h; a tree hit is 6 minutes of it.
    expect(nodeSlice(content, base(), tree)).toEqual({ timber: 12 });
    const state = run(base(), "tree_1", "r1", maxHits);
    expect(state.stock.timber).toBe(12 * (maxHits + perfectBonusHits));
    expect(state.nodeRun).toBeNull();
    const until = T0 + maxHits + tree.respawnSeconds;
    expect(state.depleted).toEqual({ tree_1: until });
    expect(nodeStatus(content, state, "tree_1", until - 1)).toEqual({ code: "depleted", until });
    expect(nodeStatus(content, state, "tree_1", until)).toEqual({ code: "ready" });
    expect(settleNodes(content, state, until).state.depleted).toEqual({});
  });

  it("ignores a repeated hit, refuses one out of order and one after the window", () => {
    const one = hitNode(content, base(), T0, "tree_1", "r1", 1);
    if (!one.ok) throw new Error("expected ok");
    const again = hitNode(content, one.state, T0 + 1, "tree_1", "r1", 1);
    expect(again).toEqual({ ok: true, state: one.state, events: [] });
    expect(hitNode(content, one.state, T0 + 1, "tree_1", "r1", 3)).toMatchObject({
      ok: false,
      refusal: { code: "out_of_order", expected: 2 },
    });
    const late = T0 + Math.ceil(hitWindowSeconds + graceSeconds) + 1;
    const over = hitNode(content, one.state, late, "tree_1", "r1", 2);
    expect(over).toMatchObject({ ok: false, refusal: { code: "run_over" } });
    // The one hit counts: the tree is worked out.
    expect(over.state.depleted.tree_1).toBeGreaterThan(T0);
  });

  it("refuses nodes the tool cannot work, unknown nodes and a first hit that is not 1", () => {
    expect(nodeStatus(content, base(), "ore_1", T0)).toEqual({ code: "tool" });
    expect(hitNode(content, base(), T0, "ore_1", "r1", 1)).toMatchObject({
      ok: false,
      refusal: { code: "tool" },
    });
    expect(hitNode(content, base(), T0, "moon_1", "r1", 1)).toMatchObject({
      ok: false,
      refusal: { code: "unknown" },
    });
    expect(hitNode(content, base(), T0, "tree_1", "r1", 2)).toMatchObject({
      ok: false,
      refusal: { code: "out_of_order", expected: 1 },
    });
    const withTools = { ...base(), toolId: "stone_tools" };
    expect(total(nodeSlice(content, withTools, ore))).toBe(12);
  });

  it("ends a run early on request, and a switched-to node ends the previous one", () => {
    const two = run(base(), "tree_1", "r1", 2);
    const ended = endNodeRun(content, two, T0 + 3, "tree_1", "r1");
    expect(ended.state.nodeRun).toBeNull();
    expect(ended.state.depleted.tree_1).toBe(T0 + 3 + tree.respawnSeconds);
    expect(endNodeRun(content, ended.state, T0 + 4, "tree_1", "r1").events).toEqual([]);

    const switched = hitNode(content, two, T0 + 3, "tree_2", "r2", 1);
    if (!switched.ok) throw new Error("expected ok");
    expect(switched.state.depleted.tree_1).toBeDefined();
    expect(switched.state.nodeRun).toMatchObject({ node: "tree_2", hits: 1 });
  });

  it("pays in full until the day's haul is in, then a small share, and resets each UTC day", () => {
    const { dailyHaulMinutes, afterHaulPercent } = content.active.node;
    const day = Math.floor(T0 / 86400);
    const tiredBase: BaseState = { ...base(), haul: { day, minutes: dailyHaulMinutes } };
    const tired = hitNode(content, tiredBase, T0, "tree_1", "r1", 1);
    if (!tired.ok) throw new Error("expected ok");
    expect(tired.events[0]).toMatchObject({
      type: "node_hit",
      reduced: true,
      gained: { timber: Math.floor((12 * afterHaulPercent) / 100) },
    });
    const yesterday: BaseState = { ...base(), haul: { day: day - 1, minutes: dailyHaulMinutes } };
    const fresh = hitNode(content, yesterday, T0, "tree_1", "r2", 1);
    if (!fresh.ok) throw new Error("expected ok");
    expect(fresh.events[0]).toMatchObject({ reduced: false, gained: { timber: 12 } });
    expect(fresh.state.haul).toEqual({ day, minutes: tree.hitMinutes });
  });

  it("settling ends a run nobody finished", () => {
    const two = run(base(), "tree_1", "r1", 2);
    const later = settleNodes(content, two, T0 + 60);
    expect(later.state.nodeRun).toBeNull();
    expect(later.events).toMatchObject([{ type: "node_depleted", node: "tree_1" }]);
  });
});
