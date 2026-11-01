/**
 * Daily quests (docs/redesign/12-feel.md 9.2; D248, D257): three a day on the island's clock,
 * the same three for every friend, rolled on `seedOf(island seed, SEED.quest, island day)`.
 * Each is a lifetime counter (`meta.stats`) that must grow by `n` since the day's roll, which
 * `meta.quests.snapshot` remembers. `rollQuests` runs at the top of every command (after settle,
 * before the rule): when the island day has moved it pays what the old day met and left
 * unclaimed (each quest's pay, and the set's once all three are done), then draws the new day.
 * Nothing is lost by not clicking; claiming is for the number pop.
 */
import type { Content, QuestDef } from "@wipe-day/content/schema";
import type { GameEvent } from "./events";
import { rng, SEED, seedOf } from "./rng";
import { pay } from "./scrap";
import type { BaseState, Meta } from "./state";
import { islandDay } from "./weather";

const byId = new WeakMap<Content, Map<string, QuestDef>>();

/** The quest with `id`, if the content lists it. */
export function questOf(content: Content, id: string): QuestDef | undefined {
  let map = byId.get(content);
  if (!map) {
    map = new Map(content.quests.quests.map((quest) => [quest.id, quest]));
    byId.set(content, map);
  }
  return map.get(id);
}

/** The island's quests for island day `day`: `perDay` of the pool, in the pool's order. */
export function rollQuestIds(content: Content, day: number): string[] {
  const { perDay, quests } = content.quests;
  const roll = rng(seedOf(content.islandClock.seed, SEED.quest, day));
  const shuffled = [...quests];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = roll.int(0, i);
    const a = shuffled[i] as QuestDef;
    shuffled[i] = shuffled[j] as QuestDef;
    shuffled[j] = a;
  }
  return shuffled
    .slice(0, perDay)
    .sort((a, b) => quests.indexOf(a) - quests.indexOf(b))
    .map((quest) => quest.id);
}

/** The day's quests in order (ids the content no longer knows are skipped). */
export function questsOf(content: Content, state: BaseState): QuestDef[] {
  const out: QuestDef[] = [];
  for (const id of state.meta.quests.ids) {
    const quest = questOf(content, id);
    if (quest) out.push(quest);
  }
  return out;
}

export const questClaimed = (state: BaseState, id: string): boolean =>
  state.meta.quests.claimed.includes(id);

/** How far a quest has come today: the counter's growth since the roll, capped at its goal. */
export function questProgress(state: BaseState, quest: QuestDef): { value: number; goal: number } {
  const stats = state.meta.stats;
  const since = state.meta.quests.snapshot[quest.stat] ?? 0;
  return { value: Math.max(0, Math.min(quest.n, stats[quest.stat] - since)), goal: quest.n };
}

export const questMet = (state: BaseState, quest: QuestDef): boolean =>
  questProgress(state, quest).value >= quest.n;

/** Whether every quest of the day is claimed (the set bonus is due once). */
export function questSetDone(content: Content, state: BaseState): boolean {
  const quests = questsOf(content, state);
  return quests.length > 0 && quests.every((quest) => questClaimed(state, quest.id));
}

/** The second the island's next day starts (when the quests roll). */
export function nextQuestRoll(content: Content, now: number): number {
  const offset = content.islandClock.utcOffsetMinutes * 60;
  return (islandDay(content, now) + 1) * 86_400 - offset;
}

/**
 * Claims `quest` (the caller checked it is met and unclaimed): its pay, and the set's when it
 * completes the day.
 */
export function claimQuest(
  content: Content,
  state: BaseState,
  quest: QuestDef,
): { state: BaseState; events: GameEvent[] } {
  const quests = state.meta.quests;
  let out: BaseState = {
    ...state,
    meta: {
      ...state.meta,
      quests: { ...quests, claimed: [...quests.claimed, quest.id] },
      stats: { ...state.meta.stats, quests: state.meta.stats.quests + 1 },
    },
  };
  const events: GameEvent[] = [
    { type: "quest_claimed", id: quest.id, pays: content.quests.pays.each },
  ];
  const paid = pay(out, content.quests.pays.each, "quests");
  out = paid.state;
  events.push(...paid.events);
  if (!out.meta.quests.setPaid && questSetDone(content, out)) {
    out = { ...out, meta: { ...out.meta, quests: { ...out.meta.quests, setPaid: true } } };
    events.push({
      type: "quest_set_done",
      day: out.meta.quests.day,
      pays: content.quests.pays.set,
    });
    // The set's drop queues for the drops' hourly gate, which pays the queue before felling's
    // marks (D256, D266): once a day by construction, so the queue stays short.
    const bonus = pay(out, content.quests.pays.set, "quests", true);
    out = bonus.state;
    events.push(...bonus.events);
  }
  return { state: out, events };
}

/**
 * The day's roll, if the island day moved since the last: pays the old day's met, unclaimed
 * quests (and the set), then draws the new day with a fresh snapshot of the counters.
 */
export function rollQuests(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const day = islandDay(content, now);
  if (state.meta.quests.day === day) return { state, events: [] };
  let out = state;
  const events: GameEvent[] = [];
  if (state.meta.quests.day > 0) {
    for (const quest of questsOf(content, out)) {
      if (questClaimed(out, quest.id) || !questMet(out, quest)) continue;
      const claimed = claimQuest(content, out, quest);
      out = claimed.state;
      events.push(...claimed.events);
    }
  }
  const quests: Meta["quests"] = {
    day,
    ids: rollQuestIds(content, day),
    claimed: [],
    snapshot: { ...out.meta.stats },
    setPaid: false,
  };
  events.push({ type: "quests_rolled", day });
  return { state: { ...out, meta: { ...out.meta, quests } }, events };
}
