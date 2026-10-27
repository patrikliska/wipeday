import { badgeCount } from "@wipe-day/domain/badges";
import { heldDrops } from "@wipe-day/domain/cards";
import { useRef } from "react";
import { useAdvisor } from "../state/advisor";
import { useColumn } from "../state/layout";
import { useWorld } from "../state/store";
import { type Panel, useUi } from "../state/ui";
import { content, t } from "../state/world";
import { albumShown, cardsOwned } from "./Album";
import { Icon } from "./Icon";
import { researchTab, workshopOpenItems, workshopShown } from "./rows";
import { Ticker } from "./Ticker";

/**
 * The dock (D187, D199; 12-feel.md 4): one bottom bar on every device, centred on desktop with
 * larger icons. Island from 0:00; each destination joins when it unlocks, and only once its phase
 * has shipped (D140): the Workshop two minutes into the run (it opens the shop on its tab), Crew
 * at the first hand, the Logbook at the first badge. A badge counts new things (the Workshop:
 * items opened since its tab last showed; Crew: hands hired since the Crew sheet last showed
 * this run; the Logbook: badges earned since it last showed). Island closes any sheet.
 * The Album (D260) counts held drops plus cards owned since it last showed. On desktop the news
 * ticker runs under it.
 */
type Place = "island" | "workshop" | Panel;

export function Dock() {
  const column = useColumn();
  const crew = useWorld(
    (state) =>
      state.base !== null && (state.base.run.hands.length > 0 || state.base.meta.stats.hands > 0),
  );
  const run = useWorld((state) => state.base?.run.n ?? 0);
  const hands = useWorld((state) => state.base?.run.hands.length ?? 0);
  const seen = useUi((state) => state.crewSeen);
  const panel = useUi((state) => state.panel);
  const openPanel = useUi((state) => state.openPanel);
  const tab = useUi((state) => state.tab);
  const expanded = useUi((state) => state.expanded);
  const workshopSeen = useUi((state) => state.workshopSeen);
  const badges = useWorld((state) => (state.base ? badgeCount(content, state.base) : 0));
  const badgesSeen = useUi((state) => state.badgesSeen);
  const album = useWorld((state) => (state.base ? albumShown(state.base) : false));
  const albumHeld = useWorld((state) => (state.base ? heldDrops(state.base.meta.drops) : 0));
  const albumCards = useWorld((state) => (state.base ? cardsOwned(state.base) : 0));
  const albumSeen = useUi((state) => state.albumSeen);
  const view = useAdvisor((state) => state.view);
  const playing = useWorld((state) => state.phase === "playing");
  // The places the dock showed when the game opened; a place that joins later pops in (3.2).
  const first = useRef<Set<Place> | null>(null);
  if (!playing) return null;

  const workshop = view !== null && workshopShown(view);
  const openItems = workshop && view ? workshopOpenItems(researchTab(view, 1).groups) : 0;
  const newItems = Math.max(0, openItems - (workshopSeen.run === run ? workshopSeen.items : 0));
  const onWorkshop = workshop && tab === "research" && (column || expanded);
  const current: Place =
    panel === "crew" || panel === "logbook" || panel === "album"
      ? panel
      : onWorkshop
        ? "workshop"
        : "island";
  const newHands = Math.max(0, hands - (seen.run === run ? seen.hands : 0));
  const items: Array<{ id: Place; icon: string; badge: number }> = [
    { id: "island", icon: "island", badge: 0 },
    ...(workshop ? [{ id: "workshop" as const, icon: "workshop", badge: newItems }] : []),
    ...(crew ? [{ id: "crew" as const, icon: "crew", badge: newHands }] : []),
    // The Album from the first Supply Drop (D260): drops to open, and cards new since it showed.
    ...(album
      ? [
          {
            id: "album" as const,
            icon: "album",
            badge: albumHeld + Math.max(0, albumCards - albumSeen),
          },
        ]
      : []),
    ...(badges > 0
      ? [{ id: "logbook" as const, icon: "logbook", badge: Math.max(0, badges - badgesSeen) }]
      : []),
  ];
  first.current ??= new Set(items.map((item) => item.id));
  const shownAtStart = first.current;
  const go = (place: Place) => {
    const ui = useUi.getState();
    if (place === "workshop") {
      ui.openWorkshop(column);
      return;
    }
    if (place === "island") {
      // Back to the island: the panel closes, the shop returns to its lines.
      if (panel !== null) openPanel(null);
      else if (expanded) ui.expand(false);
      if (tab === "research") ui.setTab("lines");
      return;
    }
    openPanel(place);
  };

  return (
    <div className="dock-wrap">
      <nav className="dock plate" aria-label={t("nav.label")}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`dock-item${current === item.id ? " on" : ""}${shownAtStart.has(item.id) ? "" : " arrive"}`}
            aria-current={current === item.id ? "page" : undefined}
            aria-label={
              item.badge > 0
                ? t("nav.with_badge", { place: t(`nav.${item.id}`), count: item.badge })
                : t(`nav.${item.id}`)
            }
            onClick={() => {
              if (current === item.id) return;
              go(item.id);
            }}
          >
            <Icon kind="nav" id={item.icon} size={column ? 30 : 26} />
            <span className="dock-label">{t(`nav.${item.id}`)}</span>
            {item.badge > 0 ? (
              // Keyed on the count, so each new thing pops the badge again.
              <span key={item.badge} className="badge num pop">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      {column ? <Ticker /> : null}
    </div>
  );
}
