/**
 * What came back: the outcome, the story line, the loot, who got hurt, XP and
 * levels, what was revealed. One button that continues (rule 2: never a dead
 * end): "Send again" after a trip, "See it on the map" after a scout.
 */
import { siteOf } from "@wipe-day/domain/missions";
import { type RaidReport, revengeOn } from "@wipe-day/domain/raids";
import { useWorld } from "../state/store";
import {
  abbrev,
  content,
  duration,
  itemName,
  outputName,
  regionName,
  resourceName,
  siteName,
  survivorLook,
  t,
} from "../state/world";
import { ResourceIcon } from "./Icon";
import { outcomeClass, raidOutcome, raidTitle } from "./panels/Defence";

export function ReportCard() {
  const id = useWorld((state) => state.report);
  const report = useWorld((state) => state.base.reports.find((candidate) => candidate.id === id));
  const raid = useWorld((state) => state.base.raidReports.find((candidate) => candidate.id === id));
  const now = useWorld((state) => Math.floor(state.now));
  const openReport = useWorld((state) => state.openReport);
  const focusMap = useWorld((state) => state.focusMap);
  if (raid) return <RaidCard report={raid} />;
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
        {(report.events ?? []).map((event) => (
          <p key={event} className={event === "ambush" ? "warn" : "good"}>
            {t(`trip_event.${event}.line`, {
              name: lead,
              stranger: report.rescued ? survivorLook(report.rescued).name : t("report.someone"),
              rolls: content.tripEvents.find((candidate) => candidate.id === event)?.rolls ?? 0,
            })}
          </p>
        ))}
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
        {(report.found ?? []).map((item) => (
          <p key={item} className="good">
            {t("report.found", { item: itemName(item) })}
          </p>
        ))}
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

/**
 * A raid (W6): who came, whether they got in, the odds it was rolled at, what left or
 * came home, and the follow-up: repair the damage, strike back, or look at the defence.
 */
function RaidCard({ report }: { report: RaidReport }) {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now));
  const openReport = useWorld((state) => state.openReport);
  const openDefence = useWorld((state) => state.openDefence);
  const name = report.foe?.name ?? "";
  const story =
    report.kind === "npc"
      ? t(`raid.npc.${report.outcome}`)
      : report.kind === "pvp_in"
        ? t(`raid.pvp.${report.outcome}`, { name })
        : t(`raid.out.${report.outcome}`, { name });
  const lost = Object.entries(report.lost).filter(([, amount]) => amount > 0);
  const gained = Object.entries(report.gained).filter(([, amount]) => amount > 0);
  const revenge =
    report.kind === "pvp_in" && report.foe !== null && revengeOn(base, report.foe.id, now) !== null;
  const close = () => openReport(null);
  const follow = base.damaged
    ? { label: t("defence.repair"), tab: "defence" as const }
    : revenge
      ? { label: t("raid.strike_back"), tab: "raids" as const }
      : {
          label: t("raid.to_defence"),
          tab: report.kind === "pvp_out" ? ("raids" as const) : ("defence" as const),
        };
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={raidTitle(report)}>
      <div className={`glass modal report raid ${outcomeClass(report)}`}>
        <span className="lvl">{raidOutcome(report)}</span>
        <h2>{raidTitle(report)}</h2>
        <p className="story">{story}</p>
        <p className="hint">
          {t("raid.odds", {
            defence: report.defence,
            attack: report.attack,
            chance: report.kind === "pvp_out" ? 100 - report.chance : report.chance,
          })}
          {report.kind === "pvp_out" ? ` ${t("raid.odds_out")}` : ` ${t("raid.odds_in")}`}
        </p>
        {gained.length > 0 ? (
          <div className="gains">
            {gained.map(([res, amount]) => (
              <span key={res}>
                <ResourceIcon id={res} /> +{abbrev(amount)} {resourceName(res)}
              </span>
            ))}
          </div>
        ) : null}
        {lost.length > 0 ? (
          <div className="gains lost">
            {lost.map(([res, amount]) => (
              <span key={res}>
                <ResourceIcon id={res} /> -{abbrev(amount)} {resourceName(res)}
              </span>
            ))}
          </div>
        ) : null}
        {report.damaged ? (
          <p className="warn">{t("raid.damaged", { percent: content.raids.damagedPercent })}</p>
        ) : null}
        {report.kind === "pvp_in" && report.outcome === "breached" && base.pvp.shieldUntil ? (
          <p className="good">
            {t("raid.shield", { time: duration(Math.max(0, base.pvp.shieldUntil - now)) })}
          </p>
        ) : null}
        {revenge ? (
          <p className="good">
            {t("raid.revenge", { name, percent: content.raids.pvp.revengePercent })}
          </p>
        ) : null}
        <div className="row">
          <button type="button" className="btn grow" onClick={close}>
            {t("report.close")}
          </button>
          <button
            type="button"
            className="btn primary grow"
            onClick={() => {
              close();
              openDefence(follow.tab);
            }}
          >
            {follow.label}
          </button>
        </div>
      </div>
    </div>
  );
}
