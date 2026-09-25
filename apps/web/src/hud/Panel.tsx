import { type Panel as PanelId, useWorld } from "../state/store";
import { BuildPanel } from "./panels/Build";
import { CraftPanel } from "./panels/Craft";
import { FurnacePanel } from "./panels/Furnace";
import { InventoryPanel } from "./panels/Inventory";
import { SquadPanel } from "./panels/Squad";
import { TasksPanel } from "./panels/Tasks";

const TITLES: Record<NonNullable<PanelId>, string> = {
  build: "Build",
  craft: "Craft",
  furnace: "Furnace",
  inventory: "Inventory",
  tasks: "Daily tasks",
  squad: "Squad",
  map: "Map",
};

/** The one side panel (bottom sheet on phones). Opened from the dock or top bar. */
export function Panel() {
  const panel = useWorld((state) => state.panel);
  const openPanel = useWorld((state) => state.openPanel);
  if (!panel) return null;
  return (
    <aside className="glass panel" aria-label={TITLES[panel]}>
      <header>
        <h2>{TITLES[panel]}</h2>
        <button type="button" className="close" onClick={() => openPanel(panel)} aria-label="Close">
          ×
        </button>
      </header>
      <div className="body">
        {panel === "build" ? <BuildPanel /> : null}
        {panel === "craft" ? <CraftPanel /> : null}
        {panel === "furnace" ? <FurnacePanel /> : null}
        {panel === "inventory" ? <InventoryPanel /> : null}
        {panel === "tasks" ? <TasksPanel /> : null}
        {panel === "squad" ? <SquadPanel /> : null}
        {panel === "map" ? <p className="hint">The map arrives with expeditions.</p> : null}
      </div>
    </aside>
  );
}
