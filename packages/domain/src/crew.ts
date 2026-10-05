/**
 * The crew at home (W4b): what a survivor's job adds and how rested they are.
 * Pure lookups and arithmetic on state, with no imports beyond types, so the
 * accrual (`base.ts`), the crafting queues (`craft.ts`) and the missions can all
 * read them. The commands that change jobs and rest are in `jobs.ts`.
 *
 * Work is lazy like the rest of the base. A survivor's `shift` says since when
 * they could work (assigned, back from a trip, up from a rest) and when they
 * tire; the output of any span is integrated from that, never ticked.
 */
import type { Amounts, Content, Trait } from "@wipe-day/content/schema";
import type { BaseState } from "./base";
import type { Survivor } from "./missions";

/** What a survivor does at home. Null on the survivor: free (they wander and help nowhere). */
export type Job =
  | { kind: "node"; node: string }
  | { kind: "station"; station: string }
  | { kind: "guard" };

export interface Shift {
  /** Work counts from here: the assignment, the return from a trip, or the end of a rest. */
  since: number;
  /** From here on they work at the tired pace until they rest. */
  tiredAt: number;
  /** Asleep until then; null = awake. */
  sleepUntil: number | null;
}

const HOUR = 3600;

export function traitsOf(content: Content, survivorId: string): Trait[] {
  const member = content.crew.find((candidate) => candidate.id === survivorId);
  return (member?.traits ?? []).flatMap((id) => {
    const trait = content.traits.find((candidate) => candidate.id === id);
    return trait ? [trait] : [];
  });
}

/** A fresh, rested shift starting at `at`. */
export function newShift(content: Content, at: number): Shift {
  return { since: at, tiredAt: at + content.crewRules.jobs.awakeHours * HOUR, sleepUntil: null };
}

export function sameJob(a: Job | null, b: Job | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "node" && b.kind === "node") return a.node === b.node;
  if (a.kind === "station" && b.kind === "station") return a.station === b.station;
  return true;
}

export function isAsleep(survivor: Survivor, now: number): boolean {
  return survivor.shift.sleepUntil !== null && now < survivor.shift.sleepUntil;
}

/** Awake past their hours: working at the tired pace until they rest. */
export function isTired(survivor: Survivor, now: number): boolean {
  return !isAsleep(survivor, now) && now >= survivor.shift.tiredAt;
}

/** Hurt until a moment after `now`. */
function isHurt(survivor: Survivor, now: number): boolean {
  return survivor.injuredUntil !== null && survivor.injuredUntil > now;
}

/** Whether they are working their job right now (home, awake, unhurt, with a job). */
export function isWorking(survivor: Survivor, now: number): boolean {
  return (
    survivor.job !== null &&
    survivor.away === null &&
    !isAsleep(survivor, now) &&
    !isHurt(survivor, now)
  );
}

/** Percent of the full pace right now: 100, the tired pace, or 0 when not working. */
export function paceAt(content: Content, survivor: Survivor, now: number): number {
  if (!isWorking(survivor, now)) return 0;
  return isTired(survivor, now) ? content.crewRules.jobs.tiredPercent : 100;
}

/**
 * Wakes a sleeper early (they were sent out): the rest so far counts in proportion, so a
 * half rest buys half a day awake. Awake survivors pass through unchanged.
 */
export function wake(content: Content, survivor: Survivor, now: number): Survivor {
  const until = survivor.shift.sleepUntil;
  if (until === null || now >= until) return survivor;
  const { sleepHours, awakeHours } = content.crewRules.jobs;
  const slept = Math.max(0, now - (until - sleepHours * HOUR));
  const awake = Math.floor((awakeHours * HOUR * slept) / (sleepHours * HOUR));
  return { ...survivor, shift: { since: now, tiredAt: now + awake, sleepUntil: null } };
}

// --- node work ---------------------------------------------------------------------

/** Per hour at full pace, what `survivorId` adds working `nodeKind` with the base's tool. */
export function nodeJobRates(
  content: Content,
  state: Pick<BaseState, "toolId">,
  survivorId: string,
  nodeKind: string,
): Amounts {
  const kind = content.nodeKinds.find((candidate) => candidate.id === nodeKind);
  const tool = content.tools.find((candidate) => candidate.id === state.toolId);
  if (!kind || !tool) return {};
  const bonus = traitsOf(content, survivorId).reduce((sum, trait) => sum + (trait.job ?? 0), 0);
  const percent = content.crewRules.jobs.nodePercent + bonus;
  const out: Amounts = {};
  for (const [id, share] of Object.entries(kind.yields)) {
    const perHour = Math.floor(((tool.rates[id] ?? 0) * share * percent) / 100);
    if (perHour > 0) out[id] = perHour;
  }
  return out;
}

/** Seconds of [from, to] that overlap [start, end]. */
function overlap(from: number, to: number, start: number, end: number): number {
  return Math.max(0, Math.min(to, end) - Math.max(from, start));
}

/**
 * What the node workers made between `from` and `to`, before storage caps. Each worker
 * counts from their shift's `since` (and from the end of an injury), at full pace until
 * `tiredAt` and at the tired pace after; a served meal adds its percent (morale) while it
 * lasts. Away survivors make nothing: they bank when they leave and count again from
 * their return.
 */
export function crewOutput(content: Content, state: BaseState, from: number, to: number): Amounts {
  const { tiredPercent } = content.crewRules.jobs;
  const fed = state.wellFed;
  const totals: Record<string, number> = {};
  for (const member of state.crew) {
    if (member.job?.kind !== "node" || member.away !== null) continue;
    const start = Math.max(from, member.shift.since, member.injuredUntil ?? 0);
    if (start >= to) continue;
    const full = overlap(start, to, start, member.shift.tiredAt);
    const tired = overlap(start, to, member.shift.tiredAt, to);
    let seconds = full + (tired * tiredPercent) / 100;
    if (fed) seconds += (overlap(start, to, start, fed.until) * fed.percent) / 100;
    for (const [id, perHour] of Object.entries(
      nodeJobRates(content, state, member.id, member.job.node),
    )) {
      totals[id] = (totals[id] ?? 0) + (perHour * seconds) / HOUR;
    }
  }
  const out: Amounts = {};
  for (const [id, amount] of Object.entries(totals)) out[id] = Math.floor(amount);
  return out;
}

/** Per hour right now, everything the node workers add (for the panels). */
export function crewRates(content: Content, state: BaseState, now: number): Amounts {
  const out: Amounts = {};
  for (const member of state.crew) {
    if (member.job?.kind !== "node") continue;
    const pace = paceAt(content, member, now);
    if (pace === 0) continue;
    for (const [id, perHour] of Object.entries(
      nodeJobRates(content, state, member.id, member.job.node),
    )) {
      out[id] = (out[id] ?? 0) + Math.floor((perHour * pace) / 100);
    }
  }
  return out;
}

// --- stations and guards -----------------------------------------------------------

/** The survivor assigned to `station`, if any (one per station). */
export function stationWorker(state: Pick<BaseState, "crew">, station: string): Survivor | null {
  return (
    state.crew.find((member) => member.job?.kind === "station" && member.job.station === station) ??
    null
  );
}

/** Percent `survivorId` would make `station`'s crafting faster. */
export function stationPercentOf(content: Content, survivorId: string, station: string): number {
  let percent = content.crewRules.jobs.stationPercent;
  for (const trait of traitsOf(content, survivorId)) {
    percent += (trait.craft?.[station] ?? 0) + (trait.craft?.any ?? 0);
  }
  return percent;
}

/**
 * Percent faster crafting at `station` from the survivor assigned there. It counts from the
 * moment they are assigned (they set the station up), and assigning or moving them reprices
 * the queue (`repriceStation` in `craft.ts`); trips and rests do not.
 */
export function stationBoost(
  content: Content,
  state: Pick<BaseState, "crew">,
  station: string,
): number {
  const worker = stationWorker(state, station);
  return worker ? stationPercentOf(content, worker.id, station) : 0;
}

/** Defence points `survivorId` brings on guard duty. */
export function guardScoreOf(content: Content, survivorId: string): number {
  return traitsOf(content, survivorId).reduce(
    (sum, trait) => sum + (trait.guard ?? 0),
    content.crewRules.jobs.guardScore,
  );
}

/** The holdfast's defence from guards at their post right now (raids use it from W6). */
export function defence(content: Content, state: Pick<BaseState, "crew">, now: number): number {
  let score = 0;
  for (const member of state.crew) {
    if (member.job?.kind === "guard" && isWorking(member, now)) {
      score += guardScoreOf(content, member.id);
    }
  }
  return score;
}

// --- bonds --------------------------------------------------------------------------

export function bondKey(a: string, b: string): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

/** Every pair in a party, as bond keys. */
export function pairsOf(crewIds: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < crewIds.length; i++) {
    for (let j = i + 1; j < crewIds.length; j++) {
      const a = crewIds[i];
      const b = crewIds[j];
      if (a !== undefined && b !== undefined) out.push(bondKey(a, b));
    }
  }
  return out;
}

/** The bonded pairs in a party: those who have been out together often enough. */
export function bondedPairs(
  content: Content,
  state: Pick<BaseState, "bonds">,
  crewIds: string[],
): string[] {
  return pairsOf(crewIds).filter((key) => (state.bonds[key] ?? 0) >= content.crewRules.bonds.trips);
}
