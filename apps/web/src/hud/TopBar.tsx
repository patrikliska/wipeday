import { advise } from "@wipe-day/domain/advisor";
import { storageCap } from "@wipe-day/domain/base";
import { crewCap } from "@wipe-day/domain/missions";
import { useShallow } from "zustand/shallow";
import { seasonDay, seasonTime, useWorld } from "../state/store";
import { abbrev, clockLabel, content, duration, resourceName, t, tierName } from "../state/world";
import { crewSummary } from "./crew";
import { knownResources, pendingOf } from "./derived";
import { ResourceIcon, Tile } from "./Icon";
import { RaidAlert } from "./RaidAlert";
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
  // The feed's dot: someone did something since the player last looked.
  const feedNew = useWorld((state) => (state.feed[0]?.id ?? 0) > state.feedSeen);
  // The crew chip (phones; desktop has the Squad dock button): count, who needs a look, and
  // the glow when the advisor picks the crew. Read once a minute.
  const crew = useWorld(
    useShallow((state) => {
      const minute = Math.floor(state.now / 60) * 60;
      return {
        count: state.base.crew.length,
        cap: crewCap(content, state.base),
        line: crewSummary(state.base, minute),
        glow: advise(content, state.base, minute) === "crew",
      };
    }),
  );
  // A served meal: its boost and the time left, in whole minutes (re-renders once a minute).
  const fed = useWorld((state) => {
    const wellFed = state.base.wellFed;
    const left = wellFed ? Math.ceil((wellFed.until - state.now) / 60) : 0;
    return wellFed && left > 0 ? `${wellFed.percent}:${left}` : "";
  });
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

      <button
        type="button"
        className={`glass crewchip${crew.glow ? " primary" : ""}${panel === "squad" ? " active" : ""}`}
        onClick={() => openPanel("squad")}
        title={t("panel.squad")}
      >
        <Tile color="#4a7fb5" label="SQ" />
        <span className="who">
          <span className="name num">
            {crew.count}/{crew.cap}
          </span>
          <span className="sub">{crew.line}</span>
        </span>
      </button>

      <button
        type="button"
        className={`glass clockchip${panel === "feed" ? " active" : ""}`}
        onClick={() => openPanel("feed")}
        title={feedNew ? t("feed.new") : t("panel.feed")}
      >
        <div>
          <div className="big num">{clock}</div>
          <div className="small">
            {t("hud.day_weather", { day, weather: t(`weather.${weather}`) })}
          </div>
          {fed ? (
            <div className="small fed">
              {t("hud.well_fed", {
                percent: fed.split(":")[0] ?? "",
                time: duration(Number(fed.split(":")[1] ?? 0) * 60),
              })}
            </div>
          ) : null}
        </div>
        {feedNew ? <span className="dot" /> : null}
      </button>
      <RaidAlert />
    </header>
  );
}
