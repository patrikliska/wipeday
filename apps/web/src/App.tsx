import { useEffect, useRef } from "react";
import { DemoDrawer } from "./hud/DemoDrawer";
import { Dock } from "./hud/Dock";
import { Login } from "./hud/Login";
import { Multipliers } from "./hud/Multipliers";
import { Odds } from "./hud/Odds";
import { Panels } from "./hud/Panels";
import { RoomBar } from "./hud/RoomBar";
import { Shop, shopOpen } from "./hud/Shop";
import { Toasts } from "./hud/Toasts";
import { TapHint, TopBar } from "./hud/TopBar";
import { Welcome } from "./hud/Welcome";
import { Scene } from "./scene/Scene";
import { startAdvisor, useAdvisor } from "./state/advisor";
import { useColumn } from "./state/layout";
import { useWorld } from "./state/store";
import { closeTop, installBack, useUi } from "./state/ui";

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const playing = useWorld((state) => state.phase === "playing");
  const sheet = useUi((state) => state.sheet);
  const welcome = useWorld((state) => state.welcome !== null);
  const panel = useUi((state) => state.panel);
  const motion = useUi((state) => state.motion);
  const column = useColumn();
  const shop = useAdvisor((state) => shopOpen(state.view));

  useEffect(() => {
    void useWorld.getState().boot();
    const onVisibility = () => useWorld.getState().setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    const stopAdvisor = startAdvisor();
    const removeBack = installBack();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopAdvisor();
      removeBack();
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const scene = new Scene(element);
    void scene.init();
    return () => scene.destroy();
  }, []);

  return (
    <div
      className={`app${motion === "reduced" ? " reduced" : ""}${column && shop ? " has-column" : ""}${welcome ? " welcome-open" : ""}`}
    >
      <div className="scene" ref={host} />
      <div className="vignette" />
      <div className="hud">
        {playing ? (
          <>
            {/* Under a panel, a sheet or the welcome card the rest of the HUD is inert: one view,
                one crown (6.3 rule 1). The dock stays live under a panel: it is the way between
                destinations (D187). */}
            <div className="hud-main" inert={panel !== null || sheet !== null || welcome}>
              <TopBar />
              <TapHint />
              <RoomBar />
              <Shop />
            </div>
            <div className="panel-layer" inert={sheet !== null || welcome}>
              <Panels />
            </div>
            <div className="dock-layer" inert={sheet !== null || welcome}>
              <Dock />
            </div>
            <Multipliers />
            <Odds />
            <Toasts />
            <Welcome />
            <DemoDrawer />
          </>
        ) : null}
        <Login />
      </div>
    </div>
  );
}

/** Escape closes the top layer; B buys the crowned row (08-screens.md 1.7). */
function onKey(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select")) return;
  if (event.key === "Escape") {
    // The welcome card has one way out, Collect, and Escape takes it (08-screens.md 2.14).
    if (useWorld.getState().welcome) {
      useWorld.getState().collect();
      event.preventDefault();
      return;
    }
    if (closeTop()) event.preventDefault();
    return;
  }
  if (
    (event.key === "b" || event.key === "B") &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    const pick = useAdvisor.getState().view?.pick;
    const ui = useUi.getState();
    if (pick?.kind !== "purchase" || !pick.choice.affordable || ui.sheet || ui.panel) return;
    if (useWorld.getState().welcome) return;
    const command = pick.choice.command;
    useWorld
      .getState()
      .send(command.type === "buy_line" ? { ...command, count: ui.bulk } : command);
  }
}
