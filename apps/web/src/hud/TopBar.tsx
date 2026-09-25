import { useShallow } from "zustand/shallow";
import { storageCap, useWorld } from "../state/store";
import {
  abbrev,
  clockLabel,
  GAME_DAY,
  type ResourceId,
  resourceById,
  tierById,
} from "../state/world";
import { ResourceIcon, Tile } from "./Icon";
import { tierVar, vars } from "./util";

const SHOWN: ResourceId[] = ["timber", "stone", "ore", "ingots", "sulfur_ore", "fibre", "scrap"];
const WEATHER_LABEL = { clear: "Clear", rain: "Rain", fog: "Fog" } as const;

export function TopBar() {
  const tier = useWorld((state) => state.tier);
  const cap = useWorld((state) => storageCap(state));
  const clock = useWorld((state) => clockLabel(state.clock));
  const day = useWorld((state) => Math.floor(state.clock / GAME_DAY) + 1);
  const weather = useWorld((state) => state.weather);
  const panel = useWorld((state) => state.panel);
  const openPanel = useWorld((state) => state.openPanel);
  const tasksDone = useWorld((state) => state.tasks.filter((task) => task.done).length);
  const amounts = useWorld(
    useShallow((state) => SHOWN.map((id) => Math.floor(state.stock[id] ?? 0))),
  );
  const pending = useWorld(
    useShallow((state) => SHOWN.map((id) => Math.floor(state.pending[id] ?? 0))),
  );
  const tierName = tierById.get(tier)?.name ?? tier;

  return (
    <header className="topbar">
      <button
        type="button"
        className={`glass identity${panel === "tasks" ? " active" : ""}`}
        style={vars({ "--tier-color": tierVar(tier) })}
        onClick={() => openPanel("tasks")}
        title="Daily tasks"
      >
        <Tile color="#cd412b" label="YOU" />
        <span className="who">
          <span className="name">Survivor</span>
          <span className="sub">{tierName} base · Season 1</span>
        </span>
        {tasksDone > 0 ? <span className="badge">{tasksDone}</span> : null}
      </button>

      <button
        type="button"
        className={`glass resources${panel === "inventory" ? " active" : ""}`}
        onClick={() => openPanel("inventory")}
        title="Inventory"
      >
        {SHOWN.map((id, index) => {
          const amount = amounts[index] ?? 0;
          const extra = pending[index] ?? 0;
          const fill = Math.min(1, (amount + extra) / cap);
          const full = fill >= 0.98;
          const name = resourceById.get(id)?.name ?? id;
          return (
            <span
              className="chip"
              key={id}
              title={`${name}: ${amount.toLocaleString()} of ${cap.toLocaleString()}`}
            >
              <ResourceIcon id={id} />
              <span className="grow">
                <span className="amount num">
                  {abbrev(amount)}
                  {extra > 0 ? <span className="pending">+{abbrev(extra)}</span> : null}
                </span>
                <span className="label">{name}</span>
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
            Day {day} · {WEATHER_LABEL[weather]}
          </div>
        </div>
      </div>
    </header>
  );
}
