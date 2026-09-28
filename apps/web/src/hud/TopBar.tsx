import { storageCap } from "@wipe-day/domain/base";
import { useShallow } from "zustand/shallow";
import { seasonDay, seasonTime, useWorld } from "../state/store";
import { abbrev, clockLabel, content, resourceName, t, tierName } from "../state/world";
import { knownResources, pendingOf } from "./derived";
import { ResourceIcon, Tile } from "./Icon";
import { tierVar, vars } from "./util";

/** The strip shows at most this many resources (fewer on phones, by CSS). */
const SHOWN = 7;

export function TopBar() {
  const tier = useWorld((state) => state.base.tier);
  const name = useWorld((state) => state.player?.name ?? t("hud.demo_player"));
  const cap = useWorld((state) => storageCap(content, state.base));
  const clock = useWorld((state) => clockLabel(seasonTime(state)));
  const day = useWorld((state) => seasonDay(state));
  const weather = useWorld((state) => state.weather);
  const panel = useWorld((state) => state.panel);
  const openPanel = useWorld((state) => state.openPanel);
  const tasksDone = useWorld((state) => state.base.tasks.done.length);
  const ids = useWorld(useShallow((state) => knownResources(state.base).slice(0, SHOWN)));
  const amounts = useWorld(
    useShallow((state) => ids.map((id) => Math.floor(state.base.stock[id] ?? 0))),
  );
  const pending = useWorld(
    useShallow((state) => ids.map((id) => Math.floor(pendingOf(state)[id] ?? 0))),
  );

  return (
    <header className="topbar">
      <button
        type="button"
        className={`glass identity${panel === "tasks" ? " active" : ""}`}
        style={vars({ "--tier-color": tierVar(tier) })}
        onClick={() => openPanel("tasks")}
        title={t("panel.tasks")}
      >
        <Tile color="#cd412b" label={t("hud.you")} />
        <span className="who">
          <span className="name">{name}</span>
          <span className="sub">{t("hud.identity_sub", { tier: tierName(tier) })}</span>
        </span>
        {tasksDone > 0 ? <span className="badge">{tasksDone}</span> : null}
      </button>

      <button
        type="button"
        className={`glass resources${panel === "inventory" ? " active" : ""}`}
        onClick={() => openPanel("inventory")}
        title={t("panel.inventory")}
      >
        {ids.map((id, index) => {
          const amount = amounts[index] ?? 0;
          const extra = pending[index] ?? 0;
          const fill = Math.min(1, (amount + extra) / cap);
          const full = fill >= 1;
          const label = resourceName(id);
          return (
            <span
              className="chip"
              key={id}
              title={t("hud.chip_title", { name: label, amount: abbrev(amount), cap: abbrev(cap) })}
            >
              <ResourceIcon id={id} />
              <span className="grow">
                <span className="amount num">
                  {abbrev(amount)}
                  {extra > 0 ? <span className="pending">+{abbrev(extra)}</span> : null}
                </span>
                <span className="label">{label}</span>
                <span
                  className="bar"
                  style={vars({ "--bar-color": full ? "var(--warning)" : "var(--success)" })}
                >
                  <i style={{ width: `${Math.round(fill * 100)}%` }} />
                </span>
              </span>
            </span>
          );
        })}
      </button>

      <div className="glass clockchip">
        <div>
          <div className="big num">{clock}</div>
          <div className="small">
            {t("hud.day_weather", { day, weather: t(`weather.${weather}`) })}
          </div>
        </div>
      </div>
    </header>
  );
}
