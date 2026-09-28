/**
 * Work the node: the active mini-game on the trees and rocks around the base.
 * Where the marker appears is presentation (the client draws it); what the
 * server checks is here: the node exists and stands, the current tool can work
 * it, hits come in order and within the window, and the perfect bonus only for
 * all `maxHits` in one streak. A node goes down for `respawnSeconds` of real
 * time only once it has taken `maxHits` hits in total: a run that stops short
 * leaves it standing with its wear, and the next run carries on (D76).
 * Hit numbers count the node's hits, not the run's: a run on a node worn to 3
 * starts at hit 4.
 */
import type { Amounts, Content, NodeKind } from "@wipe-day/content/schema";
import {
  add,
  type BaseState,
  clampToCap,
  effectiveRates,
  isEmpty,
  type NodeRun,
  production,
  storageCap,
} from "./base";
import type { GameEvent } from "./events";
import { modifiers } from "./modifiers";
import { rollBlueprint } from "./recipes";

const DAY = 86400;

/** Minutes of full-paying node work left today, and the day's total. */
export function haulLeft(
  content: Content,
  state: BaseState,
  now: number,
): { minutes: number; of: number } {
  const of = content.active.node.dailyHaulMinutes + modifiers(content, state).haulMinutes;
  const used = state.haul.day === Math.floor(now / DAY) ? state.haul.minutes : 0;
  return { minutes: Math.max(0, of - used), of };
}

export function nodeKindOf(content: Content, nodeId: string): NodeKind | null {
  const node = content.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return null;
  return content.nodeKinds.find((kind) => kind.id === node.kind) ?? null;
}

/** What one hit on a node of `kind` banks with the current tool, before storage caps. */
export function nodeSlice(content: Content, state: BaseState, kind: NodeKind): Amounts {
  const rates = effectiveRates(content, state);
  const slice: Amounts = {};
  for (const [id, share] of Object.entries(kind.yields)) {
    const perHour = rates[id] ?? 0;
    const amount = production({ [id]: perHour }, kind.hitMinutes * 60)[id] ?? 0;
    const shared = Math.floor(amount * share);
    if (shared > 0) slice[id] = shared;
  }
  return slice;
}

export type NodeStatus =
  | { code: "ready" }
  | { code: "unknown" }
  | { code: "depleted"; until: number }
  /** The current tool does not produce what this node yields. */
  | { code: "tool" };

export function nodeStatus(
  content: Content,
  state: BaseState,
  nodeId: string,
  now: number,
): NodeStatus {
  const kind = nodeKindOf(content, nodeId);
  if (!kind) return { code: "unknown" };
  const until = state.depleted[nodeId];
  if (until !== undefined && until > now) return { code: "depleted", until };
  if (isEmpty(nodeSlice(content, state, kind))) return { code: "tool" };
  return { code: "ready" };
}

/** When a run stops accepting hits: the visible window plus network grace, whole seconds. */
function fadesAt(content: Content, run: NodeRun): number {
  const { hitWindowSeconds, graceSeconds } = content.active.node;
  return run.lastHitAt + Math.ceil(hitWindowSeconds + graceSeconds);
}

/** The node's hits so far, before any run on it. */
export function nodeWear(state: BaseState, nodeId: string): number {
  return state.wear[nodeId] ?? 0;
}

/**
 * Ends `run`. A node worked all the way (`maxHits` hits in total) goes down and
 * forgets its wear; a run that stopped short leaves the node standing with it.
 */
function finishRun(
  content: Content,
  state: BaseState,
  run: NodeRun,
  at: number,
): { state: BaseState; events: GameEvent[] } {
  const kind = nodeKindOf(content, run.node);
  const cleared = { ...state, nodeRun: null };
  if (!kind || run.hits <= run.from) return { state: cleared, events: [] };
  const { [run.node]: _worn, ...wear } = cleared.wear;
  if (run.hits >= content.active.node.maxHits) {
    const until = at + kind.respawnSeconds;
    return {
      state: { ...cleared, wear, depleted: { ...cleared.depleted, [run.node]: until } },
      events: [{ type: "node_depleted", node: run.node, kind: kind.id, until }],
    };
  }
  return {
    state: { ...cleared, wear: { ...wear, [run.node]: run.hits } },
    events: [{ type: "node_run_ended", node: run.node, hits: run.hits }],
  };
}

export type HitRefusal =
  | { code: "unknown" }
  | { code: "depleted"; until: number }
  | { code: "tool" }
  | { code: "out_of_order"; expected: number }
  | { code: "run_over" };

export type HitResult =
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; state: BaseState; events: GameEvent[]; refusal: HitRefusal };

/**
 * Hit number `hit` (1-based, counting the node's wear) of run `runId` on
 * `nodeId`. A repeat of a hit already counted is a harmless no-op, so a retried
 * request never banks twice. A hit on another run ends the previous one first.
 */
export function hitNode(
  content: Content,
  state: BaseState,
  now: number,
  nodeId: string,
  runId: string,
  hit: number,
): HitResult {
  const kind = nodeKindOf(content, nodeId);
  if (!kind) return { ok: false, state, events: [], refusal: { code: "unknown" } };
  const { maxHits, perfectBonusHits } = content.active.node;
  let next = state;
  const events: GameEvent[] = [];

  let run = next.nodeRun;
  if (run && (run.run !== runId || run.node !== nodeId)) {
    const finished = finishRun(content, next, run, now);
    next = finished.state;
    events.push(...finished.events);
    run = null;
  }
  if (run) {
    if (hit <= run.hits) return { ok: true, state: next, events };
    if (hit !== run.hits + 1) {
      return {
        ok: false,
        state: next,
        events,
        refusal: { code: "out_of_order", expected: run.hits + 1 },
      };
    }
    if (now > fadesAt(content, run)) {
      const finished = finishRun(content, next, run, fadesAt(content, run));
      return {
        ok: false,
        state: finished.state,
        events: [...events, ...finished.events],
        refusal: { code: "run_over" },
      };
    }
  } else {
    const status = nodeStatus(content, next, nodeId, now);
    if (status.code === "depleted" || status.code === "tool" || status.code === "unknown") {
      return { ok: false, state: next, events, refusal: status };
    }
    const wear = nodeWear(next, nodeId);
    if (hit !== wear + 1) {
      return {
        ok: false,
        state: next,
        events,
        refusal: { code: "out_of_order", expected: wear + 1 },
      };
    }
    run = { node: nodeId, run: runId, hits: wear, from: wear, lastHitAt: now };
  }

  const hits = run.hits + 1;
  const done = hits >= maxHits;
  // The bonus is for the whole node in one streak, not for finishing a worn one.
  const perfect = done && run.from === 0;
  const slice = nodeSlice(content, next, kind);
  const slices = perfect ? 1 + perfectBonusHits : 1;
  // The daily haul: a hit pays in full while any of today's haul is left (the last one may
  // run a little over), then a small share.
  const reduced = haulLeft(content, next, now).minutes <= 0;
  const percent = reduced ? content.active.node.afterHaulPercent : 100;
  // A served meal adds its percent on top.
  const fed = next.wellFed && next.wellFed.until > now ? next.wellFed.percent : 0;
  const wanted: Amounts = {};
  for (const [id, amount] of Object.entries(slice)) {
    wanted[id] = Math.floor((amount * slices * percent * (100 + fed)) / 10000);
  }
  const gained = clampToCap(storageCap(content, next), next.stock, wanted);
  const day = Math.floor(now / DAY);
  const usedToday = next.haul.day === day ? next.haul.minutes : 0;
  next = {
    ...next,
    stock: add(next.stock, gained),
    haul: { day, minutes: usedToday + (reduced ? 0 : kind.hitMinutes * slices) },
  };
  events.push({ type: "node_hit", node: nodeId, kind: kind.id, hits, gained, perfect, reduced });

  // A perfect run sometimes turns up a blueprint, seeded by the run's moment and node.
  if (perfect) {
    const chance = content.crafting.blueprints.perfectRunPercent;
    const salt = [...nodeId].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);
    const blueprint = rollBlueprint(content, next, chance, now, salt);
    if (blueprint) {
      next = { ...next, blueprints: [...next.blueprints, blueprint] };
      events.push({ type: "blueprint_found", recipe: blueprint, from: "node" });
    }
  }

  const updated: NodeRun = { ...run, hits, lastHitAt: now };
  if (done) {
    const finished = finishRun(content, next, updated, now);
    return { ok: true, state: finished.state, events: [...events, ...finished.events] };
  }
  return { ok: true, state: { ...next, nodeRun: updated }, events };
}

/** The player stopped (a miss, or the marker faded on screen). Idempotent. */
export function endNodeRun(
  content: Content,
  state: BaseState,
  now: number,
  nodeId: string,
  runId: string,
): { state: BaseState; events: GameEvent[] } {
  const run = state.nodeRun;
  if (!run || run.run !== runId || run.node !== nodeId) return { state, events: [] };
  return finishRun(content, state, run, Math.min(now, fadesAt(content, run)));
}

/** Ends a run nobody finished and forgets nodes that stand again. Part of settling. */
export function settleNodes(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  let next = state;
  const events: GameEvent[] = [];
  if (next.nodeRun && now > fadesAt(content, next.nodeRun)) {
    const finished = finishRun(content, next, next.nodeRun, fadesAt(content, next.nodeRun));
    next = finished.state;
    events.push(...finished.events);
  }
  const standing = Object.entries(next.depleted).filter(([, until]) => until <= now);
  if (standing.length > 0) {
    const depleted = { ...next.depleted };
    for (const [id] of standing) delete depleted[id];
    next = { ...next, depleted };
  }
  return { state: next, events };
}
