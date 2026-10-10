/**
 * The client's game state (D64). `confirmed` is the server's last word; `queue` holds what the
 * player did since, in order; `base` is what they see: the queue applied over `confirmed` with
 * the very `applyCommand` the server runs. The server's answer wins.
 *
 * The taps transport (D134; `taps.ts`): taps merge into the queue's open tail; the queue is sent
 * one entry at a time, in order, each under the key it got at its first attempt. A network
 * error, a 5xx or a 429 keeps the entry and retries it ("Reconnecting… your taps are saved");
 * only a 400 (a bug) drops its one entry, with a toast and a reload. Nothing predicted is lost.
 *
 * Narrow selectors: the scene reads the store once per frame and the counter is written outside
 * React, so `second` is published once a second and nothing re-renders per frame.
 */
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import { settle, suppliesAt } from "@wipe-day/domain/settle";
import type { BaseState } from "@wipe-day/domain/state";
import type {
  CommandResponse,
  PlayerView,
  PushMessage,
  StateResponse,
} from "@wipe-day/domain/wire";
import { create } from "zustand";
import { type Backend, HttpError, newKey, type ServerConfig } from "../net/backend";
import { HttpBackend } from "../net/http";
import { LocalBackend } from "../net/local";
import { jumps, wall } from "./clocks";
import { emit } from "./events";
import { refusalMessage } from "./messages";
import {
  addTaps,
  closeDue,
  type Entry,
  enqueue,
  isOpenTail,
  pruneKeys,
  retryWait,
  sendable,
} from "./taps";
import { content, t } from "./world";

type Phase = "boot" | "login" | "offline" | "playing";

export interface Toast {
  id: number;
  text: string;
  tone: "neutral" | "success" | "warning" | "danger";
  /** Stays until dismissed or replaced (the reconnecting note). */
  sticky?: boolean;
}

interface WorldState {
  phase: Phase;
  mode: "server" | "demo";
  config: ServerConfig;
  player: PlayerView | null;
  /** The server's last word. */
  confirmed: BaseState | null;
  version: number;
  /** What the player did since, oldest first. */
  queue: Entry[];
  /** What the player sees: the queue over `confirmed`. */
  base: BaseState | null;
  /** A send failed and is being retried. */
  reconnecting: boolean;
  toasts: Toast[];
  demoOpen: boolean;
  /** The game clock's whole second, published once a second for the HUD. */
  second: number;
}

interface Actions {
  boot(): Promise<void>;
  devLogin(slot: number): Promise<void>;
  /** `count` taps at the screen point `x, y`; returns the predicted gain. */
  tap(count: number, x: number, y: number): number;
  send(command: Command): void;
  /** Once a frame: closes a ripe taps tail, sends, pings, publishes the second. */
  tick(): void;
  /** The tab hid or showed: a hidden tab closes its tail at once. */
  setHidden(hidden: boolean): void;
  dismissToast(id: number): void;
  toggleDemo(): void;
  demoJump(kind: keyof typeof jumps): void;
  demoPause(paused: boolean): void;
  demoReset(): void;
  /** Rewrites the demo's run (the drawer, the shots). */
  demoPatch(change: Partial<BaseState["run"]>): void;
}

export type Store = WorldState & Actions;

let backend: Backend = new HttpBackend();
let toastId = 0;
let flushing = false;
let attempts = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let hidden = false;
let unsubscribe: (() => void) | null = null;
/** Keys this tab sent: their pushes are echoes (pruned after 10 minutes, at most 500). */
let sentKeys = new Map<string, number>();
/** When the last command was queued (game seconds): a visible tab pings 5 minutes after. */
let lastCommandAt = 0;
let lastRefetchMs = 0;

/** The game clock in seconds (fractional, for prediction and the counter). */
export const gameSeconds = (): number => backend.clock.nowMs() / 1000;
const nowSecond = (): number => Math.floor(gameSeconds());

/** The queue applied over `confirmed`, each command at its own second. */
function rebase(confirmed: BaseState, queue: readonly Entry[]): BaseState {
  let base = confirmed;
  for (const entry of queue) base = applyCommand(content, base, entry.command, entry.at).state;
  return base;
}

/** Seconds into the local day for the sky (the island's own clock arrives in R1). */
export function localSeconds(seconds: number): number {
  return seconds - new Date(seconds * 1000).getTimezoneOffset() * 60;
}

export const useWorld = create<Store>((set, get) => {
  const toast = (text: string, tone: Toast["tone"] = "neutral", sticky = false): number => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.filter((item) => !item.sticky), { id, text, tone, sticky }] });
    if (!sticky) setTimeout(() => get().dismissToast(id), 4000);
    return id;
  };

  const adopt = (response: StateResponse): void => {
    const queue = get().queue;
    set({
      player: response.player,
      confirmed: response.state,
      version: response.version,
      base: rebase(response.state, queue),
      phase: "playing",
      second: nowSecond(),
    });
  };

  const reload = async (): Promise<void> => {
    try {
      adopt(await backend.state());
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) set({ phase: "login" });
      else set({ phase: "offline" });
    }
  };

  const onPush = (message: PushMessage): void => {
    if (message.origin && sentKeys.has(message.origin)) return;
    const state = get();
    if (message.version <= state.version) return;
    if (message.state) {
      set({
        confirmed: message.state,
        version: message.version,
        base: rebase(message.state, state.queue),
      });
      for (const event of message.events) emit(event);
      return;
    }
    // A taps batch from another tab carries only its version: refetch, at most every 2 s.
    const nowMs = wall.nowMs();
    if (nowMs - lastRefetchMs < 2000) return;
    lastRefetchMs = nowMs;
    void reload();
  };

  const settleAnswer = (entry: Entry, response: CommandResponse): void => {
    const rest = get().queue.slice(1);
    const fresher = response.version >= get().version;
    const confirmed = fresher ? response.state : (get().confirmed ?? response.state);
    set({
      confirmed,
      version: Math.max(get().version, response.version),
      queue: rest,
      base: rebase(confirmed, rest),
    });
    if (!response.ok) toast(refusalMessage(response.refusal), "warning");
    if (entry.key) sentKeys.set(entry.key, wall.nowMs());
  };

  /** Sends the queue's head while it may go: one at a time, in order. */
  const flush = async (): Promise<void> => {
    if (flushing || retryTimer) return;
    flushing = true;
    try {
      for (;;) {
        let queue = closeDue(get().queue, wall.nowMs(), hidden);
        const head = queue[0];
        if (!head || !sendable(head, wall.nowMs())) {
          set({ queue });
          break;
        }
        const entry: Entry = { ...head, closed: true, key: head.key ?? newKey() };
        queue = [entry, ...queue.slice(1)];
        set({ queue });
        try {
          const response = await backend.command(entry.key ?? "", entry.command);
          settleAnswer(entry, response);
          if (get().reconnecting) {
            set({ reconnecting: false });
            toast(t("toast.reconnected"), "success");
          }
          attempts = 0;
        } catch (error) {
          if (error instanceof HttpError && error.status === 401) {
            set({ phase: "login" });
            break;
          }
          if (
            error instanceof HttpError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429
          ) {
            // A bug, not the network: drop this one entry and take the server's word.
            set({ queue: get().queue.slice(1) });
            toast(t("toast.rejected"), "danger");
            await reload();
            continue;
          }
          const wait =
            error instanceof HttpError && error.status === 429 && error.retryAfterMs !== null
              ? error.retryAfterMs
              : retryWait(attempts);
          attempts += 1;
          if (!get().reconnecting) {
            set({ reconnecting: true });
            toast(t("toast.reconnecting"), "warning", true);
          }
          retryTimer = setTimeout(() => {
            retryTimer = null;
            void flush();
          }, wait);
          break;
        }
      }
    } finally {
      flushing = false;
    }
  };

  const connect = async (): Promise<void> => {
    unsubscribe?.();
    unsubscribe = backend.subscribe(onPush, () => void reload());
    await reload();
    // A page load counts as being here: restart the Night Shift.
    if (get().phase === "playing") get().send({ type: "ping" });
  };

  return {
    phase: "boot",
    mode: "server",
    config: { devLogin: false, discordLogin: false },
    player: null,
    confirmed: null,
    version: 0,
    queue: [],
    base: null,
    reconnecting: false,
    toasts: [],
    demoOpen: false,
    second: 0,

    async boot() {
      const demo = new URLSearchParams(window.location.search).has("demo");
      if (!demo) {
        try {
          const config = await backend.config();
          set({ config, mode: "server" });
          const me = await backend.me();
          if (!me) {
            set({ phase: "login" });
            return;
          }
          await connect();
          return;
        } catch {
          if (!import.meta.env.DEV) {
            set({ phase: "offline" });
            return;
          }
          // Development without the API running: play the demo instead of a dead screen.
        }
      }
      backend = new LocalBackend();
      set({ mode: "demo" });
      await connect();
      if (!demo) toast(t("toast.demo_mode"));
    },

    async devLogin(slot) {
      await backend.devLogin(slot);
      await connect();
    },

    tap(count, x, y) {
      const state = get();
      if (state.phase !== "playing" || !state.confirmed || !state.base) return 0;
      const now = nowSecond();
      const before = suppliesAt(content, state.base, Math.max(now, state.base.run.settledAt));
      const queue = addTaps(state.queue, count, now, wall.nowMs());
      const base = rebase(state.confirmed, queue);
      const after = suppliesAt(content, base, Math.max(now, base.run.settledAt));
      const gain = Math.max(0, after - before);
      set({ queue, base });
      lastCommandAt = now;
      emit({ type: "tap_at", x, y, gain });
      return gain;
    },

    send(command) {
      const state = get();
      if (!state.confirmed) return;
      const now = nowSecond();
      const queue = enqueue(state.queue, command, now, wall.nowMs());
      const result = applyCommand(content, state.base ?? state.confirmed, command, now);
      set({ queue, base: rebase(state.confirmed, queue) });
      lastCommandAt = now;
      if (result.ok) for (const event of result.events) emit(event);
      else toast(refusalMessage(result.refusal), "warning");
      void flush();
    },

    tick() {
      const state = get();
      const second = nowSecond();
      if (second !== state.second) {
        set({ second });
        sentKeys = pruneKeys(sentKeys, wall.nowMs());
        // A visible tab is still there: ping 5 minutes after the last command (N25).
        const ping = content.run.nightShift.pingMinutes * 60;
        if (state.phase === "playing" && !hidden && second - lastCommandAt >= ping) {
          get().send({ type: "ping" });
        }
      }
      const tail = state.queue.at(-1);
      if (state.queue.length > 0 && (!isOpenTail(tail) || sendable(tail, wall.nowMs()))) {
        void flush();
      }
    },

    setHidden(next) {
      hidden = next;
      if (next) {
        set({ queue: closeDue(get().queue, wall.nowMs(), true) });
        void flush();
      }
    },

    dismissToast(id) {
      set({ toasts: get().toasts.filter((item) => item.id !== id) });
    },

    toggleDemo() {
      set({ demoOpen: !get().demoOpen });
    },

    demoJump(kind) {
      if (!(backend instanceof LocalBackend)) return;
      jumps[kind]();
      void reload();
    },

    demoPause(paused) {
      if (!(backend instanceof LocalBackend)) return;
      backend.clock.setPaused(paused);
      set({ second: nowSecond() });
    },

    demoReset() {
      if (!(backend instanceof LocalBackend)) return;
      backend.reset();
      set({ queue: [] });
      void reload();
    },

    demoPatch(change) {
      if (!(backend instanceof LocalBackend)) return;
      const base = backend.patch(change);
      set({ confirmed: base, base: rebase(base, get().queue), version: get().version + 1 });
    },
  };
});

/** The base settled to the game clock's now, without saving: for the scene's per-frame reads. */
export function settledBase(state: Store): BaseState | null {
  if (!state.base) return null;
  return settle(content, state.base, Math.max(nowSecond(), state.base.run.settledAt)).state;
}
