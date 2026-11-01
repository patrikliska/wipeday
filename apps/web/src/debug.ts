/**
 * Dev-only hook for the screenshot script and for poking the game from the console:
 * `__wipeDay.store.getState().demoPatch({ supplies: 1e6 })` (demo mode).
 */

import { TIERS } from "@wipe-day/content/tiers";
import { badgeMet } from "@wipe-day/domain/badges";
import type { NukedEvent } from "@wipe-day/domain/events";
import { arrivalKind } from "@wipe-day/domain/flotsam";
import { crossing, gullAt } from "@wipe-day/domain/gulls";
import { questOf } from "@wipe-day/domain/quests";
import { islandDay, weatherAt } from "@wipe-day/domain/weather";
import { filmLength, type Variant } from "./scene/cinematic";
import { HOLD_MS, useBigRed } from "./state/bigred";
import { demoClocks, wall } from "./state/clocks";
import { useMap } from "./state/map";
import { seedPace } from "./state/pace";
import { useReveal } from "./state/reveal";
import { useWorld } from "./state/store";
import { useUi } from "./state/ui";
import { content } from "./state/world";

interface DebugHook {
  store: typeof useWorld;
  /** The HUD's own state: drawer, tab, bulk, panel, sheet and display settings. */
  ui: typeof useUi;
  /** Where the Blast Map is open: a sector's ladder, a node's sheet, a filter (R4 S3). */
  map: typeof useMap;
  /** As if the player had tapped this many times a second for the last minute (the crown). */
  pace: (tapsPerSecond: number) => void;
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
  /** The first flotsam arrival (from 1) of `kind` in this run, past run 1's crates. */
  flotsamK: (kind: string) => number;
  /**
   * When the run must have started for a crow (or with `elite`, a Magpie) to be `age` seconds
   * into its crossing at `time` (D238), at least `minAge` seconds into the run.
   */
  gullStart: (time: number, age: number, elite: boolean, minAge?: number) => number;
  /** The crow crossing now, as a claim names it, or null. */
  gullNow: () => { run: number; k: number } | null;
  /** Marks every badge the base already meets as earned (`at`), but `except`: shots of one toast. */
  fillBadges: (at: number, except?: string[]) => void;
  /** Opens a held drop of `tier` through the reveal (D261), as a tap on the crates does. */
  openDrop: (tier: 1 | 2 | 3) => void;
  /**
   * The Big Red's show (R4, D270; 03-the-big-red.md 7.5): `open` the card as the drum would;
   * `hold` the lid up with the ring at `fraction`; `pin` the film at `ms` for a variant (null
   * unpins); `postcard` after a press (the event's fields overriding a Wipe Day #1 sample);
   * `land` the landing at `ms` on the fresh island.
   */
  bigRed: {
    open: () => void;
    hold: (fraction: number) => void;
    pin: (variant: Variant, ms: number | null, event?: Partial<NukedEvent>) => void;
    postcard: (event?: Partial<NukedEvent>, flipped?: boolean) => void;
    land: (ms: number | null) => void;
  };
  /** Turns card `index` of the open reveal over, as a tap on it would. */
  reveal: (index: number) => void;
  /**
   * The day's quests as a shot wants them at game second `time`: these ids, these claimed, the
   * set paid or not, and each quest's progress today (its counter's growth since the roll).
   */
  setQuests: (
    time: number,
    quests: {
      ids: string[];
      claimed?: string[];
      setPaid?: boolean;
      progress?: Record<string, number>;
    },
  ) => void;
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
    ui: useUi,
    map: useMap,
    pace: (tapsPerSecond) => seedPace(tapsPerSecond, wall.nowMs()),
    clocks: demoClocks,
    frames: 0,
    frozen: false,
    weatherAt: (t) => weatherAt(content, t),
    flotsamK: (kind) => {
      const base = useWorld.getState().base;
      if (!base) return 1;
      const past = {
        ...base,
        run: { ...base.run, flotsam: { ...base.run.flotsam, caught: 1 } },
      };
      for (let k = 1; k < 500; k++) if (arrivalKind(content, past, k).id === kind) return k;
      return 1;
    },
    gullStart: (time, age, elite, minAge = 0) => {
      const base = useWorld.getState().base;
      if (!base) return time;
      for (let k = 0; k < 2000; k++) {
        const slot = crossing(content, base, 0, k);
        if (slot.elite === elite && slot.at + age >= minAge) return time - age - slot.at;
      }
      return time;
    },
    gullNow: () => {
      const base = useWorld.getState().base;
      if (!base) return null;
      const slot = gullAt(content, base, Math.floor(demoClocks.game.now()));
      return slot ? { run: base.run.n, k: slot.k } : null;
    },
    setQuests: (time, quests) => {
      const current = useWorld.getState().base;
      if (!current) return;
      const snapshot = { ...current.meta.stats };
      for (const [id, value] of Object.entries(quests.progress ?? {})) {
        const quest = questOf(content, id);
        if (quest) snapshot[quest.stat] = current.meta.stats[quest.stat] - value;
      }
      useWorld.getState().demoPatch(
        {},
        {
          quests: {
            day: islandDay(content, time),
            ids: quests.ids,
            claimed: quests.claimed ?? [],
            snapshot,
            setPaid: quests.setPaid ?? false,
          },
        },
      );
    },
    openDrop: (tier) => useReveal.getState().start(tier),
    reveal: (index) => useReveal.getState().flip(index),
    bigRed: {
      open: () => useBigRed.getState().openCard(),
      hold: (fraction) => {
        const big = useBigRed.getState();
        big.openCard();
        big.flipLid();
        useBigRed.setState({ holdSince: wall.nowMs() - fraction * HOLD_MS });
      },
      pin: (variant, ms, event) => useBigRed.getState().pin(variant, ms, event),
      postcard: (event = {}, flipped = false) => {
        const big = useBigRed.getState();
        // The film's last frame first, so the island behind the card is the crater.
        const variant = (event.flight as Variant | undefined) ?? "u_turn";
        big.pin(variant, filmLength(variant, false) - 1, event);
        window.__wipeDay?.fastForward?.(1 / 60);
        if (!useBigRed.getState().film) return;
        useBigRed.getState().filmEnded();
        if (flipped) useBigRed.getState().flipPostcard();
      },
      land: (ms) => useBigRed.getState().pinLanding(ms),
    },
    fillBadges: (at, except = []) => {
      const current = useWorld.getState().base;
      if (!current) return;
      // Lifetime counters at least what the run shows (a shot patches the run, not its past).
      const { run, meta } = current;
      const owned = Object.values(run.lines).reduce((sum, n) => sum + n, 0);
      const stats = {
        ...meta.stats,
        units: Math.max(meta.stats.units, owned),
        hands: Math.max(meta.stats.hands, run.hands.length),
        taps: Math.max(meta.stats.taps, run.taps),
        felled: Math.max(meta.stats.felled, run.target.felled),
        research: Math.max(
          meta.stats.research,
          Object.values(run.research).reduce((sum, n) => sum + n, 0),
        ),
        upgrades: Math.max(meta.stats.upgrades, run.upgrades.length),
        eras: Math.max(meta.stats.eras, TIERS.indexOf(run.era)),
      };
      const base = { ...current, meta: { ...meta, stats } };
      const badges = { ...meta.badges };
      for (const badge of content.achievements.badges)
        if (!except.includes(badge.id) && badgeMet(content, badge, base, [], at))
          badges[badge.id] = at;
      useWorld.getState().demoPatch({}, { stats, badges });
    },
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
