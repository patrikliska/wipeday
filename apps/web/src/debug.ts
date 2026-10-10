/**
 * Dev-only hook for the screenshot script and for poking the game from the console:
 * `__wipeDay.store.getState().demoPatch({ supplies: 1e6 })` (demo mode).
 */
import { weatherAt } from "@wipe-day/domain/weather";
import { demoClocks } from "./state/clocks";
import { useWorld } from "./state/store";
import { content } from "./state/world";

interface DebugHook {
  store: typeof useWorld;
  /** The demo's clocks: `game` (what the rules see) and `wall` (animation). Shots pin both. */
  clocks: typeof demoClocks;
  /** Frames rendered since load; the screenshot script waits for this to move. */
  frames: number;
  /** Stops scene motion (rendering goes on), so a screenshot and its crop show the same moment. */
  frozen: boolean;
  /** Taps through the store at the screen point `x, y` (CSS px); the target's centre without. */
  tap?: (count: number, x?: number, y?: number) => void;
  /** The target's tap box on screen (CSS px). */
  target?: () => Box;
  /** Every tap area the scene draws (CSS px), for the 44 px audit. */
  hitBoxes?: () => Array<Box & { name: string }>;
  /** Live floaters and particles (the budgets: 12 and 160). */
  counts?: () => { floaters: number; particles: number };
  /** Plays `seconds` of scene time in 60 fps steps at once, then pins the wall clock there. */
  fastForward?: (seconds: number) => void;
  /** The island's weather at a game second, so shots can pick a rainy or foggy moment. */
  weatherAt: (t: number) => string;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the scene lends the hook once it is up. */
export interface SceneHooks {
  target: () => Box;
  hitBoxes: () => Array<Box & { name: string }>;
  counts: () => { floaters: number; particles: number };
  fastForward: (seconds: number, tick?: (dt: number) => void) => void;
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
    weatherAt: (t) => weatherAt(content, t),
    tap: (count, x, y) => {
      const box = window.__wipeDay?.target?.();
      const cx = x ?? (box ? box.x + box.width / 2 : 0);
      const cy = y ?? (box ? box.y + box.height / 2 : 0);
      useWorld.getState().tap(count, cx, cy);
    },
  };
}

export function registerScene(hooks: SceneHooks): void {
  const hook = window.__wipeDay;
  if (!hook) return;
  hook.target = hooks.target;
  hook.hitBoxes = hooks.hitBoxes;
  hook.counts = hooks.counts;
  // Time passes for the rules too: the demo's game clock moves with each step.
  hook.fastForward = (seconds) => hooks.fastForward(seconds, (dt) => demoClocks.game.advance(dt));
}

export function isFrozen(): boolean {
  return window.__wipeDay?.frozen === true;
}

export function countFrame(): void {
  const hook = window.__wipeDay;
  if (hook) hook.frames += 1;
}
