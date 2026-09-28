import type { Building } from "@wipe-day/content/schema";
import {
  type Construction,
  canAfford,
  nextTool,
  tierOf,
  toolOf,
  upkeepOf,
} from "@wipe-day/domain/base";
import {
  type BuildStatus,
  builderSlots,
  buildingLevel,
  buildStatus,
  nextBuild,
} from "@wipe-day/domain/buildings";
import { useWorld } from "../../state/store";
import {
  abbrev,
  content,
  duration,
  initials,
  missingLabel,
  resourceName,
  TIERS,
  t,
  tierName,
  toolName,
} from "../../state/world";
import { Cost, needLabel } from "../Cost";
import { effectLines } from "../effects";
import { Tile } from "../Icon";
import { tierVar, vars } from "../util";

/** "+120 Timber/h, +30 Fibre/h": what a tool adds over the current one. */
function rateGains(from: Record<string, number>, to: Record<string, number>): string {
  return Object.entries(to)
    .map(([id, rate]) => [id, rate - (from[id] ?? 0)] as const)
    .filter(([, gain]) => gain > 0)
    .slice(0, 3)
    .map(([id, gain]) => t("hud.rate", { amount: abbrev(gain), what: resourceName(id) }))
    .join(" · ");
}

const buildingName = (id: string) => t(`building.${id}.name`);

/** What a construction is putting up, in words. */
function constructionName(job: Construction): string {
  return job.target.kind === "tier"
    ? t("build.job_tier", { tier: tierName(job.target.tier) })
    : t("build.job_building", {
        building: buildingName(job.target.building),
        level: job.target.level,
      });
}

/** The button's words for a building or tier that cannot be built right now. */
function statusLabel(status: BuildStatus, now: number): string {
  switch (status.code) {
    case "ok":
      return "";
    case "unaffordable":
      return t("build.upgrade_need", { need: missingLabel(status.missing) ?? "" });
    case "tier":
      return t("build.needs_tier", { tier: tierName(status.tier) });
    case "in_progress":
      return t("build.in_progress", { time: duration(status.endsAt - now) });
    case "builders":
      return t("build.builders_busy", { time: duration(status.endsAt - now) });
    case "maxed":
      return t("build.maxed");
    case "unknown":
      return t("refusal.unknown");
  }
}

/** Buildable first, then what only lacks resources or a builder, then locked, then done. */
const RANK: Record<BuildStatus["code"], number> = {
  ok: 0,
  unaffordable: 1,
  builders: 2,
  in_progress: 3,
  tier: 4,
  maxed: 5,
  unknown: 6,
};

function Pips({ level, of }: { level: number; of: number }) {
  return (
    <span className="pips" title={t("build.level", { level, of })}>
      {Array.from({ length: of }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pips are positional.
        <i key={index} className={index < level ? "on" : undefined} />
      ))}
    </span>
  );
}

export function BuildPanel() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now / 30) * 30);
  const build = useWorld((state) => state.build);
  const upgradeTool = useWorld((state) => state.upgradeTool);
  const current = TIERS.indexOf(base.tier);
  const tool = toolOf(content, base);
  const next = nextTool(content, base);
  const toolAffordable = next !== null && canAfford(next.cost, base.stock);
  const tierStatus = buildStatus(content, base, "tier");
  const slots = builderSlots(content, base);
  const free = Math.max(0, slots - base.construction.length);

  const buildings = content.buildings
    .map((building) => ({ building, status: buildStatus(content, base, building.id) }))
    .sort((a, b) => RANK[a.status.code] - RANK[b.status.code]);
  // One primary button in the panel: the tier, else the tools, else the first ready building.
  const primary =
    tierStatus.code === "ok"
      ? "tier"
      : toolAffordable
        ? "tool"
        : (buildings.find((entry) => entry.status.code === "ok")?.building.id ?? null);

  const buildingCard = (building: Building, status: BuildStatus) => {
    const level = buildingLevel(base, building.id);
    const of = building.levels.length;
    const upcoming = nextBuild(content, base, building.id);
    const now_ = effectLines(building.levels[level - 1]?.effects);
    const then = effectLines(upcoming ? building.levels[level]?.effects : undefined);
    const locked = status.code === "tier" || status.code === "maxed";
    const upkeep = upcoming
      ? Object.entries(building.levels[level]?.upkeep ?? {})
          .map(([id, amount]) => `${abbrev(amount)} ${resourceName(id).toLowerCase()}`)
          .join(", ")
      : "";
    const unlock = building.levels[0]?.minTier ?? building.unlockTier;
    return (
      <div
        key={building.id}
        className={`card${locked ? " locked" : ""}`}
        style={vars({ "--tier-color": tierVar(unlock) })}
      >
        <Tile color={tierVar(unlock)} label={initials(buildingName(building.id))} />
        <div className="main">
          <div className="title">
            <b>{buildingName(building.id)}</b>
            <Pips level={level} of={of} />
          </div>
          <div className="desc">{t(`building.${building.id}.blurb`)}</div>
          {now_.length > 0 ? (
            <div className="desc">{t("build.now", { what: now_.join(" · ") })}</div>
          ) : null}
          {upcoming && then.length > 0 ? (
            <div className="desc next">
              {t(level === 0 ? "build.gives" : "build.next", { what: then.join(" · ") })}
            </div>
          ) : null}
          {upcoming && status.code !== "tier" ? (
            <>
              <Cost cost={upcoming.cost} stock={base.stock} />
              <div className="desc">
                {upcoming.minutes === 0
                  ? t("build.instant")
                  : t("build.takes", { time: duration(upcoming.minutes * 60) })}
                {upkeep ? ` · ${t("build.upkeep", { upkeep })}` : ""}
              </div>
            </>
          ) : null}
          {status.code !== "maxed" ? (
            <button
              type="button"
              className={`btn${primary === building.id ? " primary" : ""}`}
              disabled={status.code !== "ok"}
              onClick={() => build(building.id)}
            >
              {status.code === "ok"
                ? level === 0
                  ? t("build.build_it", { building: buildingName(building.id) })
                  : t("build.level_up", { level: level + 1 })
                : statusLabel(status, now)}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <p className="hint">
        {t("build.builders", { free, slots })}
        {" · "}
        {t("build.upkeep_total", {
          upkeep:
            Object.entries(upkeepOf(content, base))
              .map(([id, amount]) => `${abbrev(amount)} ${resourceName(id).toLowerCase()}`)
              .join(", ") || t("build.none"),
        })}
      </p>
      {base.construction.map((job) => {
        const length = Math.max(1, job.endsAt - job.startedAt);
        const left = Math.max(0, job.endsAt - now);
        return (
          <div key={`${job.startedAt}-${job.endsAt}`} className="card">
            <Tile color="#e3a32f" label="⚒" />
            <div className="main">
              <div className="title">
                <b>{constructionName(job)}</b>
                <span className="lvl">{t("build.building_now")}</span>
              </div>
              <div className="progress">
                <i style={{ width: `${Math.round((1 - left / length) * 100)}%` }} />
              </div>
              <div className="desc">{t("hud.lands_in", { time: duration(left) })}</div>
            </div>
          </div>
        );
      })}

      <h3 className="section">{t("build.section_base")}</h3>
      {TIERS.map((id, index) => {
        const info = tierOf(content, id);
        const stage =
          index < current
            ? "past"
            : index === current
              ? "current"
              : index === current + 1
                ? "next"
                : "later";
        const affordable = canAfford(info.cost, base.stock);
        if (stage === "past") return null;
        const upkeep = Object.entries(info.upkeep)
          .map(([resource, amount]) => `${abbrev(amount)} ${resourceName(resource).toLowerCase()}`)
          .join(", ");
        return (
          <div
            key={id}
            className={`card${stage === "later" ? " locked" : ""}`}
            style={vars({ "--tier-color": tierVar(id) })}
          >
            <Tile color={tierVar(id)} label={initials(tierName(id))} />
            <div className="main">
              <div className="title">
                <b>{tierName(id)}</b>
                <span className="lvl">{t(`build.stage_${stage}`)}</span>
              </div>
              <div className="desc">
                {t("build.tier_facts", {
                  cap: abbrev(info.storageCap),
                  furnaces: info.furnaceSlots,
                  crates: info.boxSlots,
                  builders: info.builders,
                })}
              </div>
              {stage === "next" || stage === "later" ? (
                <>
                  <div className="desc">
                    {info.buildMinutes === 0
                      ? t("build.instant")
                      : t("build.takes", { time: duration(info.buildMinutes * 60) })}
                    {upkeep ? ` · ${t("build.upkeep", { upkeep })}` : ""}
                  </div>
                  <Cost cost={info.cost} stock={base.stock} />
                </>
              ) : null}
              {stage === "next" ? (
                <button
                  type="button"
                  className={`btn${primary === "tier" ? " primary" : ""}`}
                  disabled={tierStatus.code !== "ok"}
                  onClick={() => build("tier")}
                >
                  {tierStatus.code === "ok"
                    ? t("build.upgrade_to", { tier: tierName(id) })
                    : affordable || tierStatus.code !== "unaffordable"
                      ? statusLabel(tierStatus, now)
                      : t("build.upgrade_need", { need: needLabel(info.cost, base.stock) ?? "" })}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      <h3 className="section">{t("build.section_tools", { tool: toolName(tool.id) })}</h3>
      {next ? (
        <div className="card" style={vars({ "--tier-color": tierVar(next.tier) })}>
          <Tile color={tierVar(next.tier)} label={initials(toolName(next.id))} />
          <div className="main">
            <div className="title">
              <b>{toolName(next.id)}</b>
              <span className="lvl">{t("build.stage_next")}</span>
            </div>
            <div className="desc">{rateGains(tool.rates, next.rates)}</div>
            <Cost cost={next.cost} stock={base.stock} />
            <button
              type="button"
              className={`btn${primary === "tool" ? " primary" : ""}`}
              disabled={!toolAffordable}
              onClick={upgradeTool}
            >
              {toolAffordable
                ? t("build.tool_to", { tool: toolName(next.id) })
                : t("build.upgrade_need", { need: needLabel(next.cost, base.stock) ?? "" })}
            </button>
          </div>
        </div>
      ) : (
        <p className="hint">{t("build.tools_maxed")}</p>
      )}

      <h3 className="section">{t("build.section_buildings")}</h3>
      {buildings.map(({ building, status }) => buildingCard(building, status))}
    </>
  );
}
