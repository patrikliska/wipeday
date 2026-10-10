/**
 * Demo mode: the whole game in the browser, on the demo's game clock (1× with jumps, D138).
 * It runs the same `applyCommand` the server runs and keeps outcome-only records by key like
 * the API (D134), so the client behaves exactly as against a server. Friends (Hollis, the
 * group) arrive with R2's Wipe Days and R6.
 */
import { applyCommand, type Command, isSlim } from "@wipe-day/domain/commands";
import { settle } from "@wipe-day/domain/settle";
import { type BaseState, newBase } from "@wipe-day/domain/state";
import type {
  CommandOutcome,
  CommandResponse,
  MeResponse,
  PushMessage,
  StateResponse,
} from "@wipe-day/domain/wire";
import { demoClocks } from "../state/clocks";
import { content, t } from "../state/world";
import type { Backend, ServerConfig } from "./backend";

const SEED = 7;

export class LocalBackend implements Backend {
  readonly mode = "demo";
  readonly clock = demoClocks.game;
  readonly loginUrl = "";
  private base: BaseState;
  private version = 1;
  private readonly records = new Map<string, CommandOutcome>();

  constructor() {
    this.base = newBase(content, this.clock.now(), SEED);
  }

  async config(): Promise<ServerConfig> {
    return { devLogin: false, discordLogin: false };
  }

  async me(): Promise<MeResponse> {
    return { id: 0, name: t("hud.demo_player"), avatarUrl: null, devLogin: false };
  }

  async state(): Promise<StateResponse> {
    const now = this.clock.now();
    const settled = settle(content, this.base, now);
    if (settled.changed) {
      this.base = settled.state;
      this.version += 1;
    }
    const player = { id: 0, name: t("hud.demo_player"), avatarUrl: null };
    return {
      serverNow: now,
      version: this.version,
      player,
      state: settled.state,
      welcomeBack: null,
    };
  }

  async command(key: string, command: Command): Promise<CommandResponse> {
    const now = this.clock.now();
    const stored = this.records.get(key);
    if (stored) {
      const state = settle(content, this.base, now).state;
      return { ...stored, version: this.version, serverNow: now, state, events: [], replay: true };
    }
    const result = applyCommand(content, this.base, command, now);
    if (result.changed) {
      this.base = result.state;
      this.version += 1;
    }
    const tapped = result.events.find((event) => event.type === "tapped");
    const outcome: CommandOutcome = result.ok
      ? isSlim(command)
        ? {
            ok: true,
            version: this.version,
            credited: tapped?.type === "tapped" ? tapped.credited : 0,
          }
        : { ok: true, version: this.version, events: result.events }
      : { ok: false, version: this.version, refusal: result.refusal };
    this.records.set(key, outcome);
    return { ...outcome, serverNow: now, state: result.state, events: result.events };
  }

  subscribe(_onPush: (message: PushMessage) => void, _onReconnect: () => void): () => void {
    return () => {};
  }

  async devLogin(): Promise<void> {}

  async logout(): Promise<void> {}

  /** Demo drawer and shots: rewrites the run, as if the player had played a while. */
  patch(change: Partial<BaseState["run"]>): BaseState {
    const now = this.clock.now();
    const base = settle(content, this.base, now).state;
    this.base = { ...base, run: { ...base.run, ...change, settledAt: now } };
    this.version += 1;
    return this.base;
  }

  /** Demo drawer: a fresh island (a new run 1), as a new player would see it. */
  reset(): BaseState {
    this.base = newBase(content, this.clock.now(), SEED);
    this.version += 1;
    this.records.clear();
    return this.base;
  }
}
