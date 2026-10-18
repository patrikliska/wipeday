/**
 * The bus → sound (D224): every event on the bus is looked up in `data/sounds.json5`, its cue
 * template filled from the event, the cue played and its vibration buzzed. Nothing else plays a
 * sound. The first tap starts the sound (inside its own gesture); after it, any press on a later
 * page load wakes the AudioContext.
 */
import { fillCue } from "@wipe-day/content/sounds";
import { clamp } from "../scene/util";
import { type GameEvent, on } from "../state/events";
import { useWorld } from "../state/store";
import { content } from "../state/world";
import { haptics, sound } from "./audio";
import { sounds } from "./map";
import type { CueOptions } from "./voices";

/** How far a tap rises with Hustle (semitones), as the procedural voice does. */
const HUSTLE_SEMITONES = 4;

function optionsFor(event: GameEvent): CueOptions {
  switch (event.type) {
    case "tap_at": {
      const base = useWorld.getState().base;
      const hustle = base ? clamp(base.run.hustle.value / content.tap.hustle.cap, 0, 1) : 0;
      return { target: event.target, hustle, pitch: hustle * HUSTLE_SEMITONES };
    }
    case "felled":
      return { target: event.target };
    case "bought":
      return { bulk: event.count > 1 };
    default:
      return {};
  }
}

/** The cue an event plays, or null for silence. */
export function cueOf(event: GameEvent): { cue: string; buzz?: readonly number[] } | null {
  const entry = sounds.events[event.type];
  if (!entry) return null;
  const cue = fillCue(entry.cue, event as unknown as Record<string, unknown>);
  if (!cue || !sounds.cues[cue]) return null;
  return entry.buzz ? { cue, buzz: entry.buzz } : { cue };
}

function hear(event: GameEvent): void {
  if (event.type === "tap_at") sound.start();
  const played = cueOf(event);
  if (!played) return;
  sound.play(played.cue, optionsFor(event));
  if (played.buzz) haptics.buzz(played.buzz);
}

const onPress = (): void => {
  if (sound.started) sound.unlock();
};

/** Starts listening; returns the stop. */
export function startSound(): () => void {
  const off = on(hear);
  window.addEventListener("pointerdown", onPress, { capture: true });
  window.addEventListener("keydown", onPress, { capture: true });
  return () => {
    off();
    window.removeEventListener("pointerdown", onPress, { capture: true });
    window.removeEventListener("keydown", onPress, { capture: true });
  };
}
