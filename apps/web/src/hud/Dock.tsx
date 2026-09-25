import { gatherReadyIn, nextTierInfo, type Panel as PanelId, useWorld } from "../state/store";
import { abbrev, canAfford, duration, FURNACE_RATE, ITEMS, tierById } from "../state/world";
import { needLabel } from "./Cost";
import { Tile } from "./Icon";
import { tierVar } from "./util";

interface Action {
  id: string;
  name: string;
  glyph: string;
  color: string;
  sub?: string | undefined;
  badge?: string | undefined;
  disabled?: boolean | undefined;
  /** Hidden on phones; reachable from the top bar instead. */
  extra?: boolean | undefined;
  panel?: PanelId | undefined;
  onClick: () => void;
}

/** The action bar. The advisor picks exactly one primary button. */
export function Dock() {
  const panel = useWorld((state) => state.panel);
  const openPanel = useWorld((state) => state.openPanel);
  const gather = useWorld((state) => state.gather);
  const readySeconds = useWorld((state) => Math.ceil(gatherReadyIn(state) / 60) * 60);
  const tier = useWorld((state) => state.tier);
  const buildMinutes = useWorld((state) =>
    state.build ? Math.max(0, Math.ceil((state.build.endsAt - state.clock) / 60)) : null,
  );
  const stock = useWorld((state) => state.stock);
  const furnaceReady = useWorld((state) =>
    state.furnace.jobs.reduce(
      (sum, job) =>
        sum +
        Math.min(job.amount, Math.floor((FURNACE_RATE * (state.clock - job.startedAt)) / 3600)) -
        job.taken,
      0,
    ),
  );
  const furnaceBusy = useWorld((state) => state.furnace.jobs.length);
  const survivors = useWorld((state) => state.survivors.length);
  const tasksDone = useWorld((state) => state.tasks.filter((task) => task.done).length);
  const tasksTotal = useWorld((state) => state.tasks.length);

  const next = nextTierInfo({ tier });
  const slots = tierById.get(tier)?.furnaceSlots ?? 1;
  const gatherReady = readySeconds <= 0;
  const canBuild = next !== null && buildMinutes === null && canAfford(next.cost, stock);
  const canSmelt = furnaceBusy < slots && (stock.ore ?? 0) >= 50 && (stock.timber ?? 0) >= 25;
  const craftable = ITEMS.some((item) => canAfford(item.cost, stock));

  let primary = "craft";
  if (gatherReady) primary = "gather";
  else if (canBuild) primary = "build";
  else if (furnaceReady > 0 || canSmelt) primary = "furnace";

  let buildSub = "max tier";
  if (buildMinutes !== null) buildSub = `lands in ${duration(buildMinutes * 60)}`;
  else if (next)
    buildSub =
      needLabel(next.cost, stock)?.replace(/^need /, "") ??
      (next.buildMinutes === 0 ? "instant" : duration(next.buildMinutes * 60));

  const actions: Action[] = [
    {
      id: "gather",
      name: "Gather",
      glyph: "GA",
      color: "#7fa043",
      sub: gatherReady ? "+30 min bonus" : `ready in ${duration(readySeconds)}`,
      disabled: !gatherReady,
      onClick: () => {
        gather();
      },
    },
    {
      id: "build",
      name: next ? "Upgrade" : "Base",
      glyph: "UP",
      color: tierVar(next?.id ?? tier),
      sub: buildSub,
      panel: "build",
      onClick: () => openPanel("build"),
    },
    {
      id: "craft",
      name: "Craft",
      glyph: "CR",
      color: "#e3a32f",
      sub: craftable ? "recipes ready" : "nothing affordable",
      panel: "craft",
      onClick: () => openPanel("craft"),
    },
    {
      id: "furnace",
      name: "Furnace",
      glyph: "FU",
      color: "#ff8a3c",
      sub:
        furnaceReady > 0
          ? `${abbrev(furnaceReady)} ready`
          : furnaceBusy > 0
            ? "smelting"
            : canSmelt
              ? "load ore"
              : "idle",
      badge: furnaceReady > 0 ? abbrev(furnaceReady) : undefined,
      panel: "furnace",
      onClick: () => openPanel("furnace"),
    },
    {
      id: "squad",
      name: "Squad",
      glyph: "SQ",
      color: "#4a7fb5",
      sub: `${survivors} survivors`,
      panel: "squad",
      onClick: () => openPanel("squad"),
    },
    {
      id: "inventory",
      name: "Inventory",
      glyph: "IN",
      color: "#9aa0a6",
      extra: true,
      panel: "inventory",
      onClick: () => openPanel("inventory"),
    },
    {
      id: "tasks",
      name: "Tasks",
      glyph: "TA",
      color: "#c85a2b",
      sub: `${tasksDone}/${tasksTotal} done`,
      extra: true,
      panel: "tasks",
      onClick: () => openPanel("tasks"),
    },
  ];

  return (
    <nav className="glass dock" aria-label="Actions">
      {actions.map((action) => {
        const classes = [
          "action",
          action.id === primary ? "primary" : "",
          action.panel && action.panel === panel ? "active" : "",
          action.extra ? "extra" : "",
          action.sub ? "has-sub" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={action.id}
            type="button"
            className={classes}
            disabled={action.disabled ?? false}
            onClick={action.onClick}
          >
            <Tile color={action.color} label={action.glyph} className="glyph" />
            <span className="name">{action.name}</span>
            {action.sub ? <span className="sub">{action.sub}</span> : null}
            {action.badge ? <span className="badge">{action.badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
