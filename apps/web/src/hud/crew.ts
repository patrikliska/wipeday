/**
 * Words for the crew at home (W4b): what each job would add, and one status line
 * per survivor. Shared by the squad panel, the top bar's crew chip and the map's
 * party picker, so a job reads the same everywhere.
 */
import type { BaseState } from "@wipe-day/domain/base";
import {
  guardScoreOf,
  isAsleep,
  isTired,
  type Job,
  nodeJobRates,
  stationPercentOf,
  stationWorker,
} from "@wipe-day/domain/crew";
import { tiredWorkers } from "@wipe-day/domain/jobs";
import type { Survivor } from "@wipe-day/domain/missions";
import { stations } from "@wipe-day/domain/recipes";
import {
  abbrev,
  content,
  duration,
  nodeName,
  resourceName,
  stationName,
  survivorName,
  t,
} from "../state/world";

export interface JobOption {
  key: string;
  job: Job | null;
  label: string;
  /** Why it cannot be picked (the station is someone else's), or null. */
  blocked: string | null;
}

export function jobKey(job: Job | null): string {
  if (job === null) return "free";
  if (job.kind === "node") return `node:${job.node}`;
  if (job.kind === "station") return `station:${job.station}`;
  return "guard";
}

/** "+18 timber/h" for a node job; empty when the tools get nothing from it. */
function nodeGain(base: BaseState, survivorId: string, node: string): string {
  return Object.entries(nodeJobRates(content, base, survivorId, node))
    .map(([id, perHour]) =>
      t("work.per_hour", { amount: abbrev(perHour), what: resourceName(id).toLowerCase() }),
    )
    .join(", ");
}

/** What a job is called, with what it adds for this survivor. */
export function jobLabel(base: BaseState, survivorId: string, job: Job | null): string {
  if (job === null) return t("work.job_free");
  if (job.kind === "guard")
    return t("work.job_guard", { points: guardScoreOf(content, survivorId) });
  if (job.kind === "station")
    return t("work.job_station", {
      station: stationName(job.station),
      percent: stationPercentOf(content, survivorId, job.station),
    });
  return t("work.job_node", {
    node: nodeName(job.node),
    gain: nodeGain(base, survivorId, job.node),
  });
}

/** Every job `survivorId` could take now: free, guard, the nodes the tools reach, built stations. */
export function jobOptions(base: BaseState, survivorId: string): JobOption[] {
  const options: JobOption[] = [
    { key: "free", job: null, label: jobLabel(base, survivorId, null), blocked: null },
  ];
  const guard: Job = { kind: "guard" };
  options.push({
    key: "guard",
    job: guard,
    label: jobLabel(base, survivorId, guard),
    blocked: null,
  });
  for (const kind of content.nodeKinds) {
    const job: Job = { kind: "node", node: kind.id };
    if (Object.keys(nodeJobRates(content, base, survivorId, kind.id)).length === 0) continue;
    options.push({ key: jobKey(job), job, label: jobLabel(base, survivorId, job), blocked: null });
  }
  for (const station of stations(content)) {
    if ((base.buildings[station] ?? 0) === 0) continue;
    const job: Job = { kind: "station", station };
    const worker = stationWorker(base, station);
    const blocked =
      worker && worker.id !== survivorId
        ? t("work.station_taken", { name: survivorName(worker.id) })
        : null;
    options.push({ key: jobKey(job), job, label: jobLabel(base, survivorId, job), blocked });
  }
  return options;
}

export type CrewTone = "away" | "warn" | "good" | "muted";

/** One line for where a survivor is and how they are, with its tone. Away and hurt come first. */
export function restLine(member: Survivor, now: number): { text: string; tone: CrewTone } | null {
  const until = member.shift.sleepUntil;
  if (until !== null && isAsleep(member, now))
    return { text: t("work.asleep", { time: duration(until - now) }), tone: "muted" };
  if (member.job !== null && isTired(member, now)) return { text: t("work.tired"), tone: "warn" };
  return null;
}

/** Free survivors at home, unhurt and awake: who could be given a job right now. */
export function freeAtHome(base: BaseState, now: number): Survivor[] {
  return base.crew.filter(
    (member) =>
      member.job === null &&
      member.away === null &&
      !(member.injuredUntil !== null && member.injuredUntil > now),
  );
}

/** The crew chip's short line: who needs a look first (tired, then free), else who is out. */
export function crewSummary(base: BaseState, now: number): string {
  const tired = tiredWorkers(base, now).length;
  if (tired > 0) return t("work.summary_tired", { count: tired });
  const free = freeAtHome(base, now).length;
  if (free > 0) return t("work.summary_free", { count: free });
  const away = base.crew.filter((member) => member.away !== null).length;
  if (away > 0) return t("work.summary_away", { count: away });
  return t("work.summary_working");
}
