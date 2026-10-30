/**
 * The Big Red's show on the client (docs/redesign/03-the-big-red.md 5-9; D270): the card, the
 * hold, the film, the postcard and the landing, as one small flow. The rules (what a press pays,
 * whether it counts, the flight) are the domain's; this store only knows where in the show the
 * player is, on the `wall` clock, and never the game clock (rule 6.3.9).
 *
 * The press (03 7.7): one hold mints one idempotency key, kept in `sessionStorage` with the
 * command until answered; `nuke` is predicted and the film plays before the answer. A reload
 * mid-film resends the same key; a replay returns the stored outcome and its `nuked` event, so
 * the unseen postcard shows without the film. A refusal (`stale_run`: another tab pressed)
 * cuts the film to a toast. Another tab's Wipe Day arrives as a push with its `nuked` event:
 * a toast offers its postcard.
 */

import type { NukedEvent } from "@wipe-day/domain/events";
import { keptHands } from "@wipe-day/domain/prestige";
import type { BaseState } from "@wipe-day/domain/state";
import { create } from "zustand";
import { newKey } from "../net/backend";
import { filmLength, skipTo, VARIANTS, type Variant } from "../scene/cinematic";
import { reducedMotion } from "../scene/util";
import { wall } from "./clocks";
import { emit, on } from "./events";
import { useWorld } from "./store";
import { closeAll, useUi } from "./ui";
import { content, crewName, t } from "./world";

export type Phase = "idle" | "film" | "postcard" | "landing";

/** The hold must last this long (ms); with "tap twice" the second tap comes within ARM_MS. */
export const HOLD_MS = 2000;
export const ARM_MS = 3000;
/** The landing (03 9.2). */
export const LANDING_MS = 2600;
const LANDING_REDUCED_MS = 600;

const PENDING_KEY = "wipeday.nuke";
const LINES_KEY = "wipeday.lines";
/** The crew's one-liners (03 6), each with its speaker, never repeating within six holds. */
const LINES: readonly { line: number; crew: string }[] = [
  { line: 1, crew: "dax" },
  { line: 2, crew: "ivo" },
  { line: 3, crew: "mara" },
  { line: 4, crew: "rook" },
  { line: 5, crew: "sela" },
  { line: 6, crew: "bram" },
  { line: 7, crew: "wren" },
  { line: 8, crew: "otto" },
  { line: 9, crew: "juno" },
  { line: 10, crew: "pike" },
  { line: 11, crew: "hale" },
  { line: 12, crew: "tamsin" },
];
const NO_REPEAT = 6;

export interface Film {
  variant: Variant;
  /** The seed every particle derives from (the run's). */
  seed: number;
  /** Wall ms the hold ended. */
  startedMs: number;
  event: NukedEvent;
  /** From Wipe Day #2 a Skip button; never on the first. */
  skippable: boolean;
  reduced: boolean;
}

interface BigRedState {
  phase: Phase;
  /** The lid is up: the card shows the hold view instead of the cover. */
  lidOpen: boolean;
  /** A hold in progress: when it began (wall ms); null when the finger is up. */
  holdSince: number | null;
  /** "Tap twice": armed until this wall ms, or null. */
  armedUntil: number | null;
  /** A relief line after an early release (a locale key), cleared at the next hold. */
  relief: string | null;
  /** The crew's one-liner for this card: the locale key and who says it. */
  quip: { key: string; crew: string } | null;
  film: Film | null;
  /** Shots: the film frozen at this ms (null: the wall clock runs it). */
  pinnedMs: number | null;
  postcard: { event: NukedEvent; shownMs: number; flipped: boolean } | null;
  /** The landing's start (wall ms) while it plays. */
  landingMs: number | null;
  /** Wall ms the last landing began on this page (the afterglow sky's clock). */
  landedMs: number | null;
  /** Another tab's Wipe Day waiting to be seen (its postcard), or null. */
  elsewhere: NukedEvent | null;
}

interface BigRedActions {
  /** Opens the Big Red's card (the locked one or the cover). */
  openCard(): void;
  /** "Flip the lid": the cover turns into the hold view. */
  flipLid(): void;
  /** The finger, Space or Enter went down on the dome. */
  startHold(): void;
  /** ...and came up before the 2 s: cancel with a relief line. */
  cancelHold(): void;
  /** The hold completed (the scene's clock says 2 s passed): launch. */
  completeHold(): void;
  /** "Tap twice": the first tap arms, the second within 3 s launches. */
  tapTwice(): void;
  /** The Skip button (from Wipe Day #2). */
  skipFilm(): void;
  /** The scene reached the film's end: the postcard slides up. */
  filmEnded(): void;
  flipPostcard(): void;
  /** The postcard's Rebuild: the landing plays, then the island is the player's again. */
  rebuild(): void;
  /** The scene reached the landing's end. */
  landingEnded(): void;
  /** Another tab's postcard, from its toast. */
  showElsewhere(): void;
  /** Shots: pin the film (or unpin with null). */
  pin(variant: Variant, ms: number | null, event?: Partial<NukedEvent>): void;
  /** Shots: the landing at `ms` on the fresh island. */
  pinLanding(ms: number | null): void;
}

function readPending(): { key: string; run: number } | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { key?: unknown; run?: unknown };
    return typeof parsed.key === "string" && typeof parsed.run === "number"
      ? { key: parsed.key, run: parsed.run }
      : null;
  } catch {
    return null;
  }
}

function writePending(value: { key: string; run: number } | null): void {
  try {
    if (value) window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Private mode: a reload mid-film shows the server's run without the postcard.
  }
}

function readLines(): number[] {
  try {
    return (window.sessionStorage.getItem(LINES_KEY) ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

function writeLines(lines: number[]): void {
  try {
    window.sessionStorage.setItem(LINES_KEY, lines.join(","));
  } catch {
    // Fine without.
  }
}

/** A deterministic 0..1 from the run (the seed and the run number). */
function roll(base: BaseState, salt: number): number {
  const x = Math.sin((base.seed % 10007) * 12.9898 + base.run.n * 78.233 + salt) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The one-liner for a hold (03 6): spoken by a hand hired this run (any crew member if none),
 * picked from the seed and the run number, never repeating within six holds.
 */
export function pickQuip(base: BaseState): { key: string; crew: string } {
  const hired = new Set<string>();
  for (const id of base.run.hands) {
    const line = content.lines.find((row) => row.id === id);
    if (line) hired.add(line.hand);
  }
  const recent = readLines().slice(-NO_REPEAT);
  const fresh = LINES.filter((row) => !recent.includes(row.line));
  const pool = fresh.length > 0 ? fresh : LINES;
  const spoken = pool.filter((row) => hired.has(row.crew));
  const from = spoken.length > 0 ? spoken : pool;
  const pick = from[Math.floor(roll(base, 3) * from.length)] ?? LINES[0];
  if (!pick) throw new Error("no lines");
  return { key: `big_red.line_${pick.line}`, crew: pick.crew };
}

/** The crew member the postcard's message is from: a kept hand, else any. */
export function postcardSigner(base: BaseState, event: NukedEvent): string {
  const kept = keptHands(content, base);
  const first = kept[0];
  const line = first ? content.lines.find((row) => row.id === first) : undefined;
  if (line) return crewName(line.hand);
  const crew = content.crew;
  const pick = crew[Math.floor(roll(base, event.n) * crew.length)] ?? crew[0];
  return pick ? crewName(pick.id) : "";
}

const RELIEFS = ["big_red.relief_1", "big_red.relief_2", "big_red.relief_3"];

/** Whether the store is waiting for my own press's `nuked` event (the launch just went). */
let launching = false;
let reliefs = 0;

export const useBigRed = create<BigRedState & BigRedActions>((set, get) => {
  const showPostcard = (event: NukedEvent): void => {
    closeAll();
    set({
      phase: "postcard",
      film: null,
      pinnedMs: null,
      postcard: { event, shownMs: wall.nowMs(), flipped: false },
    });
    useUi.getState().openSheet("postcard");
    emit({ type: "postcard_shown" });
  };

  const launch = (): void => {
    const world = useWorld.getState();
    const base = world.base;
    if (!base || get().phase !== "idle") return;
    const run = base.run.n;
    const key = newKey();
    writePending({ key, run });
    const quip = get().quip;
    if (quip) {
      const n = Number(quip.key.slice("big_red.line_".length));
      writeLines([...readLines(), n].slice(-NO_REPEAT));
    }
    launching = true;
    // The open taps tail closes ahead of it (`enqueue`), so the server's gain includes every tap.
    world.send({ type: "nuke", run }, { key });
    launching = false;
  };

  return {
    phase: "idle",
    lidOpen: false,
    holdSince: null,
    armedUntil: null,
    relief: null,
    quip: null,
    film: null,
    pinnedMs: null,
    postcard: null,
    landingMs: null,
    landedMs: null,
    elsewhere: null,

    openCard() {
      const base = useWorld.getState().base;
      if (!base || get().phase !== "idle") return;
      set({
        quip: pickQuip(base),
        relief: null,
        holdSince: null,
        armedUntil: null,
        lidOpen: false,
      });
      useUi.getState().openSheet("big_red");
    },

    flipLid() {
      set({ lidOpen: true, relief: null });
    },

    startHold() {
      if (get().holdSince !== null || get().phase !== "idle") return;
      set({ holdSince: wall.nowMs(), relief: null });
      emit({ type: "hold_started" });
    },

    cancelHold() {
      if (get().holdSince === null) return;
      reliefs += 1;
      set({ holdSince: null, relief: RELIEFS[reliefs % RELIEFS.length] ?? null });
      emit({ type: "hold_cancelled" });
    },

    completeHold() {
      if (get().holdSince === null) return;
      set({ holdSince: null });
      launch();
    },

    tapTwice() {
      const now = wall.nowMs();
      const armed = get().armedUntil;
      if (armed !== null && now <= armed) {
        set({ armedUntil: null });
        emit({ type: "hold_cancelled" });
        launch();
        return;
      }
      set({ armedUntil: now + ARM_MS, relief: null });
      emit({ type: "hold_started" });
    },

    skipFilm() {
      const film = get().film;
      if (!film?.skippable) return;
      // Jump to the settle frame; the scene ends the film from there.
      set({ film: { ...film, startedMs: wall.nowMs() - skipTo(film.variant) } });
    },

    filmEnded() {
      const film = get().film;
      if (!film) return;
      showPostcard(film.event);
    },

    flipPostcard() {
      const postcard = get().postcard;
      if (!postcard) return;
      set({ postcard: { ...postcard, flipped: !postcard.flipped } });
    },

    rebuild() {
      const postcard = get().postcard;
      if (!postcard) return;
      useUi.getState().openSheet(null);
      const now = wall.nowMs();
      set({ phase: "landing", postcard: null, landingMs: now, landedMs: now });
    },

    landingEnded() {
      if (get().phase !== "landing") return;
      set({ phase: "idle", landingMs: null });
    },

    showElsewhere() {
      const event = get().elsewhere;
      if (!event) return;
      set({ elsewhere: null });
      showPostcard(event);
    },

    pin(variant, ms, event = {}) {
      const base = useWorld.getState().base;
      if (ms === null) {
        set({ phase: "idle", film: null, pinnedMs: null });
        return;
      }
      const full: NukedEvent = {
        type: "nuked",
        n: base?.run.n ?? 1,
        wipeDay: 1,
        gain: 10,
        ever: 10,
        glowBefore: 1,
        glowAfter: 1.95,
        doubling: true,
        flight: variant,
        pays: { drop: 3, scrap: 3 },
        news: { folded: 0, glass: 0 },
        summary: {
          seconds: 2880,
          made: 5.1e10,
          era: "metal",
          flotsam: 7,
          gulls: 2,
          orders: 3,
          taps: 9000,
          bestLine: { id: "furnace", share: 0.41 },
        },
        ...event,
      };
      closeAll();
      set({
        phase: "film",
        film: {
          variant,
          seed: base?.run.seed ?? 1,
          startedMs: wall.nowMs() - ms,
          event: full,
          skippable: full.wipeDay !== 1,
          reduced: reducedMotion(),
        },
        pinnedMs: ms,
        postcard: null,
        holdSince: null,
        armedUntil: null,
      });
    },

    pinLanding(ms) {
      if (ms === null) {
        set({ phase: "idle", landingMs: null });
        return;
      }
      closeAll();
      const now = wall.nowMs();
      set({
        phase: "landing",
        film: null,
        postcard: null,
        landingMs: now - ms,
        landedMs: now - ms,
      });
    },
  };
});

/** How far a hold has come, 0..1 (the ring), at wall `nowMs`. */
export function holdProgress(state: BigRedState, nowMs: number): number {
  if (state.holdSince === null) return 0;
  return Math.min(1, (nowMs - state.holdSince) / HOLD_MS);
}

/** The film's ms at wall `nowMs` (pinned films hold still). */
export function filmMs(film: Film, pinnedMs: number | null, nowMs: number): number {
  return pinnedMs ?? Math.max(0, nowMs - film.startedMs);
}

/** How long the landing runs (reduced motion: a cross-fade). */
export const landingLength = (): number => (reducedMotion() ? LANDING_REDUCED_MS : LANDING_MS);

/** Whether the film has run its length at `nowMs`. */
export function filmOver(film: Film, pinnedMs: number | null, nowMs: number): boolean {
  return (
    pinnedMs === null && filmMs(film, pinnedMs, nowMs) >= filmLength(film.variant, film.reduced)
  );
}

/** Seconds since the last landing on this page (the afterglow sky's clock), or null. */
export function sinceLanding(state: BigRedState, nowMs: number): number | null {
  return state.landedMs === null ? null : Math.max(0, (nowMs - state.landedMs) / 1000);
}

// The press's `nuked` event: mine (predicted at the launch) starts the film; a resend's replay
// after a reload shows the postcard without the film; another tab's offers its postcard.
on((event) => {
  if (event.type !== "nuked") return;
  const state = useBigRed.getState();
  const base = useWorld.getState().base;
  if (launching) {
    useBigRed.setState({ relief: null });
    startFilmFor(event, base);
    return;
  }
  const pending = readPending();
  if (pending && pending.run === event.n) {
    writePending(null);
    if (state.phase === "idle") {
      closeAll();
      useBigRed.setState({
        phase: "postcard",
        postcard: { event, shownMs: wall.nowMs(), flipped: false },
      });
      useUi.getState().openSheet("postcard");
      emit({ type: "postcard_shown" });
    }
    return;
  }
  if (state.phase === "idle") {
    useBigRed.setState({ elsewhere: event });
    useWorld
      .getState()
      .notice(
        t("big_red.other_tab", { n: event.wipeDay ?? event.n }),
        t("big_red.see_postcard"),
        () => useBigRed.getState().showElsewhere(),
      );
  }
});

function startFilmFor(event: NukedEvent, base: BaseState | null): void {
  const variant = (VARIANTS as readonly string[]).includes(event.flight)
    ? (event.flight as Variant)
    : "u_turn";
  closeAll();
  useBigRed.setState({
    phase: "film",
    film: {
      variant,
      seed: base?.run.seed ?? 1,
      startedMs: wall.nowMs(),
      event,
      skippable: event.wipeDay !== 1,
      reduced: reducedMotion(),
    },
    pinnedMs: null,
    holdSince: null,
    armedUntil: null,
  });
}

/**
 * The answer to my press: confirmed (the pending key clears) or refused (`stale_run`: the film
 * cuts to a toast with "Show island"). Read off the store: the queue no longer holds the nuke.
 */
export function watchAnswers(): () => void {
  return useWorld.subscribe((world, previous) => {
    const had = previous.queue.some((entry) => entry.command.type === "nuke");
    const has = world.queue.some((entry) => entry.command.type === "nuke");
    if (!had || has) return;
    const pending = readPending();
    const confirmed = world.confirmed;
    if (!pending || !confirmed) return;
    if (confirmed.run.n > pending.run) {
      writePending(null);
      return;
    }
    // Refused: the run never ended on the server. The film stops; the island is the old one.
    writePending(null);
    const state = useBigRed.getState();
    if (state.phase === "film" || state.phase === "postcard") {
      useUi.getState().openSheet(null);
      useBigRed.setState({ phase: "idle", film: null, postcard: null, pinnedMs: null });
      world.notice(t("big_red.not_through"), t("big_red.show_island"), () => closeAll());
    }
  });
}

/**
 * On load (03 7.7): a hold answered by nobody (the tab closed mid-film) is resent under its
 * key once the island is in; the server's replay or its fresh answer carries the `nuked` event.
 */
export function resendPending(): void {
  const pending = readPending();
  const world = useWorld.getState();
  if (!pending || !world.base) return;
  // The same key: the server applies it (the tab closed before the send) or replays the stored
  // outcome (it had already landed); either answer carries the `nuked` event for the postcard.
  world.send({ type: "nuke", run: pending.run }, { key: pending.key, resent: true });
}
