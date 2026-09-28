import { TIERS } from "@wipe-day/content/tiers";
import {
  canAfford,
  fuelFor,
  furnaceOf,
  furnaceReady,
  furnaceSlots,
  jobEndsAt,
  jobProgress,
  smeltable,
  total,
} from "@wipe-day/domain/base";
import { useWorld } from "../../state/store";
import {
  abbrev,
  content,
  duration,
  furnaceName,
  resourceName,
  t,
  tierName,
} from "../../state/world";
import { Cost, needLabel } from "../Cost";
import { ResourceIcon, Tile } from "../Icon";
import { vars } from "../util";

const ORES = content.resources.filter((resource) => resource.smeltsInto);

export function FurnacePanel() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now / 30) * 30);
  const smelt = useWorld((state) => state.smelt);
  const takeOut = useWorld((state) => state.takeOut);
  const buyFurnace = useWorld((state) => state.buyFurnace);
  const furnace = furnaceOf(content, base);
  const index = content.furnaces.findIndex((candidate) => candidate.id === base.furnaceId);
  const upgrade = content.furnaces[index + 1] ?? null;
  const upgradeTierOk =
    upgrade !== null && TIERS.indexOf(upgrade.minTier) <= TIERS.indexOf(base.tier);
  const ready = total(furnaceReady(content, base, now));

  const buyCard = upgrade ? (
    <div className="card">
      <Tile color="#ff8a3c" label="FU" />
      <div className="main">
        <div className="title">
          <b>{furnaceName(upgrade.id)}</b>
          <span className="lvl">{furnace ? t("smelt.upgrade") : t("smelt.build")}</span>
        </div>
        <div className="desc">
          {t("smelt.facts", {
            rate: abbrev(upgrade.orePerHour),
            max: abbrev(upgrade.maxOrePerJob),
            fuel: upgrade.fuelPer100Ore,
            what: resourceName(upgrade.fuel).toLowerCase(),
          })}
        </div>
        <Cost cost={upgrade.cost} stock={base.stock} />
        <button
          type="button"
          className={`btn${!furnace && upgradeTierOk && canAfford(upgrade.cost, base.stock) ? " primary" : ""}`}
          disabled={!upgradeTierOk || !canAfford(upgrade.cost, base.stock)}
          onClick={buyFurnace}
        >
          {!upgradeTierOk
            ? t("smelt.needs_tier", { tier: tierName(upgrade.minTier) })
            : canAfford(upgrade.cost, base.stock)
              ? furnace
                ? t("smelt.upgrade_to", { furnace: furnaceName(upgrade.id) })
                : t("smelt.build_it")
              : t("craft.need", { need: needLabel(upgrade.cost, base.stock) ?? "" })}
        </button>
      </div>
    </div>
  ) : null;

  if (!furnace) {
    return (
      <>
        <p className="hint">{t("smelt.hint_none")}</p>
        {buyCard}
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
          rate: abbrev(furnace.orePerHour),
        })}
      </p>
      {base.furnaceJobs.map((job) => {
        const done = jobProgress(furnace, job, now);
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
                  : t("smelt.left", { time: duration(jobEndsAt(furnace, job) - now) })}
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
        const fuel = fuelFor(furnace, amount);
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
                      time: duration((amount * 3600) / furnace.orePerHour),
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
      {buyCard}
    </>
  );
}
