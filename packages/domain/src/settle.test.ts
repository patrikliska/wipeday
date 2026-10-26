/**
 * Settle's property tests (N24; docs/redesign/09-architecture.md 4.8), seeded through `rng.ts`
 * like W6's property tests, so a failure names its seed and replays.
 *
 * 1. A generator of random states: up to 1,200 owned per line (every milestone kind), a random
 *    era, roster tiers, shelf rows and Workshop levels (away-only ones among them), a random
 *    manned subset, cycles in flight on unmanned lines, up to three buffs, the last command up
 *    to 20 h back, a Night Shift of 2-24 h, glass for Glow, survivor cards with stars and worn gear
 *    and held Supply Drops (R3). The fixture content adds buffs (a global ×4, a one-line ×12) and
 *    an effect that holds only while the player is away.
 * 2. Path independence: settling to t1 and then t2 equals settling to t2, within 1e-9, over
 *    10,000 states, with t1 placed around the window's end, buff ends and payouts; the same
 *    over 10,000 random command sequences (buys, hires, shelf rows, Workshop levels, eras,
 *    flotsam claims, taps, pings) with extra settles between.
 * 3. A tick oracle: an independent loop over whole seconds (manned production that second, each
 *    unmanned cycle at its end second) agrees with settle within 1e-6 over 1,000 states × 48 h.
 * 4. `suppliesAt` equals the settled supplies at random times.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import type { Content } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import { describe, expect, it } from "vitest";
import { applyCommand, type Command } from "./commands";
import type { GameEvent } from "./events";
import { type Rng, rng } from "./rng";
import { settle, suppliesAt } from "./settle";
import { type BaseState, type Buff, newBase } from "./state";

const shipped = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const HOUR = 3600;

/** The buffs the fixture knows, with the factors the oracle uses on its own. */
const RALLY = 4;
const DRONE = 12;
const AWAY = 1.5;
/** Frenzy (D237): lines ×MULT, as a visible speed-up and the rest as output. */
const FRENZY_MULT = 7;
const FRENZY_SPEED = 1.5;
const OVERDRIVE = 3;

/** R0's content plus buffs and an away-only effect, with a Night Shift of `hours`. */
function fixture(hours: number): Content {
  return {
    ...shipped,
    run: { ...shipped.run, nightShift: { ...shipped.run.nightShift, windowHours: hours } },
    buffs: {
      rally: [{ stat: "output", op: "more", value: RALLY }],
      drone: [{ stat: "output", op: "more", value: DRONE }],
      frenzy: [
        { stat: "speed", op: "more", value: FRENZY_SPEED },
        { stat: "output", op: "more", value: FRENZY_MULT / FRENZY_SPEED },
      ],
      // Holds only while away: settle must cut where the player goes offline.
      lantern: [{ stat: "offline", op: "more", value: AWAY, when: "offline" }],
      // R3 S2's bought boost (D258): an ordinary buff on every line.
      overdrive: [{ stat: "output", op: "more", value: OVERDRIVE }],
    },
  };
}

const rel = (a: number, b: number): number =>
  Math.abs(a - b) / Math.max(1, Math.abs(a), Math.abs(b));

interface Case {
  content: Content;
  state: BaseState;
}

/** A random state, settled up to `now` = T0 (09-architecture.md 4.8's generator). */
function randomCase(random: Rng): Case {
  const hours = 2 + random.int(0, 22);
  const content = fixture(hours);
  const base = newBase(content, T0 - 30 * HOUR, random.int(1, 1e9));
  const lines: Record<string, number> = {};
  const hands: string[] = [];
  const readyAt: Record<string, number> = {};
  for (const line of content.lines) {
    if (random.next() < 0.4) continue;
    const owned = random.next() < 0.8 ? random.int(1, 300) : random.int(300, 1200);
    lines[line.id] = owned;
    if (random.next() < 0.5) hands.push(line.id);
    else if (random.next() < 0.6) readyAt[line.id] = T0 + random.int(1, 3 * HOUR);
  }
  const buffs: Buff[] = [];
  const kinds = ["rally", "drone", "lantern", "frenzy", "overdrive"];
  for (let i = random.int(0, 3); i > 0; i--) {
    const kind = kinds[random.int(0, kinds.length - 1)] ?? "rally";
    // The same kind again restarts its timer in the game (D148); only drones stack, per line.
    if (kind !== "drone" && buffs.some((buff) => buff.kind === kind)) continue;
    const owned = Object.keys(lines);
    const line = owned[random.int(0, Math.max(0, owned.length - 1))];
    buffs.push({
      kind,
      until: T0 + random.int(1, 20 * HOUR),
      ...(kind === "drone" && line ? { line } : {}),
    });
  }
  const upgrades = content.upgrades
    .filter((upgrade) => upgrade.kind !== "grip" && random.next() < 0.3)
    .map((upgrade) => upgrade.id);
  const research: Record<string, number> = {};
  for (const def of content.research) {
    if (random.next() < 0.3) research[def.id] = random.int(1, def.levels);
  }
  // R3: survivor cards at random stars, gear worn one card a slot, drops to open.
  const survivors: Record<string, number> = {};
  for (const row of content.cards.survivors)
    if (random.next() < 0.5) survivors[row.id] = random.int(1, 5);
  const owners = Object.keys(survivors);
  const gear: Record<string, string | null> = {};
  const slots = new Set<string>();
  for (const row of content.cards.gear) {
    if (random.next() < 0.4) continue;
    const wearer =
      owners.length > 0 && random.next() < 0.7
        ? owners[random.int(0, owners.length - 1)]
        : undefined;
    const slot = `${wearer}|${row.slot}`;
    if (wearer && !slots.has(slot)) {
      slots.add(slot);
      gear[row.id] = wearer;
    } else gear[row.id] = null;
  }
  const state: BaseState = {
    ...base,
    run: {
      ...base.run,
      era: TIERS[random.int(0, TIERS.length - 1)] ?? "hqm",
      roster: random.int(0, content.milestones.roster.length),
      upgrades,
      research,
      lines,
      hands,
      readyAt,
      buffs,
      supplies: random.next() * 1e6,
      made: random.next() * 1e7,
      settledAt: T0,
      activeAt: T0 - random.int(0, 20 * HOUR),
      // Most runs have started (the flotsam schedule runs); run 1 has guaranteed crates.
      n: random.int(1, 2),
      startedAt: random.next() < 0.8 ? T0 - random.int(0, 30 * HOUR) : null,
    },
    meta: {
      ...base.meta,
      glass: { ...base.meta.glass, ever: random.int(0, 5000) },
      cards: { survivors, gear },
      drops: { ...base.meta.drops, held: { 1: random.int(0, 2), 2: 0, 3: 0 } },
      // R3 S2: scrap to spend, some orders already claimed.
      scrap: random.int(0, 200),
    },
  };
  const claimed = state.run.orders.ids.filter(() => random.next() < 0.3);
  state.run.orders = {
    ids: state.run.orders.ids,
    claimed,
    fuelledAt: claimed.length >= 5 ? T0 : null,
  };
  return { content, state };
}

/** Seconds worth testing around: the window's end, buff ends, payouts, going offline. */
function edges(content: Content, state: BaseState): number[] {
  const window = state.run.activeAt + Math.round(windowHoursOf(content, state) * HOUR);
  return [
    window,
    state.run.activeAt + 330,
    ...state.run.buffs.map((buff) => buff.until),
    ...Object.values(state.run.readyAt),
  ];
}

const sorted = (events: GameEvent[]): string[] => events.map((e) => JSON.stringify(e)).sort();

function expectSame(a: BaseState, b: BaseState, label: string): void {
  expect(rel(a.run.supplies, b.run.supplies), `${label}: supplies`).toBeLessThanOrEqual(1e-9);
  expect(rel(a.run.made, b.run.made), `${label}: made`).toBeLessThanOrEqual(1e-9);
  expect(rel(a.meta.lifetime, b.meta.lifetime), `${label}: lifetime`).toBeLessThanOrEqual(1e-9);
  const strip = (s: BaseState) => ({
    ...s,
    run: { ...s.run, supplies: 0, made: 0, madeAtActive: 0 },
  });
  expect(strip(a), `${label}: the rest`).toEqual(strip(b));
}

describe("settle's path independence (N24)", () => {
  it("settles to t1 then t2 exactly as straight to t2, over 10,000 states", () => {
    let worst = 0;
    for (let seed = 1; seed <= 10_000; seed++) {
      const random = rng(seed);
      const { content, state } = randomCase(random);
      const points = edges(content, state);
      const pivot = points[random.int(0, points.length - 1)] ?? T0 + HOUR;
      const t1 = Math.max(T0 + 1, pivot + random.int(-60, 60));
      const t2 = Math.min(T0 + 60 * HOUR, t1 + random.int(1, 40 * HOUR));
      const once = settle(content, state, t2);
      const first = settle(content, state, t1);
      const twice = settle(content, first.state, t2);
      expectSame(twice.state, once.state, `seed ${seed}`);
      expect(sorted([...first.events, ...twice.events]), `seed ${seed}: events`).toEqual(
        sorted(once.events),
      );
      worst = Math.max(worst, rel(twice.state.run.supplies, once.state.run.supplies));
    }
    expect(worst).toBeLessThanOrEqual(1e-9);
  });

  it("holds over 10,000 random command sequences with extra settles between", () => {
    let caught = 0;
    for (let seed = 1; seed <= 10_000; seed++) {
      const random = rng(seed * 7919);
      const { content, state } = randomCase(random);
      const ids = content.lines.map((line) => line.id);
      let a = state;
      let b = state;
      let t = T0;
      for (let step = random.int(2, 6); step > 0; step--) {
        t += random.int(1, 4 * HOUR);
        // Sometimes land inside the next flotsam's window, and claim it.
        const cursor = settle(content, a, t).state.run.flotsam;
        const floating = cursor.at !== null && random.next() < 0.3;
        if (floating && cursor.at !== null && cursor.at + 16 > t)
          t = Math.max(t, cursor.at) + random.int(0, 3);
        const line = ids[random.int(0, ids.length - 1)] ?? "beachcomber";
        const roll = random.next();
        const upgrade = content.upgrades[random.int(0, content.upgrades.length - 1)]?.id ?? "";
        const item = content.research[random.int(0, content.research.length - 1)]?.id ?? "";
        const era = TIERS[random.int(0, TIERS.length - 1)] ?? "wood";
        const gears = content.cards.gear;
        const owners = Object.keys(a.meta.cards.survivors);
        const card: Command =
          random.next() < 0.5
            ? { type: "open_drop", tier: 1, pull: a.meta.drops.pulls }
            : {
                type: "equip_gear",
                gear: gears[random.int(0, gears.length - 1)]?.id ?? "crowbar",
                survivor:
                  owners.length > 0 ? (owners[random.int(0, owners.length - 1)] ?? null) : null,
              };
        // R3 S2: the scrap commands and the claims (most refuse; the ones that land must agree).
        const scrapRoll = random.next();
        const scrapCommand: Command =
          scrapRoll < 0.3
            ? {
                type: "buy_boost",
                boost: ["overdrive", "double_time", "lucky_tide"][random.int(0, 2)] ?? "overdrive",
              }
            : scrapRoll < 0.45
              ? { type: "buy_drop", tier: random.next() < 0.5 ? 2 : 3 }
              : scrapRoll < 0.7
                ? {
                    type: "claim_order",
                    run: a.run.n,
                    id: a.run.orders.ids[random.int(0, 7)] ?? "",
                  }
                : scrapRoll < 0.9
                  ? {
                      type: "claim_quest",
                      day: a.meta.quests.day,
                      id: a.meta.quests.ids[random.int(0, 2)] ?? "",
                    }
                  : { type: "claim_tide", run: a.run.n, k: random.int(0, 4) };
        const command: Command = floating
          ? { type: "claim_flotsam", run: a.run.n, k: cursor.k }
          : roll < 0.25
            ? { type: "buy_line", line, count: random.next() < 0.5 ? 1 : 10 }
            : roll < 0.4
              ? { type: "hire_hand", line }
              : roll < 0.5
                ? { type: "buy_upgrade", upgrade }
                : roll < 0.55
                  ? { type: "buy_research", item, count: random.next() < 0.5 ? 1 : "max" }
                  : roll < 0.6
                    ? { type: "buy_era", era }
                    : roll < 0.8
                      ? {
                          type: "taps",
                          count: random.int(1, 30),
                          from: t - random.int(0, 2),
                          to: t,
                        }
                      : roll < 0.88
                        ? card
                        : roll < 0.95
                          ? scrapCommand
                          : { type: "ping" };
        // B settles somewhere in between first; A does not.
        const between = t - random.int(1, Math.max(1, t - b.run.settledAt));
        if (between > b.run.settledAt) b = settle(content, b, between).state;
        const result = applyCommand(content, a, command, t);
        if (result.ok && command.type === "claim_flotsam") caught += 1;
        a = result.state;
        b = applyCommand(content, b, command, t).state;
      }
      const end = t + random.int(0, 30 * HOUR);
      expectSame(settle(content, b, end).state, settle(content, a, end).state, `sequence ${seed}`);
    }
    // The sequences really catch flotsam (and so restart buffs and move the cursor).
    expect(caught).toBeGreaterThan(1000);
    // 10,000 sequences take about 5 s on the dev PC: past vitest's default, inside pnpm test.
  }, 20_000);
});

/** The Workshop's levels as plain effects: `value` per level, `more` compounding. */
function researchLevels(
  content: Content,
  state: BaseState,
): { stat: string; op: string; scope: string | undefined; value: number; n: number }[] {
  const out = [];
  for (const def of content.research) {
    const n = state.run.research[def.id] ?? 0;
    if (n > 0) out.push({ ...def.effect, scope: def.effect.scope, n });
  }
  return out;
}

/** What the hired survivors' cards carry: traits and worn gear, by stat (R3). */
function hiredCardEffects(
  content: Content,
  state: BaseState,
  id?: string,
): { stat: string; value: number }[] {
  const out: { stat: string; value: number }[] = [];
  const cards = state.meta.cards;
  for (const line of content.lines) {
    if (!state.run.hands.includes(line.id) || (id !== undefined && line.id !== id)) continue;
    const survivor = content.cards.survivors.find((row) => row.id === line.hand);
    if (!survivor || cards.survivors[survivor.id] === undefined) continue;
    out.push(survivor.trait);
    for (const gear of content.cards.gear)
      if (cards.gear[gear.id] === survivor.id) out.push(gear.effect);
  }
  return out;
}

/** The Night Shift's hours: the base plus the Workshop's and the cards', under the ceiling. */
function windowHoursOf(content: Content, state: BaseState): number {
  const { windowHours, maxHours } = content.run.nightShift;
  let hours = windowHours;
  for (const effect of researchLevels(content, state))
    if (effect.stat === "night_shift") hours += effect.value * effect.n;
  for (const effect of hiredCardEffects(content, state))
    if (effect.stat === "night_shift") hours += effect.value;
  return Math.min(maxHours, hours);
}

/** The Workshop's away-only factor (Banked Coals, Storm Shutters). */
function awayFactorOf(content: Content, state: BaseState): number {
  let factor = 1;
  for (const effect of researchLevels(content, state))
    if (effect.stat === "offline") factor *= effect.value ** effect.n;
  return factor;
}

/**
 * A line's steady multiplier and speed from first principles, sharing no code with the
 * evaluator: the eras reached, the island upgrades bought, the Workshop's levels (incs summed,
 * Line Mks and speeds compounded), the roster tiers, and the milestone table walked one step at
 * a time.
 */
function lineFactors(
  content: Content,
  state: BaseState,
  id: string,
): { output: number; speed: number } {
  const { run } = state;
  let output = 1;
  for (const era of content.eras.slice(0, TIERS.indexOf(run.era) + 1))
    for (const effect of era.effects) output *= effect.value;
  for (const upgrade of content.upgrades) {
    if (!run.upgrades.includes(upgrade.id)) continue;
    if (upgrade.kind === "island") for (const effect of upgrade.effects) output *= effect.value;
  }
  const era = content.lines.find((line) => line.id === id)?.era;
  let inc = 0;
  let speed = 1;
  for (const effect of researchLevels(content, state)) {
    const reaches = effect.scope === "all" || effect.scope === id || effect.scope === era;
    if (!reaches) continue;
    if (effect.stat === "output" && effect.op === "inc") inc += effect.value * effect.n;
    if (effect.stat === "output" && effect.op === "more") output *= effect.value ** effect.n;
    if (effect.stat === "speed") speed *= effect.value ** effect.n;
  }
  output *= 1 + inc;
  for (const tier of content.milestones.roster.slice(0, run.roster)) output *= tier.payout;
  const n = run.lines[id] ?? 0;
  for (const step of content.milestones.line) {
    if (n < step.at) continue;
    output *= step.payout ?? 1;
    speed *= step.speed ?? 1;
  }
  const every = content.milestones.lineEvery;
  for (let at = every.from; at <= n; at += every.step)
    output *= every.special.find((special) => special.at === at)?.payout ?? every.payout;
  // R3: a hired survivor's stars, trait and gear on its own line, three of a rarity the kit.
  const cards = state.meta.cards;
  const hand = content.lines.find((line) => line.id === id)?.hand ?? "";
  const stars = cards.survivors[hand];
  if (run.hands.includes(id) && stars !== undefined) {
    output *= 1 + content.cards.stars.perStar * (stars - 1);
    for (const effect of hiredCardEffects(content, state, id)) {
      if (effect.stat === "output") output *= effect.value;
      if (effect.stat === "speed") speed *= effect.value;
    }
    const byRarity = new Map<string, number>();
    for (const gear of content.cards.gear)
      if (cards.gear[gear.id] === hand)
        byRarity.set(gear.rarity, (byRarity.get(gear.rarity) ?? 0) + 1);
    const kit = content.cards.sets.kit;
    if ([...byRarity.values()].some((count) => count >= kit.pieces)) output *= kit.effect.value;
  }
  // The crew sets, for every line: era-scoped output, and Morale on everything.
  for (const set of content.cards.sets.crews) {
    const pool = content.cards.survivors.filter(
      (row) => set.rarity === undefined || row.rarity === set.rarity,
    );
    if (!pool.every((row) => (cards.survivors[row.id] ?? 0) >= set.stars)) continue;
    for (const effect of set.effects) {
      const reaches =
        effect.scope === undefined ||
        effect.scope === "all" ||
        effect.scope === id ||
        effect.scope === era;
      if (reaches && (effect.stat === "output" || effect.stat === "morale")) output *= effect.value;
    }
  }
  return { output, speed };
}

/**
 * The oracle: production second by second from first principles, sharing no code with settle.
 * Manned lines make owned × rate × their multipliers × speed × Glow × the buffs running that
 * second while the window is open (× the away factor once the player has been gone 330 s);
 * each unmanned cycle pays its rate × its cycle (never under the floor) at its end second.
 */
function oracle(content: Content, state: BaseState, until: number): number {
  const { run } = state;
  const glow = 1 + content.prestige.glowK * Math.sqrt(state.meta.glass.ever);
  const windowEnd = run.activeAt + Math.round(windowHoursOf(content, state) * HOUR);
  const away = awayFactorOf(content, state);
  const offlineFrom = run.activeAt + content.run.nightShift.pingMinutes * 60 + 30;
  const rates = new Map(content.lines.map((line) => [line.id, line]));
  const mannedByLine = new Map<string, number>();
  /** A hired survivor's away output on its own line (R3 cards' `offline`). */
  const cardAway = new Map<string, number>();
  for (const id of run.hands) {
    const line = rates.get(id);
    const { output, speed } = lineFactors(content, state, id);
    const per = (run.lines[id] ?? 0) * (line?.rate ?? 0) * output * speed * glow;
    mannedByLine.set(id, per);
    let factor = 1;
    for (const effect of hiredCardEffects(content, state, id))
      if (effect.stat === "offline") factor *= effect.value;
    cardAway.set(id, factor);
  }
  const factorAt = (t: number, line?: string): number => {
    let factor = 1;
    for (const buff of run.buffs) {
      if (buff.until <= t) continue;
      if (buff.kind === "rally") factor *= RALLY;
      if (buff.kind === "drone" && (line === undefined || buff.line === line)) factor *= DRONE;
      if (buff.kind === "lantern" && t >= offlineFrom) factor *= AWAY;
      if (buff.kind === "frenzy") factor *= FRENZY_MULT / FRENZY_SPEED;
      if (buff.kind === "overdrive") factor *= OVERDRIVE;
    }
    return t >= offlineFrom ? factor * away : factor;
  };
  const speedAt = (t: number): number =>
    run.buffs.some((buff) => buff.kind === "frenzy" && buff.until > t) ? FRENZY_SPEED : 1;
  const drones = run.buffs.filter((buff) => buff.kind === "drone");
  let total = 0;
  for (let t = run.settledAt; t < until; t++) {
    if (t >= windowEnd) break;
    // Global buffs on everything; a drone only on its line.
    let global = 1;
    for (const buff of run.buffs) {
      if (buff.until <= t) continue;
      if (buff.kind === "rally") global *= RALLY;
      if (buff.kind === "lantern" && t >= offlineFrom) global *= AWAY;
      if (buff.kind === "frenzy") global *= FRENZY_MULT;
      if (buff.kind === "overdrive") global *= OVERDRIVE;
    }
    if (t >= offlineFrom) global *= away;
    // Buffs multiply, so two drones on one line make it ×144 there.
    const boosted = new Map<string, number>();
    for (const drone of drones) {
      if (drone.until > t && drone.line)
        boosted.set(drone.line, (boosted.get(drone.line) ?? 1) * DRONE);
    }
    let second = 0;
    for (const [line, per] of mannedByLine) {
      const own = t >= offlineFrom ? (cardAway.get(line) ?? 1) : 1;
      second += per * global * own * (boosted.get(line) ?? 1);
    }
    total += second;
  }
  for (const [id, ready] of Object.entries(run.readyAt)) {
    if (ready <= run.settledAt || ready > until || run.hands.includes(id)) continue;
    const line = rates.get(id);
    if (!line) continue;
    const { output, speed } = lineFactors(content, state, id);
    // A cycle pays its rate × its length, both read at its end (a Frenzy's speed included).
    const fast = speed * speedAt(ready);
    const cycle = Math.max(content.formula.cycleFloor, line.cycle / fast);
    const rate = (run.lines[id] ?? 0) * line.rate * output * fast * glow;
    total += rate * factorAt(ready, id) * cycle;
  }
  return total;
}

describe("the tick oracle (N24)", () => {
  it("agrees with settle within 1e-6 over 1,000 states × 48 h", () => {
    let worst = 0;
    for (let seed = 1; seed <= 1_000; seed++) {
      const { content, state } = randomCase(rng(seed * 31));
      const until = T0 + 48 * HOUR;
      const settled = settle(content, state, until).state.run.supplies - state.run.supplies;
      const expected = oracle(content, state, until);
      const error = rel(settled, expected);
      worst = Math.max(worst, error);
      expect(error, `seed ${seed}`).toBeLessThanOrEqual(1e-6);
    }
    expect(worst).toBeLessThanOrEqual(1e-6);
  });
});

describe("suppliesAt", () => {
  it("equals the settled supplies at any moment", () => {
    for (let seed = 1; seed <= 2_000; seed++) {
      const random = rng(seed * 101);
      const { content, state } = randomCase(random);
      const t = T0 + random.int(0, 60 * HOUR);
      const settled = settle(content, state, t).state.run.supplies;
      expect(rel(suppliesAt(content, state, t), settled), `seed ${seed}`).toBeLessThanOrEqual(
        1e-12,
      );
    }
  });
});
