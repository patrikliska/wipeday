import { buffEffects } from "@wipe-day/domain/effects";
import { shownRate } from "@wipe-day/domain/glance";
import { suppliesAt } from "@wipe-day/domain/settle";
import { useEffect, useRef } from "react";
import { useAdvisor } from "../state/advisor";
import { wall } from "../state/clocks";
import { counterHold, gameSeconds, useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { buffName, content, duration, fmt, fmtFactor, fmtRate, t } from "../state/world";
import { Icon, ResourceIcon } from "./Icon";

/**
 * The top bar (08-screens.md 1.2): the supplies counter with its `/s`, a button that opens the
 * Multipliers sheet, and the menu. React renders it once; a rAF loop writes the figures from the
 * closed-form settle, so a ticking counter never re-renders the HUD (4.4). Held amounts floor.
 * While the welcome-back card is up the counter keeps its old value; Collect flies the gain in.
 */
export function TopBar() {
  const amount = useRef<HTMLSpanElement>(null);
  const rate = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const openSheet = useUi((state) => state.openSheet);
  const openPanel = useUi((state) => state.openPanel);
  const panel = useUi((state) => state.panel);

  useEffect(() => {
    let frame = 0;
    let shownAmount = "";
    let shownRate_ = "";
    let labelAt = 0;
    const draw = () => {
      const base = useWorld.getState().base;
      if (base) {
        const now = Math.max(gameSeconds(), base.run.settledAt);
        const held = suppliesAt(content, base, now) - counterHold(wall.nowMs());
        const nextAmount = fmt(Math.max(0, held), "held");
        // Nothing runs by itself yet: no rate line (an empty one keeps the block's height).
        const perSecond = shownRate(content, base, Math.floor(now));
        const nextRate = perSecond > 0 ? `+${fmtRate(perSecond)}` : "";
        if (nextAmount !== shownAmount && amount.current) {
          amount.current.textContent = nextAmount;
          shownAmount = nextAmount;
        }
        if (nextRate !== shownRate_ && rate.current) {
          rate.current.textContent = nextRate || " ";
          shownRate_ = nextRate;
        }
        // Screen readers get a summary every 10 s, not every digit (08-screens.md 6.5).
        const ms = performance.now();
        if (button.current && ms - labelAt > 10_000) {
          labelAt = ms;
          button.current.setAttribute(
            "aria-label",
            t("hud.counter_label", { amount: nextAmount, rate: nextRate || "0/s" }),
          );
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="topbar">
      <button
        type="button"
        ref={button}
        className="glass counter"
        onClick={() => openSheet("multipliers")}
        aria-label={t("hud.supplies")}
      >
        <ResourceIcon id="supplies" size={28} className="counter-icon" />
        <span className="figures">
          <span className="amount num" ref={amount} aria-hidden="true" />
          <span className="rate num" ref={rate} aria-hidden="true" />
        </span>
      </button>
      <div className="top-actions">
        <button
          type="button"
          className={`glass menu${panel === "settings" ? " active" : ""}`}
          onClick={() => openPanel(panel === "settings" ? null : "settings")}
          aria-label={t("hud.menu")}
          aria-pressed={panel === "settings"}
        >
          <Icon kind="ui" id="menu" size={22} />
        </button>
      </div>
      <BuffPills />
    </div>
  );
}

/** Active buffs under the top bar: icon, `×4 · 41s` and a draining line; three at most (1.3). */
function BuffPills() {
  const buffs = useWorld((state) => state.base?.run.buffs);
  const second = useWorld((state) => state.second);
  const live = (buffs ?? []).filter((buff) => buff.until > second);
  if (live.length === 0) return null;
  const shown = live.slice(0, 3);
  return (
    <div className="buffs" aria-live="off">
      {shown.map((buff) => {
        let factor = 1;
        for (const effect of buffEffects(content, [buff], second)) {
          if (effect.op === "more") factor *= effect.value;
        }
        const kind = content.flotsam.kinds.find(
          (row) => "buff" in row.effect && row.effect.buff === buff.kind,
        );
        const total = kind && "seconds" in kind.effect ? kind.effect.seconds : buff.until - second;
        const left = Math.max(0, buff.until - second);
        return (
          <span key={buff.kind} className="glass buff">
            <Icon kind="flotsam" id={kind?.id ?? buff.kind} size={18} />
            <span className="num">
              {t("hud.buff", {
                name: buffName(buff.kind),
                factor: fmtFactor(factor),
                time: duration(left),
              })}
            </span>
            <i style={{ transform: `scaleX(${total > 0 ? left / total : 0})` }} />
          </span>
        );
      })}
      {live.length > 3 ? (
        <span className="glass buff more">{t("hud.buffs_more", { count: live.length - 3 })}</span>
      ) : null}
    </div>
  );
}

/**
 * The hint pill in the action band (08-screens.md 7.2): while the crown is on the tap hint
 * (02-the-run.md 11.1 rule 7) it reads "Tap the tree." and is the view's one crown.
 */
export function TapHint() {
  const tap = useAdvisor((state) => state.view?.pick.kind === "tap");
  const era = useWorld((state) => state.base?.run.era);
  const panel = useUi((state) => state.panel);
  const sheet = useUi((state) => state.sheet);
  const expanded = useUi((state) => state.expanded);
  const house = useUi((state) => state.house);
  if (!tap || !era || panel || sheet || expanded || house) return null;
  const target = content.targets.find((row) => row.era === era)?.id ?? "tree";
  return (
    <div className="glass tap-hint" data-crown="" role="status">
      {t(`target.${target}.hint`)}
    </div>
  );
}
