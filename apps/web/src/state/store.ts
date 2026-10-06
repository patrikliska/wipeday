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
 * - The Den (W5): a purchase from another player and the casino's rolls cannot
 *   be predicted (`SERVER_ONLY`): they wait for the server, shown as pending, and
 *   their events play when the answer arrives. The board and the wheel follow the
 *   event stream's `den` messages.
 */

import type { DiceOption } from "@wipe-day/content/schema";
import type { BaseState } from "@wipe-day/domain/base";
import type { Command } from "@wipe-day/domain/commands";
import { applyCommand, SERVER_ONLY } from "@wipe-day/domain/commands";
import type { Job } from "@wipe-day/domain/crew";
import type { GameEvent as DomainEvent } from "@wipe-day/domain/events";
import type { FeedItem } from "@wipe-day/domain/feed";
import { nodeKindOf, nodeStatus } from "@wipe-day/domain/nodes";
import { newPvp } from "@wipe-day/domain/raids";
import { nextEventAt, settleAll } from "@wipe-day/domain/settle";
import { newStats } from "@wipe-day/domain/stats";
import type {
  DenBoard,
  DenPush,
  PlayerView,
  PushMessage,
  RaidsResponse,
  RanksResponse,
  StateResponse,
  WelcomeBack,
} from "@wipe-day/domain/wire";
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
  /** False for server-only commands: nothing was shown yet, the answer plays its events. */
  predicted: boolean;
}

export type DenTab = "market" | "contracts" | "games";
export type DefenceTab = "defence" | "raids";
export type FeedTab = "feed" | "ranks";
export type Game = "wheel" | "slots" | "dice";

/** The last roll the player made, for the tables to show (W5). */
export interface Roll {
  game: Game;
  result: number[];
  bet: number;
  payout: number;
  /** When the answer arrived (seconds of the wall clock), so a table can animate it once. */
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
  /** The season's feed (W4b), newest first, as far back as loaded. */
  feed: FeedItem[];
  /** The newest feed item the player has seen (the clock chip's dot is for newer ones). */
  feedSeen: number;
  /** More feed further back. */
  feedMore: boolean;
  // The Den (W5).
  denTab: DenTab;
  /** The sell form: undefined = closed, null = picking a good, else the good being listed. */
  denSell: string | null | undefined;
  game: Game;
  feedTab: FeedTab;
  /** The board as last loaded and kept up to date from the stream; null before. */
  board: DenBoard | null;
  ranks: RanksResponse | null;
  /** Keys of server-only commands waiting for their answer. */
  pending: string[];
  /** The newest wheel result the stream announced, for the spin. */
  spin: { round: number; segment: number } | null;
  /** The player's last slots spin or dice roll. */
  roll: Roll | null;
  // Raids (W6).
  defenceTab: DefenceTab;
  /** Other holdfasts in the raids, as last loaded; null before. */
  raids: RaidsResponse | null;
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
  assign(survivor: string, job: Job | null): boolean;
  rest(survivor: string): boolean;
  restTired(): boolean;
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
  /** Loads the feed's newest page, or (`older`) the page before the oldest loaded. */
  loadFeed(older?: boolean): Promise<void>;
  /** The feed was looked at: the dot goes out. */
  markFeedSeen(): void;
  /** Opens the Den on a tab (the skiff, the map marker, the dock, a toast). */
  openDen(tab?: DenTab): void;
  setDenTab(tab: DenTab): void;
  setDenSell(good: string | null | undefined): void;
  setGame(game: Game): void;
  setFeedTab(tab: FeedTab): void;
  loadDen(): Promise<void>;
  loadRanks(): Promise<void>;
  list(good: string, amount: number, price: number): boolean;
  cancelListing(listing: string): boolean;
  buyListing(listing: number): boolean;
  denBuy(offer: string, lots: number): boolean;
  deliver(contract: string): boolean;
  wheelBet(segment: string, amount: number): boolean;
  spinSlots(amount: number): boolean;
  rollDice(option: DiceOption, amount: number): boolean;
  /** Screenshots: other players' wheel bets and the jackpot in the demo Den. */
  demoDen(change: { bets?: DenBoard["bets"]; jackpot?: number }): void;
  // Raids (W6).
  /** Opens the Defence panel on a tab (the shield over the walls, the raid banner, a toast). */
  openDefence(tab?: DefenceTab): void;
  setDefenceTab(tab: DefenceTab): void;
  loadRaids(): Promise<void>;
  repair(): boolean;
  setPvp(on: boolean): boolean;
  raidPlayer(target: number): boolean;
  /** Screenshots: Hollis's holdfast in the demo. */
  demoRival(change: Partial<BaseState>): void;
}

const FEED_SEEN = "wd.feedSeen";
function storedFeedSeen(): number {
  try {
    return Number(localStorage.getItem(FEED_SEEN)) || 0;
  } catch {
    return 0;
  }
}

/** The backend in use: the feed panel talks to it for notifications. */
export function currentBackend(): Backend {
  return backend;
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
    // The Den (W5): happenings that reach this tab by push, played once.
    case "sold":
      return `sold:${event.listing}`;
    case "listing_expired":
      return `listing:${event.listing}`;
    case "wager":
      return event.game === "wheel" ? `wheel:${event.round}:${event.option}` : null;
    // Raids (W6): raiders landing, a warning and a raid by another player arrive by push.
    case "raid_landed":
      return `raid:${event.report.id}`;
    case "raided":
      return `raided:${event.report.id}`;
    case "raid_warned":
      return `warned:${event.lands}`;
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
  bonds: {},
  dry: {},
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
  listings: [],
  listingSeq: 0,
  den: { day: -1, tier: "twig", offers: [], bought: {} },
  contracts: { day: -1, tier: "twig", ids: [], done: [] },
  casino: { day: -1, wagered: 0, won: 0 },
  wheelBets: [],
  stats: newStats(),
  raid: null,
  raidSeq: 0,
  raidReports: [],
  damaged: false,
  pvp: newPvp(),
});

const isServerOnly = (command: Command): boolean => SERVER_ONLY.includes(command.type);

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
            pending: get().pending.filter((key) => key !== next.key),
          });
          if (!next.predicted && response.ok) {
            // Nothing was shown for it yet: its events play now, and a roll goes to its table.
            play(response.events);
            // A raid's result is its report card (W6).
            const launched = response.events.find((event) => event.type === "raid_launched");
            if (launched?.type === "raid_launched") {
              get().openReport(launched.report.id);
              void get().loadRaids();
            }
            const wager = response.events.find((event) => event.type === "wager");
            if (wager?.type === "wager" && wager.game !== "wheel") {
              set({
                roll: {
                  game: wager.game,
                  result: wager.result,
                  bet: wager.bet,
                  payout: wager.payout,
                  at: performance.now() / 1000,
                },
              });
            }
          }
          if (!response.ok) {
            // The server saw a different base than the prediction did: say why, show its state.
            const message = refusalMessage(response.refusal, response.serverNow);
            if (message) get().toast(message);
          }
        } catch {
          set({ queue: [], pending: [] });
          get().toast({ text: t("toast.connection"), tone: "danger" });
          await reload();
          break;
        }
      }
    } finally {
      sending = false;
    }
  };

  /** New feed items from the stream: in front, once each. */
  const onFeed = (items: FeedItem[]): void => {
    const known = new Set(get().feed.map((item) => item.id));
    const fresh = items.filter((item) => !known.has(item.id)).sort((a, b) => b.id - a.id);
    if (fresh.length > 0) set({ feed: [...fresh, ...get().feed] });
  };

  /** The Den's news from the stream: bets and spins on the wheel, the jackpot, the board. */
  const onDen = (message: DenPush): void => {
    const board = get().board;
    switch (message.kind) {
      case "bet":
        if (board) set({ board: { ...board, bets: [...board.bets, message.bet] } });
        break;
      case "result":
        set({
          spin: { round: message.round, segment: message.segment },
          ...(board
            ? {
                board: {
                  ...board,
                  round: Math.max(board.round, message.round + 1),
                  bets: board.bets.filter((bet) => bet.round > message.round),
                  results: [
                    { round: message.round, segment: message.segment },
                    ...board.results.filter((result) => result.round !== message.round),
                  ].slice(0, 10),
                },
              }
            : {}),
        });
        break;
      case "jackpot":
        if (board) set({ board: { ...board, jackpot: message.jackpot } });
        break;
      case "board":
        if (get().panel === "den") void get().loadDen();
        break;
    }
  };

  const connect = async (): Promise<void> => {
    unsubscribe?.();
    unsubscribe = backend.subscribe(onPush, () => void reload(), onFeed, onDen);
    await reload();
    void get().loadFeed();
    // A "sold" notification opens the Den (`/?den`).
    if (new URLSearchParams(window.location.search).has("den")) {
      get().openDen("market");
      window.history.replaceState(null, "", window.location.pathname);
    }
    // A notification's tap opens the game on its report (`/?report=m12`), a raid's included.
    const report = new URLSearchParams(window.location.search).get("report");
    const { reports, raidReports } = get().base;
    if (report && [...reports, ...raidReports].some((candidate) => candidate.id === report)) {
      get().openReport(report);
      window.history.replaceState(null, "", window.location.pathname);
    }
    // The raid warning's tap opens the Defence panel (`/?defence`).
    if (new URLSearchParams(window.location.search).has("defence")) {
      get().openDefence("defence");
      window.history.replaceState(null, "", window.location.pathname);
    }
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
    feed: [],
    feedSeen: storedFeedSeen(),
    feedMore: false,
    denTab: "market",
    denSell: undefined,
    game: "wheel",
    feedTab: "feed",
    board: null,
    ranks: null,
    pending: [],
    spin: null,
    roll: null,
    defenceTab: "defence",
    raids: null,

    openDefence(tab) {
      set({ panel: "defence", recipe: null, ...(tab ? { defenceTab: tab } : {}) });
      void get().loadRaids();
    },

    setDefenceTab(defenceTab) {
      set({ defenceTab });
      if (defenceTab === "raids") void get().loadRaids();
    },

    async loadRaids() {
      try {
        set({ raids: await backend.raids() });
      } catch {
        // The list is a view: a failed load keeps what was there.
      }
    },

    repair: () => get().send({ type: "repair" }),
    setPvp(on) {
      const sent = get().send({ type: "set_pvp", on });
      if (sent) void get().loadRaids();
      return sent;
    },
    raidPlayer: (target) => get().send({ type: "raid_player", target }),

    demoRival(change) {
      if (!(backend instanceof LocalBackend)) return;
      backend.patchRival(change);
      void get().loadRaids();
    },

    openDen(tab) {
      set({ panel: "den", recipe: null, ...(tab ? { denTab: tab } : {}) });
      void get().loadDen();
    },

    setDenTab(denTab) {
      set({ denTab, denSell: undefined });
    },

    setDenSell(denSell) {
      set({ denSell });
    },

    setGame(game) {
      set({ game });
    },

    setFeedTab(feedTab) {
      set({ feedTab });
      if (feedTab === "ranks") void get().loadRanks();
    },

    async loadDen() {
      try {
        set({ board: await backend.den() });
      } catch {
        // The board is a view: a failed load keeps what was there.
      }
    },

    async loadRanks() {
      try {
        set({ ranks: await backend.ranks() });
      } catch {
        // Same: the tables stay as they were.
      }
    },

    list: (good, amount, price) => get().send({ type: "market_list", good, amount, price }),
    cancelListing: (listing) => get().send({ type: "market_cancel", listing }),
    buyListing: (listing) => get().send({ type: "market_buy", listing }),
    denBuy: (offer, lots) => get().send({ type: "den_buy", offer, lots }),
    deliver: (contract) => get().send({ type: "deliver", contract }),
    wheelBet: (segment, amount) => get().send({ type: "wheel_bet", segment, amount }),
    spinSlots: (amount) => get().send({ type: "slots_spin", amount }),
    rollDice: (option, amount) => get().send({ type: "dice_roll", option, amount }),

    demoDen(change) {
      if (!(backend instanceof LocalBackend)) return;
      backend.patchDen(change);
      void get().loadDen();
    },

    async loadFeed(older = false) {
      try {
        const before = older ? get().feed.at(-1)?.id : undefined;
        const page = await backend.feed(before);
        set({
          feed: older ? [...get().feed, ...page] : page,
          // A full page means there may be more behind it.
          feedMore: page.length >= 40,
        });
      } catch {
        // The feed is a nicety: a failed load leaves what was there.
      }
    },

    markFeedSeen() {
      const newest = get().feed[0]?.id ?? 0;
      if (newest <= get().feedSeen) return;
      set({ feedSeen: newest });
      try {
        localStorage.setItem(FEED_SEEN, String(newest));
      } catch {
        // Private mode: the dot comes back next visit, nothing worse.
      }
    },

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
      const due =
        (nextEventAt(content, base, { wheel: false }) ?? Number.POSITIVE_INFINITY) <= at ||
        regrown.length > 0;
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
      if (isServerOnly(command)) {
        // It needs the server (another base, a secret roll): send it and wait for the answer.
        const key = newKey();
        sentKeys.add(key);
        set({
          queue: [...state.queue, { key, command, at, predicted: false }],
          pending: [...state.pending, key],
        });
        void flush();
        return true;
      }
      const predicted = applyCommand(content, state.base, command, at);
      if (!predicted.ok) {
        set({ base: predicted.state });
        const message = refusalMessage(predicted.refusal, at);
        if (message) get().toast(message);
        return false;
      }
      const key = newKey();
      sentKeys.add(key);
      set({
        base: predicted.state,
        queue: [...state.queue, { key, command, at, predicted: true }],
      });
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
    assign: (survivor, job) => get().send({ type: "assign", survivor, job }),
    rest: (survivor) => get().send({ type: "rest", survivor }),
    restTired: () => get().send({ type: "rest_tired" }),

    openReport(id) {
      set({ report: id });
      const { reports, raidReports } = get().base;
      const report = id
        ? [...reports, ...raidReports].find((candidate) => candidate.id === id)
        : undefined;
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
