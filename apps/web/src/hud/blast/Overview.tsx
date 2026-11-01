import { ringGate } from "@wipe-day/content/blastmap";
import { ownsNode } from "@wipe-day/domain/blastmap";
import { useMemo } from "react";
import { useMap } from "../../state/map";
import { content, sectorName, t } from "../../state/world";
import { Icon } from "../Icon";
import { blastLayout } from "./layout";
import type { MapView } from "./shared";
import { stateClass } from "./shared";

/**
 * The overview disk (docs/redesign/08-screens.md 2.9; 04-blast-map.md 8.1): one SVG of the
 * shipped nodes as dots (owned glass green, affordable ringed, the pick pulsing), eight wedges
 * as tap targets with their glyph, fill arc and affordable count, locked rings dashed with
 * their gate, Ground Zero in the hub. No SVG filters: the owned glow is a second circle. A
 * ring lit in all eight sectors glows once as a full circle.
 */
const SIZE = 370;

export function Overview({ view }: { view: MapView }) {
  const layout = useMemo(() => blastLayout(content, SIZE), []);
  const openSector = useMap((state) => state.openSector);
  const just = useMap((state) => state.just);
  const { base, states, pick, kept } = view;
  const meta = base.meta;
  const perSector = new Map<string, { owned: number; total: number; affordable: number }>();
  for (const sector of content.blastMap.sectors)
    perSector.set(sector, { owned: 0, total: 0, affordable: 0 });
  for (const node of layout.nodes) {
    const row = perSector.get(node.sector);
    if (!row) continue;
    row.total += 1;
    const state = states.get(node.id)?.kind;
    if (state === "owned") row.owned += 1;
    if (state === "affordable") row.affordable += 1;
  }
  const fullRings = new Set<number>();
  for (const ring of layout.rings) {
    const nodes = layout.nodes.filter((node) => node.ring === ring.ring);
    if (nodes.length > 0 && nodes.every((node) => ownsNode(meta, node.id)))
      fullRings.add(ring.ring);
  }
  const open = (sector: string) => openSector(sector);

  return (
    <div className="disk" style={{ maxWidth: SIZE }}>
      <svg className="disk-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-label={t("map.disk_label")}>
        <title>{t("map.disk_label")}</title>
        {/* Rings, dashed while their gate is shut; a full ring glows. */}
        {layout.rings.map((ring) => {
          const gate = ringGate(content, ring.ring);
          const shut = gate !== null && meta.wipeDays < gate;
          return (
            <circle
              key={ring.ring}
              className={`disk-ring${shut ? " shut" : ""}${fullRings.has(ring.ring) ? " full" : ""}`}
              cx={layout.cx}
              cy={layout.cy}
              r={ring.r}
            />
          );
        })}
        {/* Wedges: the tap targets, with their fill arcs. */}
        {layout.wedges.map((wedge) => {
          const row = perSector.get(wedge.sector) ?? { owned: 0, total: 0, affordable: 0 };
          const fill = row.total > 0 ? row.owned / row.total : 0;
          return (
            <g key={wedge.sector} className="wedge-group">
              {/* biome-ignore lint/a11y/useSemanticElements: an SVG wedge cannot be a <button>; it is keyed and labelled like one */}
              <path
                className={`wedge${row.owned === row.total && row.total > 0 ? " done" : ""}`}
                d={wedge.d}
                role="button"
                tabIndex={0}
                aria-label={t("map.wedge_label", {
                  sector: sectorName(wedge.sector),
                  owned: row.owned,
                  total: row.total,
                  affordable: row.affordable,
                })}
                onClick={() => open(wedge.sector)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    open(wedge.sector);
                  }
                }}
              />
              <path className="wedge-track" d={wedge.arc.d} pathLength={1} />
              {fill > 0 ? (
                <path
                  className="wedge-fill"
                  d={wedge.arc.d}
                  pathLength={1}
                  style={{ strokeDasharray: `${fill} 1` }}
                />
              ) : null}
            </g>
          );
        })}
        {/* The dots: every shipped node, by state. */}
        {layout.nodes.map((node) => {
          const state = states.get(node.id) ?? { kind: "hidden" as const };
          const dim = kept !== null && !kept.has(node.id);
          const isPick = pick?.node.id === node.id;
          const fresh = just.includes(node.id);
          return (
            <g key={node.id} className={`dot-group${dim ? " dim" : ""}`}>
              {state.kind === "owned" ? (
                <circle className="dot-glow" cx={node.x} cy={node.y} r={7} />
              ) : null}
              {isPick ? <circle className="pick-ring" cx={node.x} cy={node.y} r={8} /> : null}
              <circle
                className={`dot ${stateClass(state)}${isPick ? " pick" : ""}${fresh ? " just" : ""}`}
                cx={node.x}
                cy={node.y}
                r={3.5}
              />
            </g>
          );
        })}
        {/* Ground Zero's hub. */}
        <circle className="hub" cx={layout.cx} cy={layout.cy} r={layout.rim * 0.1} />
      </svg>
      {/* Labels over the SVG: the sector glyphs with their affordable counts, the hub's glyph,
          the shut rings' gates. Pointer events pass through to the wedges. */}
      <div className="disk-labels" aria-hidden="true">
        {layout.wedges.map((wedge) => {
          const row = perSector.get(wedge.sector);
          return (
            <span
              key={wedge.sector}
              className={`wedge-label${row && row.owned === row.total && row.total > 0 ? " done" : ""}`}
              style={{
                left: `${(wedge.label.x / SIZE) * 100}%`,
                top: `${(wedge.label.y / SIZE) * 100}%`,
              }}
            >
              <Icon kind="sector" id={wedge.sector} size={22} />
              <span className="wedge-name">{sectorName(wedge.sector)}</span>
              {row && row.affordable > 0 ? (
                <span className="badge num wedge-count">{row.affordable}</span>
              ) : null}
            </span>
          );
        })}
        <span className="hub-glyph" style={{ left: "50%", top: "50%" }}>
          <Icon kind="ui" id="ground_zero" size={26} />
        </span>
      </div>
    </div>
  );
}
