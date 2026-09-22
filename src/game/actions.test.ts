import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../content/load";
import { discoverPaths } from "../paths";
import { openDb } from "../store/db";
import { basesRepo, eventLogRepo, homeMessagesRepo } from "../store/repo";
import { eventLog } from "../store/schema";
import { Locale } from "../ui/locale";
import {
  collectAction,
  type Game,
  gatherAction,
  loadPlayer,
  startPlayer,
  upgradeToolAction,
} from "./actions";

const paths = discoverPaths();
const content = loadContent(paths.data, Locale.load(join(paths.locale, "en.json")));
const T0 = 1_700_000_000;

function game(): Game {
  return { db: openDb(":memory:", paths.migrations), content };
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
    // and capped by the twig storage (2500 total, 100 already banked).
    const collected = collectAction(g, player.id, T0 + 86400);
    expect(collected.gained).toEqual({ wood: 1440, stone: 960 });
    expect(collected.state.stock).toEqual({ wood: 1500, stone: 1000 });
  });
});

describe("idempotency", () => {
  it("collecting twice at the same instant banks once", () => {
    const g = game();
    const { player } = startPlayer(g, "1", "Kolt", T0);
    const first = collectAction(g, player.id, T0 + 3600);
    const second = collectAction(g, player.id, T0 + 3600);
    expect(first.gained).toEqual({ wood: 120, stone: 80 });
    expect(second.gained).toEqual({ wood: 0, stone: 0 });
    expect(second.state.stock).toEqual({ wood: 120, stone: 80 });
  });

  it("gathering twice within the cooldown grants one bonus", () => {
    const g = game();
    const { player } = startPlayer(g, "1", "Kolt", T0);
    expect(gatherAction(g, player.id, T0).ok).toBe(true);
    const second = gatherAction(g, player.id, T0 + 1);
    expect(second.ok).toBe(false);
    expect(basesRepo.load(g.db, player.id)?.stock).toEqual({ wood: 60, stone: 40 });
  });

  it("upgrading twice from a stale screen pays once", () => {
    const g = game();
    const { player, seasonId } = startPlayer(g, "1", "Kolt", T0);
    const rich = { ...startPlayer(g, "1", "Kolt", T0).state, stock: { wood: 300, stone: 150 } };
    basesRepo.save(g.db, player.id, seasonId, rich);

    const first = upgradeToolAction(g, player.id, T0);
    expect(first.ok).toBe(true);
    const second = upgradeToolAction(g, player.id, T0);
    expect(second).toMatchObject({ ok: false, reason: "unaffordable" });
    expect(basesRepo.load(g.db, player.id)?.toolId).toBe("stone_tools");
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
