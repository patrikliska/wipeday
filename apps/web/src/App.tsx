import { useEffect, useRef } from "react";
import { DemoDrawer } from "./hud/DemoDrawer";
import { Login } from "./hud/Login";
import { Toasts } from "./hud/Toasts";
import { TapHint, TopBar } from "./hud/TopBar";
import { Scene } from "./scene/Scene";
import { useWorld } from "./state/store";

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const playing = useWorld((state) => state.phase === "playing");

  useEffect(() => {
    void useWorld.getState().boot();
    const onVisibility = () => useWorld.getState().setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
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
            <TapHint />
            <Toasts />
            <DemoDrawer />
          </>
        ) : null}
        <Login />
      </div>
    </div>
  );
}
