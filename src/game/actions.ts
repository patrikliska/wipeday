/**
 * Transaction scripts: one player action = load state, settle it to `now`,
 * apply a pure domain function, record task progress, save, log. Each runs
 * inside a single SQLite transaction, so a double click or a stale message
 * can never bank a reward twice: the second call sees the state the first
 * one wrote.
 *
 * Nothing here knows about Discord; the UI layer calls these and renders
 * whatever comes back.
 */
import type { Amounts, Content, Task } from "../content/schema";
import {
  type BarrelResult,
  breakBarrel,
  type HitResult,
  hitNode,
  progressTasks,
  settleAll,
  startNodeRun,
  type TaskDone,
} from "../domain/active";
import {
  type BaseState,
  type BuildResult,
  type BuyFurnaceResult,
  buyFurnace,
  type CraftResult,
  collect,
  collectFurnaces,
  craft,
  type GatherResult,
  gather,
  newBase,
  type SettleEvent,
  type SmeltResult,
  smelt,
  startBuild,
  total,
  type UpgradeResult,
  upgradeTool,
} from "../domain/base";
import { seedOf } from "../domain/rng";
import type { Db } from "../store/db";
import {
  basesRepo,
  eventLogRepo,
  hintsRepo,
  type Player,
  playersRepo,
  seasonsRepo,
} from "../store/repo";

export interface Game {
  db: Db;
  content: Content;
}

/** A player with their base loaded and settled: what every screen starts from. */
export interface Loaded {
  player: Player;
  seasonId: number;
  seasonStartedAt: number;
  state: BaseState;
  hintUses: Record<string, number>;
  /** What settling to `now` did (build landed, upkeep paid, decay). */
  settled: SettleEvent[];
}

/** Every successful action also reports the daily tasks it completed. */
export type WithTasks<R> = R & { completed: TaskDone[] };

function logEvents(
  game: Game,
  playerId: number,
  seasonId: number,
  now: number,
  events: SettleEvent[],
) {
  for (const event of events) {
    eventLogRepo.append(game.db, { at: now, playerId, seasonId, type: event.type, payload: event });
  }
}

/** Loads, settles and (if anything changed) saves. Inside the caller's transaction. */
function settled(game: Game, playerId: number, seasonId: number, now: number) {
  const stored = basesRepo.load(game.db, playerId);
  if (!stored) throw new Error(`player ${playerId} has no base`);
  const result = settleAll(game.content, stored, now);
  if (result.events.length > 0 || result.state !== stored) {
    basesRepo.save(game.db, playerId, seasonId, result.state);
    logEvents(game, playerId, seasonId, now, result.events);
  }
  return result;
}

/** `/start`: creates the player and base if new; otherwise just loads them. */
export function startPlayer(
  game: Game,
  discordId: string,
  displayName: string,
  now: number,
): Loaded & { created: boolean } {
  return game.db.transaction(() => {
    const season = seasonsRepo.current(game.db, now);
    let player = playersRepo.byDiscordId(game.db, discordId);
    let created = false;
    if (!player) {
      player = playersRepo.create(game.db, discordId, displayName, now);
      created = true;
    } else if (player.displayName !== displayName) {
      playersRepo.rename(game.db, player.id, displayName);
      player = { ...player, displayName };
    }
    if (!basesRepo.load(game.db, player.id)) {
      basesRepo.save(game.db, player.id, season.id, newBase(game.content, now));
      eventLogRepo.append(game.db, {
        at: now,
        playerId: player.id,
        seasonId: season.id,
        type: "player_start",
        payload: {},
      });
    }
    const result = settled(game, player.id, season.id, now);
    return {
      player,
      seasonId: season.id,
      seasonStartedAt: season.startedAt,
      state: result.state,
      hintUses: hintsRepo.uses(game.db, player.id),
      settled: result.events,
      created,
    };
  });
}

/** An existing player by Discord id (settled to `now`), or null if they never ran `/start`. */
export function loadPlayer(game: Game, discordId: string, now: number): Loaded | null {
  return game.db.transaction(() => {
    const player = playersRepo.byDiscordId(game.db, discordId);
    if (!player || !basesRepo.load(game.db, player.id)) return null;
    return loadById(game, player, now);
  });
}

export function loadById(game: Game, player: Player, now: number): Loaded {
  const season = seasonsRepo.current(game.db, now);
  const result = settled(game, player.id, season.id, now);
  return {
    player,
    seasonId: season.id,
    seasonStartedAt: season.startedAt,
    state: result.state,
    hintUses: hintsRepo.uses(game.db, player.id),
    settled: result.events,
  };
}

interface Outcome {
  state: BaseState;
  type: string;
  payload: unknown;
  /** Daily task progress this action earns. */
  task?: { kind: Task["kind"]; amount: number };
}

/**
 * Runs one domain step inside a transaction: settle, apply, record task
 * progress, save on success, log. Failed steps change nothing.
 */
function act<R extends { ok: boolean }>(
  game: Game,
  playerId: number,
  now: number,
  hint: string | null,
  step: (state: BaseState) => R,
  outcome: (result: R & { ok: true }) => Outcome,
): WithTasks<R> {
  return game.db.transaction(() => {
    const seasonId = seasonsRepo.current(game.db, now).id;
    const { state } = settled(game, playerId, seasonId, now);
    const result = step(state);
    if (!result.ok) return { ...result, completed: [] };
    const done = outcome(result as R & { ok: true });
    let next = done.state;
    let completed: TaskDone[] = [];
    if (done.task) {
      const progressed = progressTasks(game.content, next, done.task.kind, done.task.amount);
      next = progressed.state;
      completed = progressed.completed;
    }
    basesRepo.save(game.db, playerId, seasonId, next);
    if (hint) hintsRepo.bump(game.db, playerId, hint);
    eventLogRepo.append(game.db, {
      at: now,
      playerId,
      seasonId,
      type: done.type,
      payload: done.payload,
    });
    for (const task of completed) {
      eventLogRepo.append(game.db, {
        at: now,
        playerId,
        seasonId,
        type: "task_done",
        payload: { task: task.task.id, reward: task.reward },
      });
    }
    return { ...result, state: next, completed };
  });
}

export function collectAction(
  game: Game,
  playerId: number,
  now: number,
): WithTasks<{ state: BaseState; gained: Amounts }> {
  return act(
    game,
    playerId,
    now,
    "collect",
    (state) => ({ ok: true as const, ...collect(game.content, state, now) }),
    (r) => ({
      state: r.state,
      type: "collect",
      payload: r.gained,
      task: { kind: "collect", amount: total(r.gained) > 0 ? 1 : 0 },
    }),
  );
}

/** Gather, and open a node run on the fresh bonus. */
export function gatherAction(game: Game, playerId: number, now: number): WithTasks<GatherResult> {
  return act(
    game,
    playerId,
    now,
    "gather",
    (state) => gather(game.content, state, now),
    (r) => ({
      state: startNodeRun(game.content, r.state, now, seedOf(playerId, now)),
      type: "gather",
      payload: { gained: r.gained, bonus: r.bonus },
      task: { kind: "gather", amount: 1 },
    }),
  );
}

export function hitNodeAction(
  game: Game,
  playerId: number,
  now: number,
  position: number,
): WithTasks<HitResult> {
  return act(
    game,
    playerId,
    now,
    null,
    (state) => hitNode(game.content, state, now, position),
    (r) => ({
      state: r.state,
      type: "node_hit",
      payload: { hit: r.run.hits, gained: r.gained, ended: r.run.ended },
      task: { kind: "node_hits", amount: total(r.gained) > 0 ? 1 : 0 },
    }),
  );
}

export function breakBarrelAction(
  game: Game,
  playerId: number,
  now: number,
): WithTasks<BarrelResult> {
  return act(
    game,
    playerId,
    now,
    "barrel",
    (state) => breakBarrel(game.content, state, now),
    (r) => ({
      state: r.state,
      type: "barrel",
      payload: r.loot,
      task: { kind: "barrel", amount: 1 },
    }),
  );
}

export function upgradeToolAction(
  game: Game,
  playerId: number,
  now: number,
): WithTasks<UpgradeResult> {
  return act(
    game,
    playerId,
    now,
    "tools",
    (state) => upgradeTool(game.content, state, now),
    (r) => ({
      state: r.state,
      type: "tool_upgrade",
      payload: { tool: r.tool.id, paid: r.paid, gained: r.gained },
    }),
  );
}

export function buildAction(game: Game, playerId: number, now: number): WithTasks<BuildResult> {
  return act(
    game,
    playerId,
    now,
    "build",
    (state) => startBuild(game.content, state, now),
    (r) => ({
      state: r.state,
      type: "build_start",
      payload: { tier: r.tier.id, paid: r.paid, endsAt: r.endsAt },
    }),
  );
}

export function buyFurnaceAction(
  game: Game,
  playerId: number,
  now: number,
): WithTasks<BuyFurnaceResult> {
  return act(
    game,
    playerId,
    now,
    "furnace",
    (state) => buyFurnace(game.content, state),
    (r) => ({
      state: r.state,
      type: "furnace_bought",
      payload: { furnace: r.furnace.id, paid: r.paid },
    }),
  );
}

export function smeltAction(
  game: Game,
  playerId: number,
  now: number,
  ore: string,
): WithTasks<SmeltResult> {
  return act(
    game,
    playerId,
    now,
    "furnace",
    (state) => smelt(game.content, state, now, ore),
    (r) => ({
      state: r.state,
      type: "smelt_start",
      payload: { job: r.job, fuel: r.fuel },
      task: { kind: "smelt", amount: r.job.amount },
    }),
  );
}

export function collectFurnacesAction(
  game: Game,
  playerId: number,
  now: number,
): WithTasks<{ state: BaseState; gained: Amounts }> {
  return act(
    game,
    playerId,
    now,
    "furnace",
    (state) => ({ ok: true as const, ...collectFurnaces(game.content, state, now) }),
    (r) => ({
      state: r.state,
      type: "furnace_collect",
      payload: r.gained,
      task: { kind: "furnace_collect", amount: total(r.gained) },
    }),
  );
}

export function craftAction(
  game: Game,
  playerId: number,
  now: number,
  itemId: string,
): WithTasks<CraftResult> {
  return act(
    game,
    playerId,
    now,
    "craft",
    (state) => craft(game.content, state, itemId),
    (r) => ({
      state: r.state,
      type: "craft",
      payload: { item: itemId, paid: r.paid },
      task: { kind: "craft", amount: 1 },
    }),
  );
}
