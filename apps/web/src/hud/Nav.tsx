import { sound } from "../sound/audio";
import { useWorld } from "../state/store";
import { type Panel, useUi } from "../state/ui";
import { t } from "../state/world";
import { Icon } from "./Icon";

/**
 * The nav row (08-screens.md 1.5): hidden at 0:00, it slides in when its first destination
 * unlocks (Crew, at the first hire). An R1 build has Island and Crew only: a destination whose
 * phase has not shipped does not exist on screen (7.3). Island closes any panel.
 */
const ITEMS: Array<{ id: "island" | Panel; icon: string }> = [
  { id: "island", icon: "island" },
  { id: "crew", icon: "crew" },
];

/** The row exists once the first hand was ever hired. */
export function useNavShown(): boolean {
  return useWorld(
    (state) =>
      state.base !== null && (state.base.run.hands.length > 0 || state.base.meta.stats.hands > 0),
  );
}

export function Nav({ inColumn = false }: { inColumn?: boolean }) {
  const shown = useNavShown();
  const panel = useUi((state) => state.panel);
  const openPanel = useUi((state) => state.openPanel);
  if (!shown) return null;
  const current = panel === null ? "island" : panel;
  return (
    <nav className={`nav${inColumn ? " in-column" : " glass"}`} aria-label={t("nav.label")}>
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav-item${current === item.id ? " on" : ""}`}
          aria-current={current === item.id ? "page" : undefined}
          onClick={() => {
            if (current === item.id) return;
            sound.play(item.id === "island" ? "ui_close" : "ui_open");
            openPanel(item.id === "island" ? null : item.id);
          }}
        >
          <Icon kind="nav" id={item.icon} size={24} />
          <span>{t(`nav.${item.id}`)}</span>
        </button>
      ))}
    </nav>
  );
}
