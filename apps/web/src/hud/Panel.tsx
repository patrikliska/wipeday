import { useWorld } from "../state/store";
import { t } from "../state/world";
import { BuildPanel } from "./panels/Build";
import { CraftPanel } from "./panels/Craft";
import { DefencePanel } from "./panels/Defence";
import { DenPanel } from "./panels/Den";
import { IslandPanel } from "./panels/Feed";
import { FurnacePanel } from "./panels/Furnace";
import { InventoryPanel } from "./panels/Inventory";
import { MapPanel } from "./panels/MapPanel";
import { SignalPanel } from "./panels/Signal";
import { SquadPanel } from "./panels/Squad";
import { TasksPanel } from "./panels/Tasks";

/** The one side panel (bottom sheet on phones). Opened from the dock or top bar. */
export function Panel() {
  const panel = useWorld((state) => state.panel);
  const openPanel = useWorld((state) => state.openPanel);
  if (!panel) return null;
  const title = t(`panel.${panel}`);
  return (
    <aside className="glass panel" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          className="close"
          onClick={() => openPanel(panel)}
          aria-label={t("hud.close")}
        >
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
        {panel === "map" ? <MapPanel /> : null}
        {panel === "feed" ? <IslandPanel /> : null}
        {panel === "den" ? <DenPanel /> : null}
        {panel === "defence" ? <DefencePanel /> : null}
        {panel === "signal" ? <SignalPanel /> : null}
      </div>
    </aside>
  );
}
