/**
 * Welcome back (docs/redesign/02-the-run.md 10.2; CLAUDE.md 6.3 rule 10): after an hour or more
 * away, one card says what the hands made and whether the Night Shift ran out, with one Collect
 * (the primary; never the nuke). `collect` is an ordinary command: it restarts the window and
 * clears the card, since the card only shows while the last command is that far back.
 */
import type { Content } from "@wipe-day/content/schema";
import type { Amount } from "./amount";
import { rates } from "./effects";
import type { GameEvent } from "./events";
import type { BaseState } from "./state";

export interface WelcomeBack {
  /** Seconds since the last command. */
  awaySeconds: number;
  /** Supplies made since the last command (taps before it are not counted). */
  gain: Amount;
  /** Seconds the hands worked (at most the window), the window, and whether it ran out. */
  nightShift: { worked: number; window: number; full: boolean };
  /** Lines manned: none means nobody was on shift. */
  hands: number;
  /** What happened while away, oldest first. */
  events: GameEvent[];
}

/** The card for a base settled to `now`, or null when the player was not away long enough. */
export function welcomeBack(
  content: Content,
  state: BaseState,
  now: number,
  events: GameEvent[] = [],
): WelcomeBack | null {
  const away = now - state.run.activeAt;
  if (away < content.run.nightShift.welcomeAfterMinutes * 60) return null;
  const window = rates(content, state).nightShift;
  return {
    awaySeconds: away,
    gain: Math.max(0, state.run.made - state.run.madeAtActive),
    nightShift: { worked: Math.min(away, window), window, full: away >= window },
    hands: state.run.hands.length,
    events,
  };
}
