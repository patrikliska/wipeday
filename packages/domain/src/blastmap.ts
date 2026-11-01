/**
 * The Blast Map in play (docs/redesign/04-blast-map.md 5, 8; D268): what a node's state is,
 * the path to a far one, what owned nodes do, and the one pulsing pick. Shared by the web, the
 * bot and the simulator, so the map's reasons and the server's refusals never disagree. The
 * shape (rings, sectors, gates) is `@wipe-day/content/blastmap`.
 */
import {
  agendaAt,
  FEATURES,
  type Feature,
  GROUND_ZERO,
  nodeOf,
  nodeShipped,
  ringGate,
} from "@wipe-day/content/blastmap";
import { type Effect, featureId, isFeatureStat } from "@wipe-day/content/effects";
import type { Content, NodeDef } from "@wipe-day/content/schema";
import type { Amount } from "./amount";
import type { BaseState, Meta } from "./state";

export type { NodeDef };

/** Why a node cannot be bought now (the first that applies, 04 8.2), or `owned`/`affordable`. */
export type NodeState =
  | { kind: "owned" }
  | { kind: "affordable" }
  /** Reachable (a parent owned, its ring open), but the glass is short. */
  | { kind: "glass"; need: Amount; have: Amount }
  | { kind: "ring_gate"; ring: number; at: number; toGo: number }
  | { kind: "node_gate"; at: number; toGo: number }
  | { kind: "no_parent" }
  | { kind: "hidden" };

export const ownsNode = (meta: Meta, id: string): boolean => meta.nodes.includes(id);

/** The nodes a build shows and may sell, Ground Zero included. */
export function shippedNodes(content: Content): NodeDef[] {
  return content.blastMap.nodes.filter((node) => nodeShipped(content, node));
}

export function nodeState(content: Content, meta: Meta, id: string): NodeState {
  const node = nodeOf(content, id);
  if (!node || !nodeShipped(content, node)) return { kind: "hidden" };
  if (ownsNode(meta, id)) return { kind: "owned" };
  const gate = ringGate(content, node.ring);
  if (gate !== null && meta.wipeDays < gate)
    return { kind: "ring_gate", ring: node.ring, at: gate, toGo: gate - meta.wipeDays };
  if (node.gate !== undefined && meta.wipeDays < node.gate)
    return { kind: "node_gate", at: node.gate, toGo: node.gate - meta.wipeDays };
  if (!parentOwned(meta, node)) return { kind: "no_parent" };
  if (node.cost > meta.glass.held) return { kind: "glass", need: node.cost, have: meta.glass.held };
  return { kind: "affordable" };
}

/** OR over the parents (a completion needs them all). */
function parentOwned(meta: Meta, node: NodeDef): boolean {
  if (node.id === GROUND_ZERO) return false;
  return node.type === "completion"
    ? node.requires.every((parent) => ownsNode(meta, parent))
    : node.requires.some((parent) => ownsNode(meta, parent));
}

/** Whether a node's ring and own gate are open at this Wipe Day count. */
export function gateOpen(content: Content, meta: Meta, node: NodeDef): boolean {
  const gate = ringGate(content, node.ring);
  if (gate !== null && meta.wipeDays < gate) return false;
  return node.gate === undefined || meta.wipeDays >= node.gate;
}

/**
 * The path to `id` (04 8.3): working inward a ring at a time, a node with one parent takes it;
 * any other takes a parent that is owned or already on the path, else its cheapest. Buy order,
 * nearest Ground Zero first; empty when `id` is owned, hidden or behind a gate. Ground Zero is
 * never on a path (the first nuke grants it).
 */
export function pathTo(content: Content, meta: Meta, id: string): NodeDef[] {
  const target = nodeOf(content, id);
  if (!target || !nodeShipped(content, target) || ownsNode(meta, id)) return [];
  const path: NodeDef[] = [];
  const onPath = new Set<string>();
  let node: NodeDef | undefined = target;
  while (node && !ownsNode(meta, node.id)) {
    if (node.id === GROUND_ZERO || !gateOpen(content, meta, node)) return [];
    path.push(node);
    onPath.add(node.id);
    if (node.type === "completion") {
      // Its whole previous ring, each by its own path (rare: wave 2).
      const rest = node.requires
        .filter((parent) => !ownsNode(meta, parent) && !onPath.has(parent))
        .flatMap((parent) => pathTo(content, meta, parent));
      for (const step of rest)
        if (!onPath.has(step.id)) {
          path.push(step);
          onPath.add(step.id);
        }
      break;
    }
    const parents: NodeDef[] = [];
    for (const parent of node.requires) {
      const def = nodeOf(content, parent);
      if (def) parents.push(def);
    }
    if (parents.some((parent) => ownsNode(meta, parent.id) || parent.id === GROUND_ZERO)) break;
    let next: NodeDef | undefined = parents.find((parent) => onPath.has(parent.id));
    if (!next) for (const parent of parents) if (!next || parent.cost < next.cost) next = parent;
    node = next;
  }
  return path.reverse();
}

export const pathCost = (path: readonly NodeDef[]): Amount =>
  path.reduce((sum, node) => sum + node.cost, 0);

/** The affordable prefix of a path ("Buy the first 2"), and its cost. */
export function affordablePrefix(path: readonly NodeDef[], held: Amount): NodeDef[] {
  const out: NodeDef[] = [];
  let spent = 0;
  for (const node of path) {
    if (spent + node.cost > held) break;
    spent += node.cost;
    out.push(node);
  }
  return out;
}

const effectsMemo = new WeakMap<readonly string[], { content: Content; effects: Effect[] }>();

/** The effects of every owned node, in content order (so the fold's sums never depend on buy order). */
export function nodeEffects(content: Content, meta: Meta): Effect[] {
  const known = effectsMemo.get(meta.nodes);
  if (known && known.content === content) return known.effects;
  const owned = new Set(meta.nodes);
  const effects: Effect[] = [];
  for (const node of content.blastMap.nodes) if (owned.has(node.id)) effects.push(...node.effects);
  effectsMemo.set(meta.nodes, { content, effects });
  return effects;
}

/** Whether an owned node unlocks `feature`. */
export function hasFeature(content: Content, meta: Meta, feature: Feature): boolean {
  const stat = `feature:${feature}`;
  return nodeEffects(content, meta).some((effect) => effect.stat === stat);
}

/** Every feature the owned nodes unlock. */
export function features(content: Content, meta: Meta): Feature[] {
  const out: Feature[] = [];
  for (const effect of nodeEffects(content, meta)) {
    if (!isFeatureStat(effect.stat)) continue;
    const id = featureId(effect.stat);
    if ((FEATURES as readonly string[]).includes(id) && !out.includes(id as Feature))
      out.push(id as Feature);
  }
  return out;
}

const sectorMemo = new WeakMap<readonly string[], Record<string, number>>();

/** Owned nodes per sector (`per: sector:<id>`). */
export function sectorCounts(content: Content, meta: Meta): Record<string, number> {
  const known = sectorMemo.get(meta.nodes);
  if (known) return known;
  const counts: Record<string, number> = {};
  for (const id of meta.nodes) {
    const sector = nodeOf(content, id)?.sector;
    if (sector) counts[sector] = (counts[sector] ?? 0) + 1;
  }
  sectorMemo.set(meta.nodes, counts);
  return counts;
}

/** Nodes owned in `sector`. */
export const sectorOwned = (content: Content, meta: Meta, sector: string): number =>
  sectorCounts(content, meta)[sector] ?? 0;

/** The shipped nodes the player can buy right now. */
export function affordableNodes(content: Content, meta: Meta): NodeDef[] {
  return shippedNodes(content).filter(
    (node) => nodeState(content, meta, node.id).kind === "affordable",
  );
}

/** How many shipped nodes are lit, and how many there are. */
export function litCount(content: Content, meta: Meta): { lit: number; total: number } {
  const shipped = shippedNodes(content);
  return { lit: shipped.filter((node) => ownsNode(meta, node.id)).length, total: shipped.length };
}

/** Whether `kind:id` is on the agenda at or before this Wipe Day count. */
export function agendaUnlocked(content: Content, meta: Meta, unlock: string): boolean {
  for (const row of content.agenda.rows)
    if (row.at <= meta.wipeDays && row.unlocks.includes(unlock)) return true;
  return false;
}

/** What Wipe Day `at` unlocks, for the cover card and postcard. */
export { agendaAt };

/**
 * The map's one pulsing pick (04 8.4), first match wins: Go Bag after Wipe Day #1; the cheapest
 * affordable unlock or automation node; the affordable node with the best income gain per
 * glass (`gainOf`, the caller's estimate; ties to the lower ring, then the lower slot); else
 * the cheapest reachable node, with its shortfall. Null when nothing is reachable.
 */
export function nodePick(
  content: Content,
  state: BaseState,
  gainOf: (node: NodeDef) => number = (node) => nodeGain(content, node),
): { node: NodeDef; state: NodeState } | null {
  const meta = state.meta;
  const shipped = shippedNodes(content);
  const states = new Map(shipped.map((node) => [node.id, nodeState(content, meta, node.id)]));
  const affordable = shipped.filter((node) => states.get(node.id)?.kind === "affordable");
  const goBag = affordable.find((node) => node.id === "packed_crate");
  if (goBag) return { node: goBag, state: { kind: "affordable" } };
  const toys = affordable
    .filter((node) => node.type === "unlock" || node.type === "automation")
    .sort((a, b) => a.cost - b.cost || a.ring - b.ring || a.slot - b.slot);
  if (toys[0]) return { node: toys[0], state: { kind: "affordable" } };
  let best: NodeDef | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const node of affordable) {
    const value = gainOf(node) / Math.max(1, node.cost);
    const better =
      value > bestValue ||
      (value === bestValue &&
        best !== null &&
        (node.ring < best.ring || (node.ring === best.ring && node.slot < best.slot)));
    if (best === null || better) {
      best = node;
      bestValue = value;
    }
  }
  if (best) return { node: best, state: { kind: "affordable" } };
  const reachable = shipped
    .filter((node) => states.get(node.id)?.kind === "glass")
    .sort((a, b) => a.cost - b.cost || a.ring - b.ring || a.slot - b.slot);
  const next = reachable[0];
  if (!next) return null;
  const found = states.get(next.id);
  return found ? { node: next, state: found } : null;
}

/**
 * A node's rough worth in output, scope-weighted (04 7.3's weights, coarsely): what the pick
 * divides by the cost, and what the simulator buys by (D268). Shared so the web, the bot and
 * the simulator agree on the one pulsing pick.
 */
export function nodeGain(content: Content, node: NodeDef): number {
  let gain = 0;
  for (const effect of node.effects) {
    const share =
      effect.scope === undefined || effect.scope === "all"
        ? 1
        : content.lines.some((line) => line.id === effect.scope)
          ? 1 / content.lines.length
          : 0.25;
    const v = effect.value;
    switch (effect.stat) {
      case "output":
      case "speed":
        gain += (effect.op === "more" ? v - 1 : v) * share * (effect.when ? 0.3 : 1);
        break;
      case "tap":
      case "tap_share":
        gain += 0.3 * v;
        break;
      case "glass_gain":
        gain += 0.5 * (effect.op === "more" ? v - 1 : v);
        break;
      case "glow_k":
        gain += 2 * v;
        break;
      case "night_shift":
        gain += 0.05 * v;
        break;
      case "line_cost":
      case "hand_cost":
      case "upgrade_cost":
      case "era_cost":
        gain += 0.5 * (1 - v);
        break;
      case "keep_hand":
      case "start_owned":
      case "start_era":
      case "start_upgrade":
        gain += 0.2;
        break;
      default:
        gain += effect.stat.startsWith("feature:") ? 0.1 : 0.05;
    }
  }
  return gain;
}

/** The map's filter chips (04 8.4), derived from a node's stats, never authored. */
export const NODE_TAGS = ["taps", "offline", "automation"] as const;
export type NodeTag = (typeof NODE_TAGS)[number];

const TAP_STATS = /^(tap|hustle|crit|fell|afterglow|rush)/;
const OFFLINE_STATS = /^(night_shift|offline)$/;
const AUTOMATION_STATS = /^(start_|keep_hand)/;

/** Which chips a node answers to: Taps, Offline and Automation (a node may answer several). */
export function nodeTags(node: NodeDef): NodeTag[] {
  const tags = new Set<NodeTag>();
  if (node.type === "automation") tags.add("automation");
  for (const effect of node.effects) {
    const stat = effect.stat;
    if (TAP_STATS.test(stat)) tags.add("taps");
    if (OFFLINE_STATS.test(stat) || effect.when === "offline" || effect.when === "night")
      tags.add("offline");
    if (AUTOMATION_STATS.test(stat) || stat === "feature:bulk_buy") tags.add("automation");
  }
  return NODE_TAGS.filter((tag) => tags.has(tag));
}
