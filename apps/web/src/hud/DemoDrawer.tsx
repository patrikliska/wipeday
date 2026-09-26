import { useState } from "react";
import { demoClocks } from "../state/clocks";
import { useWorld } from "../state/store";
import { BASE_TIERS } from "../state/world";

const WEATHERS = ["clear", "rain", "fog"] as const;

/** Showcase controls: time, weather, tier. Not part of the game UI. */
export function DemoDrawer() {
  const open = useWorld((state) => state.demoOpen);
  const setOpen = useWorld((state) => state.setDemoOpen);
  // Time controls drive the demo game clock itself; the store only reads it.
  const clock = demoClocks.game;
  const [timeScale, setScaleShown] = useState(clock.scale);
  const [paused, setPausedShown] = useState(clock.paused);
  const setTimeScale = (scale: number) => {
    clock.setScale(scale);
    setScaleShown(scale);
  };
  const setPaused = (next: boolean) => {
    clock.setPaused(next);
    setPausedShown(next);
  };
  const addHours = (hours: number) => clock.advance(hours * 3600);
  const weather = useWorld((state) => state.weather);
  const setWeather = useWorld((state) => state.setWeather);
  const tier = useWorld((state) => state.tier);
  const jumpTier = useWorld((state) => state.jumpTier);
  const spawnBarrel = useWorld((state) => state.spawnBarrel);
  const giveEverything = useWorld((state) => state.giveEverything);

  return (
    <>
      <button
        type="button"
        className={`glass demo-toggle${open ? " active" : ""}`}
        onClick={() => setOpen(!open)}
        title="Demo controls"
        aria-label="Demo controls"
      >
        ✦
      </button>
      {open ? (
        <div className="glass demo">
          <h3>Demo controls</h3>
          <label>
            Time speed <span className="num">{timeScale}×</span>
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
              {paused ? "Play" : "Pause"}
            </button>
            <button type="button" className="btn small" onClick={() => addHours(1)}>
              +1 h
            </button>
            <button type="button" className="btn small" onClick={() => addHours(6)}>
              +6 h
            </button>
          </div>
          <h3>Weather</h3>
          <div className="buttons">
            {WEATHERS.map((option) => (
              <button
                key={option}
                type="button"
                className={`btn small${weather === option ? " selected" : ""}`}
                onClick={() => setWeather(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <h3>Base tier</h3>
          <div className="buttons">
            {BASE_TIERS.map((info) => (
              <button
                key={info.id}
                type="button"
                className={`btn small${tier === info.id ? " selected" : ""}`}
                onClick={() => jumpTier(info.id)}
              >
                {info.name}
              </button>
            ))}
          </div>
          <h3>World</h3>
          <div className="buttons">
            <button type="button" className="btn small" onClick={spawnBarrel}>
              Barrel
            </button>
            <button type="button" className="btn small" onClick={giveEverything}>
              Give all
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
