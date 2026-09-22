import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../content/load";
import { discoverPaths } from "../paths";
import { tick } from "../scheduler/scheduler";
import { openDb } from "../store/db";
import { basesRepo, eventLogRepo, homeMessagesRepo } from "../store/repo";
import { eventLog } from "../store/schema";
import { Locale } from "../ui/locale";
import {
  buildAction,
  buyFurnaceAction,
  collectAction,
  collectFurnacesAction,
  craftAction,
  type Game,
  gatherAction,
  loadPlayer,
  smeltAction,
  startPlayer,
  upgradeToolAction,
} from "./actions";

const paths = discoverPaths();
const content = loadContent(paths.data, Locale.load(join(paths.locale, "en.json")));
const T0 = 1_700_000_000;
const HOUR = 3600;

function game(): Game {
  return { db: openDb(":memory:", paths.migrations), content };
}

function give(g: Game, playerId: number, stock: Record<string, number>, extra = {}) {
  const state = basesRepo.load(g.db, playerId);
  if (!state) throw new Error("no base");
  basesRepo.save(g.db, playerId, 1, { ...state, stock: { ...state.stock, ...stock }, ...extra });
}

describe("startPlayer", () => {
  it("creates once and then only loads, keeping the name fresh", () => {
    const g = game();
    const first = startPlayer(g, "1", "Kolt", T0);
    expect(first.created).toBe(true);
    expect(first.state.stock).toEqual({ wood: 0, stone: 0 });

    const again = startPlayer(g, "1", "Kolt500", T0 + 10);
    expect(again.created).toBe(false);
    expect(again.player.id).toBe(first.player.id);
    expect(again.player.displayName).toBe("Kolt500");
    expect(again.state.lastCollectedAt).toBe(T0);
    expect(loadPlayer(g, "2", T0)).toBeNull();
  });
});

describe("offline accrual across restarts", () => {
  it("survives a save/load round trip byte for byte", () => {
    const g = game();
    const { player, seasonId } = startPlayer(g, "1", "Kolt", T0);
    const afterGather = gatherAction(g, player.id, T0);
    if (!afterGather.ok) throw new Error("expected ok");

    // "Restart": a fresh load from the database must equal what was saved.
    const reloaded = basesRepo.load(g.db, player.id);
    expect(reloaded).toEqual(afterGather.state);
    basesRepo.save(g.db, player.id, seasonId, afterGather.state);
    expect(basesRepo.load(g.db, player.id)).toEqual(afterGather.state);

    // Collect a day later: the accrual is computed from the persisted timestamp
    // and each resource stops at the twig cap (1500; 60 wood and 40 stone banked).
    const collected = collectAction(g, player.id, T0 + 86400);
    expect(collected.gained).toEqual({ wood: 1440, stone: 1460 });
    expect(collected.state.stock).toEqual({ wood: 1500, stone: 1500 });
  });

  it("persists furnace jobs and items", () => {
    const g = game();
    const { player } = startPlayer(g, "1", "Kolt", T0);
    give(g, player.id, { wood: 5000, stone: 3000, metal_ore: 400 }, { tier: "wood" });
    expect(buyFurnaceAction(g, player.id, T0).ok).toBe(true);
    expect(craftAction(g, player.id, T0, "workbench_1").ok).toBe(true);
    const smelted = smeltAction(g, player.id, T0, "metal_ore");
    if (!smelted.ok) throw new Error(`expected ok, got ${smelted.reason}`);
    const reloaded = basesRepo.load(g.db, player.id);
    expect(reloaded?.furnaceJobs).toEqual([smelted.job]);
    expect(reloaded?.items).toEqual({ workbench_1: 1 });
    expect(reloaded?.furnaceId).toBe("furnace");
  });
});

describe("idempotency", () => {
  it("collecting twice at the same instant banks once", () => {
    const g = game();
    const { player } = startPlayer(g, "1", "Kolt", T0);
    const first = collectAction(g, player.id, T0 + HOUR);
    const second = collectAction(g, player.id, T0 + HOUR);
    expect(first.gained).toEqual({ wood: 120, stone: 80 });
    expect(second.gained).toEqual({ wood: 0, stone: 0 });
    expect(second.state.stock).toEqual({ wood: 120, stone: 80 });
  });

  it("gathering twice within the cooldown grants one bonus", () => {
    const g = game();
    const { player } = startPlayer(g, "1", "Kolt", T0);
    expect(gatherAction(g, player.id, T0).ok).toBe(true);
    expect(gatherAction(g, player.id, T0 + 1).ok).toBe(false);
    expect(basesRepo.load(g.db, player.id)?.stock).toEqual({ wood: 60, stone: 40 });
  });

  it("upgrading twice from a stale screen pays once", () => {
    const g = game();
    const { player } = startPlayer(g, "1", "Kolt", T0);
    give(g, player.id, { wood: 300, stone: 150 });
    expect(upgradeToolAction(g, player.id, T0).ok).toBe(true);
    expect(upgradeToolAction(g, player.id, T0)).toMatchObject({
      ok: false,
      reason: "unaffordable",
    });
    expect(basesRepo.load(g.db, player.id)?.toolId).toBe("stone_tools");
  });

  it("building twice pays once; the tier lands exactly once", () => {
    const g = game();
    const { player } = startPlayer(g, "1", "Kolt", T0);
    give(g, player.id, { wood: 2000, stone: 800 });
    const first = buildAction(g, player.id, T0);
    expect(first).toMatchObject({ ok: true });
    expect(buildAction(g, player.id, T0)).toMatchObject({ ok: false, reason: "unaffordable" });
    expect(basesRepo.load(g.db, player.id)?.tier).toBe("wood");
  });

  it("collecting furnace output twice hands it out once", () => {
    const g = game();
    const { player } = startPlayer(g, "1", "Kolt", T0);
    give(g, player.id, { wood: 5000, stone: 3000, metal_ore: 400 }, { tier: "wood" });
    buyFurnaceAction(g, player.id, T0);
    smeltAction(g, player.id, T0, "metal_ore");
    const first = collectFurnacesAction(g, player.id, T0 + 10 * HOUR);
    const second = collectFurnacesAction(g, player.id, T0 + 10 * HOUR);
    expect(first.gained).toEqual({ metal_fragments: 400 });
    expect(second.gained).toEqual({});
    expect(basesRepo.load(g.db, player.id)?.furnaceJobs).toEqual([]);
  });
});

describe("settle on load and the scheduler", () => {
  it("lands a finished build when the player next looks, once", () => {
    const g = game();
    const { player } = startPlayer(g, "1", "Kolt", T0);
    give(g, player.id, { wood: 5000, stone: 9000, metal_fragments: 1200 }, { tier: "wood" });
    const started = buildAction(g, player.id, T0);
    if (!started.ok) throw new Error("expected ok");
    expect(loadPlayer(g, "1", started.endsAt - 1)?.state.tier).toBe("wood");
    const landed = loadPlayer(g, "1", started.endsAt);
    expect(landed?.state.tier).toBe("stone");
    expect(landed?.settled).toEqual([{ type: "build_done", tier: "stone" }]);
    expect(loadPlayer(g, "1", started.endsAt + 1)?.settled).toEqual([]);
  });

  it("the tick resolves ended builds and refreshes only those players", async () => {
    const g = game();
    const a = startPlayer(g, "1", "A", T0);
    const b = startPlayer(g, "2", "B", T0);
    give(g, a.player.id, { wood: 5000, stone: 9000, metal_fragments: 1200 }, { tier: "wood" });
    const started = buildAction(g, a.player.id, T0);
    if (!started.ok) throw new Error("expected ok");
    const refreshed: number[] = [];
    const hooks = {
      refreshHome: async (_app: unknown, playerId: number) => void refreshed.push(playerId),
    };
    const app = g as unknown as Parameters<typeof tick>[0];

    expect(await tick(app, hooks, started.endsAt - 1)).toEqual([]);
    expect(await tick(app, hooks, started.endsAt)).toEqual([a.player.id]);
    expect(refreshed).toEqual([a.player.id]);
    expect(basesRepo.load(g.db, a.player.id)?.tier).toBe("stone");
    expect(basesRepo.load(g.db, b.player.id)?.tier).toBe("twig");
    expect(await tick(app, hooks, started.endsAt + 60)).toEqual([]);
  });
});

it("logs every state change and tracks hint uses", () => {
  const g = game();
  const { player } = startPlayer(g, "1", "Kolt", T0);
  gatherAction(g, player.id, T0);
  collectAction(g, player.id, T0 + 60);
  const types = g.db
    .select()
    .from(eventLog)
    .all()
    .map((row) => row.type);
  expect(types).toEqual(["player_start", "gather", "collect"]);
  expect(loadPlayer(g, "1", T0)?.hintUses).toEqual({ gather: 1, collect: 1 });
  eventLogRepo.append(g.db, {
    at: T0,
    playerId: null,
    seasonId: null,
    type: "note",
    payload: null,
  });
});

it("remembers one home message per player", () => {
  const g = game();
  const { player } = startPlayer(g, "1", "Kolt", T0);
  expect(homeMessagesRepo.get(g.db, player.id)).toBeNull();
  homeMessagesRepo.set(g.db, player.id, { channelId: "c1", messageId: "m1" }, T0);
  homeMessagesRepo.set(g.db, player.id, { channelId: "c1", messageId: "m2" }, T0 + 1);
  expect(homeMessagesRepo.get(g.db, player.id)).toEqual({ channelId: "c1", messageId: "m2" });
  homeMessagesRepo.clear(g.db, player.id);
  expect(homeMessagesRepo.get(g.db, player.id)).toBeNull();
});
