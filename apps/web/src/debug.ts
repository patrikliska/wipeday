/**
 * Dev-only hook for the screenshot script and for poking the game from the console:
 * `__wipeDay.store.getState().demoPatch({ supplies: 1e6 })` (demo mode).
 */
import { demoClocks } from "./state/clocks";
import { useWorld } from "./state/store";

interface DebugHook {
  store: typeof useWorld;
  /** The demo's clocks: `game` (what the rules see) and `wall` (animation). Shots pin both. */
  clocks: typeof demoClocks;
  /** Frames rendered since load; the screenshot script waits for this to move. */
  frames: number;
  /** Stops scene motion (rendering goes on), so a screenshot and its crop show the same moment. */
  frozen: boolean;
  /** Taps through the store at the screen point `x, y` (CSS px), as a player would. */
  tap?: (count: number, x: number, y: number) => void;
}

declare global {
  interface Window {
    __wipeDay?: DebugHook;
  }
}

export function installDebug(): void {
  if (!import.meta.env.DEV) return;
  window.__wipeDay = {
    store: useWorld,
    clocks: demoClocks,
    frames: 0,
    frozen: false,
    tap: (count, x, y) => useWorld.getState().tap(count, x, y),
  };
}

export function isFrozen(): boolean {
  return window.__wipeDay?.frozen === true;
}

export function countFrame(): void {
  const hook = window.__wipeDay;
  if (hook) hook.frames += 1;
}
