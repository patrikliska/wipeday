/**
 * The crew's commands at home (W4b): take a job, go free, rest. Each banks what
 * the workers made so far first (like a tool upgrade), so a change never
 * re-prices time that already passed. The arithmetic lives in `crew.ts`.
 */
import type { Content } from "@wipe-day/content/schema";
import { type BaseState, collect } from "./base";
import { repriceStation } from "./craft";
import {
  isAsleep,
  isTired,
  type Job,
  newShift,
  nodeJobRates,
  type Shift,
  sameJob,
  stationWorker,
} from "./crew";
import type { GameEvent } from "./events";
import { type Survivor, survivorIn } from "./missions";
import { stationLevel, stations } from "./recipes";

const HOUR = 3600;

export type JobRefusal =
  | { code: "no_survivor" }
  | { code: "away" }
  | { code: "no_yield"; node: string }
  | { code: "no_station"; station: string }
  | { code: "station_taken"; station: string; by: string }
  | { code: "asleep"; until: number }
  | { code: "nobody_tired" };

type JobResult =
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; refusal: JobRefusal };

/**
 * Why `survivorId` cannot take `job` right now; null when they can. Someone out on a trip
 * can be given a job: it is a standing order they pick up when they are home.
 */
export function jobStatus(
  content: Content,
  state: BaseState,
  survivorId: string,
  job: Job | null,
): JobRefusal | null {
  const survivor = survivorIn(state, survivorId);
  if (!survivor) return { code: "no_survivor" };
  if (job?.kind === "node") {
    if (Object.keys(nodeJobRates(content, state, survivorId, job.node)).length === 0)
      return { code: "no_yield", node: job.node };
  }
  if (job?.kind === "station") {
    if (!stations(content).includes(job.station) || stationLevel(state, job.station) === 0)
      return { code: "no_station", station: job.station };
    const worker = stationWorker(state, job.station);
    if (worker && worker.id !== survivorId)
      return { code: "station_taken", station: job.station, by: worker.id };
  }
  return null;
}

function withMember(state: BaseState, member: Survivor): BaseState {
  return { ...state, crew: state.crew.map((m) => (m.id === member.id ? member : m)) };
}

function stationOf(job: Job | null): string | null {
  return job?.kind === "station" ? job.station : null;
}

/**
 * Gives `survivorId` a job (null: free). Same job again changes nothing. Time spent free
 * counts as rest: someone free for a full rest's length starts the job rested.
 */
export function assign(
  content: Content,
  state: BaseState,
  survivorId: string,
  job: Job | null,
  now: number,
): JobResult {
  const refusal = jobStatus(content, state, survivorId, job);
  if (refusal) return { ok: false, refusal };
  const survivor = survivorIn(state, survivorId);
  if (!survivor) return { ok: false, refusal: { code: "no_survivor" } };
  if (sameJob(survivor.job, job)) return { ok: true, state, events: [] };

  let next = collect(content, state, now).state;
  const restedFree =
    survivor.job === null &&
    !isAsleep(survivor, now) &&
    now - survivor.shift.since >= content.crewRules.jobs.sleepHours * HOUR;
  const shift: Shift =
    job !== null && restedFree
      ? newShift(content, now)
      : { ...survivor.shift, since: Math.max(survivor.shift.since, now) };
  next = withMember(next, { ...survivor, job, shift });
  for (const station of new Set([stationOf(survivor.job), stationOf(job)])) {
    if (station) next = repriceStation(content, next, station, now);
  }
  return { ok: true, state: next, events: [{ type: "assigned", survivor: survivorId, job }] };
}

/** The shift of someone who goes to bed at `now`. */
function bedtime(content: Content, now: number): Shift {
  const { sleepHours, awakeHours } = content.crewRules.jobs;
  const until = now + sleepHours * HOUR;
  return { since: until, tiredAt: until + awakeHours * HOUR, sleepUntil: until };
}

/** Sends `survivorId` to bed for a rest; they go back to their job when they wake. */
export function rest(
  content: Content,
  state: BaseState,
  survivorId: string,
  now: number,
): JobResult {
  const survivor = survivorIn(state, survivorId);
  if (!survivor) return { ok: false, refusal: { code: "no_survivor" } };
  if (survivor.away !== null) return { ok: false, refusal: { code: "away" } };
  if (isAsleep(survivor, now) && survivor.shift.sleepUntil !== null)
    return { ok: false, refusal: { code: "asleep", until: survivor.shift.sleepUntil } };
  const banked = collect(content, state, now).state;
  const shift = bedtime(content, now);
  return {
    ok: true,
    state: withMember(banked, { ...survivor, shift }),
    events: [{ type: "rested", survivor: survivorId, until: shift.sleepUntil ?? now }],
  };
}

/** Workers at home who have tired: who "Rest the tired" sends to bed. */
export function tiredWorkers(state: BaseState, now: number): Survivor[] {
  return state.crew.filter(
    (member) => member.job !== null && member.away === null && isTired(member, now),
  );
}

/** Sends every tired worker at home to bed at once. */
export function restTired(content: Content, state: BaseState, now: number): JobResult {
  const tired = tiredWorkers(state, now);
  if (tired.length === 0) return { ok: false, refusal: { code: "nobody_tired" } };
  let next = collect(content, state, now).state;
  const shift = bedtime(content, now);
  const events: GameEvent[] = [];
  for (const member of tired) {
    next = withMember(next, { ...member, shift });
    events.push({ type: "rested", survivor: member.id, until: shift.sleepUntil ?? now });
  }
  return { ok: true, state: next, events };
}
