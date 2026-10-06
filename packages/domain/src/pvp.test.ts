import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import type { Amounts, Content } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import { describe, expect, it } from "vitest";
import { type BaseState, newBase, newSurvivor } from "./base";
import { applyCommand } from "./commands";
import {
  atRisk,
  pvpCost,
  pvpOdds,
  pvpStatus,
  type RaidTarget,
  raidPlayer,
  setPvp,
  takeRaid,
} from "./raids";
import { rng } from "./rng";

const content = loadContent(contentPaths.data, loadLocale());
const HOUR = 3600;
const T0 = 1_700_000_000;
const { pvp, capPercent, scrapCeiling } = content.raids;
const A = 1;
const B = 2;

/** A Sheet Metal base in the raids, with charges and a full yard. */
const raider = (seed: number, extra: Partial<BaseState> = {}): BaseState => {
  const base = newBase(content, T0, seed);
  return {
    ...base,
    tier: "metal",
    buildings: { walls: 2 },
    stock: { timber: 30_000, stone: 40_000, ingots: 20_000, scrap: 3000, charge: 40, plates: 50 },
    upkeepPaidUntil: T0 + 30 * 24 * HOUR,
    pvp: { ...base.pvp, on: true },
    ...extra,
  };
};
const target = (state: BaseState, id = B, name = "Bea"): RaidTarget => ({ id, name, state });

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

/** A raid by A on B with `seed`, both halves applied. */
function raid(me: BaseState, them: BaseState, seed: number, now = T0) {
  const attack = ok(raidPlayer(content, me, A, "Al", target(them), seed, now));
  const defend = takeRaid(content, them, attack.hit, now);
  return { attacker: attack.state, defender: defend.state, hit: attack.hit, events: attack.events };
}

/** A seed whose raid on `them` comes out `outcome`. */
function seedFor(me: BaseState, them: BaseState, outcome: "held" | "breached"): number {
  for (let seed = 1; seed < 500; seed++) {
    const result = raidPlayer(content, me, A, "Al", target(them), seed, T0);
    if (result.ok && result.hit.outcome === outcome) return seed;
  }
  throw new Error(`no seed for ${outcome}`);
}

const status = (me: BaseState, them: BaseState, now = T0, rules: Content = content) =>
  pvpStatus(rules, me, A, target(them), now).code;

describe("who can raid whom (every limit)", () => {
  it("opens at Sheet Metal, for players in the raids only", () => {
    expect(status(raider(1, { tier: "stone" }), raider(2))).toBe("pvp_locked");
    expect(status(raider(1, { pvp: { ...raider(1).pvp, on: false } }), raider(2))).toBe("pvp_off");
    expect(status(raider(1), raider(2, { pvp: { ...raider(2).pvp, on: false } }))).toBe(
      "target_off",
    );
    // A target that decayed below the tier is out too, even with the flag on.
    expect(status(raider(1), raider(2, { tier: "stone" }))).toBe("target_off");
    expect(pvpStatus(content, raider(1), A, target(raider(2), A), T0).code).toBe("self_target");
    expect(status(raider(1), raider(2))).toBe("ok");
  });

  it("joining needs the tier; leaving waits out a victim's revenge window", () => {
    const stone = raider(1, { tier: "stone", pvp: { ...raider(1).pvp, on: false } });
    expect(setPvp(content, stone, true, T0)).toMatchObject({
      ok: false,
      status: { code: "pvp_locked" },
    });
    const after = raid(raider(1), raider(2), 1).attacker;
    const locked = setPvp(content, after, false, T0 + HOUR);
    expect(locked).toMatchObject({
      ok: false,
      status: { code: "opt_out_locked", until: T0 + pvp.revengeHours * HOUR },
    });
    const left = ok(setPvp(content, after, false, T0 + pvp.revengeHours * HOUR));
    expect(left.state.pvp.on).toBe(false);
    expect(left.events).toEqual([{ type: "pvp_set", on: false }]);
    // Setting what is already set is fine and changes nothing (idempotent).
    expect(ok(setPvp(content, left.state, false, T0)).events).toEqual([]);
  });

  it("a breach shields the defender for a day", () => {
    const me = raider(1);
    const them = raider(2);
    const { defender } = raid(me, them, seedFor(me, them, "breached"));
    expect(defender.pvp.shieldUntil).toBe(T0 + pvp.shieldHours * HOUR);
    const other = raider(3);
    expect(pvpStatus(content, other, 3, target(defender), T0 + HOUR).code).toBe("shielded");
    expect(pvpStatus(content, other, 3, target(defender), T0 + pvp.shieldHours * HOUR).code).toBe(
      "ok",
    );
    // A held raid leaves no shield.
    const held = raid(me, them, seedFor(me, them, "held")).defender;
    expect(held.pvp.shieldUntil).toBeNull();
  });

  it("one attack a day, whoever the target", () => {
    const { attacker } = raid(raider(1), raider(2), 1);
    const third = target(raider(3), 3);
    expect(pvpStatus(content, attacker, A, third, T0 + HOUR)).toEqual({
      code: "attack_cooldown",
      readyAt: T0 + pvp.attackHours * HOUR,
    });
    expect(pvpStatus(content, attacker, A, third, T0 + pvp.attackHours * HOUR).code).toBe("ok");
  });

  it("the same target once in 72 hours", () => {
    const me = raider(1);
    const them = raider(2);
    const { attacker } = raid(me, them, seedFor(me, them, "held"));
    const day2 = T0 + pvp.attackHours * HOUR;
    expect(pvpStatus(content, attacker, A, target(them), day2)).toEqual({
      code: "target_cooldown",
      readyAt: T0 + pvp.sameTargetHours * HOUR,
    });
    expect(
      pvpStatus(content, attacker, A, target(them), T0 + pvp.sameTargetHours * HOUR).code,
    ).toBe("ok");
  });

  it("only within the tier fence", () => {
    // Today Sheet Metal and Armored are one apart; a fence of 0 shows the rule.
    const strict = { ...content, raids: { ...content.raids, pvp: { ...pvp, maxTierGap: 0 } } };
    expect(status(raider(1), raider(2, { tier: "hqm" }), T0, strict)).toBe("tier_fence");
    expect(status(raider(1), raider(2, { tier: "hqm" }))).toBe("ok");
    expect(status(raider(1, { tier: "hqm" }), raider(2), T0, strict)).toBe("tier_fence");
  });

  it("charges up front, by the target's tier", () => {
    const poor = raider(1, { stock: { ...raider(1).stock, charge: 2 } });
    expect(pvpStatus(content, poor, A, target(raider(2)), T0)).toEqual({
      code: "unaffordable",
      missing: { charge: (pvp.charges.metal ?? 0) - 2 },
    });
    const result = raid(raider(1), raider(2, { tier: "hqm" }), 1);
    expect(result.attacker.stock.charge).toBe(40 - (pvp.charges.hqm ?? 0));
    expect(result.defender.stock.charge).toBe(40);
  });

  it("attacking ends your own shield", () => {
    const me = raider(1, { pvp: { ...raider(1).pvp, shieldUntil: T0 + 10 * HOUR } });
    expect(raid(me, raider(2), 1).attacker.pvp.shieldUntil).toBeNull();
  });
});

describe("revenge", () => {
  /** B raided by A: B holds a token against A. */
  const revenged = () => {
    const me = raider(1);
    const them = raider(2);
    const { attacker, defender } = raid(me, them, seedFor(me, them, "breached"));
    return { a: attacker, b: defender };
  };
  const strike = (b: BaseState, a: BaseState, now: number, rules: Content = content) =>
    pvpStatus(rules, b, B, target(a, A, "Al"), now);

  it("gives the defender a token at half the charges for 48 hours", () => {
    const { a, b } = revenged();
    expect(b.pvp.revenge).toEqual([
      { attacker: A, name: "Al", until: T0 + pvp.revengeHours * HOUR },
    ]);
    expect(strike(b, a, T0 + HOUR)).toEqual({
      code: "ok",
      cost: pvpCost(content, "metal", true),
      revenge: true,
    });
    expect(pvpCost(content, "metal", true)).toBe(Math.ceil((pvp.charges.metal ?? 0) / 2));
    expect(strike(b, a, T0 + pvp.revengeHours * HOUR)).toMatchObject({ revenge: false });
  });

  it("skips the 72-hour rule and the fence, not the daily limit or a shield", () => {
    const { a, b } = revenged();
    // B hit A two days ago: the 72-hour rule would stop a plain raid.
    const hitA = { ...b, pvp: { ...b.pvp, hits: { [String(A)]: T0 - 48 * HOUR } } };
    expect(strike(hitA, a, T0 + HOUR).code).toBe("ok");
    const strict = { ...content, raids: { ...content.raids, pvp: { ...pvp, maxTierGap: 0 } } };
    expect(strike(b, { ...a, tier: "hqm" as Tier }, T0 + HOUR, strict).code).toBe("ok");
    const busy = { ...b, pvp: { ...b.pvp, lastAttackAt: T0 } };
    expect(strike(busy, a, T0 + HOUR).code).toBe("attack_cooldown");
    const shielded = { ...a, pvp: { ...a.pvp, shieldUntil: T0 + 5 * HOUR } };
    expect(strike(b, shielded, T0 + HOUR).code).toBe("shielded");
  });

  it("is used up, and a revenge raid gives no counter-token", () => {
    const { a, b } = revenged();
    const back = ok(raidPlayer(content, b, B, "Bea", target(a, A, "Al"), 3, T0 + HOUR));
    expect(back.hit.revenge).toBe(true);
    expect(back.state.pvp.revenge).toEqual([]);
    expect(back.state.stock.charge).toBe(40 - pvpCost(content, "metal", true));
    const aAfter = takeRaid(content, a, back.hit, T0 + HOUR).state;
    expect(aAfter.pvp.revenge).toEqual([]);
  });
});

describe("the raid itself", () => {
  it("a breach takes the capped share; what one loses the other gains", () => {
    const me = raider(1);
    const them = raider(2);
    const { attacker, defender, events } = raid(me, them, seedFor(me, them, "breached"));
    const risk = atRisk(content, them, capPercent);
    expect(risk.scrap).toBe(scrapCeiling.metal);
    for (const [id, amount] of Object.entries(risk)) {
      expect(defender.stock[id], id).toBe((them.stock[id] ?? 0) - amount);
    }
    expect(attacker.stock.timber).toBe(30_000 + (risk.timber ?? 0));
    expect(defender.stock.plates).toBe(50);
    expect(defender.damaged).toBe(true);
    expect(defender.raidReports[0]).toMatchObject({
      kind: "pvp_in",
      outcome: "breached",
      foe: { id: A },
    });
    expect(attacker.raidReports[0]).toMatchObject({
      kind: "pvp_out",
      outcome: "breached",
      foe: { id: B },
    });
    expect(events[0]).toMatchObject({ type: "raid_launched", target: B, targetName: "Bea" });
  });

  it("a held raid costs the attacker the charges and nothing else", () => {
    const me = raider(1);
    const them = raider(2);
    const { attacker, defender } = raid(me, them, seedFor(me, them, "held"));
    expect(defender.stock).toEqual(them.stock);
    expect(attacker.stock).toEqual({ ...me.stock, charge: 40 - (pvp.charges.metal ?? 0) });
  });

  it("guards and walls lower the odds; the confirm screen shows them", () => {
    const them = raider(2);
    const guarded = {
      ...them,
      crew: [{ ...newSurvivor(content, "hale", T0), job: { kind: "guard" as const } }],
    };
    const bare = pvpOdds(content, raider(1), target(them), T0);
    const strong = pvpOdds(content, raider(1), target(guarded), T0);
    expect(strong.chance).toBeGreaterThan(bare.chance);
    expect(strong.defence.guards).toBe(content.crewRules.jobs.guardScore + 8);
  });

  it("the client cannot predict it; the server's world must name the target", () => {
    const command = { type: "raid_player" as const, target: B };
    expect(applyCommand(content, raider(1), command, T0)).toMatchObject({
      ok: false,
      refusal: { code: "server_only" },
    });
    const wrong = applyCommand(content, raider(1), command, T0, {
      seed: 1,
      self: A,
      target: target(raider(3), 3),
    });
    expect(wrong).toMatchObject({ ok: false, refusal: { code: "no_target" } });
    const right = applyCommand(content, raider(1), command, T0, {
      seed: 1,
      self: A,
      selfName: "Al",
      target: target(raider(2)),
    });
    expect(right.ok).toBe(true);
  });
});

describe("a PvP raid never takes more than the cap, and creates nothing (property)", () => {
  const STOCKED = [
    "timber",
    "stone",
    "ore",
    "ingots",
    "sulfur",
    "food",
    "scrap",
    "planks",
    "gears",
  ];
  const randomStock = (random: ReturnType<typeof rng>): Amounts => {
    const stock: Amounts = { charge: random.int(0, 30) };
    for (const id of STOCKED) if (random.next() < 0.8) stock[id] = random.int(0, 300_000);
    return stock;
  };

  it("holds over random bases and seeds", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const random = rng(seed);
      for (let round = 0; round < 20; round++) {
        const tiers: Tier[] = ["metal", "hqm"];
        const me = raider(seed, {
          tier: tiers[random.int(0, 1)] as Tier,
          stock: randomStock(random),
        });
        const them = raider(seed + 1000, {
          tier: tiers[random.int(0, 1)] as Tier,
          stock: randomStock(random),
          items: { bow: 1 },
          buildings: { walls: random.int(0, 3), turret: random.int(0, 2) },
        });
        const attack = raidPlayer(content, me, A, "Al", target(them), random.int(1, 1e9), T0);
        if (!attack.ok) {
          expect(attack.status.code).toBe("unaffordable");
          continue;
        }
        const defender = takeRaid(content, them, attack.hit, T0).state;
        const paid = pvpCost(content, them.tier, false);
        for (const id of new Set([...Object.keys(me.stock), ...Object.keys(them.stock)])) {
          const had = them.stock[id] ?? 0;
          const lost = had - (defender.stock[id] ?? 0);
          const gained =
            (attack.state.stock[id] ?? 0) - (me.stock[id] ?? 0) + (id === "charge" ? paid : 0);
          const where = `${id}, seed ${seed}/${round}`;
          expect(gained, where).toBe(lost);
          expect(lost, where).toBeGreaterThanOrEqual(0);
          const limit =
            id === "scrap"
              ? Math.min(Math.floor((had * capPercent) / 100), scrapCeiling[them.tier] ?? 0)
              : Math.floor((had * capPercent) / 100);
          expect(lost, where).toBeLessThanOrEqual(limit);
        }
        expect(defender.stock.planks ?? 0).toBe(them.stock.planks ?? 0);
        expect(defender.stock.charge ?? 0).toBe(them.stock.charge ?? 0);
        expect(defender.items).toEqual(them.items);
        expect(defender.crew).toEqual(them.crew);
        expect(defender.blueprints).toEqual(them.blueprints);
      }
    }
  });
});
