import { moraleOf } from "@wipe-day/domain/badges";
import { useEffect, useRef, useState } from "react";
import { wall } from "../state/clocks";
import { on } from "../state/events";
import { useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { content, t } from "../state/world";
import { BadgeIcon } from "./Logbook";

/** Badges earned within this long share one toast ("3 badges", `05` 1.8). */
const MERGE_MS = 2000;
/** How long the toast stays (ms). */
const SHOW_MS = 4500;

interface Shown {
  ids: string[];
  at: number;
}

/**
 * A badge earned (12-feel.md 9.1; D198): one toast under the top bar with the badge's icon and
 * name and what it did to Morale ("Morale ×1.11 → ×1.12"); badges within two seconds merge into
 * one ("3 badges"). Its button opens the Logbook. Fed by `badge_unlocked` on the event bus, so a
 * badge found by taps, a purchase or a catch all arrive here.
 */
export function BadgeToast() {
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<number | null>(null);
  const base = useWorld((state) => state.base);
  const openPanel = useUi((state) => state.openPanel);

  useEffect(
    () =>
      on((event) => {
        if (event.type !== "badge_unlocked") return;
        const now = wall.nowMs();
        setShown((current) => {
          if (current && now - current.at < MERGE_MS) {
            if (current.ids.includes(event.id)) return current;
            return { ids: [...current.ids, event.id], at: now };
          }
          return { ids: [event.id], at: now };
        });
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setShown(null), SHOW_MS);
      }),
    [],
  );
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!shown || !base) return null;
  const first = content.achievements.badges.find((badge) => badge.id === shown.ids[0]);
  if (!first) return null;
  const many = shown.ids.length > 1;
  const to = moraleOf(content, base);
  const from = to - content.achievements.moralePer * shown.ids.length;
  return (
    <div className="badge-toast-wrap" aria-live="polite">
      <div className="plate badge-toast" key={shown.ids.join(",")}>
        <span className="badge-toast-icon">
          <BadgeIcon badge={first} size={30} />
        </span>
        <span className="badge-toast-text">
          <span className="badge-toast-title">
            {many
              ? t("logbook.toast_many", { count: shown.ids.length })
              : t("logbook.toast", { name: t(`badge.${first.id}.name`) })}
          </span>
          <span className="badge-toast-morale num">
            {t("logbook.toast_morale", { from: from.toFixed(2), to: to.toFixed(2) })}
          </span>
        </span>
        <button
          type="button"
          className="btn toast-btn"
          onClick={() => {
            setShown(null);
            openPanel("logbook");
          }}
        >
          {t("logbook.open")}
        </button>
      </div>
    </div>
  );
}
