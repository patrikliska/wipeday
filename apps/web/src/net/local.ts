/**
 * Demo mode: the whole game in the browser, on the same domain rules as the
 * server, over the demo clock (fast, pausable). Used by `?demo`, by the dev
 * server when no API is running, and by the screenshot script, which also
 * patches the state directly through `patch`.
 */
import { type BaseState, newBase } from "@wipe-day/domain/base";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import { settleAll } from "@wipe-day/domain/settle";
import type {
  CommandResponse,
  MeResponse,
  PushMessage,
  StateResponse,
} from "@wipe-day/domain/wire";
import { DEMO_SEASON_START, demoClocks } from "../state/clocks";
import { content, t } from "../state/world";
import type { Backend, ServerConfig } from "./backend";

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
      scrap: 14,
    },
    items: { crate: 2, bow: 1 },
    buildings: { workbench: 1, campfire: 1, furnace: 1, garden: 1 },
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

  subscribe(_onPush: (message: PushMessage) => void, _onReconnect: () => void): () => void {
    return () => undefined;
  }

  /** Demo drawer and screenshots: overwrite parts of the base. Returns the new base. */
  patch(change: Partial<BaseState>): { state: BaseState; version: number } {
    this.base = { ...this.base, ...change };
    this.version += 1;
    return { state: this.base, version: this.version };
  }

  async devLogin(): Promise<void> {}
  async logout(): Promise<void> {}
}
