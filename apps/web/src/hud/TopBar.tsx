import { afterglowAt, afterglowRules, buffEffects, rates } from "@wipe-day/domain/effects";
import { shownRate } from "@wipe-day/domain/glance";
import { suppliesAt } from "@wipe-day/domain/settle";
import { useEffect, useRef } from "react";
import { useAdvisor } from "../state/advisor";
import { wall } from "../state/clocks";
import { emit } from "../state/events";
import { useColumn } from "../state/layout";
import { counterHold, gameSeconds, useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { buffName, content, duration, fmt, fmtFactor, fmtRate, t } from "../state/world";
import { EraPlate } from "./Era";
import { GlassPlate } from "./Glass";
import { Icon, ResourceIcon } from "./Icon";
import { ScrapPlate } from "./Scrap";
import { useRise } from "./util";

/**
 * The top of the screen (12-feel.md 4; the Feel Board's counter plate): the supplies counter
 * with its `/s`, the Night Shift lamp beside it, the next era's plate (D245), the settings pill on
 * the right. React renders it once; a rAF loop writes the figures from the closed-form settle, so a
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
        </div>
        {column ? (
          <>
            <Lamp />
            <ScrapPlate />
            <GlassPlate />
          </>
        ) : (
          // A phone's plate stays narrow: the lamp, the scrap and glass chips and the era plate
          // sit on the row under it.
          <div className="counter-sub">
            <Lamp />
            <ScrapPlate />
            <GlassPlate />
            <EraPlate />
          </div>
        )}
      </div>
      {/* Desktop: the next era centred between the counter and the settings pill (D245). */}
      {column ? <EraPlate /> : null}
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
 * The Night Shift lamp (12-feel.md 6): how long the hands would work on if the player left now,
 * burning down from the last command and filled again by the next. Shown once someone is on
 * shift: before that there is nobody to work the night.
 */
function Lamp() {
  const base = useWorld((state) => state.base);
  if (!base || base.run.hands.length === 0) return null;
  return <LampPlate window={rates(content, base).nightShift} activeAt={base.run.activeAt} />;
}

/** The lamp's plate; when Spare Wicks lengthen the window it flashes and its time pops (3.2). */
function LampPlate({ window, activeAt }: { window: number; activeAt: number }) {
  const second = useWorld((state) => state.second);
  const longer = useRise(window);
  const left = Math.max(0, Math.min(window, activeAt + window - Math.max(second, 0)));
  const fill = window > 0 ? left / window : 0;
  return (
    <div
      className="plate lamp"
      role="img"
      aria-label={t("hud.lamp_label", { left: duration(left), window: duration(window) })}
    >
      {longer > 0 ? (
        <span key={`flash-${longer}`} className="card-flash" aria-hidden="true" />
      ) : null}
      <Icon kind="ui" id="night_shift" size={18} className="lamp-icon" />
      <span className="lamp-name">{t("hud.lamp")}</span>
      <span className="lamp-bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${fill})` }} />
      </span>
      <span key={`time-${longer}`} className={`lamp-time num${longer > 0 ? " pop" : ""}`}>
        {duration(left)}
        <span className="lamp-of"> {t("hud.lamp_of", { window: duration(window) })}</span>
      </span>
    </div>
  );
}

/**
 * Active buffs under the counter: icon, `×4 · 41s` and a draining line; three at most (1.3). A
 * bought boost (D258) is a pill like a Rally's; a running Lucky Tide is one too, with its time.
 */
function BuffPills() {
  const buffs = useWorld((state) => state.base?.run.buffs);
  const tide = useWorld((state) => state.base?.run.tide ?? null);
  const second = useWorld((state) => state.second);
  // A bought boost or the tide that ran out this very second lingers a beat with its tick
  // (12-feel.md 3.2, D267): the pill is drawn once more with `ending`, and the bus hears it.
  const ending = useRef(new Map<string, number>());
  const boosts = (buffs ?? [])
    .filter((buff) => content.scrap.boosts.some((row) => row.id === buff.kind))
    .map((buff) => [buff.kind, buff.until] as const);
  if (tide) boosts.push([tide.boost, tide.until]);
  for (const [kind, until] of boosts) {
    if (until <= second && until > second - 2 && !ending.current.has(kind)) {
      ending.current.set(kind, until);
      emit({ type: "boost_ended", boost: kind });
    }
  }
  for (const [kind, until] of ending.current) if (until <= second - 2) ending.current.delete(kind);
  const live = (buffs ?? []).filter(
    (buff) => buff.until > second || ending.current.get(buff.kind) === buff.until,
  );
  const tideBoost =
    tide && (tide.until > second || ending.current.get(tide.boost) === tide.until)
      ? content.scrap.boosts.find((row) => row.id === tide.boost)
      : undefined;
  const afterglow = useAfterglow(second);
  // Afterglow's bar ends with the same tick (R4 S4): the pill lingers a beat as `ending`.
  if (afterglow?.ending && !ending.current.has("afterglow")) {
    ending.current.set("afterglow", second);
    emit({ type: "afterglow_ended" });
  }
  if (live.length === 0 && !tideBoost && !afterglow) return null;
  const shown = live.slice(0, afterglow ? 2 : 3);
  const hidden = live.length - shown.length;
  return (
    <div className="buffs" aria-live="off">
      {afterglow ? (
        // Afterglow (03 10.1): green, frozen at ×3 until the first tap, then counting down.
        <span
          key="afterglow"
          className={`plate buff afterglow${afterglow.ending ? " ending" : ""}`}
          role="img"
          aria-label={t("hud.afterglow_label", {
            factor: fmtFactor(afterglow.factor),
            time: duration(afterglow.left),
          })}
        >
          <Icon kind="ui" id="afterglow" size={18} />
          <span className="num">
            {afterglow.waiting
              ? t("hud.afterglow_waiting", { factor: fmtFactor(afterglow.factor) })
              : t("hud.afterglow", {
                  factor: fmtFactor(afterglow.factor),
                  time: duration(afterglow.left),
                })}
          </span>
          <i style={{ transform: `scaleX(${afterglow.fill})` }} />
        </span>
      ) : null}
      {shown.map((buff) => {
        const over = buff.until <= second;
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
        const boost = content.scrap.boosts.find((row) => row.id === buff.kind);
        const total = frenzy
          ? content.tap.frenzy.seconds
          : boost
            ? boost.seconds
            : kind && "seconds" in kind.effect
              ? kind.effect.seconds
              : buff.until - second;
        const left = Math.max(0, buff.until - second);
        return (
          <span
            key={buff.kind}
            className={`plate buff${frenzy ? " frenzy" : ""}${over ? " ending" : ""}`}
          >
            {frenzy || boost ? (
              <Icon kind="ui" id={buff.kind} size={18} />
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
      {tideBoost && tide && shown.length < 3 ? (
        <span key="tide" className={`plate buff${tide.until <= second ? " ending" : ""}`}>
          <Icon kind="ui" id={tideBoost.id} size={18} />
          <span className="num">
            {t("hud.tide", {
              name: t(`boost.${tideBoost.id}.name`),
              time: duration(Math.max(0, tide.until - second)),
            })}
          </span>
          <i
            style={{
              transform: `scaleX(${Math.max(0, tide.until - second) / tideBoost.seconds})`,
            }}
          />
        </span>
      ) : null}
      {hidden > 0 ? (
        <span className="plate buff more">{t("hud.buffs_more", { count: hidden })}</span>
      ) : null}
    </div>
  );
}

/**
 * Afterglow's pill (03 10.1): from run 2 on, until the fade ends. Before the run's first tap it
 * waits, frozen at the start factor; after, it counts down on the game clock (taps are commands
 * at game seconds, so the pill and the gain agree).
 */
function useAfterglow(
  second: number,
): { factor: number; left: number; fill: number; waiting: boolean; ending: boolean } | null {
  const base = useWorld((state) => state.base);
  if (!base || base.meta.nukes === 0) return null;
  const rules = afterglowRules(content, base);
  const total = rules.hold + rules.ends;
  const from = base.run.afterglowFrom;
  if (from === null)
    return { factor: rules.start, left: total, fill: 1, waiting: true, ending: false };
  const elapsed = Math.max(0, second - from);
  // Two seconds past its end the pill is still drawn, empty, with its tick (`ending`).
  if (elapsed >= total + 2) return null;
  if (elapsed >= total) return { factor: 1, left: 0, fill: 0, waiting: false, ending: true };
  return {
    factor: afterglowAt(content, base, second),
    left: total - elapsed,
    fill: (total - elapsed) / total,
    waiting: false,
    ending: false,
  };
}

/**
 * The hint pill (08-screens.md 7.2): onboarding only (D244). While the player is new and there is
 * nothing new to buy it reads "Tap the tree." and is the view's one crown.
 */
export function TapHint() {
  const tap = useAdvisor((state) => state.view?.tapHint === true);
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
