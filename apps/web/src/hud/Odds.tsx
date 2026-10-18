import { floatSeconds, guaranteedCrate, odds } from "@wipe-day/domain/flotsam";
import { magpieOdds } from "@wipe-day/domain/gulls";
import { useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { buffName, content, duration, fmtFactor, t } from "../state/world";
import { Icon } from "./Icon";
import { SheetFrame } from "./Sheet";

/**
 * The Odds sheet (02-the-run.md 8.5; 08-screens.md 2.15; guardrail 9): every shipped flotsam
 * kind with its chance and what it gives, how often something drifts in, and run 1's crates
 * while they last; then the crows, a Magpie's chance among them (D238). Opened from Settings and from the Multipliers sheet; read-only.
 */
export function Odds() {
  const sheet = useUi((state) => state.sheet);
  const openSheet = useUi((state) => state.openSheet);
  const base = useWorld((state) => state.base);
  if (sheet !== "odds") return null;
  const close = () => openSheet(null);
  const { schedule, firstRun } = content.flotsam;
  const float = base ? floatSeconds(content, base) : schedule.floatSeconds;
  const [shortest, longest] = schedule.gapMinutes;

  return (
    <SheetFrame
      id="odds"
      className="odds"
      title={t("odds.title")}
      head={<p className="sub">{t("odds.sub")}</p>}
      primary={t("settings.done")}
      onPrimary={close}
      onClose={close}
    >
      <ul className="odds-list">
        {odds(content).map(({ kind, share }) => (
          <li key={kind.id} className="odds-row">
            <span className="odds-icon">
              <Icon kind="flotsam" id={kind.id} size={32} />
            </span>
            <span className="odds-text">
              <span className="odds-name">{t(`flotsam.${kind.id}.name`)}</span>
              <span className="odds-effect">{effectLine(kind.effect)}</span>
            </span>
            <span className="odds-share num">{(share * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
      <h3 className="odds-head">{t("odds.crows")}</h3>
      <ul className="odds-list">
        {[false, true].map((elite) => (
          <li key={String(elite)} className={`odds-row${elite ? " elite" : ""}`}>
            <span className="odds-icon">
              <Icon
                kind="ui"
                id="gull"
                size={32}
                {...(elite ? { color: "var(--supplies-hi)" } : {})}
              />
            </span>
            <span className="odds-text">
              <span className="odds-name">{t(elite ? "gull.elite" : "gull.name")}</span>
              <span className="odds-effect">
                {t("odds.crow", {
                  time: duration(
                    elite ? content.flotsam.gulls.eliteSeconds : content.flotsam.gulls.seconds,
                  ),
                })}
              </span>
            </span>
            <span className="odds-share num">
              {((elite ? magpieOdds(content) : 1 - magpieOdds(content)) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
      <p className="mult-note">{t("odds.crows_schedule")}</p>
      <p className="mult-note">
        {t("odds.schedule", {
          min: shortest,
          max: longest,
          rain: fmtFactor(schedule.rainFactor),
          float: Math.round(float),
        })}
      </p>
      {base && guaranteedCrate(base) ? (
        <p className="mult-note">
          {t("odds.first", { every: firstRun.repeatSeconds / 60, flat: firstRun.flatMinutes })}
        </p>
      ) : null}
      <p className="mult-note">{t("odds.hidden")}</p>
    </SheetFrame>
  );
}

type Effect = (typeof content.flotsam.kinds)[number]["effect"];

/** What a kind gives, from its data. */
function effectLine(effect: Effect): string {
  if ("lump" in effect) {
    const { floorMinutes, heldShare, rateMinutes } = effect.lump;
    return t("odds.crate", {
      share: `${Math.round(heldShare * 100)}%`,
      floor: floorMinutes,
      cap: rateMinutes,
    });
  }
  let factor = 1;
  for (const item of effect.effects) if (item.op === "more") factor *= item.value;
  const output = effect.effects.some((item) => item.stat === "output");
  return t(output ? "odds.buff_output" : "odds.buff_tap", {
    name: buffName(effect.buff),
    factor: fmtFactor(factor),
    time: duration(effect.seconds),
  });
}
