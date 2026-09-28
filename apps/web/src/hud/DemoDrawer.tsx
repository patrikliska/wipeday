import { useState } from "react";
import { demoClocks } from "../state/clocks";
import { useWorld } from "../state/store";
import { content, TIERS, t, tierName } from "../state/world";

const WEATHERS = ["clear", "rain", "fog"] as const;

/** Showcase controls for demo mode: time, weather, tier. Not part of the game UI. */
export function DemoDrawer() {
  const mode = useWorld((state) => state.mode);
  const open = useWorld((state) => state.demoOpen);
  const setOpen = useWorld((state) => state.setDemoOpen);
  // Time controls drive the demo game clock itself; the store only reads it.
  const clock = demoClocks.game;
  const [timeScale, setScaleShown] = useState(clock.scale);
  const [paused, setPausedShown] = useState(clock.paused);
  const weather = useWorld((state) => state.weather);
  const setWeather = useWorld((state) => state.setWeather);
  const tier = useWorld((state) => state.base.tier);
  const now = useWorld((state) => Math.floor(state.now));
  const patch = useWorld((state) => state.demoPatch);
  if (mode !== "demo") return null;

  const setTimeScale = (scale: number) => {
    clock.setScale(scale);
    setScaleShown(scale);
  };
  const setPaused = (next: boolean) => {
    clock.setPaused(next);
    setPausedShown(next);
  };
  const giveEverything = () => {
    const stock: Record<string, number> = {};
    for (const resource of content.resources) stock[resource.id] = 50_000;
    patch({
      stock,
      items: {
        workbench_1: 1,
        workbench_2: 1,
        crate: 6,
        campfire: 1,
        kiln: 1,
        press: 1,
        lantern: 1,
      },
      toolId: content.tools[2]?.id ?? "rock",
      furnaceId: content.furnaces[0]?.id ?? null,
    });
  };

  return (
    <>
      <button
        type="button"
        className={`glass demo-toggle${open ? " active" : ""}`}
        onClick={() => setOpen(!open)}
        title={t("demo.title")}
        aria-label={t("demo.title")}
      >
        ✦
      </button>
      {open ? (
        <div className="glass demo">
          <h3>{t("demo.title")}</h3>
          <label>
            {t("demo.speed")} <span className="num">{timeScale}×</span>
            <input
              type="range"
              min={1}
              max={2400}
              step={1}
              value={timeScale}
              onChange={(event) => setTimeScale(Number(event.target.value))}
            />
          </label>
          <div className="buttons">
            <button type="button" className="btn small" onClick={() => setPaused(!paused)}>
              {paused ? t("demo.play") : t("demo.pause")}
            </button>
            <button type="button" className="btn small" onClick={() => clock.advance(3600)}>
              +1 h
            </button>
            <button type="button" className="btn small" onClick={() => clock.advance(6 * 3600)}>
              +6 h
            </button>
          </div>
          <h3>{t("demo.weather")}</h3>
          <div className="buttons">
            {WEATHERS.map((option) => (
              <button
                key={option}
                type="button"
                className={`btn small${weather === option ? " selected" : ""}`}
                onClick={() => setWeather(option)}
              >
                {t(`weather.${option}`)}
              </button>
            ))}
          </div>
          <h3>{t("demo.tier")}</h3>
          <div className="buttons">
            {TIERS.map((id) => (
              <button
                key={id}
                type="button"
                className={`btn small${tier === id ? " selected" : ""}`}
                onClick={() => patch({ tier: id, build: null })}
              >
                {tierName(id)}
              </button>
            ))}
          </div>
          <h3>{t("demo.world")}</h3>
          <div className="buttons">
            <button
              type="button"
              className="btn small"
              onClick={() =>
                patch({ barrel: { spawnedAt: now, expiresAt: now + 45 * 60, seed: now } })
              }
            >
              {t("demo.barrel")}
            </button>
            <button type="button" className="btn small" onClick={giveEverything}>
              {t("demo.give")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
