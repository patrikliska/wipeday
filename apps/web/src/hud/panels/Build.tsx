import { canAfford, nextTool, tierOf, toolOf } from "@wipe-day/domain/base";
import { useWorld } from "../../state/store";
import {
  abbrev,
  content,
  duration,
  initials,
  resourceName,
  TIERS,
  t,
  tierName,
  toolName,
} from "../../state/world";
import { Cost, needLabel } from "../Cost";
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

export function BuildPanel() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now / 30) * 30);
  const build = useWorld((state) => state.build);
  const upgradeTool = useWorld((state) => state.upgradeTool);
  const current = TIERS.indexOf(base.tier);
  const tool = toolOf(content, base);
  const next = nextTool(content, base);
  const toolAffordable = next !== null && canAfford(next.cost, base.stock);
  // One primary button per view: the tier upgrade wins when both are affordable.
  const nextTierId = TIERS[current + 1];
  const tierPrimary =
    nextTierId !== undefined &&
    base.build === null &&
    canAfford(tierOf(content, nextTierId).cost, base.stock);

  return (
    <>
      <p className="hint">{t("build.hint")}</p>
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
        const inProgress = base.build?.tier === id;
        const totalSeconds = info.buildMinutes * 60;
        const left = inProgress && base.build ? Math.max(0, base.build.endsAt - now) : 0;
        const progress = inProgress && totalSeconds > 0 ? 1 - left / totalSeconds : 0;
        const upkeep = Object.entries(info.upkeep)
          .map(([resource, amount]) => `${abbrev(amount)} ${resourceName(resource).toLowerCase()}`)
          .join(", ");
        return (
          <div
            key={id}
            className={`card${stage === "later" || stage === "past" ? " locked" : ""}`}
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
                  bench: info.workbenchLevel,
                })}
              </div>
              {stage === "next" || stage === "later" ? (
                <>
                  <div className="desc">
                    {info.buildMinutes === 0
                      ? t("build.instant")
                      : t("build.takes", { time: duration(totalSeconds) })}
                    {upkeep ? ` · ${t("build.upkeep", { upkeep })}` : ""}
                  </div>
                  <Cost cost={info.cost} stock={base.stock} />
                </>
              ) : null}
              {inProgress ? (
                <>
                  <div className="progress">
                    <i style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <div className="desc">{t("hud.lands_in", { time: duration(left) })}</div>
                </>
              ) : null}
              {stage === "next" && !inProgress ? (
                <button
                  type="button"
                  className={`btn${affordable && !base.build ? " primary" : ""}`}
                  disabled={!affordable || base.build !== null}
                  onClick={build}
                >
                  {base.build
                    ? t("build.busy")
                    : affordable
                      ? t("build.upgrade_to", { tier: tierName(id) })
                      : t("build.upgrade_need", { need: needLabel(info.cost, base.stock) ?? "" })}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      <p className="hint">{t("build.tools_hint", { tool: toolName(tool.id) })}</p>
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
              className={`btn${toolAffordable && !tierPrimary ? " primary" : ""}`}
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
    </>
  );
}
