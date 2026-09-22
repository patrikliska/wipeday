/**
 * Transaction scripts: one player action = load state, apply a pure domain
 * function, save, log. Each runs inside a single SQLite transaction, so a
 * double click or a stale message can never bank a reward twice: the second
 * call sees the state the first one wrote.
 *
 * Nothing here knows about Discord; the UI layer calls these and renders
 * whatever comes back.
 */
import type { Amounts, Content } from "../content/schema";
import {
  type BaseState,
  collect,
  type GatherResult,
  gather,
  newBase,
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

/** A player with their base loaded: what every screen starts from. */
export interface Loaded {
  player: Player;
  seasonId: number;
  seasonStartedAt: number;
  state: BaseState;
  hintUses: Record<string, number>;
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
    let state = basesRepo.load(game.db, player.id);
    if (!state) {
      state = newBase(game.content, now);
      basesRepo.save(game.db, player.id, season.id, state);
      eventLogRepo.append(game.db, {
        at: now,
        playerId: player.id,
        seasonId: season.id,
        type: "player_start",
        payload: {},
      });
    }
    return {
      player,
      seasonId: season.id,
      seasonStartedAt: season.startedAt,
      state,
      hintUses: hintsRepo.uses(game.db, player.id),
      created,
    };
  });
}

/** An existing player by Discord id, or null if they never ran `/start`. */
export function loadPlayer(game: Game, discordId: string, now: number): Loaded | null {
  const player = playersRepo.byDiscordId(game.db, discordId);
  if (!player) return null;
  const state = basesRepo.load(game.db, player.id);
  if (!state) return null;
  const season = seasonsRepo.current(game.db, now);
  return {
    player,
    seasonId: season.id,
    seasonStartedAt: season.startedAt,
    state,
    hintUses: hintsRepo.uses(game.db, player.id),
  };
}

function mustLoad(game: Game, playerId: number): { state: BaseState; seasonId: number } {
  const state = basesRepo.load(game.db, playerId);
  if (!state) throw new Error(`player ${playerId} has no base`);
  return { state, seasonId: seasonsRepo.current(game.db, 0).id };
}

export function collectAction(
  game: Game,
  playerId: number,
  now: number,
): { state: BaseState; gained: Amounts } {
  return game.db.transaction(() => {
    const { state, seasonId } = mustLoad(game, playerId);
    const result = collect(game.content, state, now);
    basesRepo.save(game.db, playerId, seasonId, result.state);
    hintsRepo.bump(game.db, playerId, "collect");
    eventLogRepo.append(game.db, {
      at: now,
      playerId,
      seasonId,
      type: "collect",
      payload: result.gained,
    });
    return result;
  });
}

export function gatherAction(game: Game, playerId: number, now: number): GatherResult {
  return game.db.transaction(() => {
    const { state, seasonId } = mustLoad(game, playerId);
    const result = gather(game.content, state, now);
    if (!result.ok) return result;
    basesRepo.save(game.db, playerId, seasonId, result.state);
    hintsRepo.bump(game.db, playerId, "gather");
    eventLogRepo.append(game.db, {
      at: now,
      playerId,
      seasonId,
      type: "gather",
      payload: { gained: result.gained, bonus: result.bonus },
    });
    return result;
  });
}

export function upgradeToolAction(game: Game, playerId: number, now: number): UpgradeResult {
  return game.db.transaction(() => {
    const { state, seasonId } = mustLoad(game, playerId);
    const result = upgradeTool(game.content, state, now);
    if (!result.ok) return result;
    basesRepo.save(game.db, playerId, seasonId, result.state);
    hintsRepo.bump(game.db, playerId, "tools");
    eventLogRepo.append(game.db, {
      at: now,
      playerId,
      seasonId,
      type: "tool_upgrade",
      payload: { tool: result.tool.id, paid: result.paid, gained: result.gained },
    });
    return result;
  });
}
