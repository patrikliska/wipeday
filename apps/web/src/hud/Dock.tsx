import { useColumn } from "../state/layout";
import { useWorld } from "../state/store";
import { type Panel, useUi } from "../state/ui";
import { t } from "../state/world";
import { Icon } from "./Icon";
import { Ticker } from "./Ticker";

/**
 * The dock (D187, D199; 12-feel.md 4): one bottom bar on every device, centred on desktop with
 * larger icons. Island from 0:00; each destination joins when it unlocks, and only once its phase
 * has shipped (D140): in R2 Feel S4 that is Crew, at the first hand. A badge counts new things
 * (Crew: hands hired since the Crew sheet last showed this run). Island closes any sheet. On
 * desktop the news ticker runs under it.
 */
type Place = "island" | Panel;

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
  const playing = useWorld((state) => state.phase === "playing");
  if (!playing) return null;

  const current: Place = panel === "crew" ? "crew" : "island";
  const newHands = Math.max(0, hands - (seen.run === run ? seen.hands : 0));
  const items: Array<{ id: Place; icon: string; badge: number }> = [
    { id: "island", icon: "island", badge: 0 },
    ...(crew ? [{ id: "crew" as const, icon: "crew", badge: newHands }] : []),
  ];

  return (
    <div className="dock-wrap">
      <nav className="dock plate" aria-label={t("nav.label")}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`dock-item${current === item.id ? " on" : ""}`}
            aria-current={current === item.id ? "page" : undefined}
            aria-label={
              item.badge > 0
                ? t("nav.with_badge", { place: t(`nav.${item.id}`), count: item.badge })
                : t(`nav.${item.id}`)
            }
            onClick={() => {
              if (current === item.id) return;
              openPanel(item.id === "island" ? null : item.id);
            }}
          >
            <Icon kind="nav" id={item.icon} size={column ? 30 : 26} />
            <span className="dock-label">{t(`nav.${item.id}`)}</span>
            {item.badge > 0 ? <span className="badge num">{item.badge}</span> : null}
          </button>
        ))}
      </nav>
      {column ? <Ticker /> : null}
    </div>
  );
}
