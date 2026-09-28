import { useEffect, useRef } from "react";
import { AwayModal } from "./hud/AwayModal";
import { DemoDrawer } from "./hud/DemoDrawer";
import { Dock } from "./hud/Dock";
import { Login } from "./hud/Login";
import { Panel } from "./hud/Panel";
import { Toasts } from "./hud/Toasts";
import { TopBar } from "./hud/TopBar";
import { Scene } from "./scene/Scene";
import { useWorld } from "./state/store";

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const playing = useWorld((state) => state.phase === "playing");

  useEffect(() => {
    void useWorld.getState().boot();
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const scene = new Scene(element);
    void scene.init();
    return () => scene.destroy();
  }, []);

  return (
    <div className="app">
      <div className="scene" ref={host} />
      <div className="vignette" />
      <div className="hud">
        {playing ? (
          <>
            <TopBar />
            <Toasts />
            <Panel />
            <Dock />
            <DemoDrawer />
            <AwayModal />
          </>
        ) : null}
        <Login />
      </div>
    </div>
  );
}
