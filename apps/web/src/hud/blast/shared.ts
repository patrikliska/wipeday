/**
 * What the Blast Map's views share (docs/redesign/04-blast-map.md 8; D271): the node states
 * of the whole shipped map at this second, the pick while node buying is new to the player
 * (D244: afterwards nothing on the map advises a purchase), the filter chips, the words for a
 * node's state, and the buy with its juice.
 */
import type { NodeDef } from "@wipe-day/content/schema";
import {
  affordableNodes,
  type NodeState,
  type NodeTag,
  nodePick,
  nodeState,
  nodeTags,
  shippedNodes,
} from "@wipe-day/domain/blastmap";
import type { BaseState } from "@wipe-day/domain/state";
import { useMemo } from "react";
import { type MapFilter, useMap } from "../../state/map";
import { useWorld } from "../../state/store";
import { reducedMotion } from "../../state/ui";
import { content, fmt, nodeName, nodeTypeName, sectorName, t } from "../../state/world";

export interface MapView {
  base: BaseState;
  states: Map<string, NodeState>;
  /** The one pulsing pick, while node buying is new (D244), else null. */
  pick: { node: NodeDef; state: NodeState } | null;
  affordable: number;
  /** Nodes the filter chip in force keeps (every node when none). */
  kept: Set<string> | null;
}

/** Whether the map still advises: fewer nodes bought than the hint allowance (Ground Zero is granted). */
export function pickShown(base: BaseState): boolean {
  return base.meta.nodes.length - 1 < content.run.advisor.hintUses;
}

export function nodeMatches(node: NodeDef, filter: MapFilter, state: NodeState): boolean {
  if (filter === "affordable") return state.kind === "affordable";
  return nodeTags(node).includes(filter as NodeTag);
}

/** The map's view of the base, memoised on the base and the filter. */
export function useMapView(): MapView | null {
  const base = useWorld((state) => state.base);
  const filter = useMap((state) => state.filter);
  return useMemo(() => {
    if (!base) return null;
    const states = new Map<string, NodeState>();
    for (const node of shippedNodes(content))
      states.set(node.id, nodeState(content, base.meta, node.id));
    const pick = pickShown(base) ? nodePick(content, base) : null;
    const affordable = affordableNodes(content, base.meta).length;
    const kept = filter
      ? new Set(
          shippedNodes(content)
            .filter((node) => nodeMatches(node, filter, states.get(node.id) ?? { kind: "hidden" }))
            .map((node) => node.id),
        )
      : null;
    return { base, states, pick, affordable, kept };
  }, [base, filter]);
}

/** A node's state in words, for labels (08-screens.md 6.5). */
export function stateWords(state: NodeState): string {
  switch (state.kind) {
    case "owned":
      return t("map.state_owned");
    case "affordable":
      return t("map.state_affordable");
    case "glass":
      return t("map.state_glass", { need: fmt(state.need - state.have, "cost") });
    case "ring_gate":
      return t("map.ring_opens_togo", { ring: state.ring, at: state.at, toGo: state.toGo });
    case "node_gate":
      return t("map.node_opens", { at: state.at, toGo: state.toGo });
    case "no_parent":
      return t("map.state_no_parent");
    case "hidden":
      return "";
  }
}

/** "Lucky Swing, notable, Grip ring 3, 77 glass, affordable" (04 8.5). */
export function nodeLabel(node: NodeDef, state: NodeState): string {
  return t("map.node_label", {
    name: nodeName(node.id),
    type: nodeTypeName(node.type),
    sector: node.sector ? sectorName(node.sector) : "",
    ring: node.ring,
    cost: fmt(node.cost, "cost"),
    state: stateWords(state),
  });
}

/** Two letters for a node without an icon yet (the lettered tile, D141). */
export function nodeLetters(id: string): string {
  const words = nodeName(id).split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const second = words[1]?.[0] ?? words[0]?.[1] ?? "";
  return (first + second).toUpperCase();
}

/** The CSS class of a node's state. */
export function stateClass(state: NodeState): string {
  switch (state.kind) {
    case "owned":
      return "owned";
    case "affordable":
      return "affordable";
    case "glass":
      return "reachable";
    default:
      return "locked";
  }
}

/**
 * Buys `path` (predicted at once, D64): the nodes fill, their edges light outward, glass flies
 * from the map's chip to the first node, the chime sounds (`node_bought` on the bus).
 */
export function buyPath(path: readonly NodeDef[], from?: Element | null): void {
  if (path.length === 0) return;
  const ids = path.map((node) => node.id);
  useWorld.getState().send({ type: "buy_node", path: ids });
  useMap.getState().bought(ids);
  const first = ids[0];
  const target = first ? document.querySelector(`[data-node="${first}"]`) : null;
  if (from && target && !reducedMotion()) flyGlass(from, target);
}

/** Three glass shards arcing from `from` to `to`, in the map's own layer. */
function flyGlass(from: Element, to: Element): void {
  const host = from.closest(".panel-sheet") ?? document.body;
  const hostRect = host.getBoundingClientRect();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const x0 = a.left + a.width / 2 - hostRect.left;
  const y0 = a.top + a.height / 2 - hostRect.top;
  const x1 = b.left + b.width / 2 - hostRect.left;
  const y1 = b.top + b.height / 2 - hostRect.top;
  for (let i = 0; i < 3; i++) {
    const shard = document.createElement("span");
    shard.className = "glass-fly";
    shard.setAttribute("aria-hidden", "true");
    host.appendChild(shard);
    const dx = (i - 1) * 14;
    const animation = shard.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
        {
          transform: `translate(${(x0 + x1) / 2 + dx}px, ${Math.min(y0, y1) - 40}px) scale(1.2)`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: `translate(${x1}px, ${y1}px) scale(0.4)`, opacity: 0.2 },
      ],
      { duration: 420 + i * 60, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", delay: i * 40 },
    );
    animation.onfinish = () => shard.remove();
  }
}
