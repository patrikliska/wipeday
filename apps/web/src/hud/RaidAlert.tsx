/**
 * Raiders sighted (W6): from the warning until they land, a banner under the top bar
 * says when and how likely the walls hold, and opens the Defence panel. On phones it is
 * the way to the guard post, so it carries the glow when the advisor picks "defend".
 */
import { advise } from "@wipe-day/domain/advisor";
import { npcOdds, raidWarned } from "@wipe-day/domain/raids";
import { useShallow } from "zustand/shallow";
import { useWorld } from "../state/store";
import { content, duration, t } from "../state/world";

export function RaidAlert() {
  const openDefence = useWorld((state) => state.openDefence);
  const alert = useWorld(
    useShallow((state) => {
      // Read once a minute: the banner's words change no faster.
      const minute = Math.floor(state.now / 60) * 60;
      const base = state.base;
      if (state.view !== "base" || state.panel === "defence") return null;
      if (!raidWarned(content, base, minute)) return null;
      const odds = npcOdds(content, base, minute);
      if (!odds || odds.lands <= minute) return null;
      return {
        left: odds.lands - minute,
        chance: odds.chance,
        glow: advise(content, base, minute) === "defend",
      };
    }),
  );
  if (!alert) return null;
  return (
    <button
      type="button"
      className={`glass raid-alert${alert.glow ? " primary" : ""}`}
      onClick={() => openDefence("defence")}
    >
      <span className="flag" aria-hidden="true" />
      <span className="what">
        <b>{t("defence.sighted")}</b>
        <span>{t("defence.alert", { time: duration(alert.left), chance: alert.chance })}</span>
      </span>
    </button>
  );
}
