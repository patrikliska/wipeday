import { rates } from "@wipe-day/domain/effects";
import { useColumn } from "../state/layout";
import { useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { content, fmt, fmtFactor, t } from "../state/world";
import { ResourceIcon } from "./Icon";
import { useRise } from "./util";

/**
 * The glass plate (docs/redesign/08-screens.md 1.2; R4 S3, D271): beside the scrap plate from
 * Wipe Day #1, the crater glass held and, on a desktop, "Glow ×2.17"; a phone keeps the number
 * and says Glow in its label. It opens the Blast Map, where the glass is spent. It pops when
 * the held count rises (a press, a grant) and flashes with it.
 */
export function GlassPlate() {
  const held = useWorld((state) => state.base?.meta.glass.held ?? 0);
  const shown = useWorld((state) => (state.base?.meta.wipeDays ?? 0) >= 1);
  const glow = useWorld((state) => (state.base ? rates(content, state.base).glow : 1));
  const panel = useUi((state) => state.panel);
  const openPanel = useUi((state) => state.openPanel);
  const column = useColumn();
  const rose = useRise(held);
  if (!shown) return null;
  return (
    <button
      type="button"
      className={`glass-plate${panel === "map" ? " active" : ""}`}
      onClick={() => openPanel(panel === "map" ? null : "map")}
      aria-pressed={panel === "map"}
      aria-label={t("hud.glass_label", { held: fmt(held, "held"), glow: fmtFactor(glow) })}
    >
      <span className="plate glass-face">
        {rose > 0 ? <span key={`flash-${rose}`} className="card-flash" aria-hidden="true" /> : null}
        <ResourceIcon id="glass" size={20} className="glass-plate-icon" />
        <span key={`n-${rose}`} className={`num${rose > 0 ? " pop" : ""}`}>
          {fmt(held, "held")}
        </span>
        {column ? (
          <span className="glass-glow num">{t("hud.glow", { glow: fmtFactor(glow) })}</span>
        ) : null}
      </span>
    </button>
  );
}
