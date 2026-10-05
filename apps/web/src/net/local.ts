/**
 * Demo mode: the whole game in the browser, on the same domain rules as the
 * server, over the demo clock (fast, pausable). Used by `?demo`, by the dev
 * server when no API is running, and by the screenshot script, which also
 * patches the state directly through `patch`.
 */
import { type BaseState, newBase } from "@wipe-day/domain/base";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import type { GameEvent } from "@wipe-day/domain/events";
import { type FeedItem, isFeedWorthy, type NotifyPrefs } from "@wipe-day/domain/feed";
import { settleAll } from "@wipe-day/domain/settle";
import type {
  CommandResponse,
  MeResponse,
  PushMessage,
  StateResponse,
} from "@wipe-day/domain/wire";
import { DEMO_SEASON_START, demoClocks } from "../state/clocks";
import { content, t } from "../state/world";
import type { Backend, NotifySettings, ServerConfig } from "./backend";

/** A base a few days in, so the demo shows the living base rather than an empty shore. */
function demoBase(now: number): BaseState {
  return {
    ...newBase(content, now - 3 * 3600, 20260928),
    tier: "wood",
    toolId: "stone_tools",
    stock: {
      timber: 1840,
      stone: 1210,
      ore: 260,
      sulfur_ore: 40,
      fibre: 90,
      ingots: 120,
      food: 60,
      scrap: 14,
      planks: 30,
      rope: 5,
    },
    items: { crate: 2, bow: 1, roast: 1 },
    buildings: { workbench: 1, campfire: 1, furnace: 1, garden: 1, loom: 1 },
    // The workbench is busy, so the first look shows a station at work.
    production: {
      workbench: [{ recipe: "planks", count: 5, done: 0, unitSeconds: 120, startedAt: now - 60 }],
    },
    lastCollectedAt: now - 3600,
    lastGatherAt: now - 20 * 60,
    upkeepPaidUntil: now,
    barrel: { spawnedAt: now - 15 * 60, expiresAt: now + 30 * 60, seed: 42 },
    nextBarrelAt: now + 4 * 3600,
  };
}

export class LocalBackend implements Backend {
  readonly mode = "demo";
  readonly clock = demoClocks.game;
  readonly loginUrl = "";
  private base: BaseState;
  private version = 1;
  /** The demo's feed: only the player's own happenings (there is nobody else). */
  private feedItems: FeedItem[] = [];
  private feedListener: ((items: FeedItem[]) => void) | null = null;
  private readonly player: MeResponse = {
    id: 0,
    name: t("hud.demo_player"),
    avatarUrl: null,
    devLogin: false,
  };

  constructor() {
    this.base = demoBase(this.clock.now());
  }

  async config(): Promise<ServerConfig> {
    return { devLogin: false, discordLogin: false };
  }

  async me(): Promise<MeResponse> {
    return this.player;
  }

  async state(): Promise<StateResponse> {
    const now = this.clock.now();
    this.base = settleAll(content, this.base, now).state;
    return {
      serverNow: now,
      version: this.version,
      player: this.player,
      seasonStartedAt: DEMO_SEASON_START,
      state: this.base,
      // The demo opens as if the player had been away, so the welcome back shows.
      welcomeBack: this.version === 1 ? { awaySeconds: 3 * 3600, events: [] } : null,
    };
  }

  async command(_key: string, command: Command): Promise<CommandResponse> {
    const now = this.clock.now();
    const result = applyCommand(content, this.base, command, now);
    this.base = result.state;
    this.version += 1;
    this.record(result.events, now);
    return result.ok
      ? {
          ok: true,
          serverNow: now,
          version: this.version,
          state: result.state,
          events: result.events,
        }
      : {
          ok: false,
          serverNow: now,
          version: this.version,
          state: result.state,
          events: result.events,
          refusal: result.refusal,
        };
  }

  private record(events: GameEvent[], at: number): void {
    const items = events.filter(isFeedWorthy).map((event, index) => ({
      id: this.version * 100 + index,
      at,
      playerId: this.player.id,
      playerName: this.player.name,
      event,
    }));
    if (items.length === 0) return;
    this.feedItems = [...items.reverse(), ...this.feedItems].slice(0, 100);
    this.feedListener?.(items);
  }

  subscribe(
    _onPush: (message: PushMessage) => void,
    _onReconnect: () => void,
    onFeed: (items: FeedItem[]) => void,
  ): () => void {
    this.feedListener = onFeed;
    return () => {
      this.feedListener = null;
    };
  }

  async feed(before?: number): Promise<FeedItem[]> {
    return this.feedItems.filter((item) => before === undefined || item.id < before);
  }

  /** The demo has no server to push from. */
  async notify(): Promise<NotifySettings | null> {
    return null;
  }

  async setNotify(): Promise<NotifyPrefs> {
    throw new Error("no notifications in demo mode");
  }

  async pushSubscribe(): Promise<void> {}
  async pushUnsubscribe(): Promise<void> {}

  /** Demo drawer and screenshots: overwrite parts of the base. Returns the new base. */
  patch(change: Partial<BaseState>): { state: BaseState; version: number } {
    this.base = { ...this.base, ...change };
    this.version += 1;
    return { state: this.base, version: this.version };
  }

  async devLogin(): Promise<void> {}
  async logout(): Promise<void> {}
}
