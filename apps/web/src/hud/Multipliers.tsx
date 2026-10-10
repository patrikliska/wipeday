import { rates } from "@wipe-day/domain/effects";
import { breakdown, type Step, tapGlance } from "@wipe-day/domain/glance";
import { windowEnd } from "@wipe-day/domain/settle";
import { useEffect } from "react";
import { sound } from "../sound/audio";
import { useAdvisor } from "../state/advisor";
import { localSeconds, useWorld } from "../state/store";
import { useUi } from "../state/ui";
import {
  buffName,
  clockLabel,
  content,
  duration,
  fmt,
  fmtCount,
  fmtFactor,
  fmtRate,
  lineName,
  t,
  tierName,
  upgradeName,
} from "../state/world";
import { Icon } from "./Icon";

/**
 * The Multipliers sheet (08-screens.md 2.16), opened from the counter: every line's output taken
 * apart in the evaluator's order, then a tap's parts, then the Night Shift. Read-only; its one
 * primary is Done.
 */
export function Multipliers() {
  const sheet = useUi((state) => state.sheet);
  const openSheet = useUi((state) => state.openSheet);
  const view = useAdvisor((state) => state.view);
  const second = useWorld((state) => state.second);
  useEffect(() => {
    if (sheet === "multipliers") sound.play("ui_open");
  }, [sheet]);
  if (sheet !== "multipliers" || !view) return null;
  const close = () => {
    sound.play("ui_close");
    openSheet(null);
  };
  const { base, now } = view;
  const sheetData = breakdown(content, base, now);
  const tap = tapGlance(content, base, now);
  const hours = rates(content, base).nightShift / 3600;
  const until = clockLabel(localSeconds(windowEnd(content, base)));
  const steps = sheetData.steps.filter((step) => Math.abs(step.factor - 1) > 1e-9);

  return (
    <div className="sheet-backdrop">
      {/* The backdrop closes the sheet; it is a button so keyboards and readers reach it too. */}
      <button
        type="button"
        className="backdrop-hit"
        tabIndex={-1}
        aria-label={t("settings.close")}
        onClick={close}
      />
      <section
        className="glass sheet multipliers"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mult-title"
      >
        <header className="panel-head">
          <div>
            <h2 id="mult-title">{t("mult.title")}</h2>
            <p className="big num">+{fmtRate(view.rate)}</p>
          </div>
          <button
            type="button"
            className="btn icon-btn"
            onClick={close}
            aria-label={t("settings.close")}
          >
            <Icon kind="ui" id="close" size={18} />
          </button>
        </header>
        <div className="panel-scroll">
          <table className="mult-table">
            <tbody>
              <tr>
                <th scope="row">{t("mult.lines", { units: fmtCount(sheetData.units) })}</th>
                <td className="num">{fmtRate(sheetData.base)}</td>
              </tr>
              {steps.map((step) => (
                <StepRow key={step.id} step={step} second={second} />
              ))}
              <tr className="total">
                <th scope="row">{t("mult.all_running")}</th>
                <td className="num">{fmtRate(sheetData.total)}</td>
              </tr>
            </tbody>
          </table>
          <table className="mult-table">
            <tbody>
              <tr className="total">
                <th scope="row">{t("mult.per_tap")}</th>
                <td className="num">{fmt(tap.value, "cost")}</td>
              </tr>
              <tr>
                <th scope="row" colSpan={2}>
                  {t("mult.grip", {
                    flat: fmt(tap.flat, "cost"),
                    share: `${Number((tap.share * 100).toPrecision(3))}%`,
                  })}
                </th>
              </tr>
              {tap.hustle > 1.0005 ? (
                <tr>
                  <th scope="row" colSpan={2}>
                    {t("mult.hustle", { factor: fmtFactor(tap.hustle) })}
                  </th>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="mult-note">
            {base.run.hands.length > 0
              ? t("mult.night_shift", { hours: fmtFactor(hours), time: until })
              : t("mult.no_hands")}
          </p>
          <p className="mult-note">{t("mult.unmanned")}</p>
        </div>
        <footer className="panel-foot">
          <button type="button" className="btn primary grow" onClick={close}>
            {t("settings.done")}
          </button>
        </footer>
      </section>
    </div>
  );
}

const STEP_TITLE: Record<Step["id"], string> = {
  milestones: "mult.milestones",
  upgrades: "mult.upgrades",
  eras: "mult.eras",
  roster: "mult.roster_title",
  glow: "mult.glow",
  buffs: "mult.buffs",
  other: "mult.other",
};

function sourceName(step: Step, id: string): string {
  switch (step.id) {
    case "milestones":
      return lineName(id);
    case "upgrades":
      return upgradeName(id);
    case "eras":
      return tierName(id);
    case "roster":
      return t("mult.roster", { at: id });
    case "buffs":
      return buffName(id);
    default:
      return id;
  }
}

function StepRow({ step, second }: { step: Step; second: number }) {
  const sources = step.sources.map((source) =>
    source.until !== undefined
      ? t("mult.source_buff", {
          name: sourceName(step, source.id),
          factor: fmtFactor(source.factor),
          time: duration(Math.max(0, source.until - second)),
        })
      : t("mult.source_factor", {
          name: sourceName(step, source.id),
          factor: fmtFactor(source.factor),
        }),
  );
  return (
    <tr>
      <th scope="row">
        {t(STEP_TITLE[step.id])}
        {sources.length > 0 ? <small>{sources.join(" · ")}</small> : null}
      </th>
      <td className="num">×{fmtFactor(step.factor)}</td>
    </tr>
  );
}
