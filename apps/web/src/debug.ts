/**
 * Dev-only hook for the screenshot script and for poking the prototype from
 * the console: `__wipeDay.store.getState().jumpTier("hqm")`.
 */
import { useWorld } from "./state/store";

interface DebugHook {
  store: typeof useWorld;
  /** Frames rendered since load; the screenshot script waits for this to move. */
  frames: number;
}

declare global {
  interface Window {
    __wipeDay?: DebugHook;
  }
}

export function installDebug(): void {
  if (!import.meta.env.DEV) return;
  window.__wipeDay = { store: useWorld, frames: 0 };
}

export function countFrame(): void {
  const hook = window.__wipeDay;
  if (hook) hook.frames += 1;
}
