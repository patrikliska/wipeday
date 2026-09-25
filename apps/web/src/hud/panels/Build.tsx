import { useWorld } from "../../state/store";
import { abbrev, BASE_TIERS, canAfford, duration, TIERS } from "../../state/world";
import { Cost, needLabel } from "../Cost";
import { Tile } from "../Icon";
import { initials, tierVar, vars } from "../util";

export function BuildPanel() {
  const tier = useWorld((state) => state.tier);
  const stock = useWorld((state) => state.stock);
  const build = useWorld((state) => state.build);
  const startBuild = useWorld((state) => state.startBuild);
  const minutesLeft = useWorld((state) =>
    state.build ? Math.max(0, Math.ceil((state.build.endsAt - state.clock) / 60)) : 0,
  );
  const current = TIERS.indexOf(tier);

  return (
    <>
      <p className="hint">
        Each tier raises storage, furnace slots and what you can craft. Upkeep rises with it.
      </p>
      {BASE_TIERS.map((info, index) => {
        const stage =
          index < current
            ? "past"
            : index === current
              ? "current"
              : index === current + 1
                ? "next"
                : "later";
        const affordable = canAfford(info.cost, stock);
        const inProgress = build?.tier === info.id;
        const total = info.buildMinutes * 60;
        const progress = inProgress && total > 0 ? 1 - (minutesLeft * 60) / total : 0;
        const label = { past: "Built", current: "Your base", next: "Next", later: "Later" }[stage];
        const slots = `${info.furnaceSlots} furnace ${info.furnaceSlots === 1 ? "slot" : "slots"}`;
        const time = info.buildMinutes === 0 ? "instant" : `builds in ${duration(total)}`;
        return (
          <div
            key={info.id}
            className={`card${stage === "later" || stage === "past" ? " locked" : ""}`}
            style={vars({ "--tier-color": tierVar(info.id) })}
          >
            <Tile color={tierVar(info.id)} label={initials(info.name)} />
            <div className="main">
              <div className="title">
                <b>{info.name}</b>
                <span className="lvl">{label}</span>
              </div>
              <div className="desc">
                Storage {abbrev(info.cap)} · {slots} · {time}
              </div>
              {stage === "next" || stage === "later" ? (
                <Cost cost={info.cost} stock={stock} />
              ) : null}
              {inProgress ? (
                <>
                  <div className="progress">
                    <i style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <div className="desc">Lands in {duration(minutesLeft * 60)}</div>
                </>
              ) : null}
              {stage === "next" && !inProgress ? (
                <button
                  type="button"
                  className={`btn${affordable && !build ? " primary" : ""}`}
                  disabled={!affordable || build !== null}
                  onClick={startBuild}
                >
                  {build
                    ? "Upgrade · build in progress"
                    : affordable
                      ? `Upgrade to ${info.name}`
                      : `Upgrade · ${needLabel(info.cost, stock) ?? ""}`}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
