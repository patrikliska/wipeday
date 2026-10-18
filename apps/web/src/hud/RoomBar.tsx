/**
 * The bar over the house's room (D206): where you are and the way back. Back, Escape and a tap
 * on the dimmed island all close it (6.3 rule 2: never a dead end).
 */
import { sound } from "../sound/audio";
import { useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { t } from "../state/world";

export function RoomBar() {
  const open = useUi((state) => state.house);
  const era = useWorld((state) => state.base?.run.era);
  if (!open || !era) return null;
  const house = t(`house.${era}`);
  return (
    <section className="plate room-bar" aria-label={t("house.title", { house })}>
      <button
        type="button"
        className="btn room-back"
        onClick={() => {
          sound.play("ui_close");
          useUi.getState().openHouse(false);
        }}
      >
        <span aria-hidden="true">‹</span> {t("house.back")}
      </button>
      <span className="room-title">{t("house.title", { house })}</span>
    </section>
  );
}
