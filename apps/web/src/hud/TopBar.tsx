import { mannedRate, suppliesAt } from "@wipe-day/domain/settle";
import { useEffect, useRef } from "react";
import { gameSeconds, useWorld } from "../state/store";
import { content, fmt, fmtRate, t } from "../state/world";
import { ResourceIcon } from "./Icon";

/**
 * The supplies counter: one big number with its rate under it (docs/redesign/09-architecture.md
 * 10.2). React renders it once; a rAF loop writes the figures from the closed-form settle, so a
 * ticking counter never re-renders the HUD. Held amounts floor (never claim what you lack).
 */
export function TopBar() {
  const amount = useRef<HTMLSpanElement>(null);
  const rate = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    let shownAmount = "";
    let shownRate = "";
    const draw = () => {
      const base = useWorld.getState().base;
      if (base) {
        const now = Math.max(gameSeconds(), base.run.settledAt);
        const nextAmount = fmt(suppliesAt(content, base, now), "held");
        // Nothing runs by itself yet: no rate line (an empty one keeps the pill's height).
        const perSecond = mannedRate(content, base, Math.floor(now));
        const nextRate = perSecond > 0 ? fmtRate(perSecond) : "";
        if (nextAmount !== shownAmount && amount.current) {
          amount.current.textContent = nextAmount;
          shownAmount = nextAmount;
        }
        if (nextRate !== shownRate && rate.current) {
          rate.current.textContent = nextRate || " ";
          shownRate = nextRate;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="topbar">
      <div className="glass counter" title={t("hud.supplies")}>
        <ResourceIcon id="supplies" />
        <div className="figures">
          <span className="amount" ref={amount} />
          <span className="rate" ref={rate} />
        </div>
      </div>
    </div>
  );
}

/** The one thing to do on a fresh island: tap it (rule 6.3.6). Gone after the first tap. */
export function TapHint() {
  const fresh = useWorld((state) => state.base !== null && state.base.run.taps === 0);
  if (!fresh) return null;
  return <div className="glass tap-hint">{t("hud.tap_hint")}</div>;
}
