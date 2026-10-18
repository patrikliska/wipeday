import { buffEffects, rates } from "@wipe-day/domain/effects";
import { shownRate } from "@wipe-day/domain/glance";
import { suppliesAt } from "@wipe-day/domain/settle";
import { useEffect, useRef } from "react";
import { useAdvisor } from "../state/advisor";
import { wall } from "../state/clocks";
import { useColumn } from "../state/layout";
import { counterHold, gameSeconds, useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { buffName, content, duration, fmt, fmtFactor, fmtRate, t } from "../state/world";
import { Icon, ResourceIcon } from "./Icon";
import { pickPlace } from "./rows";
import { shopOpen } from "./Shop";

/**
 * The top of the screen (12-feel.md 4; the Feel Board's counter plate): the supplies counter
 * with its `/s` and the Best buy chip, the Night Shift lamp beside it, the settings pill on the
 * right. React renders it once; a rAF loop writes the figures from the closed-form settle, so a
 * ticking counter never re-renders the HUD (4.4). Held amounts floor. While the welcome-back card
 * is up the counter keeps its old value; Collect flies the gain in.
 */
export function TopBar() {
  const amount = useRef<HTMLSpanElement>(null);
  const rate = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const openSheet = useUi((state) => state.openSheet);
  const openPanel = useUi((state) => state.openPanel);
  const panel = useUi((state) => state.panel);
  const column = useColumn();

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
      <div className="counter-row">
        <div className="plate counter">
          <button
            type="button"
            ref={button}
            className="counter-hit"
            onClick={() => openSheet("multipliers")}
            aria-label={t("hud.supplies")}
          >
            <ResourceIcon id="supplies" size={column ? 52 : 38} className="counter-icon" />
            <span className="figures">
              <span className="amount num" ref={amount} aria-hidden="true" />
              <span className="rate num" ref={rate} aria-hidden="true" />
            </span>
          </button>
          {column ? <BestBuy /> : null}
        </div>
        {column ? (
          <Lamp />
        ) : (
          // A phone's plate stays narrow: the lamp and the chip share the row under it.
          <div className="counter-sub">
            <Lamp />
            <BestBuy />
          </div>
        )}
      </div>
      <button
        type="button"
        className={`plate pill menu${panel === "settings" ? " active" : ""}`}
        onClick={() => openPanel(panel === "settings" ? null : "settings")}
        aria-label={t("hud.menu")}
        aria-pressed={panel === "settings"}
      >
        <Icon kind="ui" id="menu" size={22} />
      </button>
      <BuffPills />
    </div>
  );
}

/**
 * The Best buy chip (D186): while the crowned card is out of sight (scrolled away, or on the
 * other tab), one chip in the counter plate brings it into view and pulses it once. Gold, never
 * orange: the crown stays the only orange thing in the view.
 */
function BestBuy() {
  const column = useColumn();
  // A primitive from the selector: a fresh object each time would re-render without end.
  const tab = useAdvisor((state) => (state.view ? (pickPlace(state.view)?.tab ?? null) : null));
  const open = useAdvisor((state) => shopOpen(state.view));
  const inView = useUi((state) => state.crownInView);
  // Under a panel, a sheet, the room or the expanded drawer (which crowns its own card).
  const covered = useUi(
    (state) =>
      state.panel !== null || state.sheet !== null || state.house || (state.expanded && !column),
  );
  if (!tab || !open || inView || covered) return null;
  return (
    <button
      type="button"
      className="best-buy"
      onClick={() => {
        useUi.getState().focusCrown(tab);
      }}
    >
      {t("hud.best_buy")}
      <Icon kind="ui" id="chevron" size={14} className={column ? "" : "down"} />
    </button>
  );
}

/**
 * The Night Shift lamp (12-feel.md 6): how long the hands would work on if the player left now,
 * burning down from the last command and filled again by the next. Shown once someone is on
 * shift: before that there is nobody to work the night.
 */
function Lamp() {
  const base = useWorld((state) => state.base);
  const second = useWorld((state) => state.second);
  if (!base || base.run.hands.length === 0) return null;
  const window = rates(content, base).nightShift;
  const left = Math.max(0, Math.min(window, base.run.activeAt + window - Math.max(second, 0)));
  const fill = window > 0 ? left / window : 0;
  return (
    <div
      className="plate lamp"
      role="img"
      aria-label={t("hud.lamp_label", { left: duration(left), window: duration(window) })}
    >
      <Icon kind="ui" id="night_shift" size={18} className="lamp-icon" />
      <span className="lamp-name">{t("hud.lamp")}</span>
      <span className="lamp-bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${fill})` }} />
      </span>
      <span className="lamp-time num">
        {duration(left)}
        <span className="lamp-of"> {t("hud.lamp_of", { window: duration(window) })}</span>
      </span>
    </div>
  );
}

/** Active buffs under the counter: icon, `×4 · 41s` and a draining line; three at most (1.3). */
function BuffPills() {
  const buffs = useWorld((state) => state.base?.run.buffs);
  const second = useWorld((state) => state.second);
  const live = (buffs ?? []).filter((buff) => buff.until > second);
  if (live.length === 0) return null;
  const shown = live.slice(0, 3);
  return (
    <div className="buffs" aria-live="off">
      {shown.map((buff) => {
        // Frenzy (D237) is one number on screen: taps and lines ×mult.
        const frenzy = buff.kind === "frenzy";
        let factor = 1;
        if (frenzy) factor = content.tap.frenzy.mult;
        else
          for (const effect of buffEffects(content, [buff], second)) {
            if (effect.op === "more") factor *= effect.value;
          }
        const kind = content.flotsam.kinds.find(
          (row) => "buff" in row.effect && row.effect.buff === buff.kind,
        );
        const total = frenzy
          ? content.tap.frenzy.seconds
          : kind && "seconds" in kind.effect
            ? kind.effect.seconds
            : buff.until - second;
        const left = Math.max(0, buff.until - second);
        return (
          <span key={buff.kind} className={`plate buff${frenzy ? " frenzy" : ""}`}>
            {frenzy ? (
              <Icon kind="ui" id="frenzy" size={18} />
            ) : (
              <Icon kind="flotsam" id={kind?.id ?? buff.kind} size={18} />
            )}
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
        <span className="plate buff more">{t("hud.buffs_more", { count: live.length - 3 })}</span>
      ) : null}
    </div>
  );
}

/**
 * The hint pill (08-screens.md 7.2): while the crown is on the tap hint (02-the-run.md 11.1
 * rule 7) it reads "Tap the tree." and is the view's one crown.
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
    <div className="plate tap-hint" data-crown="" role="status">
      {t(`target.${target}.hint`)}
    </div>
  );
}
