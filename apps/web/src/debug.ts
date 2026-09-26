/**
 * Dev-only hook for the screenshot script and for poking the prototype from
 * the console: `__wipeDay.store.getState().jumpTier("hqm")`.
 */
import { demoClocks } from "./state/clocks";
import { useWorld } from "./state/store";

interface DebugHook {
  store: typeof useWorld;
  /** The demo clocks: shots pause them and set the time (`clocks.game.set(seconds)`). */
  clocks: typeof demoClocks;
  /** Frames rendered since load; the screenshot script waits for this to move. */
  frames: number;
  /** Stops scene motion (rendering goes on), so a screenshot and its crop show the same moment. */
  frozen: boolean;
  /** Screen position (CSS px) of the active node marker, for shots that hit it. */
  nodeMarker?: () => { x: number; y: number } | null;
}

declare global {
  interface Window {
    __wipeDay?: DebugHook;
  }
}

export function installDebug(): void {
  if (!import.meta.env.DEV) return;
  window.__wipeDay = { store: useWorld, clocks: demoClocks, frames: 0, frozen: false };
}

export function isFrozen(): boolean {
  return window.__wipeDay?.frozen === true;
}

export function countFrame(): void {
  const hook = window.__wipeDay;
  if (hook) hook.frames += 1;
}
