/**
 * The client's game state. The server (or, in demo mode, the local backend)
 * owns the truth; this store holds:
 *
 * - `confirmed`: the last state the backend answered with, and `queue`: the
 *   commands sent since and not yet answered. `base` is `confirmed` with the
 *   queue re-applied, which is what the player sees (client prediction).
 * - A tap runs the command through the same domain function the server uses,
 *   shows the result and plays its effects at once, then sends it with a fresh
 *   idempotency key. The answer replaces the prediction; a refusal the
 *   prediction missed rolls it back with a one-line explanation.
 * - Timers that end on screen (a build, a craft, a barrel, a regrown node) are
 *   predicted by settling locally, and their effects play exactly once even
 *   when the server's version of the same moment arrives later.
 */
import type { BaseState } from "@wipe-day/domain/base";
import type { Command } from "@wipe-day/domain/commands";
import { applyCommand } from "@wipe-day/domain/commands";
import type { GameEvent as DomainEvent } from "@wipe-day/domain/events";
import { nodeKindOf, nodeStatus } from "@wipe-day/domain/nodes";
import { nextEventAt, settleAll } from "@wipe-day/domain/settle";
import type { PlayerView, PushMessage, StateResponse, WelcomeBack } from "@wipe-day/domain/wire";
import { create } from "zustand";
import { type Backend, newKey, type ServerConfig } from "../net/backend";
import { HttpBackend } from "../net/http";
import { LocalBackend } from "../net/local";
import { DEMO_SEASON_START, demoClocks } from "./clocks";
import { emit, type GameEvent } from "./events";
import { eventMessage, type Message, type Panel, refusalMessage, type Tone } from "./messages";
import { content, t } from "./world";

export type { Panel };
export type Weather = "clear" | "rain" | "fog";
export type Phase = "loading" | "login" | "playing" | "offline";

export interface Toast {
  id: number;
  text: string;
  tone: Tone;
  panel?: Panel;
  recipe?: string;
  report?: string;
}

interface Queued {
  key: string;
  command: Command;
  /** Game time the command was predicted at. */
  at: number;
}

export interface WorldState {
  phase: Phase;
  mode: "server" | "demo";
  config: ServerConfig;
  player: PlayerView | null;
  /** What the player sees: `confirmed` plus the commands still in flight. */
  base: BaseState;
  confirmed: BaseState;
  version: number;
  queue: Queued[];
  /** Game time now (seconds, fractional): the server's clock, or the demo clock. */
  now: number;
  seasonStartedAt: number;
  welcomeBack: WelcomeBack | null;
  /** The node run the scene is playing, with the id the server knows it by. */
  run: { node: string; run: string } | null;
  weather: Weather;
  toasts: Toast[];
  panel: Panel;
  /** The craft panel's station tab ("favourites" for the pinned ones). */
  station: string;
  /** The recipe open in the craft panel (by output id), or null for the list. */
  recipe: string | null;
  /** The base scene or the island map. */
  view: "base" | "map";
  /** What the map panel shows: a region or a site, or null for the overview. */
  mapFocus: { kind: "region" | "site"; id: string } | null;
  /** The report card open (by report id), or null. */
  report: string | null;
  demoOpen: boolean;
}

interface Actions {
  boot(): Promise<void>;
  /** Reads the clock and lands timers that ended. The scene calls it once per frame. */
  tick(): void;
  /** Predicts, shows and sends one command. False when it was refused locally. */
  send(command: Command): boolean;
  gather(): boolean;
  collect(): boolean;
  /** Builds the next base tier (`"tier"`) or a building's next level. */
  build(what: string): boolean;
  upgradeTool(): boolean;
  /** Queues `count` units of the recipe that makes `recipe`. */
  craft(recipe: string, count: number): boolean;
  cancelCraft(station: string, index: number): boolean;
  salvage(item: string, count: number): boolean;
  serve(meal: string): boolean;
  /** Opens the craft panel on a recipe's detail (from a "Make planks" link). */
  openRecipe(output: string): void;
  /** The craft panel's list for one station; closes any open recipe. */
  selectStation(station: string): void;
  setView(view: "base" | "map"): void;
  /** Opens the map panel on a region or a site (from a tap on the map). */
  focusMap(focus: { kind: "region" | "site"; id: string } | null): void;
  scout(region: string, survivor: string): boolean;
  sendTrip(site: string, crew: string[]): boolean;
  equip(survivor: string, slot: "weapon" | "armor", item: string | null): boolean;
  treat(survivor: string, item: string): boolean;
  /** Opens a report card (and marks it read); null closes it. */
  openReport(id: string | null): void;
  smelt(ore: string): boolean;
  takeOut(): boolean;
  breakBarrel(): boolean;
  /** The scene starts a node run; returns why not when the node cannot be worked. */
  startRun(node: string): string | null;
  hitNode(hits: number): void;
  /** `done`: the node took its last hit, which ended the run on the server already. */
  endRun(done: boolean): void;
  devLogin(slot: number): Promise<void>;
  logout(): Promise<void>;
  openPanel(panel: Panel): void;
  dismissWelcome(): void;
  toast(message: Message): void;
  dismissToast(id: number): void;
  setWeather(weather: Weather): void;
  setDemoOpen(open: boolean): void;
  /** Demo mode and screenshots only: overwrite parts of the base. */
  demoPatch(change: Partial<BaseState>): void;
}

export type Store = WorldState & Actions;

let toastId = 0;
let backend: Backend = new HttpBackend();
let unsubscribe: (() => void) | null = null;
let sending = false;
/** Keys this tab sent: their pushes are echoes, the command's own answer already arrived. */
const sentKeys = new Set<string>();
/** Timed happenings already played: a server copy of the same moment must not replay them. */
const played = new Set<string>();

/** Identity of a timed happening, for playing it once. */
function timedKey(event: DomainEvent): string | null {
  switch (event.type) {
    case "build_done":
      return `build:${event.tier}`;
    case "building_done":
      return `building:${event.building}:${event.level}`;
    case "crafted":
      return `craft:${event.station}:${event.recipe}:${event.at}`;
    case "barrel_spawned":
      return `barrel:${event.expiresAt}`;
    case "node_depleted":
      return `node:${event.node}:${event.until}`;
    default:
      return null;
  }
}

const seconds = (): number => backend.clock.nowMs() / 1000;

/** `confirmed` with every queued command re-applied at the moment it was predicted. */
function rebase(confirmed: BaseState, queue: Queued[]): BaseState {
  return queue.reduce(
    (state, queued) => applyCommand(content, state, queued.command, queued.at).state,
    confirmed,
  );
}

const placeholder = (): BaseState => ({
  seed: 0,
  tier: "twig",
  toolId: content.tools[0]?.id ?? "",
  stock: {},
  lastCollectedAt: 0,
  lastGatherAt: null,
  buildings: {},
  construction: [],
  upkeepPaidUntil: 0,
  furnaceJobs: [],
  items: {},
  production: {},
  blueprints: [],
  wellFed: null,
  crew: [],
  nextArrivalAt: 0,
  known: [],
  missions: [],
  reports: [],
  missionSeq: 0,
  nodeRun: null,
  wear: {},
  depleted: {},
  haul: { day: -1, minutes: 0 },
  barrel: null,
  nextBarrelAt: Number.MAX_SAFE_INTEGER,
  tasks: { day: -1, ids: [], progress: {}, done: [] },
  hints: {},
});

export const useWorld = create<Store>((set, get) => {
  /** Plays events on screen and toasts the ones worth words; timed ones only once. */
  const play = (events: GameEvent[]): void => {
    for (const event of events) {
      if (event.type !== "node_respawned" && event.type !== "weather") {
        const key = timedKey(event);
        if (key) {
          if (played.has(key)) continue;
          played.add(key);
        }
      }
      emit(event);
      const message = eventMessage(event);
      if (message) get().toast(message);
    }
  };

  const adopt = (response: StateResponse): void => {
    set({
      player: response.player,
      confirmed: response.state,
      version: response.version,
      queue: [],
      base: response.state,
      seasonStartedAt: response.seasonStartedAt,
      welcomeBack: response.welcomeBack,
      now: seconds(),
      phase: "playing",
    });
  };

  const reload = async (): Promise<void> => {
    try {
      adopt(await backend.state());
    } catch {
      set({ phase: "offline" });
    }
  };

  const onPush = (message: PushMessage): void => {
    if (message.origin && sentKeys.has(message.origin)) return;
    const state = get();
    if (message.version <= state.version) return;
    const base = rebase(message.state, state.queue);
    set({ confirmed: message.state, version: message.version, base });
    // Another tab's actions or a timer the server landed first: show the timed ones.
    play(message.events.filter((event) => timedKey(event) !== null));
  };

  /** Sends queued commands one at a time, in order; each answer becomes the new truth. */
  const flush = async (): Promise<void> => {
    if (sending) return;
    sending = true;
    try {
      for (;;) {
        const next = get().queue[0];
        if (!next) break;
        try {
          const response = await backend.command(next.key, next.command);
          const rest = get().queue.slice(1);
          set({
            confirmed: response.state,
            version: Math.max(get().version, response.version),
            queue: rest,
            base: rebase(response.state, rest),
          });
          if (!response.ok) {
            // The server saw a different base than the prediction did: say why, show its state.
            const message = refusalMessage(response.refusal, response.serverNow);
            if (message) get().toast(message);
          }
        } catch {
          set({ queue: [] });
          get().toast({ text: t("toast.connection"), tone: "danger" });
          await reload();
          break;
        }
      }
    } finally {
      sending = false;
    }
  };

  const connect = async (): Promise<void> => {
    unsubscribe?.();
    unsubscribe = backend.subscribe(onPush, () => void reload());
    await reload();
  };

  return {
    phase: "loading",
    mode: "server",
    config: { devLogin: false, discordLogin: false },
    player: null,
    base: placeholder(),
    confirmed: placeholder(),
    version: 0,
    queue: [],
    now: 0,
    seasonStartedAt: 0,
    welcomeBack: null,
    run: null,
    weather: "clear",
    toasts: [],
    panel: null,
    station: "workbench",
    recipe: null,
    view: "base",
    mapFocus: null,
    report: null,
    demoOpen: false,

    async boot() {
      const demo = new URLSearchParams(window.location.search).has("demo");
      if (!demo) {
        try {
          const config = await backend.config();
          set({ config, mode: "server" });
          const me = await backend.me();
          if (!me) {
            set({ phase: "login", now: seconds() });
            return;
          }
          await connect();
          return;
        } catch {
          if (!import.meta.env.DEV) {
            set({ phase: "offline", now: seconds() });
            return;
          }
          // Development without the API running: play the demo instead of a dead screen.
        }
      }
      backend = new LocalBackend();
      set({ mode: "demo", seasonStartedAt: DEMO_SEASON_START });
      await connect();
      if (!demo) get().toast({ text: t("toast.demo_mode"), tone: "neutral" });
    },

    tick() {
      const now = seconds();
      const state = get();
      if (state.phase !== "playing") {
        set({ now });
        return;
      }
      const at = Math.floor(now);
      const base = state.base;
      const regrown = Object.entries(base.depleted).filter(([, until]) => until <= at);
      const due = (nextEventAt(base) ?? Number.POSITIVE_INFINITY) <= at || regrown.length > 0;
      if (!due) {
        set({ now });
        return;
      }
      const settled = settleAll(content, base, at);
      set({ now, base: settled.state });
      play(settled.events);
      play(
        regrown.map(([node]) => ({
          type: "node_respawned" as const,
          node,
          kind: nodeKindOf(content, node)?.id ?? "tree",
        })),
      );
    },

    send(command) {
      const state = get();
      if (state.phase !== "playing") return false;
      const at = Math.floor(state.now);
      const predicted = applyCommand(content, state.base, command, at);
      if (!predicted.ok) {
        set({ base: predicted.state });
        const message = refusalMessage(predicted.refusal, at);
        if (message) get().toast(message);
        return false;
      }
      const key = newKey();
      sentKeys.add(key);
      set({ base: predicted.state, queue: [...state.queue, { key, command, at }] });
      play(predicted.events);
      void flush();
      return true;
    },

    gather: () => get().send({ type: "gather" }),
    collect: () => get().send({ type: "collect" }),
    build: (what) => get().send({ type: "build", what }),
    upgradeTool: () => get().send({ type: "upgrade_tool" }),
    craft: (recipe, count) => get().send({ type: "craft", recipe, count }),
    cancelCraft: (station, index) => get().send({ type: "cancel_craft", station, index }),
    salvage: (item, count) => get().send({ type: "salvage", item, count }),
    serve: (meal) => get().send({ type: "serve", meal }),

    openRecipe(output) {
      const station = content.recipes.find((recipe) => recipe.output === output)?.station;
      set({ panel: "craft", recipe: output, ...(station ? { station } : {}) });
    },

    selectStation(station) {
      set({ station, recipe: null });
    },

    setView(view) {
      set({
        view,
        panel: view === "map" ? get().panel : get().panel === "map" ? null : get().panel,
      });
    },

    focusMap(focus) {
      set({ view: "map", mapFocus: focus, panel: "map" });
    },

    scout: (region, survivor) => get().send({ type: "scout", region, survivor }),
    sendTrip: (site, crew) => get().send({ type: "send_trip", site, crew }),
    equip: (survivor, slot, item) => get().send({ type: "equip", survivor, slot, item }),
    treat: (survivor, item) => get().send({ type: "treat", survivor, item }),

    openReport(id) {
      set({ report: id });
      const report = id ? get().base.reports.find((candidate) => candidate.id === id) : undefined;
      if (report && !report.read) get().send({ type: "read_report", id: report.id });
    },
    smelt: (ore) => get().send({ type: "smelt", ore }),
    takeOut: () => get().send({ type: "take_out" }),
    breakBarrel: () => get().send({ type: "break_barrel" }),

    startRun(node) {
      const state = get();
      const status = nodeStatus(content, state.base, node, Math.floor(state.now));
      if (status.code === "tool") return t("hud.node_needs_tool");
      if (status.code !== "ready") return null;
      set({ run: { node, run: newKey() } });
      return null;
    },

    hitNode(hits) {
      const run = get().run;
      if (!run) return;
      get().send({ type: "hit_node", node: run.node, run: run.run, hit: hits });
    },

    endRun(done) {
      const run = get().run;
      set({ run: null });
      // The node's last hit ended the run on the server; anything shorter ends here.
      if (run && !done) get().send({ type: "end_node_run", node: run.node, run: run.run });
    },

    async devLogin(slot) {
      await backend.devLogin(slot);
      await connect();
    },

    async logout() {
      await backend.logout();
      unsubscribe?.();
      unsubscribe = null;
      set({ phase: "login", player: null, panel: null });
    },

    openPanel(panel) {
      // The craft panel opens on its list; a "Make planks" link uses openRecipe instead.
      set({ panel: get().panel === panel ? null : panel, recipe: null });
    },

    dismissWelcome() {
      set({ welcomeBack: null });
    },

    toast(message) {
      const id = ++toastId;
      const toast: Toast = { id, text: message.text, tone: message.tone };
      if (message.panel) toast.panel = message.panel;
      if (message.recipe) toast.recipe = message.recipe;
      if (message.report) toast.report = message.report;
      set({ toasts: [...get().toasts.slice(-3), toast] });
      setTimeout(() => get().dismissToast(id), 4500);
    },

    dismissToast(id) {
      set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
    },

    setWeather(weather) {
      set({ weather });
      emit({ type: "weather", weather });
    },

    setDemoOpen(demoOpen) {
      set({ demoOpen });
    },

    demoPatch(change) {
      if (!(backend instanceof LocalBackend)) return;
      const { state, version } = backend.patch(change);
      set({ confirmed: state, base: rebase(state, get().queue), version });
    },
  };
});

/** Game seconds since the season began: gives the day number and the time of day. */
export function seasonTime(state: Pick<WorldState, "now" | "seasonStartedAt" | "mode">): number {
  // The live game follows the player's own day; the demo counts from its epoch season start.
  if (state.mode === "demo") return state.now - state.seasonStartedAt;
  return state.now - new Date(state.now * 1000).getTimezoneOffset() * 60;
}

/** Day of the season, 1-based. */
export function seasonDay(state: Pick<WorldState, "now" | "seasonStartedAt">): number {
  return Math.floor((state.now - state.seasonStartedAt) / 86400) + 1;
}

export { demoClocks };
