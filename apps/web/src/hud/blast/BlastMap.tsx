import { ringGate, shippedRings } from "@wipe-day/content/blastmap";
import { litCount, NODE_TAGS } from "@wipe-day/domain/blastmap";
import { rates } from "@wipe-day/domain/effects";
import { useEffect, useRef } from "react";
import { useColumn } from "../../state/layout";
import { type MapFilter, useMap } from "../../state/map";
import { useWorld } from "../../state/store";
import { useUi } from "../../state/ui";
import { content, fmt, fmtFactor, nodeName, sectorName, sectorTagline, t } from "../../state/world";
import { Icon, ResourceIcon } from "../Icon";
import { Ladder } from "./Ladder";
import { nextSector } from "./layout";
import { NodeSheet } from "./NodeSheet";
import { Overview } from "./Overview";
import { buyPath, type MapView, nodeLabel, useMapView } from "./shared";

/**
 * The Blast Map as a dock place (docs/redesign/08-screens.md 2.9-2.11; 04-blast-map.md 8;
 * D271): the overview disk with the filter chips and, while node buying is new, the pick card
 * at its foot (D244); a sector's ladder with `<` `>` to its neighbours; the node sheet over
 * either. On a desktop the disk and the chosen ladder sit side by side. The header's glass
 * chip is what the shards fly from. It closes by (x), Island, Escape and Android back.
 */
export function BlastMapPanel() {
  const view = useMapView();
  const now = useWorld((state) => state.second);
  const sector = useMap((state) => state.sector);
  const node = useMap((state) => state.node);
  const openSector = useMap((state) => state.openSector);
  const openPanel = useUi((state) => state.openPanel);
  const column = useColumn();
  // The panel always opens on the disk; it forgets where it was on close.
  useEffect(() => () => useMap.getState().reset(), []);
  if (!view) return null;
  const { base } = view;
  const { lit, total } = litCount(content, base.meta);
  const glow = rates(content, base).glow;
  const wide = column;
  // Desktop: the disk and a ladder together; the ladder is the chosen sector or the pick's.
  const shownSector =
    sector ?? (wide ? (view.pick?.node.sector ?? content.blastMap.sectors[0] ?? null) : null);
  const onLadder = !wide && sector !== null;
  const back = () => (onLadder ? openSector(null) : openPanel(null));

  return (
    <div className={`panel-body map${wide ? " wide" : ""}`}>
      <header className="panel-head map-head">
        <button type="button" className="btn ghost map-back" onClick={back}>
          <Icon kind="ui" id="chevron" size={16} className="back" />
          {onLadder ? t("map.back_map") : t("map.back_island")}
        </button>
        <div className="map-title">
          {onLadder && sector ? (
            <h2>
              <Icon kind="sector" id={sector} size={22} />
              {sectorName(sector)}
              <span className="map-count num">{sectorCount(view, sector)}</span>
            </h2>
          ) : (
            <h2>{t("map.title")}</h2>
          )}
          <p className="sub">
            {onLadder && sector
              ? sectorTagline(sector)
              : [
                  t("map.glow_lit", { glow: fmtFactor(glow), lit, total }),
                  shutRing(base.meta.wipeDays),
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
        {onLadder && sector ? (
          <SectorArrows sector={sector} />
        ) : (
          <span className="map-glass plate" data-map-glass="">
            <ResourceIcon id="glass" size={20} />
            <span className="num">{fmt(base.meta.glass.held, "held")}</span>
          </span>
        )}
      </header>
      {!onLadder ? <FilterChips view={view} /> : null}
      <div className="map-body">
        {!onLadder ? (
          <div className="map-disk-col">
            <Overview view={view} />
          </div>
        ) : null}
        {shownSector ? (
          <div className="map-ladder-col">
            {wide ? (
              <div className="map-ladder-head">
                <SectorArrows sector={shownSector} />
                <h3>
                  <Icon kind="sector" id={shownSector} size={20} />
                  {sectorName(shownSector)}
                  <span className="map-count num">{sectorCount(view, shownSector)}</span>
                </h3>
                <p className="sub">{sectorTagline(shownSector)}</p>
              </div>
            ) : null}
            <Ladder view={view} sector={shownSector} />
          </div>
        ) : null}
      </div>
      {node ? <NodeSheet view={view} now={now} /> : <MapFoot view={view} />}
    </div>
  );
}

/** The first shut ring's gate, for the disk's sub line (the ring itself is dashed). */
function shutRing(wipeDays: number): string {
  for (const ring of shippedRings(content)) {
    const gate = ringGate(content, ring);
    if (gate !== null && wipeDays < gate) return t("map.ring_opens", { ring, at: gate });
  }
  return "";
}

function sectorCount(view: MapView, sector: string): string {
  let owned = 0;
  let total = 0;
  for (const node of content.blastMap.nodes) {
    if (node.sector !== sector) continue;
    const state = view.states.get(node.id);
    if (!state || state.kind === "hidden") continue;
    total += 1;
    if (state.kind === "owned") owned += 1;
  }
  return t("map.sector_count", { owned, total });
}

/** `<` `>` to the neighbouring sectors (clockwise). */
function SectorArrows({ sector }: { sector: string }) {
  const openSector = useMap((state) => state.openSector);
  return (
    <span className="map-arrows">
      <button
        type="button"
        className="btn icon-btn"
        aria-label={t("map.prev_sector", { sector: sectorName(nextSector(content, sector, -1)) })}
        onClick={() => openSector(nextSector(content, sector, -1))}
      >
        <Icon kind="ui" id="chevron" size={16} className="back" />
      </button>
      <button
        type="button"
        className="btn icon-btn"
        aria-label={t("map.next_sector", { sector: sectorName(nextSector(content, sector, 1)) })}
        onClick={() => openSector(nextSector(content, sector, 1))}
      >
        <Icon kind="ui" id="chevron" size={16} />
      </button>
    </span>
  );
}

/** Affordable, Taps, Offline, Automation: derived from the nodes' stats (04 8.4). */
function FilterChips({ view }: { view: MapView }) {
  const filter = useMap((state) => state.filter);
  const setFilter = useMap((state) => state.setFilter);
  const chips: MapFilter[] = ["affordable", ...NODE_TAGS];
  return (
    <div className="map-chips-wrap">
      <fieldset className="map-chips">
        <legend className="sr-only">{t("map.filters")}</legend>
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            className={`chip${filter === chip ? " on" : ""}`}
            aria-pressed={filter === chip}
            onClick={() => setFilter(chip)}
          >
            {t(`map.chip_${chip}`)}
            {chip === "affordable" && view.affordable > 0 ? (
              <span className="num chip-count">{view.affordable}</span>
            ) : null}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/**
 * The foot: the pick card while node buying is new (the map's one orange action, D244),
 * else a quiet summary of what the glass could buy.
 */
function MapFoot({ view }: { view: MapView }) {
  const chip = useRef<HTMLElement | null>(null);
  const { base, pick, affordable } = view;
  const held = base.meta.glass.held;
  const openNode = useMap((state) => state.openNode);
  const openSector = useMap((state) => state.openSector);
  if (pick) {
    const { node, state } = pick;
    const affordableNow = state.kind === "affordable";
    const open = () => {
      openSector(node.sector);
      openNode(node.id);
    };
    return (
      <footer className="panel-foot map-foot pick-card">
        <button
          type="button"
          className="pick-text"
          onClick={open}
          aria-label={nodeLabel(node, state)}
        >
          <Icon kind="ui" id="crown" size={16} className="pick-crown" />
          <span className="pick-name">{nodeName(node.id)}</span>
          <span className="pick-place">
            {t("map.node_place", {
              type: t(`node_type.${node.type}`),
              sector: node.sector ? sectorName(node.sector) : "",
              ring: node.ring,
            })}
          </span>
          {node.type !== "small" && t(`node.${node.id}.blurb`) ? (
            <span className="pick-blurb">{t(`node.${node.id}.blurb`)}</span>
          ) : null}
        </button>
        <button
          type="button"
          className={`btn${affordableNow ? " primary" : ""} pick-buy`}
          disabled={!affordableNow}
          ref={(element) => {
            chip.current = element;
          }}
          onClick={() =>
            buyPath([node], document.querySelector("[data-map-glass]") ?? chip.current)
          }
        >
          {affordableNow
            ? t("map.buy", { cost: fmt(node.cost, "cost") })
            : state.kind === "glass"
              ? t("map.need_more", { need: fmt(state.need - state.have, "cost") })
              : t("map.buy", { cost: fmt(node.cost, "cost") })}
        </button>
      </footer>
    );
  }
  return (
    <footer className="panel-foot map-foot">
      <p className="map-summary">
        {affordable > 0
          ? t("map.summary", { n: affordable, held: fmt(held, "held") })
          : t("map.summary_none", { held: fmt(held, "held") })}
      </p>
    </footer>
  );
}
