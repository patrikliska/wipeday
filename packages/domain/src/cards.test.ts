import type { Rarity } from "@wipe-day/content/cards";
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import type { Content } from "@wipe-day/content/schema";
import { describe, expect, it } from "vitest";
import {
  albumCounts,
  cardEffects,
  craftCost,
  heldDrops,
  hireFactor,
  maxStars,
  nextStar,
  pityView,
  setProgress,
  topTier,
} from "./cards";
import { applyCommand, type Command, type CommandResult } from "./commands";
import { credit, drawCard, fellDrops, nextFellDrop, nextPity, openDrop, rollRarity } from "./drops";
import { unitRate } from "./effects";
import { lineOf } from "./lines";
import { normalizeState } from "./normalize";
import { type BaseState, newBase } from "./state";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;
const ONLINE = { online: true } as const;

const fresh = (seed = 1): BaseState => newBase(content, T0, seed);
const withMeta = (state: BaseState, meta: Partial<BaseState["meta"]>): BaseState => ({
  ...state,
  meta: { ...state.meta, ...meta },
});
const holding = (state: BaseState, tier: 1 | 2 | 3, n: number): BaseState =>
  withMeta(state, {
    drops: { ...state.meta.drops, held: { ...state.meta.drops.held, [tier]: n } },
  });
const ok = (result: CommandResult): BaseState => {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.refusal)}`);
  return result.state;
};
const run = (state: BaseState, command: Command, now = T0, c: Content = content) =>
  applyCommand(c, state, command, now);

/** Every card owned, every survivor at five stars. */
const full = (state: BaseState): BaseState =>
  withMeta(state, {
    cards: {
      survivors: Object.fromEntries(content.cards.survivors.map((row) => [row.id, 5])),
      gear: Object.fromEntries(content.cards.gear.map((row) => [row.id, null])),
    },
  });

const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

describe("Supply Drops", () => {
  it("draws the printed first card first: Mara", () => {
    const opened = openDrop(content, holding(fresh(), 1, 1), 1);
    expect(opened.cards[0]).toMatchObject({ kind: "survivor", id: "mara", fresh: true });
    expect(opened.cards).toHaveLength(content.cards.drops.cards);
    expect(opened.state.meta.cards.survivors.mara).toBe(1);
    expect(opened.state.meta.drops.pulls).toBe(3);
    expect(opened.state.meta.drops.held[1]).toBe(0);
    expect(opened.state.meta.stats.drops).toBe(1);
  });

  it("N28: no card is ever blank; on a full Album every card pays shards", () => {
    let state = holding(full(fresh(7)), 1, 10_000);
    let empty = holding(fresh(8), 2, 2_000);
    for (let i = 0; i < 10_000; i++) {
      const opened = openDrop(content, state, 1);
      for (const card of opened.cards) {
        expect(card.fresh).toBe(false);
        expect(card.shards).toBeGreaterThan(0);
        // A five-star survivor's duplicate pays gear shards, which always buy something.
        expect(card.into).toBe("gear");
      }
      state = opened.state;
    }
    for (let i = 0; i < 2_000; i++) {
      const opened = openDrop(content, empty, 2);
      for (const card of opened.cards) expect(card.fresh || card.shards > 0).toBe(true);
      empty = opened.state;
    }
    // Two thousand tier-II drops find every card.
    expect(Object.keys(empty.meta.cards.survivors)).toHaveLength(content.cards.survivors.length);
    expect(Object.keys(empty.meta.cards.gear)).toHaveLength(content.cards.gear.length);
  });

  it("N29: pity as printed when every roll is Common (10th, 40th, 150th card)", () => {
    const odds = { common: 100, rare: 0, epic: 0, legendary: 0 };
    const commons: Content = {
      ...content,
      cards: {
        ...content.cards,
        drops: { ...content.cards.drops, tiers: [{ odds }, { odds }, { odds }] },
      },
    };
    let state = holding(fresh(), 1, 100);
    const rarities: Rarity[] = [];
    for (let i = 0; i < 60; i++) {
      const opened = openDrop(commons, state, 1);
      rarities.push(...opened.cards.map((card) => card.rarity));
      state = opened.state;
    }
    const at = (card: number) => rarities[card - 1];
    expect(rarities.slice(0, 9).every((rarity) => rarity === "common")).toBe(true);
    expect(at(10)).toBe("rare");
    expect(at(20)).toBe("rare");
    expect(at(30)).toBe("rare");
    expect(at(40)).toBe("epic");
    expect(at(80)).toBe("epic");
    expect(at(120)).toBe("epic");
    expect(at(150)).toBe("legendary");
    expect(at(160)).toBe("rare");
    // Never more than 9 cards without a Rare or better.
    let gap = 0;
    for (const rarity of rarities) {
      gap = rarity === "common" ? gap + 1 : 0;
      expect(gap).toBeLessThanOrEqual(9);
    }
  });

  it("N29: on the shipped odds the longest gaps stay inside the printed pity", () => {
    for (const tier of [1, 2, 3] as const) {
      let state = holding(fresh(11 + tier), tier, 3_000);
      const gaps = { rare: 0, epic: 0, legendary: 0 };
      const longest = { rare: 0, epic: 0, legendary: 0 };
      for (let i = 0; i < 3_000; i++) {
        const opened = openDrop(content, state, tier);
        for (const card of opened.cards) {
          for (const key of ["rare", "epic", "legendary"] as const) {
            gaps[key] = RANK[card.rarity] >= RANK[key] ? 0 : gaps[key] + 1;
            longest[key] = Math.max(longest[key], gaps[key]);
          }
        }
        state = opened.state;
      }
      const pity = content.cards.drops.pity;
      expect(longest.rare).toBeLessThanOrEqual(pity.rare - 1);
      expect(longest.epic).toBeLessThanOrEqual(pity.epic - 1);
      expect(longest.legendary).toBeLessThanOrEqual(pity.legendary - 1);
    }
  });

  it("draws each tier's rarities near its printed odds", () => {
    const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const pity = { rare: 0, epic: 0, legendary: 0 };
    // Without pity's floor: the raw odds of tier I.
    for (let pull = 1; pull <= 20_000; pull++) counts[drawCard(content, 5, 1, pull, pity).rarity]++;
    expect(counts.common / 20_000).toBeCloseTo(0.7, 1);
    expect(counts.rare / 20_000).toBeCloseTo(0.25, 1);
    expect(counts.legendary).toBeGreaterThan(0);
  });

  it("rolls a forced rarity from the odds above it, renormalised", () => {
    const odds = { common: 70, rare: 25, epic: 4.5, legendary: 0.5 };
    expect(rollRarity(odds, "common", 0)).toBe("common");
    expect(rollRarity(odds, "rare", 0)).toBe("rare");
    expect(rollRarity(odds, "rare", 0.999)).toBe("legendary");
    expect(rollRarity(odds, "epic", 0.5)).toBe("epic");
    expect(nextPity({ rare: 9, epic: 39, legendary: 149 }, "epic")).toEqual({
      rare: 0,
      epic: 0,
      legendary: 150,
    });
  });
});

describe("drops earned by counts (D251)", () => {
  it("felling pays at the 5th fell, then every `every`th (40, D266)", () => {
    const every = content.cards.drops.fells.every;
    const fells = [0, 4, 5, 4 + every, 5 + every, 5 + 2 * every, 5 + 3 * every];
    expect(fells.map((n) => fellDrops(content, n))).toEqual([0, 0, 1, 1, 2, 3, 4]);
    expect(nextFellDrop(content, 0)).toBe(5);
    expect(nextFellDrop(content, 5)).toBe(5 + every);
    expect(nextFellDrop(content, 6 + every)).toBe(5 + 2 * every);
  });

  it("pays from the counters, one an hour and three an island day, whatever the batching", () => {
    const felled = (state: BaseState, n: number) =>
      withMeta(state, { stats: { ...state.meta.stats, felled: n } });
    const paid = credit(content, felled(fresh(), 95), T0);
    // Four marks are passed (5, 30, 55, 80): one drop; the others are not carried over.
    expect(paid.state.meta.drops.held[1]).toBe(1);
    expect(paid.events).toEqual([{ type: "drop_earned", tier: 1, count: 1, source: "fells" }]);
    expect(credit(content, paid.state, T0 + 60).events).toEqual([]);
    // Step by step to the same count in the same minute: the same drops.
    let stepwise = fresh();
    for (let n = 1; n <= 95; n++) stepwise = credit(content, felled(stepwise, n), T0).state;
    expect(stepwise.meta.drops.held).toEqual(paid.state.meta.drops.held);
    expect(stepwise.meta.drops.paid).toEqual(paid.state.meta.drops.paid);
    // Within the hour the next mark (105) pays nothing; an hour on, the next one (130) does.
    const soon = credit(content, felled(paid.state, 105), T0 + 1800).state;
    expect(soon.meta.drops.held[1]).toBe(1);
    const later = credit(content, felled(soon, 130), T0 + 3600).state;
    expect(later.meta.drops.held[1]).toBe(2);
    // Three a day: hourly marks past the third wait for the next island day.
    let day = later;
    for (let hour = 2; hour <= 4; hour++)
      day = credit(content, felled(day, 130 + 25 * hour), T0 + hour * 3600).state;
    expect(day.meta.drops.today.fells).toBeLessThanOrEqual(3);
  });

  it("pays a drop per ten badges after a successful command, one an hour", () => {
    const badges = Object.fromEntries(
      content.achievements.badges.slice(0, 21).map((badge) => [badge.id, T0]),
    );
    const state = ok(run(withMeta(fresh(), { badges }), { type: "ping" }));
    expect(state.meta.drops.held[1]).toBe(1);
    expect(state.meta.drops.paid.badges).toBe(1);
    // The second waits its turn: still owed within the hour, paid after it.
    expect(ok(run(state, { type: "ping" }, T0 + 1800)).meta.drops.held[1]).toBe(1);
    const later = ok(run(state, { type: "ping" }, T0 + 3600));
    expect(later.meta.drops.held[1]).toBe(2);
    expect(later.meta.drops.paid.badges).toBe(2);
  });

  it("the Sealed Locker gives a Supply Drop II", () => {
    const locker = content.flotsam.kinds.find((kind) => kind.id === "sealed_locker");
    if (!locker) throw new Error("no sealed_locker");
    const only: Content = { ...content, flotsam: { ...content.flotsam, kinds: [locker] } };
    const base = fresh();
    const state: BaseState = {
      ...base,
      run: { ...base.run, startedAt: T0, flotsam: { k: 0, at: T0 + 10, caught: 1, last: -1 } },
    };
    const result = run(state, { type: "claim_flotsam", run: 1, k: 0 }, T0 + 12, only);
    const caught = ok(result);
    expect(caught.meta.drops.held[2]).toBe(1);
    expect(caught.run.supplies).toBe(0);
    expect(result.events).toContainEqual({
      type: "drop_earned",
      tier: 2,
      count: 1,
      source: "locker",
    });
  });
});

describe("card commands", () => {
  it("open_drop: refuses without a drop and on a second click", () => {
    expect(run(fresh(), { type: "open_drop", tier: 1, pull: 0 })).toMatchObject({
      ok: false,
      refusal: { reason: "no_drop" },
    });
    const state = holding(fresh(), 1, 2);
    const once = ok(run(state, { type: "open_drop", tier: 1, pull: 0 }));
    expect(once.meta.drops.held[1]).toBe(1);
    // The same click again names the old pull: nothing happens.
    expect(run(once, { type: "open_drop", tier: 1, pull: 0 })).toMatchObject({
      ok: false,
      refusal: { reason: "stale" },
    });
    expect(ok(run(once, { type: "open_drop", tier: 1, pull: 3 })).meta.drops.held[1]).toBe(0);
  });

  it("star_up: needs the card and the shards; twice is refused", () => {
    expect(run(fresh(), { type: "star_up", survivor: "mara", to: 2 })).toMatchObject({
      refusal: { reason: "not_owned" },
    });
    const owned = withMeta(fresh(), { cards: { survivors: { mara: 1 }, gear: {} } });
    expect(run(owned, { type: "star_up", survivor: "mara", to: 2 })).toMatchObject({
      refusal: { reason: "shards", need: 10, have: 0 },
    });
    const rich = withMeta(owned, {
      drops: { ...owned.meta.drops, shards: { ...owned.meta.drops.shards, crew: { mara: 12 } } },
    });
    const starred = ok(run(rich, { type: "star_up", survivor: "mara", to: 2 }));
    expect(starred.meta.cards.survivors.mara).toBe(2);
    expect(starred.meta.drops.shards.crew.mara).toBe(2);
    expect(run(starred, { type: "star_up", survivor: "mara", to: 2 })).toMatchObject({
      refusal: { reason: "owned" },
    });
    const top = withMeta(fresh(), { cards: { survivors: { mara: 5 }, gear: {} } });
    expect(run(top, { type: "star_up", survivor: "mara", to: 6 })).toMatchObject({
      refusal: { reason: "max_stars" },
    });
  });

  it("craft_gear: rarity shards buy a missing card once", () => {
    const state = withMeta(fresh(), {
      drops: {
        ...fresh().meta.drops,
        shards: { crew: {}, gear: { common: 25, rare: 0, epic: 0, legendary: 0 } },
      },
    });
    const crafted = ok(run(state, { type: "craft_gear", gear: "crowbar" }));
    expect(crafted.meta.cards.gear.crowbar).toBeNull();
    expect(crafted.meta.drops.shards.gear.common).toBe(5);
    expect(run(crafted, { type: "craft_gear", gear: "crowbar" })).toMatchObject({
      refusal: { reason: "owned" },
    });
    expect(run(state, { type: "craft_gear", gear: "gas_mask" })).toMatchObject({
      refusal: { reason: "shards", need: 50, have: 0 },
    });
  });

  it("equip_gear: one card a slot, swaps free, and back to the Album", () => {
    const state = withMeta(fresh(), {
      cards: {
        survivors: { mara: 1, dax: 1 },
        gear: { salvaged_hatchet: null, crowbar: null, hard_hat: null },
      },
    });
    let next = ok(run(state, { type: "equip_gear", gear: "salvaged_hatchet", survivor: "mara" }));
    next = ok(run(next, { type: "equip_gear", gear: "hard_hat", survivor: "mara" }));
    // The crowbar takes the hand slot: the hatchet goes back.
    next = ok(run(next, { type: "equip_gear", gear: "crowbar", survivor: "mara" }));
    expect(next.meta.cards.gear).toEqual({
      salvaged_hatchet: null,
      crowbar: "mara",
      hard_hat: "mara",
    });
    // Moving it to Dax takes it off Mara.
    next = ok(run(next, { type: "equip_gear", gear: "crowbar", survivor: "dax" }));
    expect(next.meta.cards.gear.crowbar).toBe("dax");
    const again = ok(run(next, { type: "equip_gear", gear: "crowbar", survivor: "dax" }));
    expect(again.meta.cards).toBe(next.meta.cards);
    next = ok(run(next, { type: "equip_gear", gear: "crowbar", survivor: null }));
    expect(next.meta.cards.gear.crowbar).toBeNull();
    expect(run(next, { type: "equip_gear", gear: "gas_mask", survivor: "mara" })).toMatchObject({
      refusal: { reason: "not_owned" },
    });
    expect(run(next, { type: "equip_gear", gear: "crowbar", survivor: "vera" })).toMatchObject({
      refusal: { reason: "not_owned" },
    });
  });
});

describe("what cards do", () => {
  const beach = lineOf(content, "beachcomber");
  if (!beach) throw new Error("no beachcomber");
  const working = (cards: BaseState["meta"]["cards"], hired = true): BaseState => {
    const base = fresh();
    return {
      ...base,
      run: { ...base.run, lines: { beachcomber: 10 }, hands: hired ? ["beachcomber"] : [] },
      meta: { ...base.meta, cards },
    };
  };
  const rate = (state: BaseState) => unitRate(content, state, beach, T0, ONLINE);

  it("stars multiply the hired line: ×2 at five stars, through the Workshop's inc", () => {
    const none = rate(working({ survivors: {}, gear: {} }));
    const five = working({ survivors: { mara: 5 }, gear: {} });
    // Mara's trait is Night Shift time, so only the stars reach the rate.
    expect(rate(five) / none).toBeCloseTo(2, 9);
    expect(hireFactor(content, five, beach)).toBeCloseTo(2, 9);
    // Not hired: the card does nothing.
    expect(rate(working({ survivors: { mara: 5 }, gear: {} }, false))).toBeCloseTo(
      rate(working({ survivors: {}, gear: {} }, false)),
      9,
    );
  });

  it("gear works on its wearer's line while hired, and three of a rarity add the kit", () => {
    const none = rate(working({ survivors: { mara: 1 }, gear: {} }));
    const hatchet = rate(working({ survivors: { mara: 1 }, gear: { salvaged_hatchet: "mara" } }));
    expect(hatchet / none).toBeCloseTo(1.2, 9);
    const kit = working({
      survivors: { mara: 1 },
      gear: { salvaged_hatchet: "mara", hard_hat: "mara", jerrycan: "mara" },
    });
    expect(rate(kit) / none).toBeCloseTo(1.2 * 1.2 * 1.2 * 1.1, 9);
  });

  it("the crew sets hold for the collection, hired or not", () => {
    const commons = Object.fromEntries(
      content.cards.survivors.filter((row) => row.rarity === "common").map((row) => [row.id, 3]),
    );
    const state = working({ survivors: commons, gear: {} }, false);
    const effects = cardEffects(content, state);
    expect(effects).toContainEqual({ stat: "output", op: "more", value: 1.5, scope: "twig" });
  });
});

describe("normalize", () => {
  it("drops unknown cards, clamps stars, and keeps gear only on owned survivors", () => {
    const base = fresh();
    const stored = JSON.parse(
      JSON.stringify({
        ...base,
        meta: {
          ...base.meta,
          cards: {
            survivors: { mara: 9, ghost: 2 },
            gear: { crowbar: "mara", salvaged_hatchet: "mara", hard_hat: "dax", nope: null },
          },
        },
      }),
    );
    const state = normalizeState(content, stored);
    expect(state?.meta.cards).toEqual({
      survivors: { mara: 5 },
      gear: { salvaged_hatchet: "mara", crowbar: null, hard_hat: null },
    });
    // A base from before R3 gets the empty Album.
    const old = JSON.parse(JSON.stringify(base));
    delete old.meta.cards;
    delete old.meta.drops;
    expect(normalizeState(content, old)?.meta.drops.held).toEqual({ 1: 0, 2: 0, 3: 0 });
  });
});

describe("what the Album reads (R3 S3)", () => {
  const owned = (state: BaseState, survivors: Record<string, number>, gear: string[]) =>
    withMeta(state, {
      cards: { survivors, gear: Object.fromEntries(gear.map((id) => [id, null])) },
    });

  it("nextStar: the next star's price and the shards held; null unowned or at five", () => {
    expect(nextStar(content, fresh(), "mara")).toBeNull();
    let state = owned(fresh(), { mara: 1, dax: 5 }, []);
    expect(nextStar(content, state, "mara")).toEqual({ to: 2, cost: 10, have: 0 });
    expect(nextStar(content, state, "dax")).toBeNull();
    state = withMeta(state, {
      drops: { ...state.meta.drops, shards: { ...state.meta.drops.shards, crew: { mara: 7 } } },
    });
    expect(nextStar(content, state, "mara")?.have).toBe(7);
    expect(maxStars(content)).toBe(5);
  });

  it("craftCost: the rarity's price against the rarity's shards", () => {
    const state = withMeta(fresh(), {
      drops: {
        ...fresh().meta.drops,
        shards: { crew: {}, gear: { common: 3, rare: 0, epic: 0, legendary: 0 } },
      },
    });
    expect(craftCost(content, state, "crowbar")).toEqual({ cost: 20, have: 3 });
    expect(craftCost(content, state, "power_saw")).toEqual({ cost: 300, have: 0 });
    expect(craftCost(content, state, "nothing")).toBeNull();
  });

  it("albumCounts, setProgress, pityView, heldDrops and topTier", () => {
    const state = owned(fresh(), { mara: 3, dax: 3, ivo: 1 }, ["crowbar", "chainsaw"]);
    expect(albumCounts(content, state)).toEqual({
      survivors: { owned: 3, total: 14 },
      gear: { owned: 2, total: 30 },
    });
    const [oldHands, fullCrew] = content.cards.sets.crews;
    if (!oldHands || !fullCrew) throw new Error("sets missing");
    expect(setProgress(content, state.meta.cards, oldHands)).toEqual({ done: 2, total: 5 });
    expect(setProgress(content, state.meta.cards, fullCrew)).toEqual({ done: 3, total: 14 });
    expect(pityView(content, state.meta.drops)).toEqual([
      { rarity: "rare", since: 0, within: 10 },
      { rarity: "epic", since: 0, within: 40 },
      { rarity: "legendary", since: 0, within: 150 },
    ]);
    expect(heldDrops(state.meta.drops)).toBe(0);
    expect(topTier(state.meta.drops)).toBeNull();
    const held = holding(holding(state, 1, 2), 3, 1);
    expect(heldDrops(held.meta.drops)).toBe(3);
    expect(topTier(held.meta.drops)).toBe(3);
  });
});
