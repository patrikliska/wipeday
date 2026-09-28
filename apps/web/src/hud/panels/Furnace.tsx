import {
  fuelFor,
  furnaceOf,
  furnaceReady,
  furnaceSlots,
  jobEndsAt,
  jobProgress,
  smeltable,
  smeltRate,
  total,
} from "@wipe-day/domain/base";
import { buildingLevel, buildStatus, nextBuild } from "@wipe-day/domain/buildings";
import { useWorld } from "../../state/store";
import {
  abbrev,
  content,
  duration,
  furnaceName,
  missingLabel,
  resourceName,
  t,
  tierName,
} from "../../state/world";
import { Cost } from "../Cost";
import { ResourceIcon, Tile } from "../Icon";
import { vars } from "../util";

const ORES = content.resources.filter((resource) => resource.smeltsInto);

export function FurnacePanel() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now / 30) * 30);
  const smelt = useWorld((state) => state.smelt);
  const takeOut = useWorld((state) => state.takeOut);
  const build = useWorld((state) => state.build);
  const openPanel = useWorld((state) => state.openPanel);
  const furnace = furnaceOf(content, base);
  const level = buildingLevel(base, "furnace");
  const upgrade = nextBuild(content, base, "furnace");
  const status = buildStatus(content, base, "furnace");
  const nextType = content.furnaces[level];
  const ready = total(furnaceReady(base, now));

  const upgradeLabel = (): string => {
    switch (status.code) {
      case "ok":
        return furnace
          ? t("smelt.upgrade_to", { furnace: furnaceName(nextType?.id ?? "") })
          : t("smelt.build_it");
      case "unaffordable":
        return t("craft.need", { need: missingLabel(status.missing) ?? "" });
      case "tier":
        return t("smelt.needs_tier", { tier: tierName(status.tier) });
      case "in_progress":
        return t("build.in_progress", { time: duration(status.endsAt - now) });
      case "builders":
        return t("build.builders_busy", { time: duration(status.endsAt - now) });
      default:
        return t("build.maxed");
    }
  };

  const buildCard =
    upgrade && nextType ? (
      <div className="card">
        <Tile color="#ff8a3c" label="FU" />
        <div className="main">
          <div className="title">
            <b>{furnaceName(nextType.id)}</b>
            <span className="lvl">{furnace ? t("smelt.upgrade") : t("smelt.build")}</span>
          </div>
          <div className="desc">
            {t("smelt.facts", {
              rate: abbrev(nextType.orePerHour),
              max: abbrev(nextType.maxOrePerJob),
              fuel: nextType.fuelPer100Ore,
              what: resourceName(nextType.fuel).toLowerCase(),
            })}
          </div>
          {status.code !== "tier" ? <Cost cost={upgrade.cost} stock={base.stock} /> : null}
          <button
            type="button"
            className={`btn${!furnace && status.code === "ok" ? " primary" : ""}`}
            disabled={status.code !== "ok"}
            onClick={() => build("furnace")}
          >
            {upgradeLabel()}
          </button>
        </div>
      </div>
    ) : null;

  if (!furnace) {
    return (
      <>
        <p className="hint">{t("smelt.hint_none")}</p>
        {buildCard}
      </>
    );
  }

  const slots = furnaceSlots(content, base);
  return (
    <>
      <p className="hint">
        {t("smelt.hint", {
          furnace: furnaceName(furnace.id),
          slots,
          rate: abbrev(smeltRate(content, base, furnace)),
        })}
      </p>
      {base.furnaceJobs.map((job) => {
        const done = jobProgress(job, now);
        return (
          <div key={`${job.input}-${job.startedAt}`} className="card">
            <ResourceIcon id={job.output} />
            <div className="main">
              <div className="title">
                <b>{resourceName(job.output)}</b>
                <span className="lvl num">
                  {abbrev(done)} / {abbrev(job.amount)}
                </span>
              </div>
              <div className="progress" style={vars({ "--bar-color": "#ff8a3c" })}>
                <i style={{ width: `${Math.round((done / job.amount) * 100)}%` }} />
              </div>
              <div className="desc">
                {done >= job.amount
                  ? t("smelt.finished")
                  : t("smelt.left", { time: duration(jobEndsAt(job) - now) })}
              </div>
            </div>
          </div>
        );
      })}
      {base.furnaceJobs.length === 0 ? (
        <div className="card">
          <div className="main">
            <div className="title">
              <b>{t("smelt.cold")}</b>
            </div>
            <div className="desc">{t("smelt.cold_desc")}</div>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={`btn${ready > 0 ? " primary" : ""}`}
        disabled={ready <= 0}
        onClick={takeOut}
      >
        {ready > 0 ? t("smelt.take_out", { amount: abbrev(ready) }) : t("smelt.nothing_ready")}
      </button>
      {ORES.map((ore) => {
        const output = ore.smeltsInto ?? "";
        const have = Math.floor(base.stock[ore.id] ?? 0);
        const amount = smeltable(content, base, ore.id);
        const fuel = fuelFor(content, base, furnace, amount);
        const slotFree = base.furnaceJobs.length < slots;
        let label = t("smelt.smelt", { amount: abbrev(amount), what: resourceName(ore.id) });
        if (!slotFree) label = t("smelt.no_slot");
        else if (have <= 0)
          label = t("smelt.need_ore", { what: resourceName(ore.id).toLowerCase() });
        else if (amount <= 0)
          label = t("smelt.need_fuel", { what: resourceName(furnace.fuel).toLowerCase() });
        return (
          <div key={ore.id} className="card">
            <ResourceIcon id={ore.id} />
            <div className="main">
              <div className="title">
                <b>{resourceName(ore.id)}</b>
                <span className="lvl num">{t("smelt.have", { amount: abbrev(have) })}</span>
              </div>
              <div className="desc">
                {amount > 0
                  ? t("smelt.makes", {
                      amount: abbrev(amount),
                      what: resourceName(output),
                      time: duration((amount * 3600) / smeltRate(content, base, furnace)),
                      fuel: abbrev(fuel),
                      fuelName: resourceName(furnace.fuel).toLowerCase(),
                    })
                  : t("smelt.gather_first")}
              </div>
              <button
                type="button"
                className="btn"
                disabled={!slotFree || amount <= 0}
                onClick={() => smelt(ore.id)}
              >
                {label}
              </button>
            </div>
          </div>
        );
      })}
      {buildCard}
      <button type="button" className="btn small" onClick={() => openPanel("build")}>
        {t("smelt.more_buildings")}
      </button>
    </>
  );
}
