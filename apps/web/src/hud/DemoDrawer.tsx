import { useState } from "react";
import { demoClocks } from "../state/clocks";
import { localSeconds, useWorld } from "../state/store";
import { clockLabel, GAME_DAY, t } from "../state/world";

/**
 * Showcase controls for demo mode, not part of the game (D138): the game clock runs at 1×;
 * pause it, or jump it +1 h, +6 h or to the next 08:00. Jumps move the game clock only: the
 * domain sees the time pass, real-second animation does not.
 */
export function DemoDrawer() {
  const mode = useWorld((state) => state.mode);
  const open = useWorld((state) => state.demoOpen);
  const toggle = useWorld((state) => state.toggleDemo);
  const second = useWorld((state) => state.second);
  const jump = useWorld((state) => state.demoJump);
  const pause = useWorld((state) => state.demoPause);
  const reset = useWorld((state) => state.demoReset);
  const patch = useWorld((state) => state.demoPatch);
  const supplies = useWorld((state) => state.base?.run.supplies ?? 0);
  const [paused, setPaused] = useState(demoClocks.game.paused);
  if (mode !== "demo") return null;

  const local = localSeconds(second);
  const day = Math.floor(local / GAME_DAY) + 1;

  return (
    <>
      <button
        type="button"
        className={`glass demo-toggle${open ? " active" : ""}`}
        onClick={toggle}
        title={t("demo.title")}
        aria-label={t("demo.title")}
      >
        ✦
      </button>
      {open ? (
        <div className="glass demo">
          <h3>{t("demo.title")}</h3>
          <div className="clock">
            <span>{t("demo.clock")}</span>
            <span className="big num">
              {clockLabel(local)} · {day}
            </span>
          </div>
          <div className="buttons">
            <button
              type="button"
              className="btn"
              onClick={() => {
                pause(!paused);
                setPaused(!paused);
              }}
            >
              {paused ? t("demo.play") : t("demo.pause")}
            </button>
            <button type="button" className="btn" onClick={() => jump("hour")}>
              {t("demo.hour")}
            </button>
            <button type="button" className="btn" onClick={() => jump("sixHours")}>
              {t("demo.six_hours")}
            </button>
            <button type="button" className="btn" onClick={() => jump("nextMorning")}>
              {t("demo.next_day")}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => patch({ supplies: supplies + 1e6 })}
            >
              {t("demo.give")}
            </button>
            <button type="button" className="btn" onClick={reset}>
              {t("demo.reset")}
            </button>
          </div>
          <p className="note">{t("demo.jumps")}</p>
        </div>
      ) : null}
    </>
  );
}
