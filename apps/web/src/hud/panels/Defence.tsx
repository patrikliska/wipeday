/**
 * Defence (W6): what keeps raiders out, and the raids between holdfasts. Two tabs:
 * - Defence: the score and where it comes from, the next raid once the lookout has seen
 *   it (when, the chance to hold, what a breach would take, a guard to post), the repair
 *   after a breach, and the raids so far;
 * - Raids: the friendly raids between holdfasts. The rules come first, before joining;
 *   then every holdfast in them with the charges, the chance to get in and the most a
 *   breach brings home. Leaving is one tap (locked for two days after your own raid).
 * Every rule comes from the domain (`raids.ts`).
 */
import type { Amounts } from "@wipe-day/content/schema";
import { advise } from "@wipe-day/domain/advisor";
import { tierAtLeast } from "@wipe-day/domain/base";
import type { Refusal } from "@wipe-day/domain/commands";
import { guardScoreOf } from "@wipe-day/domain/crew";
import { isFit } from "@wipe-day/domain/missions";
import { modifiers } from "@wipe-day/domain/modifiers";
import {
  defenceOf,
  npcOdds,
  pvpOpen,
  type RaidReport,
  raidsOpen,
  raidWarned,
  repairCost,
  repairStatus,
  revengeOn,
  setPvpStatus,
} from "@wipe-day/domain/raids";
import type { RaidTargetView } from "@wipe-day/domain/wire";
import { useEffect } from "react";
import { refusalMessage } from "../../state/messages";
import { type DefenceTab, useWorld } from "../../state/store";
import {
  abbrev,
  content,
  duration,
  missingLabel,
  resourceName,
  stationName,
  survivorLook,
  t,
  tierName,
} from "../../state/world";
import { Cost } from "../Cost";
import { ResourceIcon } from "../Icon";

const TABS: DefenceTab[] = ["defence", "raids"];

export function DefencePanel() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now / 60) * 60);
  const tab = useWorld((state) => state.defenceTab);
  const setTab = useWorld((state) => state.setDefenceTab);
  const openPanel = useWorld((state) => state.openPanel);

  if (!raidsOpen(content, base)) {
    return (
      <>
        <p className="hint">{t("defence.blurb")}</p>
        <div className="card locked">
          <div className="main">
            <b>{t("defence.closed", { tier: tierName(content.raids.npc.startTier) })}</b>
            <div className="desc">{t("defence.closed_sub")}</div>
          </div>
        </div>
        <button type="button" className="btn wide primary" onClick={() => openPanel("build")}>
          {t("den.to_build")}
        </button>
      </>
    );
  }
  const revenge = base.pvp.revenge.some((token) => token.until > now);
  return (
    <>
      <div className="tabs" role="tablist">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`tab${tab === id ? " on" : ""}`}
            onClick={() => setTab(id)}
          >
            {t(`defence.tab_${id}`)}
            {id === "raids" && revenge ? <i className="dot" aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      {tab === "defence" ? <Defence /> : <Raids />}
    </>
  );
}

/** "+120 Timber, +80 Stone": the biggest few amounts. */
function chips(amounts: Amounts, sign: "+" | "-") {
  const entries = Object.entries(amounts)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div className="cost">
      {entries.slice(0, 5).map(([id, amount]) => (
        <span key={id} title={resourceName(id)}>
          <ResourceIcon id={id} /> {sign}
          {abbrev(amount)}
        </span>
      ))}
    </div>
  );
}

/** The buildings that defend, with what each level standing gives now. */
function defenceParts(buildings: Record<string, number>): { id: string; points: number }[] {
  return content.buildings.flatMap((building) => {
    const points = building.levels[(buildings[building.id] ?? 0) - 1]?.effects.defence ?? 0;
    return points > 0 ? [{ id: building.id, points }] : [];
  });
}

function Defence() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now / 60) * 60);
  const repair = useWorld((state) => state.repair);
  const assign = useWorld((state) => state.assign);
  const openPanel = useWorld((state) => state.openPanel);
  const openReport = useWorld((state) => state.openReport);

  const defence = defenceOf(content, base, now);
  const parts = defenceParts(base.buildings);
  const guards = base.crew.filter((member) => member.job?.kind === "guard");
  const advice = advise(content, base, now);
  const warned = raidWarned(content, base, now);
  const odds = warned ? npcOdds(content, base, now) : null;
  const repairing = repairStatus(content, base);
  const cost = repairCost(content, base);
  // The best guard who is home, fit and not on guard yet: one tap posts them.
  const free = base.crew
    .filter((member) => member.job?.kind !== "guard" && member.away === null && isFit(member, now))
    .sort((a, b) => guardScoreOf(content, b.id) - guardScoreOf(content, a.id))[0];
  const warnHours = content.raids.npc.warnBaseHours + modifiers(content, base).warnHours;

  return (
    <>
      <div className="card defence-score">
        <div className="score">
          <b className="num">{defence.total}</b>
          <span>{t("defence.points")}</span>
        </div>
        <div className="main">
          {parts.map((part) => (
            <div key={part.id} className="line">
              <span>{stationName(part.id)}</span>
              <b className={`num${defence.damaged ? " warn" : ""}`}>
                +
                {defence.damaged
                  ? Math.floor((part.points * content.raids.damagedPercent) / 100)
                  : part.points}
              </b>
            </div>
          ))}
          <div className="line">
            <span>
              {guards.length > 0
                ? t("defence.guards", {
                    names: guards.map((member) => survivorLook(member.id).name).join(", "),
                  })
                : t("defence.no_guards")}
            </span>
            <b className="num">+{defence.guards}</b>
          </div>
          {parts.length === 0 ? <div className="desc">{t("defence.no_buildings")}</div> : null}
        </div>
      </div>

      {base.damaged ? (
        <>
          <p className="warn">{t("defence.damaged", { percent: content.raids.damagedPercent })}</p>
          <Cost cost={cost} stock={base.stock} />
          <button
            type="button"
            className={`btn wide${advice === "repair" ? " primary" : ""}`}
            disabled={repairing.code !== "ok"}
            onClick={() => repair()}
          >
            {repairing.code === "unaffordable"
              ? t("defence.need", { need: missingLabel(repairing.missing) ?? "" })
              : t("defence.repair")}
          </button>
        </>
      ) : null}

      <h3 className="section">{t("defence.next")}</h3>
      {odds ? (
        <div className="card raid-warning">
          <div className="main">
            <div className="title">
              <b>{t("defence.sighted")}</b>
              <span className="lvl">
                {t("defence.lands_in", { time: duration(Math.max(0, odds.lands - now)) })}
              </span>
            </div>
            <div className="odds three">
              <div>
                <b className={`num${odds.chance < 50 ? " warn" : ""}`}>{odds.chance}%</b>
                <span>{t("defence.to_hold")}</span>
              </div>
              <div>
                <b className="num">{odds.defence.total}</b>
                <span>{t("defence.yours")}</span>
              </div>
              <div>
                <b className="num">{odds.strength}</b>
                <span>{t("defence.raiders")}</span>
              </div>
            </div>
            <div className="desc">{t("defence.at_risk")}</div>
            {chips(odds.risk, "-") ?? <div className="desc">{t("defence.nothing_at_risk")}</div>}
          </div>
        </div>
      ) : (
        <p className="hint">{t("defence.quiet", { hours: warnHours })}</p>
      )}
      {odds ? (
        <button
          type="button"
          className={`btn wide${advice === "defend" ? " primary" : ""}`}
          disabled={!free}
          onClick={() => free && assign(free.id, { kind: "guard" })}
        >
          {free
            ? t("defence.post_guard", {
                name: survivorLook(free.id).name,
                points: guardScoreOf(content, free.id),
              })
            : t("defence.nobody_free")}
        </button>
      ) : null}
      <button type="button" className="btn wide" onClick={() => openPanel("build")}>
        {t("defence.build_more")}
      </button>

      <h3 className="section">{t("defence.history")}</h3>
      {base.raidReports.length === 0 ? (
        <p className="hint">{t("defence.no_history")}</p>
      ) : (
        <div className="list">
          {base.raidReports.map((report) => (
            <button
              key={report.id}
              type="button"
              className={`card raid-row ${outcomeClass(report)}${report.read ? "" : " unread"}`}
              onClick={() => openReport(report.id)}
            >
              <div className="main">
                <div className="title">
                  <b>{raidTitle(report)}</b>
                  <span className="lvl">{raidOutcome(report)}</span>
                </div>
                <div className="desc">
                  {t("feed.ago", { time: duration(Math.max(0, now - report.at)) })}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** "Raiders", "Hollis raided you", "Your raid on Hollis". */
export function raidTitle(report: RaidReport): string {
  if (report.kind === "npc") return t("defence.title_npc");
  const name = report.foe?.name ?? "";
  return report.kind === "pvp_in"
    ? t("defence.title_in", { name })
    : t("defence.title_out", { name });
}

/** Held / Broke in for a defence; Got in / Held off for a raid of your own. */
export function raidOutcome(report: RaidReport): string {
  if (report.kind === "pvp_out")
    return t(report.outcome === "breached" ? "defence.got_in" : "defence.repelled");
  return t(report.outcome === "held" ? "defence.held" : "defence.broke_in");
}

/** good or bad, from this base's side. */
export function outcomeClass(report: RaidReport): "good" | "bad" {
  const won = report.kind === "pvp_out" ? report.outcome === "breached" : report.outcome === "held";
  return won ? "good" : "bad";
}

function Raids() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now / 60) * 60);
  const raids = useWorld((state) => state.raids);
  const loadRaids = useWorld((state) => state.loadRaids);
  const setPvp = useWorld((state) => state.setPvp);
  const openPanel = useWorld((state) => state.openPanel);
  const { pvp } = content.raids;

  useEffect(() => {
    void loadRaids();
  }, [loadRaids]);

  const rules = (
    <div className="card rules">
      <div className="main">
        <b>{t("defence.rules_title")}</b>
        <ul>
          <li>{t("defence.rule_charges")}</li>
          <li>
            {t("defence.rule_cap", {
              percent: content.raids.capPercent,
              scrap: content.raids.scrapCeiling[base.tier] ?? content.raids.scrapCeiling.metal ?? 0,
            })}
          </li>
          <li>{t("defence.rule_shield", { hours: pvp.shieldHours })}</li>
          <li>
            {t("defence.rule_limits", {
              hours: pvp.sameTargetHours,
              gap: pvp.maxTierGap,
            })}
          </li>
          <li>{t("defence.rule_revenge", { hours: pvp.revengeHours })}</li>
          <li>{t("defence.rule_leave", { hours: pvp.revengeHours })}</li>
        </ul>
      </div>
    </div>
  );

  if (!pvpOpen(content, base)) {
    return (
      <>
        <div className="card locked">
          <div className="main">
            <b>{t("defence.pvp_closed", { tier: tierName(pvp.minTier) })}</b>
            <div className="desc">{t("defence.pvp_closed_sub")}</div>
          </div>
        </div>
        {rules}
        <button type="button" className="btn wide" onClick={() => openPanel("build")}>
          {t("den.to_build")}
        </button>
      </>
    );
  }

  if (!base.pvp.on) {
    return (
      <>
        <p className="hint">{t("defence.pvp_blurb")}</p>
        {rules}
        <button type="button" className="btn wide primary" onClick={() => setPvp(true)}>
          {t("defence.join")}
        </button>
      </>
    );
  }

  const shield = base.pvp.shieldUntil !== null && base.pvp.shieldUntil > now;
  const last = base.pvp.lastAttackAt;
  const ready = last !== null ? last + pvp.attackHours * 3600 : null;
  const leaving = setPvpStatus(content, base, false, now);
  const tokens = base.pvp.revenge.filter((token) => token.until > now);
  const targets = raids?.targets ?? null;

  return (
    <>
      <div className="chips">
        <span className="chip-tag good">{t("defence.in_raids")}</span>
        {shield ? (
          <span className="chip-tag">
            {t("defence.shielded", { time: duration((base.pvp.shieldUntil ?? now) - now) })}
          </span>
        ) : null}
        {ready !== null && ready > now ? (
          <span className="chip-tag">{t("defence.ready_in", { time: duration(ready - now) })}</span>
        ) : null}
        <span className="chip-tag">
          <ResourceIcon id="charge" /> {abbrev(base.stock.charge ?? 0)}
        </span>
      </div>
      {tokens.map((token) => (
        <p key={token.attacker} className="good">
          {t("defence.revenge", {
            name: token.name,
            time: duration(token.until - now),
            percent: pvp.revengePercent,
          })}
        </p>
      ))}
      {targets === null ? (
        <p className="hint">{t("defence.looking")}</p>
      ) : targets.length === 0 ? (
        <p className="hint">{t("defence.nobody")}</p>
      ) : (
        targets.map((target) => <TargetCard key={target.id} target={target} />)
      )}
      <button
        type="button"
        className="btn small"
        disabled={leaving.code !== "ok"}
        onClick={() => setPvp(false)}
      >
        {leaving.code === "opt_out_locked"
          ? t("defence.leave_locked", { time: duration(leaving.until - now) })
          : t("defence.leave")}
      </button>
    </>
  );
}

function TargetCard({ target }: { target: RaidTargetView }) {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now));
  const raidPlayer = useWorld((state) => state.raidPlayer);
  const pending = useWorld((state) =>
    state.queue.some((queued) => queued.command.type === "raid_player" && !queued.predicted),
  );
  const { status, odds } = target;
  const revenge = revengeOn(base, target.id, now) !== null;
  const reason = status.code === "ok" ? null : refusalMessage(status as Refusal, now)?.text;
  const cost = status.code === "ok" ? status.cost : odds.cost;
  return (
    <div className="card target">
      <div className="main">
        <div className="title">
          <b>{target.name}</b>
          <span className="lvl">
            {tierName(target.tier)}
            {revenge ? ` · ${t("defence.revenge_tag")}` : ""}
          </span>
        </div>
        <div className="odds three">
          <div>
            <b className="num">{100 - odds.chance}%</b>
            <span>{t("defence.get_in")}</span>
          </div>
          <div>
            <b className="num">{odds.defence.total}</b>
            <span>{t("defence.their_defence")}</span>
          </div>
          <div>
            <b className="num">{cost}</b>
            <span>{t("defence.charges")}</span>
          </div>
        </div>
        <div className="desc">{t("defence.take")}</div>
        {chips(odds.take, "+") ?? <div className="desc">{t("defence.nothing_to_take")}</div>}
        <div className="desc">
          {t("defence.charges_left", { left: Math.max(0, (base.stock.charge ?? 0) - cost) })}
        </div>
      </div>
      <button
        type="button"
        className="btn wide danger"
        disabled={status.code !== "ok" || pending || !tierAtLeast(base, content.raids.pvp.minTier)}
        onClick={() => raidPlayer(target.id)}
      >
        {pending
          ? t("defence.raiding")
          : status.code === "ok"
            ? t(status.revenge ? "defence.strike" : "defence.raid", {
                name: target.name,
                count: cost,
              })
            : (reason ?? "")}
      </button>
    </div>
  );
}
