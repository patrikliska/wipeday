import { type Advice, advise, hintFor, partWorthIt } from "@wipe-day/domain/advisor";
import {
  canAfford,
  furnaceOf,
  furnaceReady,
  gatherReadyAt,
  nextTier,
  nextTool,
  tierOf,
  total,
} from "@wipe-day/domain/base";
import { craftOptions, jobEndsAt } from "@wipe-day/domain/craft";
import { type Panel as PanelId, useWorld } from "../state/store";
import { abbrev, content, duration, outputName, t } from "../state/world";
import { needLabel } from "./Cost";
import { crewSummary } from "./crew";
import { pendingOf } from "./derived";
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

/** Which dock button carries each piece of advice. */
const DOCK_FOR: Record<Advice, string | null> = {
  gather: "gather",
  collect: "gather",
  build: "build",
  tools: "build",
  furnace: "furnace",
  building: "build",
  craft: "craft",
  map: "map",
  // Desktop: the Squad button; phones: the crew chip in the top bar.
  crew: "squad",
  // The barrel glows in the scene itself.
  barrel: null,
};

/** The action bar. The advisor picks exactly one primary button; its hint sits above the bar. */
export function Dock() {
  const panel = useWorld((state) => state.panel);
  const openPanel = useWorld((state) => state.openPanel);
  const openRecipe = useWorld((state) => state.openRecipe);
  const view = useWorld((state) => state.view);
  const setView = useWorld((state) => state.setView);
  const gather = useWorld((state) => state.gather);
  const collect = useWorld((state) => state.collect);
  const base = useWorld((state) => state.base);
  const panelOpen = useWorld((state) => state.panel !== null);
  // The dock reads time in whole minutes: enough for its labels, and it re-renders rarely.
  const minute = useWorld((state) => Math.floor(state.now / 60) * 60);
  const pendingTotal = useWorld((state) => Math.floor(total(pendingOf(state))));
  const now = minute;

  const advice = advise(content, base, now);
  const hint = hintFor(base, advice);
  const primary = DOCK_FOR[advice];

  const readyIn = Math.max(0, gatherReadyAt(content, base) - now);
  const gatherReady = readyIn <= 0;
  const target = nextTier(base.tier);
  const tool = nextTool(content, base);
  const ready = total(furnaceReady(base, now));
  const furnace = furnaceOf(content, base);
  const craftable = craftOptions(content, base).filter((option) => option.status.code === "ok");
  // What the stations are making: the job that finishes first.
  const soonest = Object.values(base.production)
    .flatMap((jobs) => jobs.slice(0, 1))
    .sort((a, b) => jobEndsAt(a) - jobEndsAt(b))[0];
  // The part the next tier or tool waits on: Craft opens straight on its recipe.
  const part = partWorthIt(content, base);
  const unread = base.reports.filter((report) => !report.read).length;
  const soonestBack = [...base.missions].sort((a, b) => a.endsAt - b.endsAt)[0];
  const tasksDone = base.tasks.done.length;

  // The builders first: what is going up and when it lands; then what can be built next.
  const first = [...base.construction].sort((a, b) => a.endsAt - b.endsAt)[0];
  let buildSub = t("hud.max_tier");
  if (first) buildSub = t("hud.lands_in", { time: duration(first.endsAt - now) });
  else if (advice === "building") buildSub = t("hud.can_build");
  else if (target) {
    const tier = tierOf(content, target);
    buildSub =
      needLabel(tier.cost, base.stock) ??
      (tier.buildMinutes === 0 ? t("hud.instant") : duration(tier.buildMinutes * 60));
  }
  if (!first && tool && canAfford(tool.cost, base.stock)) buildSub = t("hud.new_tools");

  // With gather on cooldown and a pile waiting, the first button banks the pile instead.
  const collectMode = !gatherReady && pendingTotal > 0;

  const actions: Action[] = [
    {
      id: "gather",
      name: collectMode ? t("action.collect") : t("action.gather"),
      glyph: collectMode ? "CO" : "GA",
      color: "#7fa043",
      sub: collectMode
        ? `+${abbrev(pendingTotal)}`
        : gatherReady
          ? t("hud.gather_bonus", { minutes: content.tools[0]?.bonusMinutes ?? 0 })
          : t("hud.ready_in", { time: duration(readyIn) }),
      disabled: !gatherReady && !collectMode,
      onClick: () => {
        // Gathering happens at the holdfast: from the map, go home first.
        setView("base");
        if (collectMode) collect();
        else gather();
      },
    },
    {
      id: "build",
      name: target ? t("action.upgrade") : t("action.base"),
      glyph: "UP",
      color: tierVar(target ?? base.tier),
      sub: buildSub,
      panel: "build",
      onClick: () => openPanel("build"),
    },
    {
      id: "craft",
      name: t("action.craft"),
      glyph: "CR",
      color: "#e3a32f",
      sub: part
        ? t("craft.make_named", { item: outputName(part.output) })
        : soonest
          ? t("hud.crafting_now", {
              item: outputName(soonest.recipe),
              time: duration(Math.max(0, jobEndsAt(soonest) - now)),
            })
          : craftable.length > 0
            ? t("hud.recipes_ready", { count: craftable.length })
            : t("hud.nothing_affordable"),
      panel: "craft",
      onClick: () => (part ? openRecipe(part.output) : openPanel("craft")),
    },
    {
      id: "furnace",
      name: t("action.furnace"),
      glyph: "FU",
      color: "#ff8a3c",
      sub: !furnace
        ? t("hud.not_built")
        : ready > 0
          ? t("hud.ready_amount", { amount: abbrev(ready) })
          : base.furnaceJobs.length > 0
            ? t("hud.smelting")
            : t("hud.idle"),
      badge: ready > 0 ? abbrev(ready) : undefined,
      panel: "furnace",
      onClick: () => openPanel("furnace"),
    },
    {
      // The fifth phone action (D84): the island; on the map it takes you home.
      id: "map",
      name: view === "map" ? t("action.holdfast") : t("action.map"),
      glyph: "MA",
      color: "#3aa0a0",
      sub:
        unread > 0
          ? t("hud.reports", { count: unread })
          : soonestBack
            ? t("hud.away", {
                count: base.missions.length,
                time: duration(Math.max(0, soonestBack.endsAt - now)),
              })
            : t("hud.explore"),
      badge: unread > 0 ? String(unread) : undefined,
      onClick: () => setView(view === "map" ? "base" : "map"),
    },
    {
      id: "squad",
      name: t("action.squad"),
      glyph: "SQ",
      color: "#4a7fb5",
      sub: crewSummary(base, now),
      extra: true,
      panel: "squad",
      onClick: () => openPanel("squad"),
    },
    {
      id: "inventory",
      name: t("action.inventory"),
      glyph: "IN",
      color: "#9aa0a6",
      extra: true,
      panel: "inventory",
      onClick: () => openPanel("inventory"),
    },
    {
      id: "tasks",
      name: t("action.tasks"),
      glyph: "TA",
      color: "#c85a2b",
      sub: t("hud.tasks_done", { done: tasksDone, total: base.tasks.ids.length }),
      extra: true,
      panel: "tasks",
      onClick: () => openPanel("tasks"),
    },
  ];

  return (
    <>
      {/* The hint points at the dock; with a panel open (a sheet on phones) it would cover it. */}
      {hint && !panelOpen && view === "base" ? (
        <p className="glass advice" aria-live="polite">
          {t(`hint.${hint}`)}
        </p>
      ) : null}
      <nav className="glass dock" aria-label={t("hud.actions")}>
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
    </>
  );
}
