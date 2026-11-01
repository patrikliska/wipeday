import { useEffect, useRef } from "react";
import { BadgeToast } from "./hud/BadgeToast";
import { BigRedChip, BigRedSheet } from "./hud/BigRed";
import { Cinematic } from "./hud/Cinematic";
import { Credits } from "./hud/Credits";
import { DemoDrawer } from "./hud/DemoDrawer";
import { Dock } from "./hud/Dock";
import { EraSheet } from "./hud/Era";
import { GearSheet } from "./hud/Gear";
import { Login } from "./hud/Login";
import { Multipliers } from "./hud/Multipliers";
import { Odds } from "./hud/Odds";
import { OrdersSheet } from "./hud/Orders";
import { Panels } from "./hud/Panels";
import { PostcardSheet } from "./hud/Postcard";
import { RevealSheet } from "./hud/Reveal";
import { RoomBar } from "./hud/RoomBar";
import { ScrapSheet } from "./hud/Scrap";
import { Shop, shopOpen } from "./hud/Shop";
import { SurvivorSheet } from "./hud/Survivor";
import { Toasts } from "./hud/Toasts";
import { TapHint, TopBar } from "./hud/TopBar";
import { Welcome } from "./hud/Welcome";
import { Scene } from "./scene/Scene";
import { startSound } from "./sound/director";
import { startAdvisor, useAdvisor } from "./state/advisor";
import { resendPending, useBigRed, watchAnswers } from "./state/bigred";
import { useColumn } from "./state/layout";
import { useWorld } from "./state/store";
import { closeTop, installBack, useUi } from "./state/ui";
import { startUiEvents } from "./state/uiEvents";

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const playing = useWorld((state) => state.phase === "playing");
  const sheet = useUi((state) => state.sheet);
  const welcome = useWorld((state) => state.welcome !== null);
  const panel = useUi((state) => state.panel);
  const motion = useUi((state) => state.motion);
  const column = useColumn();
  const shop = useAdvisor((state) => shopOpen(state.view));
  // The show (R4, D270): the film and the postcard hide the HUD; the landing brings it back.
  const show = useBigRed((state) => state.phase);
  const showing = show === "film" || show === "postcard";

  useEffect(() => {
    void useWorld.getState().boot();
    const onVisibility = () => useWorld.getState().setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    const stopAdvisor = startAdvisor();
    const stopSound = startSound();
    const stopUiEvents = startUiEvents();
    const stopAnswers = watchAnswers();
    // A press the last page load never saw answered goes again once the island is in (03 7.7).
    let resent = false;
    const stopResend = useWorld.subscribe((state) => {
      if (resent || state.phase !== "playing" || !state.base) return;
      resent = true;
      resendPending();
    });
    const removeBack = installBack();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopAdvisor();
      stopSound();
      stopUiEvents();
      stopAnswers();
      stopResend();
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
      className={`app${motion === "reduced" ? " reduced" : ""}${column && shop ? " has-column" : ""}${welcome ? " welcome-open" : ""}${showing ? " showing" : ""}${show === "landing" ? " landing" : ""}`}
    >
      <div className="scene" ref={host} />
      <div className="vignette" />
      <div className="hud">
        {playing ? (
          <>
            {/* Under a panel, a sheet or the welcome card the rest of the HUD is inert: one view,
                one crown (6.3 rule 1). The dock stays live under a panel: it is the way between
                destinations (D187). The film has no HUD at all. */}
            <div
              className="hud-main"
              inert={panel !== null || sheet !== null || welcome || show !== "idle"}
            >
              <TopBar />
              <TapHint />
              <RoomBar />
              <Shop />
              {/* The Big Red's chip on a phone: above the drawer (the column carries its own). */}
              {column ? null : <BigRedChip />}
            </div>
            <div className="panel-layer" inert={sheet !== null || welcome || show !== "idle"}>
              <Panels />
            </div>
            <div className="dock-layer" inert={sheet !== null || welcome || show !== "idle"}>
              <Dock />
            </div>
            <Multipliers />
            <Odds />
            <Credits />
            <EraSheet />
            <OrdersSheet />
            <ScrapSheet />
            <RevealSheet />
            <SurvivorSheet />
            <GearSheet />
            <BigRedSheet />
            <PostcardSheet />
            <Cinematic />
            <Toasts />
            <BadgeToast />
            <Welcome />
            <DemoDrawer />
          </>
        ) : null}
        <Login />
      </div>
    </div>
  );
}

/**
 * Escape closes the top layer (08-screens.md 1.7). No key buys: the game never picks a purchase
 * for the player (D244).
 */
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
  }
}
