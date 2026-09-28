/**
 * What came back: the outcome, the story line, the loot, who got hurt, XP and
 * levels, what was revealed. One button that continues (rule 2: never a dead
 * end): "Send again" after a trip, "See it on the map" after a scout.
 */
import { siteOf } from "@wipe-day/domain/missions";
import { useWorld } from "../state/store";
import {
  abbrev,
  content,
  duration,
  outputName,
  regionName,
  resourceName,
  siteName,
  survivorLook,
  t,
} from "../state/world";
import { ResourceIcon } from "./Icon";

export function ReportCard() {
  const id = useWorld((state) => state.report);
  const report = useWorld((state) => state.base.reports.find((candidate) => candidate.id === id));
  const now = useWorld((state) => Math.floor(state.now));
  const openReport = useWorld((state) => state.openReport);
  const focusMap = useWorld((state) => state.focusMap);
  if (!id || !report) return null;
  const names = report.crew.map((member) => survivorLook(member).name);
  const lead = names[0] ?? "";
  const party =
    names.length > 1 ? `${names.slice(0, -1).join(", ")} ${t("report.and")} ${names.at(-1)}` : lead;
  const scout = report.kind === "scout";
  const title = scout ? regionName(report.target) : siteName(report.target);
  const story = scout
    ? t("report.scouted", { name: lead, region: regionName(report.target) })
    : t(`story.${report.target}.${report.outcome}`, { name: party });
  const gains = Object.entries(report.gained).filter(([, amount]) => amount > 0);
  const close = () => openReport(null);
  const site = scout ? undefined : siteOf(content, report.target);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`glass modal report ${report.outcome}`}>
        <span className="lvl">
          {scout ? t("report.scout_back") : t(`report.${report.outcome}`)}
        </span>
        <h2>{title}</h2>
        <p className="story">{story}</p>
        {gains.length > 0 ? (
          <div className="gains">
            {gains.map(([res, amount]) => (
              <span key={res}>
                <ResourceIcon id={res} /> +{abbrev(amount)} {resourceName(res)}
              </span>
            ))}
          </div>
        ) : null}
        {report.revealed.length > 0 ? (
          <p className="good">
            {t("report.revealed", { regions: report.revealed.map(regionName).join(", ") })}
          </p>
        ) : null}
        {report.blueprint ? (
          <p className="good">{t("report.blueprint", { item: outputName(report.blueprint) })}</p>
        ) : null}
        <p className="hint">
          {t("report.xp", { xp: report.xp })}
          {report.levelUps.length > 0
            ? ` ${t("report.level_up", { names: report.levelUps.map((m) => survivorLook(m).name).join(", ") })}`
            : ""}
        </p>
        {report.injured.map((hurt) => (
          <p key={hurt.id} className="warn">
            {t("report.injured", {
              name: survivorLook(hurt.id).name,
              time: duration(Math.max(0, hurt.until - now)),
            })}
          </p>
        ))}
        <div className="row">
          <button type="button" className="btn grow" onClick={close}>
            {t("report.close")}
          </button>
          <button
            type="button"
            className="btn primary grow"
            onClick={() => {
              close();
              if (site) focusMap({ kind: "site", id: site.id });
              else focusMap({ kind: "region", id: report.revealed[0] ?? report.target });
            }}
          >
            {site ? t("report.again") : t("report.see_map")}
          </button>
        </div>
      </div>
    </div>
  );
}
