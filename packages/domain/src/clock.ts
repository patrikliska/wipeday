/**
 * Where "now" comes from. Nothing in the game reads `Date.now()` itself: the
 * process that owns time (the API, the bot, the web client, the simulator,
 * a test) builds one `Clock` and injects it. Domain functions still take a
 * plain `now` argument; the caller reads it from its clock once per action,
 * so one action sees one instant.
 *
 * Three implementations:
 * - `systemClock`: real time, for servers and production clients.
 * - `manualClock`: moves only when told to, for tests and the simulator.
 * - `scaledClock`: runs faster, pauses and jumps, for the web demo drawer
 *   and the screenshot script. Never used for anything a server trusts.
 */

export interface Clock {
  /** Whole seconds since the Unix epoch (UTC). What game state stores. */
  now(): number;
  /** Milliseconds since the Unix epoch, fractional allowed. For smooth animation only. */
  nowMs(): number;
}

export const systemClock: Clock = {
  now: () => Math.floor(Date.now() / 1000),
  nowMs: () => Date.now(),
};

export interface ManualClock extends Clock {
  /** Jumps to `seconds` since the epoch. */
  set(seconds: number): void;
  /** Moves forward (or back, if negative) by `seconds`. */
  advance(seconds: number): void;
}

/** A clock that stands still at `start` (unix seconds) until moved. */
export function manualClock(start: number): ManualClock {
  let ms = start * 1000;
  return {
    now: () => Math.floor(ms / 1000),
    nowMs: () => ms,
    set: (seconds) => {
      ms = seconds * 1000;
    },
    advance: (seconds) => {
      ms += seconds * 1000;
    },
  };
}

export interface ScaledClock extends ManualClock {
  /** Clock seconds per `source` second. */
  readonly scale: number;
  readonly paused: boolean;
  setScale(scale: number): void;
  setPaused(paused: boolean): void;
}

/**
 * A clock that runs `scale` times faster than `source` (real time by default),
 * starting at `start` (unix seconds). Changing speed or pausing never makes it
 * jump: it re-anchors at the current reading first.
 */
export function scaledClock(options: {
  start: number;
  scale?: number;
  source?: Clock;
}): ScaledClock {
  const source = options.source ?? systemClock;
  let scale = options.scale ?? 1;
  let paused = false;
  let anchorMs = options.start * 1000;
  let anchorSourceMs = source.nowMs();

  const nowMs = (): number =>
    paused ? anchorMs : anchorMs + (source.nowMs() - anchorSourceMs) * scale;
  const reanchor = (ms: number): void => {
    anchorMs = ms;
    anchorSourceMs = source.nowMs();
  };

  return {
    now: () => Math.floor(nowMs() / 1000),
    nowMs,
    get scale() {
      return scale;
    },
    get paused() {
      return paused;
    },
    set: (seconds) => reanchor(seconds * 1000),
    advance: (seconds) => reanchor(nowMs() + seconds * 1000),
    setScale: (next) => {
      reanchor(nowMs());
      scale = next;
    },
    setPaused: (next) => {
      reanchor(nowMs());
      paused = next;
    },
  };
}
