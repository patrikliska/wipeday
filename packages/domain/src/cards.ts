/**
 * What owned cards do (docs/redesign/12-feel.md 7.2-7.3; D248, D250). A survivor card adds to
 * its hand while the hand is hired: its stars (its line ×(1 + perStar) a star above 1, one `more`
 * so the Workshop's `inc`s never dilute it), its trait, and the gear it wears, plus the kit when
 * three pieces share a rarity. The crew sets hold for the collection, hired or not.
 *
 * The domain's only source of card effects; `effects.ts` adds them to `activeEffects` and keys
 * its cache on `meta.cards` and `run.hands`.
 */
import { cardEffect } from "@wipe-day/content/cards";
import type { Effect } from "@wipe-day/content/effects";
import type { Content, GearDef, LineDef, SurvivorDef } from "@wipe-day/content/schema";
import type { BaseState, Meta } from "./state";

type Cards = Meta["cards"];

interface Index {
  survivors: Map<string, SurvivorDef>;
  gear: Map<string, GearDef>;
  /** Each hand's line. */
  lines: Map<string, LineDef>;
}

const indexes = new WeakMap<Content, Index>();

function indexOf(content: Content): Index {
  const known = indexes.get(content);
  if (known) return known;
  const index: Index = {
    survivors: new Map(content.cards.survivors.map((row) => [row.id, row])),
    gear: new Map(content.cards.gear.map((row) => [row.id, row])),
    lines: new Map(content.lines.map((line) => [line.hand, line])),
  };
  indexes.set(content, index);
  return index;
}

export const survivorOf = (content: Content, id: string): SurvivorDef | undefined =>
  indexOf(content).survivors.get(id);

export const gearOf = (content: Content, id: string): GearDef | undefined =>
  indexOf(content).gear.get(id);

/** The line a survivor's hand runs. */
export const lineOfHand = (content: Content, hand: string): LineDef | undefined =>
  indexOf(content).lines.get(hand);

/** A survivor's stars, or 0 when its card is not owned. */
export const starsOf = (state: BaseState, survivor: string): number =>
  state.meta.cards.survivors[survivor] ?? 0;

/** The gear `survivor` wears, in content order. */
export function wornBy(content: Content, cards: Cards, survivor: string): GearDef[] {
  return content.cards.gear.filter((row) => cards.gear[row.id] === survivor);
}

/**
 * What one owned survivor's card adds to its line `line` while hired: stars, trait, gear, kit.
 * Empty when the card is not owned.
 */
export function survivorEffects(content: Content, cards: Cards, survivor: string, line: string) {
  const out: Effect[] = [];
  const stars = cards.survivors[survivor];
  const def = survivorOf(content, survivor);
  if (stars === undefined || !def) return out;
  const { perStar } = content.cards.stars;
  if (stars > 1)
    out.push({ stat: "output", op: "more", value: 1 + perStar * (stars - 1), scope: line });
  out.push(cardEffect(def.trait, line));
  const worn = wornBy(content, cards, survivor);
  for (const gear of worn) out.push(cardEffect(gear.effect, line));
  const { kit } = content.cards.sets;
  const counts = new Map<string, number>();
  for (const gear of worn) counts.set(gear.rarity, (counts.get(gear.rarity) ?? 0) + 1);
  if ([...counts.values()].some((n) => n >= kit.pieces)) out.push(cardEffect(kit.effect, line));
  return out;
}

/** Whether the crew set's survivors are all owned at its stars. */
export function setComplete(
  content: Content,
  cards: Cards,
  set: Content["cards"]["sets"]["crews"][number],
): boolean {
  return content.cards.survivors
    .filter((row) => set.rarity === undefined || row.rarity === set.rarity)
    .every((row) => (cards.survivors[row.id] ?? 0) >= set.stars);
}

const memo = new WeakMap<Cards, { hands: readonly string[]; effects: Effect[] }>();

/** Every card effect in force: the hired survivors' and the complete crew sets'. */
export function cardEffects(content: Content, state: BaseState): Effect[] {
  const cards = state.meta.cards;
  const known = memo.get(cards);
  if (known && known.hands === state.run.hands) return known.effects;
  const out: Effect[] = [];
  for (const id of state.run.hands) {
    const line = content.lines.find((row) => row.id === id);
    if (line) out.push(...survivorEffects(content, cards, line.hand, line.id));
  }
  for (const set of content.cards.sets.crews)
    if (setComplete(content, cards, set)) out.push(...set.effects);
  memo.set(cards, { hands: state.run.hands, effects: out });
  return out;
}

/**
 * What hiring `line`'s hand would multiply its unit rate by through its card (the advisor's
 * hire gain): the `more` factors of output and speed its card adds. 1 without the card.
 */
export function hireFactor(content: Content, state: BaseState, line: LineDef): number {
  let factor = 1;
  for (const effect of survivorEffects(content, state.meta.cards, line.hand, line.id)) {
    if (effect.op === "more" && (effect.stat === "output" || effect.stat === "speed"))
      factor *= effect.value;
  }
  return factor;
}

// --- what the Album and the sheets read (R3 S3; D260-D262) ----------------------------------

/** The next star a survivor can buy: its number, its shard price and the shards held. */
export function nextStar(
  content: Content,
  state: BaseState,
  survivor: string,
): { to: number; cost: number; have: number } | null {
  const stars = state.meta.cards.survivors[survivor];
  if (stars === undefined) return null;
  const cost = content.cards.stars.costs[stars - 1];
  if (cost === undefined) return null;
  return { to: stars + 1, cost, have: state.meta.drops.shards.crew[survivor] ?? 0 };
}

/** The most stars a survivor can hold. */
export const maxStars = (content: Content): number => content.cards.stars.costs.length + 1;

/** What crafting `gear` costs in shards of its rarity, and how many are held. */
export function craftCost(
  content: Content,
  state: BaseState,
  gear: string,
): { cost: number; have: number } | null {
  const def = gearOf(content, gear);
  if (!def) return null;
  return {
    cost: content.cards.shards.craft[def.rarity],
    have: state.meta.drops.shards.gear[def.rarity],
  };
}

/** How full the Album is: survivors and gear owned against the whole set. */
export function albumCounts(
  content: Content,
  state: BaseState,
): { survivors: { owned: number; total: number }; gear: { owned: number; total: number } } {
  const cards = state.meta.cards;
  return {
    survivors: {
      owned: content.cards.survivors.filter((row) => cards.survivors[row.id] !== undefined).length,
      total: content.cards.survivors.length,
    },
    gear: {
      owned: content.cards.gear.filter((row) => row.id in cards.gear).length,
      total: content.cards.gear.length,
    },
  };
}

/** The pity counters as the Album prints them: cards since the last of each rarity, of `within`. */
export function pityView(
  content: Content,
  drops: BaseState["meta"]["drops"],
): { rarity: "rare" | "epic" | "legendary"; since: number; within: number }[] {
  const limits = content.cards.drops.pity;
  return (["rare", "epic", "legendary"] as const).map((rarity) => ({
    rarity,
    since: drops.pity[rarity],
    within: limits[rarity],
  }));
}

/** How many of a crew set's survivors stand at its stars, of how many it needs. */
export function setProgress(
  content: Content,
  cards: Cards,
  set: Content["cards"]["sets"]["crews"][number],
): { done: number; total: number } {
  const members = content.cards.survivors.filter(
    (row) => set.rarity === undefined || row.rarity === set.rarity,
  );
  return {
    done: members.filter((row) => (cards.survivors[row.id] ?? 0) >= set.stars).length,
    total: members.length,
  };
}

/** Supply Drops held, every tier together. */
export const heldDrops = (drops: BaseState["meta"]["drops"]): number =>
  drops.held[1] + drops.held[2] + drops.held[3];

/** The highest tier held (the crate in front, the one a tap opens), or null. */
export function topTier(drops: BaseState["meta"]["drops"]): 1 | 2 | 3 | null {
  for (const tier of [3, 2, 1] as const) if (drops.held[tier] > 0) return tier;
  return null;
}
