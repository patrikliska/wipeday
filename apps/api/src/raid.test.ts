import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGame } from "@wipe-day/content/load";
import type { BaseState } from "@wipe-day/domain/base";
import { manualClock } from "@wipe-day/domain/clock";
import { rng } from "@wipe-day/domain/rng";
import { nextEventAt } from "@wipe-day/domain/settle";
import type { RaidsResponse } from "@wipe-day/domain/wire";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import type { Config } from "./config";
import { type CommandResponse, Game } from "./game";
import { EventHub } from "./hub";
import { log } from "./log";
import { Notifier } from "./push";
import { openDb } from "./store/db";
import { bases, eventLog } from "./store/schema";

const { content, locale } = loadGame();
const T0 = 1_700_006_400 - (1_700_006_400 % 86_400) + 12 * 3600;
const HOUR = 3600;
const { pvp } = content.raids;

const config: Config = {
  production: false,
  port: 0,
  publicUrl: "http://localhost:5173",
  discord: null,
  databasePath: ":memory:",
  backupDir: "",
  webDist: join(tmpdir(), "wipe-day-no-web-build"),
  devLogin: true,
};

/** A seed whose first roll is above every hold chance: the raid gets in. */
const BREACH = (() => {
  for (let seed = 1; ; seed++) if (rng(seed).next() * 100 >= content.raids.maxChance) return seed;
})();

function setup() {
  const db = openDb(":memory:");
  const hub = new EventHub();
  const clock = manualClock(T0);
  const sent: { endpoint: string; payload: string }[] = [];
  const notifier = new Notifier(
    db,
    locale,
    log,
    "mailto:test@localhost.invalid",
    async (to, payload) => {
      sent.push({ endpoint: to.endpoint, payload });
      return { statusCode: 201 };
    },
  );
  const game = new Game({
    db,
    content,
    clock,
    hub,
    newSeed: () => 7,
    rollSeed: () => BREACH,
    notify: (playerId, events) => notifier.notify(playerId, events),
  });
  const app = createApp({ db, game, hub, clock, config, discord: null, notifier });

  const stored = (playerId: number): BaseState => {
    const row = db.select().from(bases).where(eq(bases.playerId, playerId)).get();
    if (!row) throw new Error("no base");
    return JSON.parse(row.stateJson) as BaseState;
  };
  const patch = (playerId: number, change: (state: BaseState) => BaseState) => {
    const next = change(stored(playerId));
    db.update(bases)
      .set({ stateJson: JSON.stringify(next), nextEventAt: nextEventAt(content, next) })
      .where(eq(bases.playerId, playerId))
      .run();
  };
  /** A Sheet Metal holdfast in the raids, with charges and a yard worth raiding. */
  const login = async (slot: number, inRaids = true): Promise<string> => {
    const response = await app.request("/api/dev/login", {
      method: "POST",
      body: JSON.stringify({ slot }),
      headers: { "content-type": "application/json" },
    });
    const cookie = response.headers.getSetCookie()[0]?.split(";")[0] ?? "";
    await app.request("/api/state", { headers: { cookie } });
    patch(slot, (state) => ({
      ...state,
      tier: "metal",
      upkeepPaidUntil: T0 + 10 * 24 * HOUR,
      stock: { timber: 30_000, stone: 30_000, ingots: 10_000, scrap: 2000, charge: 40 },
      pvp: { ...state.pvp, on: inRaids },
    }));
    return cookie;
  };
  const send = async (cookie: string, key: string, command: unknown): Promise<CommandResponse> => {
    const response = await app.request("/api/commands", {
      method: "POST",
      body: JSON.stringify({ key, command }),
      headers: { cookie, "content-type": "application/json" },
    });
    expect(response.status).toBe(200);
    return (await response.json()) as CommandResponse;
  };
  const get = async <T>(cookie: string, path: string): Promise<T> =>
    (await (await app.request(path, { headers: { cookie } })).json()) as T;
  const logged = (playerId: number, type: string) =>
    db
      .select()
      .from(eventLog)
      .where(and(eq(eventLog.playerId, playerId), eq(eventLog.type, type)))
      .all().length;
  return { db, game, clock, notifier, sent, stored, patch, login, send, get, logged };
}

const raid = (target: number) => ({ type: "raid_player", target });

describe("a PvP raid on the server", () => {
  it("is one transaction over both bases: what one loses the other gains", async () => {
    const { login, send, stored, logged, game } = setup();
    const [p1] = [await login(1), await login(2)];
    const before = stored(2);
    const response = await send(p1, "raid-one-0001", raid(2));
    expect(response.ok).toBe(true);
    const attacker = stored(1);
    const defender = stored(2);
    for (const id of ["timber", "stone", "ingots", "scrap"]) {
      const lost = (before.stock[id] ?? 0) - (defender.stock[id] ?? 0);
      expect(lost, id).toBeGreaterThan(0);
      expect(attacker.stock[id], id).toBe((before.stock[id] ?? 0) + lost);
    }
    expect(attacker.stock.charge).toBe(40 - (pvp.charges.metal ?? 0));
    expect(defender.pvp.shieldUntil).toBe(T0 + pvp.shieldHours * HOUR);
    expect(defender.pvp.revenge).toMatchObject([
      { attacker: 1, until: T0 + pvp.revengeHours * HOUR },
    ]);
    expect(logged(1, "raid_launched")).toBe(1);
    expect(logged(2, "raided")).toBe(1);
    expect(game.feed().some((item) => item.event.type === "raid_launched")).toBe(true);
  });

  it("two attackers on one target: the second meets the shield", async () => {
    const { login, send, stored } = setup();
    const [p1, , p3] = [await login(1), await login(2), await login(3)];
    const [first, second] = await Promise.all([
      send(p1, "raid-race-001", raid(2)),
      send(p3, "raid-race-003", raid(2)),
    ]);
    const refusals = [first, second].filter((response) => !response.ok);
    expect([first, second].filter((response) => response.ok)).toHaveLength(1);
    expect(refusals[0]).toMatchObject({ refusal: { code: "shielded" } });
    expect(stored(2).raidReports.filter((report) => report.kind === "pvp_in")).toHaveLength(1);
  });

  it("a replayed key raids once and answers the same", async () => {
    const { login, send, stored } = setup();
    const [p1] = [await login(1), await login(2)];
    const first = await send(p1, "raid-replay-1", raid(2));
    const after = stored(2).stock;
    const again = await send(p1, "raid-replay-1", raid(2));
    expect(again).toEqual(first);
    expect(stored(2).stock).toEqual(after);
  });

  it("50 parallel attacks with distinct keys get exactly one through", async () => {
    const { login, send, stored } = setup();
    const [p1] = [await login(1), await login(2)];
    const responses = await Promise.all(
      Array.from({ length: 50 }, (_, index) => send(p1, `raid-flood-${index}`, raid(2))),
    );
    expect(responses.filter((response) => response.ok)).toHaveLength(1);
    expect(stored(1).stock.charge).toBe(40 - (pvp.charges.metal ?? 0));
    expect(stored(2).raidReports.filter((report) => report.kind === "pvp_in")).toHaveLength(1);
  });

  it("the defender's due NPC raid lands first, and the PvP take is on what is left", async () => {
    const { login, send, stored, patch } = setup();
    const [p1] = [await login(1), await login(2)];
    patch(2, (state) => ({
      ...state,
      lastCollectedAt: T0 - 60,
      raid: { at: T0 - 60, seed: BREACH, n: 1, warned: true },
    }));
    await send(p1, "raid-after-npc", raid(2));
    const reports = stored(2).raidReports;
    expect(reports.map((report) => report.kind)).toEqual(["pvp_in", "npc"]);
    const npcLost = reports[1]?.lost.timber ?? 0;
    const pvpLost = reports[0]?.lost.timber ?? 0;
    expect(pvpLost).toBe(Math.floor(((30_000 - npcLost) * content.raids.capPercent) / 100));
  });

  it("an offline defender gets the push", async () => {
    const { login, send, notifier, sent } = setup();
    const [p1] = [await login(1), await login(2)];
    notifier.subscribe(
      2,
      { endpoint: "https://push.example/two", keys: { p256dh: "k", auth: "a" } },
      T0,
    );
    await send(p1, "raid-push-001", raid(2));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(
      sent.some((push) => push.endpoint.endsWith("/two") && push.payload.includes("Raider")),
    ).toBe(true);
  });

  it("refuses an unknown target, oneself, and a player out of the raids", async () => {
    const { login, send } = setup();
    const [p1] = [await login(1), await login(2, false)];
    expect(await send(p1, "raid-nobody-1", raid(99))).toMatchObject({
      ok: false,
      refusal: { code: "no_target" },
    });
    expect(await send(p1, "raid-myself-1", raid(1))).toMatchObject({
      ok: false,
      refusal: { code: "self_target" },
    });
    expect(await send(p1, "raid-outsider", raid(2))).toMatchObject({
      ok: false,
      refusal: { code: "target_off" },
    });
  });

  it("lists the holdfasts in the raids with the confirm screen's numbers", async () => {
    const { login, get } = setup();
    const [p1] = [await login(1), await login(2), await login(3, false)];
    const raids = await get<RaidsResponse>(p1, "/api/raids");
    expect(raids.targets.map((target) => target.id)).toEqual([2]);
    expect(raids.targets[0]).toMatchObject({
      tier: "metal",
      status: { code: "ok", cost: pvp.charges.metal, revenge: false },
      odds: { attack: pvp.attack.metal },
    });
  });
});

describe("NPC raids on the server", () => {
  it("land on the minute tick at their time, with the push", async () => {
    const { login, game, clock, stored, patch, notifier, sent } = setup();
    await login(1);
    notifier.subscribe(
      1,
      { endpoint: "https://push.example/one", keys: { p256dh: "k", auth: "a" } },
      T0,
    );
    patch(1, (state) => ({ ...state, raid: { at: T0 + HOUR, seed: 3, n: 1, warned: true } }));
    clock.set(T0 + HOUR + 5);
    expect(game.tick()).toContain(1);
    expect(stored(1).raid).toBeNull();
    expect(stored(1).raidReports[0]).toMatchObject({ id: "r1", kind: "npc", at: T0 + HOUR });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sent.some((push) => push.endpoint.endsWith("/one"))).toBe(true);
  });

  it("a command plans the next raid and the base's timer includes it", async () => {
    const { login, send, stored, db } = setup();
    const p1 = await login(1);
    await send(p1, "plan-a-raid-1", { type: "collect" });
    const base = stored(1);
    expect(base.raid).not.toBeNull();
    const row = db.select().from(bases).where(eq(bases.playerId, 1)).get();
    expect(row?.nextEventAt).toBeLessThanOrEqual(base.raid?.at ?? 0);
  });
});
