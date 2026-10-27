/**
 * Supply Drops (docs/redesign/12-feel.md 7.1; D249-D251): three cards a drop, each card's rarity
 * drawn from its tier's printed odds, with pity counted per player across tiers (at least a Rare
 * within 10 cards, an Epic within 40, a Legendary within 150), then a card of that rarity at
 * random. Never blank (N28): a card already owned pays shards.
 *
 * Card k rolls on `seedOf(base seed, SEED.drop, k)`: the client predicts the reveal like every
 * other roll (09-architecture.md 3.1), and the order is fixed, so nothing can be re-rolled (D250).
 *
 * Drops earned by counts (fells, badges) are paid by `credit` after every successful command
 * from the counters, never from events, so one big taps batch pays what many small ones do.
 */
import { type DropTier, RARITIES, type Rarity } from "@wipe-day/content/cards";
import type { Content } from "@wipe-day/content/schema";
import { badgeCount } from "./badges";
import { survivorOf } from "./cards";
import type { DropCard, GameEvent } from "./events";
import { rng, SEED, seedOf } from "./rng";
import type { BaseState, Drops, Meta } from "./state";
import { islandDay } from "./weather";

type Pity = Drops["pity"];
const PITY_RARITIES = ["rare", "epic", "legendary"] as const;
const rank = (rarity: Rarity): number => RARITIES.indexOf(rarity);

/** Tier-I drops felling has paid by `felled` lifetime fells (a slowing schedule, D249). */
export function fellDrops(content: Content, felled: number): number {
  const { at, every } = content.cards.drops.fells;
  let n = 0;
  for (const mark of at) if (felled >= mark) n++;
  const last = at.at(-1) ?? 0;
  if (felled > last) n += Math.floor((felled - last) / every);
  return n;
}

/** The lifetime fell at which felling pays its next drop. */
export function nextFellDrop(content: Content, felled: number): number {
  const { at, every } = content.cards.drops.fells;
  for (const mark of at) if (felled < mark) return mark;
  const last = at.at(-1) ?? 0;
  return last + (Math.floor((felled - last) / every) + 1) * every;
}

/** The lowest rarity pity forces on the next card (common: none). */
export function pityFloor(content: Content, pity: Pity): Rarity {
  const limits = content.cards.drops.pity;
  for (const rarity of [...PITY_RARITIES].reverse())
    if (pity[rarity] >= limits[rarity] - 1) return rarity;
  return "common";
}

/**
 * A card's rarity from its tier's odds at `u` in [0, 1), at least `floor`: the odds of the
 * rarities from `floor` up, renormalised (what the printed pity promises).
 */
export function rollRarity(odds: Record<Rarity, number>, floor: Rarity, u: number): Rarity {
  const eligible = RARITIES.filter((rarity) => rank(rarity) >= rank(floor));
  const total = eligible.reduce((sum, rarity) => sum + odds[rarity], 0);
  if (total <= 0) return floor;
  let roll = u * total;
  for (const rarity of eligible) {
    roll -= odds[rarity];
    if (roll < 0) return rarity;
  }
  return eligible.at(-1) ?? floor;
}

/** The pity counters after a card of `rarity`. */
export function nextPity(pity: Pity, rarity: Rarity): Pity {
  const out = { ...pity };
  for (const key of PITY_RARITIES) out[key] = rank(rarity) >= rank(key) ? 0 : pity[key] + 1;
  return out;
}

/** Every card of `rarity`: survivors first, then gear, in content order. */
function poolOf(content: Content, rarity: Rarity): { kind: "survivor" | "gear"; id: string }[] {
  return [
    ...content.cards.survivors
      .filter((row) => row.rarity === rarity)
      .map((row) => ({ kind: "survivor" as const, id: row.id })),
    ...content.cards.gear
      .filter((row) => row.rarity === rarity)
      .map((row) => ({ kind: "gear" as const, id: row.id })),
  ];
}

/** Card number `pull` (0 is the printed first card): what it is, before it is added. */
export function drawCard(
  content: Content,
  seed: number,
  tier: DropTier,
  pull: number,
  pity: Pity,
): { kind: "survivor" | "gear"; id: string; rarity: Rarity } {
  const { first, tiers } = content.cards.drops;
  const firstCard = survivorOf(content, first);
  if (pull === 0 && firstCard) return { kind: "survivor", id: first, rarity: firstCard.rarity };
  const random = rng(seedOf(seed, SEED.drop, pull));
  const odds = tiers[tier - 1]?.odds;
  if (!odds) throw new Error(`no Supply Drop tier ${tier}`);
  let rarity = rollRarity(odds, pityFloor(content, pity), random.next());
  let pool = poolOf(content, rarity);
  // The content check keeps every rarity's pool full; this only guards a bad file.
  while (pool.length === 0 && rank(rarity) > 0) {
    rarity = RARITIES[rank(rarity) - 1] ?? "common";
    pool = poolOf(content, rarity);
  }
  const card = pool[Math.floor(random.next() * pool.length)] ?? pool[0];
  if (!card) throw new Error("cards.json5 has no cards");
  return { ...card, rarity };
}

/** Adds a drawn card to `meta`: new, or its shards (a five-star survivor pays gear shards). */
function addCard(
  content: Content,
  meta: Meta,
  card: { kind: "survivor" | "gear"; id: string; rarity: Rarity },
): { meta: Meta; result: DropCard } {
  const { shards } = content.cards;
  const drops = meta.drops;
  const owned =
    card.kind === "survivor"
      ? meta.cards.survivors[card.id] !== undefined
      : card.id in meta.cards.gear;
  if (!owned) {
    const cards =
      card.kind === "survivor"
        ? { ...meta.cards, survivors: { ...meta.cards.survivors, [card.id]: 1 } }
        : { ...meta.cards, gear: { ...meta.cards.gear, [card.id]: null } };
    return { meta: { ...meta, cards }, result: { ...card, fresh: true, shards: 0, into: null } };
  }
  const stars = meta.cards.survivors[card.id] ?? 0;
  if (card.kind === "survivor" && stars < content.cards.stars.costs.length + 1) {
    const n = shards.survivor[card.rarity];
    const crew = { ...drops.shards.crew, [card.id]: (drops.shards.crew[card.id] ?? 0) + n };
    return {
      meta: { ...meta, drops: { ...drops, shards: { ...drops.shards, crew } } },
      result: { ...card, fresh: false, shards: n, into: "crew" },
    };
  }
  const n = shards.gear[card.rarity];
  const gear = { ...drops.shards.gear, [card.rarity]: drops.shards.gear[card.rarity] + n };
  return {
    meta: { ...meta, drops: { ...drops, shards: { ...drops.shards, gear } } },
    result: { ...card, fresh: false, shards: n, into: "gear" },
  };
}

/** Opens one held drop of `tier` (the caller checked one is held): its cards, in order. */
export function openDrop(
  content: Content,
  state: BaseState,
  tier: DropTier,
): { state: BaseState; cards: DropCard[] } {
  let meta = state.meta;
  const cards: DropCard[] = [];
  for (let i = 0; i < content.cards.drops.cards; i++) {
    const drops = meta.drops;
    const card = drawCard(content, state.seed, tier, drops.pulls, drops.pity);
    const pity = nextPity(drops.pity, card.rarity);
    meta = { ...meta, drops: { ...drops, pulls: drops.pulls + 1, pity } };
    const added = addCard(content, meta, card);
    meta = added.meta;
    cards.push(added.result);
  }
  const held = { ...meta.drops.held, [tier]: meta.drops.held[tier] - 1 };
  meta = {
    ...meta,
    drops: { ...meta.drops, held },
    stats: { ...meta.stats, drops: meta.stats.drops + 1 },
  };
  return { state: { ...state, meta }, cards };
}

/** Adds `count` held drops of `tier`. */
export function grantDrops(state: BaseState, tier: DropTier, count: number): BaseState {
  if (count <= 0) return state;
  const drops = state.meta.drops;
  const held = { ...drops.held, [tier]: drops.held[tier] + count };
  return { ...state, meta: { ...state.meta, drops: { ...drops, held } } };
}

/** Whether a count-based drop (felling's or the badges') may come at `now`: one an hour. */
export function dropGateOpen(content: Content, drops: Drops, now: number): boolean {
  return now >= nextDropAt(content, drops);
}

/** When the gate opens next (0 when it is open): the last gated drop's time plus the gap. */
export function nextDropAt(content: Content, drops: Drops): number {
  const { gapMinutes } = content.cards.drops.fells;
  return drops.today.at === 0 ? 0 : drops.today.at + gapMinutes * 60;
}

/** Drops promised and not yet paid by the gate (the order sets' marks, the badges'; D266). */
export function dropsOnWay(content: Content, state: BaseState): number {
  const drops = state.meta.drops;
  const badges = Math.floor(badgeCount(content, state) / content.cards.drops.badgesPer);
  return Math.max(0, drops.owed.earned - drops.owed.paid) + Math.max(0, badges - drops.paid.badges);
}

/** Whether felling is still under its cap for the island day of `now`. */
export function fellRoom(content: Content, drops: Drops, now: number): boolean {
  const given = drops.today.day === islandDay(content, now) ? drops.today.fells : 0;
  return given < content.cards.drops.fells.perDay;
}

/**
 * Pays the count-based drops earned and not yet received at `now`, one at most (D249, D251,
 * D266): the claims' queue first (one mark per quest set and per fuelled order set; the orders
 * themselves pay shards), else felling's (its schedule's marks; at most `perDay` an island day;
 * marks passed while the gate is shut pay nothing later), else the badges' (one per
 * `badgesPer`); the queue and the badges wait their turn, there are few. From counters, so a
 * batch of fells pays what the same fells one by one would, and it never takes back (a removed
 * badge stops counting toward new drops only).
 */
export function credit(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const drops = state.meta.drops;
  const paid = drops.paid;
  const fellsDue = Math.max(0, fellDrops(content, state.meta.stats.felled) - paid.fells);
  const badgesDue = Math.max(
    0,
    Math.floor(badgeCount(content, state) / content.cards.drops.badgesPer) - paid.badges,
  );
  const owedDue = Math.max(0, drops.owed.earned - drops.owed.paid);
  if (fellsDue === 0 && badgesDue === 0 && owedDue === 0) return { state, events: [] };
  // The queue first (D266): its marks are few by construction (one per quest day and per
  // fuelled set) and must arrive; felling's marks are elastic, they lapse when the hour is taken.
  const open = dropGateOpen(content, drops, now);
  const source =
    open && owedDue > 0
      ? ("claims" as const)
      : open && fellsDue > 0 && fellRoom(content, drops, now)
        ? ("fells" as const)
        : open && badgesDue > 0
          ? ("badges" as const)
          : null;
  // Felling's marks are spent either way; the badges' wait.
  if (source === null && fellsDue === 0) return { state, events: [] };
  const day = islandDay(content, now);
  const given = drops.today.day === day ? drops.today.fells : 0;
  const next = source ? grantDrops(state, 1, 1) : state;
  const meta = {
    ...next.meta,
    drops: {
      ...next.meta.drops,
      paid: { fells: paid.fells + fellsDue, badges: paid.badges + (source === "badges" ? 1 : 0) },
      owed: { ...drops.owed, paid: drops.owed.paid + (source === "claims" ? 1 : 0) },
      today: source ? { day, fells: given + (source === "fells" ? 1 : 0), at: now } : drops.today,
    },
  };
  const events: GameEvent[] = source ? [{ type: "drop_earned", tier: 1, count: 1, source }] : [];
  return { state: { ...next, meta }, events };
}
