/**
 * What a tap on the map opens: a region (its fog, what scouting costs, who goes)
 * or a site (what is there, the party picker and the confirm: success chance,
 * loot range, injury risk, time, rations and what is left: CLAUDE.md 6.3 rule 4).
 * W4b adds what might happen on the way (trip events), bonds, keycodes and boats.
 * With nothing tapped, the overview: the crew at a glance, who is away, the reports.
 */
import type { Amounts } from "@wipe-day/content/schema";
import { bondedPairs, isAsleep } from "@wipe-day/domain/crew";
import {
  atSea,
  canSteer,
  dockNeeded,
  isFit,
  partyLimit,
  regionOf,
  type ScoutStatus,
  scoutMinutes,
  scoutStatus,
  siteOf,
  sitesFinding,
  sitesIn,
  triesToSure,
  tripOdds,
  tripStatus,
} from "@wipe-day/domain/missions";
import { useState } from "react";
import { useWorld } from "../../state/store";
import {
  abbrev,
  content,
  duration,
  itemName,
  missingLabel,
  regionName,
  resourceName,
  siteName,
  stationName,
  survivorLook,
  t,
  tierName,
  traitName,
} from "../../state/world";
import { Cost } from "../Cost";
import { crewSummary } from "../crew";
import { vars } from "../util";

/** "82 food, 12 fuel" left after paying `cost`. */
function leftAfter(cost: Amounts, stock: Amounts): string {
  return Object.entries(cost)
    .map(
      ([id, amount]) =>
        `${abbrev(Math.max(0, (stock[id] ?? 0) - amount))} ${resourceName(id).toLowerCase()}`,
    )
    .join(", ");
}

export function MapPanel() {
  const focus = useWorld((state) => state.mapFocus);
  if (focus?.kind === "region") return <RegionView id={focus.id} />;
  if (focus?.kind === "site") return <SiteView id={focus.id} />;
  return <Overview />;
}

function Overview() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now));
  const openReport = useWorld((state) => state.openReport);
  const openPanel = useWorld((state) => state.openPanel);
  return (
    <>
      <p className="hint">{t("map.overview_hint")}</p>
      <button type="button" className="card report-row" onClick={() => openPanel("squad")}>
        <div className="main">
          <div className="title">
            <b>{t("map.crew")}</b>
            <span className="lvl">{crewSummary(base, now)}</span>
          </div>
        </div>
      </button>
      {base.missions.length > 0 ? <h3 className="section">{t("map.away")}</h3> : null}
      {base.missions.map((mission) => (
        <div key={mission.id} className="card">
          <div className="main">
            <div className="title">
              <b>
                {mission.kind === "scout" ? regionName(mission.target) : siteName(mission.target)}
              </b>
              <span className="lvl">{duration(Math.max(0, mission.endsAt - now))}</span>
            </div>
            <div className="desc">{mission.crew.map((id) => survivorLook(id).name).join(", ")}</div>
            <div className="progress" style={vars({ "--bar-color": "#3aa0a0" })}>
              <i
                style={{
                  width: `${Math.round(Math.min(1, (now - mission.startedAt) / Math.max(1, mission.endsAt - mission.startedAt)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      ))}
      {base.reports.length > 0 ? <h3 className="section">{t("map.reports")}</h3> : null}
      {base.reports.slice(0, 6).map((report) => (
        <button
          key={report.id}
          type="button"
          className={`card report-row${report.read ? "" : " unread"}`}
          onClick={() => openReport(report.id)}
        >
          <div className="main">
            <div className="title">
              <b>{report.kind === "scout" ? regionName(report.target) : siteName(report.target)}</b>
              <span className="lvl">
                {t(`map.outcome_${report.kind === "scout" ? "scouted" : report.outcome}`)}
              </span>
            </div>
          </div>
        </button>
      ))}
    </>
  );
}

/** The crew who could go now, fittest first (level), with a tick for the chosen. */
function CrewPicker({
  chosen,
  onToggle,
  most,
  sea = false,
}: {
  chosen: string[];
  onToggle: (id: string) => void;
  most: number;
  /** At sea: the boat's trait is shown first, so the player sees who can steer. */
  sea?: boolean;
}) {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now));
  return (
    <div className="picker">
      {base.crew.map((member) => {
        const look = survivorLook(member.id);
        const fit = isFit(member, now);
        const picked = chosen.includes(member.id);
        const full = !picked && chosen.length >= most;
        const traits = look.traits.map(traitName).join(" · ");
        const why = member.away
          ? t("map.busy")
          : !fit
            ? t("map.hurt")
            : isAsleep(member, now)
              ? t("map.asleep", { traits })
              : sea && canSteer(content, member.id)
                ? t("map.steers", { traits })
                : traits;
        return (
          <button
            key={member.id}
            type="button"
            className={`pick${picked ? " on" : ""}`}
            disabled={!fit || full}
            aria-pressed={picked}
            onClick={() => onToggle(member.id)}
            style={vars({ "--hat": look.hat })}
          >
            <span className="face" />
            <span className="grow">
              <b>
                {look.name} · {t("squad.level", { level: member.level })}
              </b>
              <span className="sub">{why}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RegionView({ id }: { id: string }) {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now));
  const scout = useWorld((state) => state.scout);
  const focusMap = useWorld((state) => state.focusMap);
  const region = regionOf(content, id);
  const [chosen, setChosen] = useState<string | null>(null);
  if (!region) return null;
  const known = base.known.includes(id);
  const sea = region.access === "sea";
  const firstFit =
    base.crew.find((member) => isFit(member, now) && (!sea || canSteer(content, member.id)))?.id ??
    base.crew.find((member) => isFit(member, now))?.id ??
    null;
  const who = chosen ?? firstFit;
  const status = scoutStatus(content, base, id, now, who ?? undefined);
  const minutes = who ? scoutMinutes(content, region, who) : region.scout.minutes;
  const sites = sitesIn(content, id);

  let reason = "";
  switch (status.code) {
    case "far":
      reason = farReason(base, status);
      break;
    case "no_dock":
      reason = dockReason(status.building, status.level);
      break;
    case "no_navigator":
      reason = t("map.need_navigator");
      break;
    case "hidden":
      reason = t("map.hidden");
      break;
    case "scouting":
      reason = t("map.scouting_now");
      break;
    case "no_survivor":
      reason = t("map.no_one");
      break;
    case "unfit":
      reason = t("map.unfit");
      break;
    case "unaffordable":
      reason = t("map.need", { need: missingLabel(status.missing) ?? "" });
      break;
    default:
      reason = "";
  }

  return (
    <>
      <div className="row">
        <button type="button" className="btn small" onClick={() => focusMap(null)}>
          {t("map.back")}
        </button>
      </div>
      <div className="card">
        <div className="main">
          <div className="title">
            <b>{regionName(id)}</b>
            <span className="lvl">{known ? t("map.known") : t("map.fogged")}</span>
          </div>
          <div className="desc">{known ? t(`region.${id}.blurb`) : t("map.fog_blurb")}</div>
        </div>
      </div>
      {known ? (
        <>
          {sites.length > 0 ? <h3 className="section">{t("map.sites_here")}</h3> : null}
          {sites.map((site) => (
            <button
              key={site.id}
              type="button"
              className="card report-row"
              onClick={() => focusMap({ kind: "site", id: site.id })}
            >
              <div className="main">
                <div className="title">
                  <b>{siteName(site.id)}</b>
                  <span className="lvl">{t("map.tier", { tier: site.tier })}</span>
                </div>
                <div className="desc">{t(`site.${site.id}.blurb`)}</div>
              </div>
            </button>
          ))}
          {sites.length === 0 ? <p className="hint">{t("map.no_sites")}</p> : null}
        </>
      ) : status.code === "hidden" ||
        status.code === "far" ||
        status.code === "scouting" ||
        status.code === "no_dock" ? (
        <p className="hint">{reason}</p>
      ) : (
        <>
          <h3 className="section">{t("map.scout_who")}</h3>
          <CrewPicker
            chosen={who ? [who] : []}
            most={1}
            sea={sea}
            onToggle={(member) => setChosen(member)}
          />
          <h3 className="section">{t("map.scout_cost")}</h3>
          <Cost cost={region.scout.cost} stock={base.stock} />
          <p className="hint">
            {t("map.scout_line", { time: duration(minutes * 60) })}
            {status.code === "ok" && Object.keys(region.scout.cost).length > 0
              ? ` ${t("map.left_after", { list: leftAfter(region.scout.cost, base.stock) })}`
              : ""}
          </p>
          <button
            type="button"
            className={`btn wide${status.code === "ok" ? " primary" : ""}`}
            disabled={status.code !== "ok" || !who}
            onClick={() => who && scout(id, who)}
          >
            {status.code === "ok"
              ? t("map.scout_go", {
                  name: survivorLook(who ?? "").name,
                  time: duration(minutes * 60),
                })
              : reason}
          </button>
        </>
      )}
    </>
  );
}

/** Why a region is too far: the radio mast would do it, or a stronger base tier. */
function farReason(
  base: { buildings: Record<string, number> },
  status: Extract<ScoutStatus, { code: "far" }>,
): string {
  const mast = content.buildings.find((b) => (b.levels[0]?.effects.scoutRange ?? 0) > 0);
  const extra = mast?.levels[0]?.effects.scoutRange ?? 0;
  if (mast && (base.buildings[mast.id] ?? 0) === 0 && status.ring <= status.range + extra)
    return t("map.far_building", { building: stationName(mast.id) });
  const tier =
    (["twig", "wood", "stone", "metal", "hqm"] as const).find(
      (candidate) => (content.mapRules.range[candidate] ?? 0) + extra >= status.ring,
    ) ?? "hqm";
  return t("map.far", { tier: tierName(tier) });
}

function dockReason(building: string, level: number): string {
  return level > 1
    ? t("map.need_dock_level", { building: stationName(building), level })
    : t("map.need_dock", { building: stationName(building) });
}

function SiteView({ id }: { id: string }) {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now));
  const sendTrip = useWorld((state) => state.sendTrip);
  const focusMap = useWorld((state) => state.focusMap);
  const site = siteOf(content, id);
  const most = site ? partyLimit(content, site) : 1;
  const fit = base.crew.filter((member) => isFit(member, now)).map((member) => member.id);
  const sea = site ? atSea(content, site.region) : false;
  const [chosen, setChosen] = useState<string[]>(() => {
    const party = fit.slice(0, most);
    // At sea, someone in the first pick can steer.
    if (sea && !party.some((id) => canSteer(content, id))) {
      const navigator = fit.find((id) => canSteer(content, id));
      if (navigator && party.length > 0) party[party.length - 1] = navigator;
    }
    return party;
  });
  if (!site) return null;
  const party = chosen.filter((member) => fit.includes(member));
  const status = tripStatus(content, base, id, party, now);
  const odds = tripOdds(content, base, site, party.length > 0 ? party : fit.slice(0, 1));
  const away = base.missions.find((mission) => mission.kind === "trip" && mission.target === id);
  const worst = Math.max(0, ...odds.injury);

  let reason = "";
  if (status.code === "no_party") reason = t("map.pick_party");
  else if (status.code === "unaffordable")
    reason = t("map.need", { need: missingLabel(status.missing) ?? "" });
  else if (status.code === "unfit" || status.code === "no_survivor") reason = t("map.unfit");
  else if (status.code === "party_size") reason = t("map.party_size", { most });
  else if (status.code === "hidden") reason = t("map.hidden");
  else if (status.code === "keycode")
    reason = t("map.need_keycode", { item: itemName(status.item) });
  else if (status.code === "no_dock") reason = dockReason(status.building, status.level);
  else if (status.code === "no_navigator") reason = t("map.need_navigator");
  const events = content.tripEvents.filter((event) => (odds.events?.[event.id] ?? 0) > 0);
  const bonds = bondedPairs(content, base, party);
  const keycode = site.keycode;
  const keys = keycode ? (base.items[keycode] ?? 0) : 0;
  const keySource = keycode ? sitesFinding(content, keycode)[0] : undefined;

  const toggle = (member: string) =>
    setChosen((list) =>
      list.includes(member) ? list.filter((m) => m !== member) : [...list, member],
    );

  return (
    <>
      <div className="row">
        <button
          type="button"
          className="btn small"
          onClick={() => focusMap({ kind: "region", id: site.region })}
        >
          {t("map.back_to", { region: regionName(site.region) })}
        </button>
      </div>
      <div className="card">
        <div className="main">
          <div className="title">
            <b>{siteName(id)}</b>
            <span className="lvl">
              {t("map.tier", { tier: site.tier })} · {t(`map.hazard_${site.hazard}`)}
            </span>
          </div>
          <div className="desc">{t(`site.${id}.blurb`)}</div>
          {away ? (
            <div className="desc">
              {t("map.party_there", { time: duration(Math.max(0, away.endsAt - now)) })}
            </div>
          ) : null}
        </div>
      </div>

      <h3 className="section">{t("map.party", { most })}</h3>
      <CrewPicker chosen={party} onToggle={toggle} most={most} sea={sea} />
      {sea ? (
        <p className="hint">
          {t("map.by_boat", {
            building: stationName(content.mapRules.boatBuilding),
            level: dockNeeded(content, site.region),
          })}
        </p>
      ) : null}

      <h3 className="section">{t("map.odds")}</h3>
      <div className="odds">
        <div>
          <b className="num">{odds.success}%</b>
          <span>{t("map.success")}</span>
        </div>
        <div>
          <b className="num">{odds.partial}%</b>
          <span>{t("map.something")}</span>
        </div>
        <div>
          <b className={`num${worst >= 20 ? " warn" : ""}`}>{worst}%</b>
          <span>{t("map.injury")}</span>
        </div>
        <div>
          <b className="num">{duration(odds.minutes * 60)}</b>
          <span>{t("map.time")}</span>
        </div>
      </div>
      <p className="hint">
        {t("map.loot_line", {
          rolls: odds.rolls,
          loot: site.loot
            .map((entry) => {
              const scale = (amount: number) => Math.floor((amount * (100 + odds.loot)) / 100);
              return `${abbrev(scale(entry.min))}–${abbrev(scale(entry.max))} ${resourceName(entry.resource).toLowerCase()}`;
            })
            .join(", "),
        })}
        {odds.blueprint > 0 ? ` ${t("map.blueprint_chance", { percent: odds.blueprint })}` : ""}
        {odds.fragment > 0 ? ` ${t("map.fragment_chance", { percent: odds.fragment })}` : ""}
        {(site.finds ?? []).map((find) => {
          const left = triesToSure(content, base, site.id);
          return ` ${t("map.find_chance", { percent: find.chance, item: itemName(find.item) })}${
            left < content.mapRules.findPity ? ` ${t("map.find_sure", { count: left + 1 })}` : ""
          }`;
        })}
      </p>
      {events.length > 0 || bonds.length > 0 ? (
        <>
          <h3 className="section">{t("map.might_happen")}</h3>
          <div className="chips">
            {events.map((event) => (
              <span
                key={event.id}
                className={`chip-tag${event.loot && event.loot < 0 ? " warn" : ""}`}
              >
                {t(`trip_event.${event.id}.name`)} {odds.events?.[event.id] ?? 0}%
              </span>
            ))}
            {bonds.map((pair) => (
              <span key={pair} className="chip-tag good">
                {t("map.bond", {
                  names: pair
                    .split("+")
                    .map((id) => survivorLook(id).name)
                    .join(" & "),
                  points: content.crewRules.bonds.success,
                })}
              </span>
            ))}
          </div>
        </>
      ) : null}
      {keycode ? (
        <>
          <h3 className="section">{t("map.keycode")}</h3>
          <p className={keys > 0 ? "hint" : "warn"}>
            {keys > 0
              ? t("map.keycode_have", { item: itemName(keycode), count: keys, left: keys - 1 })
              : keySource
                ? t("map.keycode_none", { item: itemName(keycode), site: siteName(keySource.id) })
                : t("map.need_keycode", { item: itemName(keycode) })}
          </p>
          {keys === 0 && keySource && base.known.includes(keySource.region) ? (
            <button
              type="button"
              className="btn small"
              onClick={() => focusMap({ kind: "site", id: keySource.id })}
            >
              {t("map.go_to", { site: siteName(keySource.id) })}
            </button>
          ) : null}
        </>
      ) : null}
      {Object.keys(site.rations).length > 0 ? (
        <>
          <h3 className="section">{t("map.rations")}</h3>
          <Cost cost={site.rations} stock={base.stock} />
          {status.code === "ok" ? (
            <p className="hint">
              {t("map.left_after", { list: leftAfter(site.rations, base.stock) })}
            </p>
          ) : null}
        </>
      ) : null}
      <button
        type="button"
        className={`btn wide${status.code === "ok" ? " primary" : ""}`}
        disabled={status.code !== "ok"}
        onClick={() => {
          if (sendTrip(id, party)) focusMap(null);
        }}
      >
        {status.code === "ok"
          ? t("map.send", { count: party.length, time: duration(odds.minutes * 60) })
          : reason}
      </button>
    </>
  );
}
