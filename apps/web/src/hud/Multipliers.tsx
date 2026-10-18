import { rates } from "@wipe-day/domain/effects";
import { breakdown, type Step, tapGlance } from "@wipe-day/domain/glance";
import { windowEnd } from "@wipe-day/domain/settle";
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
  researchName,
  t,
  tierName,
  upgradeName,
} from "../state/world";
import { Icon } from "./Icon";
import { SheetFrame } from "./Sheet";

/**
 * The Multipliers sheet (08-screens.md 2.16), opened from the counter: every line's output taken
 * apart in the evaluator's order, then a tap's parts, then the Night Shift, and a way to the
 * flotsam odds (02-the-run.md 8.5). Read-only; its one primary is Done.
 */
export function Multipliers() {
  const sheet = useUi((state) => state.sheet);
  const openSheet = useUi((state) => state.openSheet);
  const view = useAdvisor((state) => state.view);
  const second = useWorld((state) => state.second);
  if (sheet !== "multipliers" || !view) return null;
  const close = () => openSheet(null);
  const { base, now } = view;
  const sheetData = breakdown(content, base, now);
  const tap = tapGlance(content, base, now);
  const hours = rates(content, base).nightShift / 3600;
  const until = clockLabel(localSeconds(windowEnd(content, base)));
  const steps = sheetData.steps.filter((step) => Math.abs(step.factor - 1) > 1e-9);

  return (
    <SheetFrame
      id="mult"
      className="multipliers"
      title={t("mult.title")}
      head={<p className="big num">+{fmtRate(view.rate)}</p>}
      primary={t("settings.done")}
      onPrimary={close}
      onClose={close}
    >
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
      <button type="button" className="btn ghost fold" onClick={() => openSheet("odds")}>
        {t("mult.odds")}
        <Icon kind="ui" id="chevron" size={16} />
      </button>
    </SheetFrame>
  );
}

const STEP_TITLE: Record<Step["id"], string> = {
  milestones: "mult.milestones",
  workshop: "mult.workshop",
  upgrades: "mult.upgrades",
  eras: "mult.eras",
  roster: "mult.roster_title",
  glow: "mult.glow",
  morale: "mult.morale",
  buffs: "mult.buffs",
  other: "mult.other",
};

function sourceName(step: Step, id: string): string {
  switch (step.id) {
    case "milestones":
      return lineName(id);
    case "workshop":
      return researchName(id);
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
    step.id === "morale"
      ? t("mult.badges", { count: Number(source.id) })
      : source.until !== undefined
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
