import { useEffect, useRef } from "react";
import { gameSeconds, localSeconds, useWorld } from "../state/store";
import { closeAll } from "../state/ui";
import { clockLabel, duration, fmt, t } from "../state/world";
import { Icon, ResourceIcon } from "./Icon";
import { SheetFrame } from "./Sheet";

/**
 * Welcome back (02-the-run.md 10.2; 08-screens.md 2.14; CLAUDE.md 6.3 rule 10): after an hour
 * away, one card says what the hands made and whether the Night Shift ran out, with one button,
 * Collect, which flies the gain into the counter. There is no other way out: the backdrop and
 * Escape collect too, so a gain is never lost. With nobody on shift the button is "Back to work"
 * and the crown goes to a hand row afterwards (the advisor's rule 3).
 */
export function Welcome() {
  const card = useWorld((state) => state.welcome);
  const collect = useWorld((state) => state.collect);
  const shown = useRef(false);
  useEffect(() => {
    if (card && !shown.current) {
      // One card on top: a sheet or panel left open while away closes under it.
      closeAll();
    }
    shown.current = card !== null;
  }, [card]);
  if (!card) return null;
  const nobody = card.hands === 0;
  const gain = card.gain >= 1;
  const { full, window, worked } = card.nightShift;
  const left = Math.max(0, window - worked);
  const lead = nobody
    ? t("welcome.nobody")
    : full
      ? t("welcome.worked_full", { time: duration(window) })
      : t("welcome.worked_all");
  const stopped = !nobody && card.stoppedAt !== null ? stoppedLine(card.stoppedAt) : null;
  const button = nobody ? t("welcome.back_to_work") : t("welcome.collect");

  return (
    <SheetFrame
      id="welcome"
      className="welcome"
      title={t("welcome.title")}
      head={<p className="sub">{t("welcome.away", { time: duration(card.awaySeconds) })}</p>}
      primary={button}
      onPrimary={collect}
      onClose={collect}
      closable={false}
    >
      {gain ? (
        <p className="welcome-gain">
          <ResourceIcon id="supplies" size={34} />
          <span className="num">+{fmt(card.gain, "held")}</span>
        </p>
      ) : null}
      <p className="welcome-line">
        <span className="welcome-icon">
          <Icon kind="ui" id="night_shift" size={26} />
        </span>
        <span>
          {lead}
          {stopped ? <span className="welcome-stopped">{stopped}</span> : null}
        </span>
      </p>
      {nobody ? null : (
        // The lamp burning down (12-feel.md 6): what is left of the window the hands worked.
        <div className={`welcome-lamp${full ? " out" : ""}`}>
          <span className="lamp-bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${window > 0 ? left / window : 0})` }} />
          </span>
          <span className="welcome-lamp-text">
            {full
              ? t("welcome.lamp_out")
              : t("welcome.lamp_left", { left: duration(left), window: duration(window) })}
          </span>
        </div>
      )}
    </SheetFrame>
  );
}

/** "They stopped at 21:40." today, "yesterday at", or the weekday, on this browser's clock. */
function stoppedLine(at: number): string {
  const day = (seconds: number) => Math.floor(localSeconds(seconds) / 86_400);
  const time = clockLabel(localSeconds(at));
  const days = day(gameSeconds()) - day(at);
  if (days <= 0) return t("welcome.stopped_today", { time });
  if (days === 1) return t("welcome.stopped_yesterday", { time });
  const weekday = new Date(at * 1000).toLocaleDateString("en-GB", { weekday: "long" });
  return t("welcome.stopped_day", { day: weekday, time });
}
