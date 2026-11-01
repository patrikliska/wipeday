import { nodeOf, ringGate } from "@wipe-day/content/blastmap";
import type { NodeDef } from "@wipe-day/content/schema";
import { ownsNode, pathTo } from "@wipe-day/domain/blastmap";
import { type KeyboardEvent, useLayoutEffect, useMemo, useRef } from "react";
import { useMap } from "../../state/map";
import { content, fmt, nodeName, t } from "../../state/world";
import { Icon } from "../Icon";
import { ladderLayout } from "./layout";
import { type MapView, nodeLabel, nodeLetters, stateClass } from "./shared";

/**
 * A sector's ladder (docs/redesign/08-screens.md 2.10; 04-blast-map.md 8.1): ring 1 at the
 * bottom, at most four 56 px nodes a row with two-line labels, frames by type (circle, double
 * ring, hexagon, rounded square, cog ring), edges 2 px glass green along owned paths and 1 px
 * elsewhere, the path to a selected far node lit. Positions are fixed by slot, so nothing
 * moves when a node ships. Arrow keys walk slots and rings; every node is a button.
 */
const HEAD = 32;
const ROW = 116;
/** A node's centre below its row's top. */
const CENTRE = 36;

export function Ladder({ view, sector }: { view: MapView; sector: string }) {
  const rings = useMemo(() => ladderLayout(content, sector), [sector]);
  const selected = useMap((state) => state.node);
  const openNode = useMap((state) => state.openNode);
  const just = useMap((state) => state.just);
  const { base, states, pick, kept } = view;
  const meta = base.meta;
  const scroller = useRef<HTMLDivElement>(null);

  // The path to the selected node lights (04 8.3): the nodes and the edges along it.
  const path = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(pathTo(content, meta, selected).map((node) => node.id));
  }, [selected, meta]);

  // Band tops, so the edges (one SVG over the ladder) know every node's y in px.
  const bands: { ring: number; top: number; height: number }[] = [];
  let top = 0;
  for (const ring of rings) {
    const height = HEAD + ring.rows * ROW;
    bands.push({ ring: ring.ring, top, height });
    top += height;
  }
  const total = top;
  const positions = new Map<string, { x: number; y: number }>();
  for (const [index, ring] of rings.entries()) {
    const band = bands[index];
    if (!band) continue;
    for (const item of ring.nodes) {
      const y = band.top + HEAD + (ring.rows - 1 - item.row) * ROW + CENTRE;
      positions.set(item.node.id, { x: item.x, y });
    }
  }

  // Opened at the lowest unfinished ring (ring 1 at the bottom unless it is complete); with a
  // node selected, that node a third of the way down, above its sheet (08 2.11). Before paint,
  // and only when the sector or the selection changes: a buy never scrolls under the thumb.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on open and selection only
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const chosen = selected ? positions.get(selected) : undefined;
    if (chosen) {
      element.scrollTop = Math.max(0, chosen.y - element.clientHeight * 0.35);
      return;
    }
    const lowest = [...rings]
      .reverse()
      .find((ring) => ring.nodes.some((item) => !ownsNode(meta, item.node.id)));
    const index = rings.findIndex((ring) => ring.ring === lowest?.ring);
    const band = bands[index === -1 ? rings.length - 1 : index];
    if (!band) return;
    element.scrollTop = Math.max(0, band.top + band.height - element.clientHeight);
  }, [sector, selected]);

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, node: NodeDef) => {
    const step = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [1, 0], ArrowDown: [-1, 0] }[
      event.key
    ];
    if (!step) return;
    event.preventDefault();
    const ring = rings.find((row) => row.ring === node.ring + (step[0] ?? 0));
    if (!ring) return;
    const slots = ring.nodes.map((item) => item.node.slot);
    const want = node.slot + (step[1] ?? 0);
    const target = step[0] === 0 ? want : clampSlot(node.slot, node.ring, ring.ring, slots);
    const next = ring.nodes.find((item) => item.node.slot === target)?.node;
    if (!next) return;
    (
      scroller.current?.querySelector(`[data-node="${next.id}"]`) as HTMLButtonElement | null
    )?.focus();
  };

  return (
    <div className={`ladder-scroll${selected ? " sheet-open" : ""}`} ref={scroller}>
      <div className="ladder" style={{ height: total }}>
        <svg className="ladder-edges" width="100%" height={total} aria-hidden="true">
          {rings.flatMap((ring) =>
            ring.nodes.flatMap((item) =>
              item.node.requires.map((parentId) => {
                const parent = nodeOf(content, parentId);
                const from = positions.get(item.node.id);
                const to = positions.get(parentId);
                // Ring 1 hangs from Ground Zero, which the ladder does not draw.
                if (!from || !to || parent?.ring === 0) return null;
                const owned = ownsNode(meta, item.node.id) && ownsNode(meta, parentId);
                const lit =
                  path.has(item.node.id) && (path.has(parentId) || ownsNode(meta, parentId));
                const fresh = just.includes(item.node.id);
                return (
                  <line
                    key={`${item.node.id}-${parentId}`}
                    className={`edge${owned ? " owned" : ""}${lit ? " lit" : ""}${fresh ? " just" : ""}`}
                    x1={`${from.x * 100}%`}
                    y1={from.y}
                    x2={`${to.x * 100}%`}
                    y2={to.y}
                    pathLength={1}
                  />
                );
              }),
            ),
          )}
        </svg>
        {rings.map((ring, index) => {
          const band = bands[index];
          if (!band) return null;
          const gate = ringGate(content, ring.ring);
          const shut = gate !== null && meta.wipeDays < gate;
          return (
            <section
              key={ring.ring}
              className={`ring-band${shut ? " shut" : ""}`}
              style={{ top: band.top, height: band.height }}
              aria-label={t("map.ring_label", { ring: ring.ring })}
            >
              <h3 className="ring-head">
                <span className="ring-word">{t("map.ring_label", { ring: ring.ring })}</span>
                <span className="ring-sub">
                  {shut
                    ? t("map.ring_opens_togo", {
                        ring: ring.ring,
                        at: gate,
                        toGo: (gate ?? 0) - meta.wipeDays,
                      })
                    : t("map.ring_band", {
                        low: fmt(ring.band[0], "cost"),
                        high: fmt(ring.band[1], "cost"),
                      })}
                </span>
              </h3>
              {ring.nodes.map((item) => {
                const node = item.node;
                const state = states.get(node.id) ?? { kind: "hidden" as const };
                const cls = stateClass(state);
                const isPick = pick?.node.id === node.id;
                const dim = kept !== null && !kept.has(node.id);
                const onPath = path.has(node.id);
                const fresh = just.includes(node.id);
                const y = HEAD + (ring.rows - 1 - item.row) * ROW;
                return (
                  <button
                    key={node.id}
                    type="button"
                    data-node={node.id}
                    className={`node-btn ${cls} type-${node.type}${isPick ? " pick" : ""}${selected === node.id ? " selected" : ""}${onPath ? " on-path" : ""}${dim ? " dim" : ""}${fresh ? " just" : ""}`}
                    style={{ left: `${item.x * 100}%`, top: y }}
                    aria-label={nodeLabel(node, state)}
                    aria-pressed={selected === node.id}
                    onClick={() => openNode(selected === node.id ? null : node.id)}
                    onKeyDown={(event) => onKey(event, node)}
                  >
                    <span className="node-frame" aria-hidden="true">
                      <span className="node-letters">{nodeLetters(node.id)}</span>
                      {cls === "locked" ? (
                        <Icon kind="ui" id="lock" size={14} className="node-lock" />
                      ) : null}
                      {isPick ? (
                        <Icon kind="ui" id="crown" size={14} className="node-crown" />
                      ) : null}
                    </span>
                    <span className="node-name">{nodeName(node.id)}</span>
                    {cls === "reachable" || cls === "affordable" ? (
                      <span className="node-cost num">{fmt(node.cost, "cost")}</span>
                    ) : null}
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** The slot in a neighbouring ring nearest to `slot` of a ring with `fromRing`'s size. */
function clampSlot(slot: number, fromRing: number, toRing: number, slots: number[]): number {
  const fromSize = content.blastMap.rings.find((row) => row.ring === fromRing)?.size ?? 1;
  const toSize = content.blastMap.rings.find((row) => row.ring === toRing)?.size ?? 1;
  const want = Math.round(((slot - 0.5) / fromSize) * toSize + 0.5);
  return slots.reduce(
    (best, candidate) => (Math.abs(candidate - want) < Math.abs(best - want) ? candidate : best),
    slots[0] ?? 1,
  );
}
