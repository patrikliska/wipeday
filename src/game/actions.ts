/**
 * Transaction scripts: one player action = load state, settle it to `now`,
 * apply a pure domain function, save, log. Each runs inside a single SQLite
 * transaction, so a double click or a stale message can never bank a reward
 * twice: the second call sees the state the first one wrote.
 *
 * Nothing here knows about Discord; the UI layer calls these and renders
 * whatever comes back.
 */
import type { Amounts, Content } from "../content/schema";
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
  settle,
  smelt,
  startBuild,
  type UpgradeResult,
  upgradeTool,
} from "../domain/base";
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
  const result = settle(game.content, stored, now);
  if (result.events.length > 0) {
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

/** Runs one domain step inside a transaction: settle, apply, save on success, log. */
function act<R extends { ok: boolean }>(
  game: Game,
  playerId: number,
  now: number,
  hint: string | null,
  step: (state: BaseState) => R,
  outcome: (result: R & { ok: true }) => { state: BaseState; type: string; payload: unknown },
): R {
  return game.db.transaction(() => {
    const seasonId = seasonsRepo.current(game.db, now).id;
    const { state } = settled(game, playerId, seasonId, now);
    const result = step(state);
    if (!result.ok) return result;
    const done = outcome(result as R & { ok: true });
    basesRepo.save(game.db, playerId, seasonId, done.state);
    if (hint) hintsRepo.bump(game.db, playerId, hint);
    eventLogRepo.append(game.db, {
      at: now,
      playerId,
      seasonId,
      type: done.type,
      payload: done.payload,
    });
    return result;
  });
}

export function collectAction(
  game: Game,
  playerId: number,
  now: number,
): { state: BaseState; gained: Amounts } {
  const result = act(
    game,
    playerId,
    now,
    "collect",
    (state) => ({ ok: true as const, ...collect(game.content, state, now) }),
    (r) => ({ state: r.state, type: "collect", payload: r.gained }),
  );
  return { state: result.state, gained: result.gained };
}

export function gatherAction(game: Game, playerId: number, now: number): GatherResult {
  return act(
    game,
    playerId,
    now,
    "gather",
    (state) => gather(game.content, state, now),
    (r) => ({ state: r.state, type: "gather", payload: { gained: r.gained, bonus: r.bonus } }),
  );
}

export function upgradeToolAction(game: Game, playerId: number, now: number): UpgradeResult {
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

export function buildAction(game: Game, playerId: number, now: number): BuildResult {
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

export function buyFurnaceAction(game: Game, playerId: number, now: number): BuyFurnaceResult {
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

export function smeltAction(game: Game, playerId: number, now: number, ore: string): SmeltResult {
  return act(
    game,
    playerId,
    now,
    "furnace",
    (state) => smelt(game.content, state, now, ore),
    (r) => ({ state: r.state, type: "smelt_start", payload: { job: r.job, fuel: r.fuel } }),
  );
}

export function collectFurnacesAction(
  game: Game,
  playerId: number,
  now: number,
): { state: BaseState; gained: Amounts } {
  const result = act(
    game,
    playerId,
    now,
    "furnace",
    (state) => ({ ok: true as const, ...collectFurnaces(game.content, state, now) }),
    (r) => ({ state: r.state, type: "furnace_collect", payload: r.gained }),
  );
  return { state: result.state, gained: result.gained };
}

export function craftAction(
  game: Game,
  playerId: number,
  now: number,
  itemId: string,
): CraftResult {
  return act(
    game,
    playerId,
    now,
    "craft",
    (state) => craft(game.content, state, itemId),
    (r) => ({ state: r.state, type: "craft", payload: { item: itemId, paid: r.paid } }),
  );
}
