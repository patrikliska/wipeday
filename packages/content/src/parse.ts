/**
 * Validates the parsed data files and checks them against each other and the locale.
 * Browser-safe: the server reads the files from disk (`load.ts`), the web client gets the same
 * objects from its bundler, and both end up here. Collects every problem so one attempt shows
 * the whole list.
 */
import type { z } from "zod";
import { deriveLines } from "./lines";
import type { Locale } from "./locale";
import {
  type Content,
  crewSchema,
  DATA_FILES,
  type DataFile,
  type EntityKind,
  eraSchema,
  FILES,
  flotsamFileSchema,
  islandFileSchema,
  linesFileSchema,
  milestonesFileSchema,
  pacingSchema,
  prestigeSchema,
  resourceSchema,
  targetsFileSchema,
  toolSchema,
  upgradesFileSchema,
  WEATHERS,
} from "./schema";
import { TIERS } from "./tiers";
import { deriveUpgrades } from "./upgrades";

export interface Problem {
  file: string;
  /** The offending entity id; empty when the problem is about the whole file. */
  id: string;
  message: string;
}

export class ContentError extends Error {
  constructor(readonly problems: Problem[]) {
    const lines = problems.map((problem) => `  - ${formatProblem(problem)}`);
    super(`${problems.length} problem(s) in the data files:\n${lines.join("\n")}`);
    this.name = "ContentError";
  }
}

export function formatProblem(problem: Problem): string {
  return problem.id
    ? `${problem.file} \`${problem.id}\`: ${problem.message}`
    : `${problem.file}: ${problem.message}`;
}

/** The identity every named entity shares, with where it came from. */
export interface Identity {
  file: string;
  kind: EntityKind;
  id: string;
}

/** Every named entity in file order. */
export function identities(content: Content): Identity[] {
  return [
    ...FILES.flatMap(({ file, field, kind }) =>
      content[field].map((entity) => ({ file, kind, id: entity.id })),
    ),
    ...content.upgrades
      .filter((upgrade) => upgrade.kind !== "grip")
      .map((upgrade) => ({ file: "upgrades.json5", kind: "upgrade" as const, id: upgrade.id })),
    ...content.flotsam.kinds.map((kind) => ({
      file: "flotsam.json5",
      kind: "flotsam" as const,
      id: kind.id,
    })),
  ];
}

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((issue) =>
    issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
  );
}

/** The largest price a reachable cost may have (docs/redesign/09-architecture.md 2.3). */
export const MAX_REACHABLE_COST = 1e200;

/**
 * Validates every file. `raw` holds each file's parsed JSON5 (undefined when it could not be
 * read, which is reported). Throws `ContentError` listing all problems.
 */
export function parseContent(
  raw: Partial<Record<DataFile, unknown>>,
  locale: Locale,
  readProblems: Problem[] = [],
): Content {
  const problems: Problem[] = [...readProblems];
  // Every file must arrive: a bundler that forgets one would otherwise run on defaults.
  for (const file of DATA_FILES) {
    if (raw[file] === undefined && !readProblems.some((problem) => problem.file === file)) {
      problems.push({ file, id: "", message: "file is missing" });
    }
  }

  /** A file as a whole; its entity lists are checked row by row below. */
  const whole = <T>(file: DataFile, schema: z.ZodType<T>): T | null => {
    const data = raw[file];
    if (data === undefined) return null;
    const parsed = schema.safeParse(data);
    if (parsed.success) return parsed.data;
    problems.push({ file, id: "", message: issuesOf(parsed.error).join("; ") });
    return null;
  };
  /** An entity list, row by row, so one bad row names its id. */
  const rows = <T>(file: DataFile, key: string, schema: z.ZodType<T>): T[] => {
    const data = raw[file] as Record<string, unknown> | undefined;
    if (data === undefined) return [];
    const list = data[key];
    if (!Array.isArray(list)) {
      problems.push({ file, id: "", message: `\`${key}\` must be a list` });
      return [];
    }
    const out: T[] = [];
    for (const [index, row] of list.entries()) {
      const result = schema.safeParse(row);
      if (result.success) {
        out.push(result.data);
        continue;
      }
      const rowId = (row as { id?: unknown })?.id;
      for (const message of issuesOf(result.error)) {
        problems.push({ file, id: typeof rowId === "string" ? rowId : `#${index + 1}`, message });
      }
    }
    const extra = Object.keys(data).filter((name) => name !== key);
    if (file !== "lines.json5" && extra.length > 0)
      problems.push({ file, id: "", message: `unknown keys: ${extra.join(", ")}` });
    return out;
  };

  const resources = rows("resources.json5", "resources", resourceSchema);
  const crew = rows("crew.json5", "crew", crewSchema);
  const tools = rows("tools.json5", "tools", toolSchema);
  const eras = rows("eras.json5", "eras", eraSchema);
  const linesFile = whole("lines.json5", linesFileSchema);
  const prestige = whole("prestige.json5", prestigeSchema);
  const targets = whole("targets.json5", targetsFileSchema);
  const upgrades = whole("upgrades.json5", upgradesFileSchema);
  const milestones = whole("milestones.json5", milestonesFileSchema);
  const flotsam = whole("flotsam.json5", flotsamFileSchema);
  const islandClock = whole("island.json5", islandFileSchema);
  const pacing = whole("pacing.json5", pacingSchema);

  if (
    problems.length > 0 ||
    !linesFile ||
    !prestige ||
    !targets ||
    !upgrades ||
    !milestones ||
    !flotsam ||
    !islandClock ||
    !pacing
  ) {
    throw new ContentError(problems);
  }

  const lines = deriveLines(linesFile.formula, linesFile.lines);
  const buffs: Content["buffs"] = {};
  for (const kind of flotsam.kinds) {
    if ("buff" in kind.effect) buffs[kind.effect.buff] = kind.effect.effects;
  }
  const content: Content = {
    resources,
    crew,
    tools,
    island: linesFile.island,
    formula: linesFile.formula,
    lines,
    stages: linesFile.stages,
    run: linesFile.run,
    prestige,
    tap: targets.tap,
    targets: targets.targets,
    eras,
    upgrades: deriveUpgrades(tools, lines, upgrades),
    milestones,
    flotsam,
    islandClock,
    pacing,
    buffs,
  };
  problems.push(...crossCheck(content, locale));
  if (problems.length > 0) throw new ContentError(problems);
  return content;
}

/** Checks that span entities or files. */
export function crossCheck(content: Content, locale: Locale): Problem[] {
  const problems: Problem[] = [];
  const add = (file: string, id: string, message: string) => problems.push({ file, id, message });

  // Ids are unique within their kind, and each has its name.
  const all = identities(content);
  const seen = new Set<string>();
  for (const { file, kind, id } of all) {
    if (seen.has(`${kind}.${id}`)) add(file, id, "id is used more than once");
    seen.add(`${kind}.${id}`);
    const key = `${kind}.${id}.name`;
    if (!locale.has(key)) add(file, id, `missing locale key \`${key}\``);
  }
  // A shelf row's id names nothing else (its icon and locale key stay unambiguous).
  for (const { file, kind, id } of all) {
    if (kind !== "upgrade") continue;
    if (all.some((other) => other.kind !== "upgrade" && other.id === id))
      add(file, id, "an upgrade id must not be used by any other entity");
  }
  if (!locale.has(`island.${content.island}.name`))
    add("lines.json5", "", `missing locale key \`island.${content.island}.name\``);
  const need = (file: string, id: string, key: string) => {
    if (!locale.has(key)) add(file, id, `missing locale key \`${key}\``);
  };
  for (const target of content.targets) need("targets.json5", target.id, `target.${target.id}.cry`);
  for (const buff of Object.keys(content.buffs)) need("flotsam.json5", buff, `buff.${buff}.name`);
  for (const weather of WEATHERS) need("island.json5", weather, `weather.${weather}.name`);

  // Grip: Rock is free and owned; each rung after it costs more, in era order.
  for (const [index, tool] of content.tools.entries()) {
    const previous = content.tools[index - 1];
    if (index === 0 && tool.cost !== 0) add("tools.json5", tool.id, "the first rung must be free");
    if (previous && TIERS.indexOf(tool.tier) < TIERS.indexOf(previous.tier))
      add("tools.json5", tool.id, "tools must be listed in era order");
    if (previous && !(tool.cost > previous.cost))
      add("tools.json5", tool.id, "each rung must cost more than the one before");
  }

  problems.push(...checkLines(content));
  problems.push(...checkEras(content));
  problems.push(...checkShelf(content));
  problems.push(...checkFlotsam(content));

  // The tap (N10, N9).
  const { tap } = content;
  if (tap.bucket.burst < tap.bucket.perSecond)
    add("targets.json5", "", "the bucket's burst must be at least a second's taps");
  if (tap.hustle.peak > tap.hustle.peakCeiling)
    add("targets.json5", "", "Hustle's peak must not pass its ceiling");

  // The simulator's archetypes.
  for (const [name, archetype] of Object.entries({
    ...content.pacing.archetypes,
    ...content.pacing.scenarios,
  })) {
    if (archetype.tapsPerSecond > tap.bucket.perSecond)
      add("pacing.json5", name, "taps a second above the bucket's rate would only be clamped");
  }
  return problems;
}

/** Eras and their targets (02-the-run.md 13.2). */
function checkEras(content: Content): Problem[] {
  const problems: Problem[] = [];
  const add = (file: string, id: string, message: string) => problems.push({ file, id, message });
  const { eras, targets, lines } = content;
  if (eras.map((era) => era.id).join() !== TIERS.join())
    add("eras.json5", "", `the eras must be ${TIERS.join(", ")}, in that order`);
  for (const [index, era] of eras.entries()) {
    const previous = eras[index - 1];
    if (index === 0 && era.cost !== 0) add("eras.json5", era.id, "the first era must be free");
    if (previous && !(era.cost > previous.cost))
      add("eras.json5", era.id, "each era must cost more than the one before");
    const target = targets.find((row) => row.id === era.target);
    if (!target) add("eras.json5", era.id, `unknown target \`${era.target}\` (targets.json5)`);
    else if (target.era !== era.id)
      add("eras.json5", era.id, `target \`${target.id}\` belongs to the ${target.era} era`);
    if (!lines.some((line) => line.era === era.id))
      add("eras.json5", era.id, "an era must open at least one line");
  }
  for (const [index, target] of targets.entries()) {
    if (targets.findIndex((row) => row.id === target.id) !== index) continue;
    if (eras.filter((era) => era.target === target.id).length !== 1)
      add("targets.json5", target.id, "each target belongs to exactly one era");
    const previous = targets[index - 1];
    if (previous && !(target.fellTaps > previous.fellTaps))
      add("targets.json5", target.id, "fellTaps must rise from era to era");
  }
  return problems;
}

/** The shelf and milestones (02-the-run.md 13.3). */
function checkShelf(content: Content): Problem[] {
  const problems: Problem[] = [];
  const add = (file: string, id: string, message: string) => problems.push({ file, id, message });
  const island = content.upgrades.filter((upgrade) => upgrade.kind === "island");
  for (const [index, upgrade] of island.entries()) {
    const previous = island[index - 1];
    if (previous && !(upgrade.cost > previous.cost))
      add("upgrades.json5", upgrade.id, "each island upgrade must cost more than the one before");
  }
  for (const upgrade of content.upgrades) {
    if (!(upgrade.cost < MAX_REACHABLE_COST))
      add("upgrades.json5", upgrade.id, "its price must stay under 1e200");
  }
  const rising = (file: string, what: string, ats: number[]) => {
    for (const [index, at] of ats.entries()) {
      const before = ats[index - 1];
      if (before !== undefined && !(at > before)) add(file, "", `${what} must rise: ${at}`);
    }
  };
  const { line, lineEvery, roster } = content.milestones;
  rising(
    "milestones.json5",
    "line milestones",
    line.map((step) => step.at),
  );
  rising(
    "milestones.json5",
    "roster milestones",
    roster.map((step) => step.at),
  );
  const last = line.at(-1)?.at ?? 0;
  if (lineEvery.from <= last)
    add("milestones.json5", "", "lineEvery must start after the last listed line milestone");
  for (const special of lineEvery.special) {
    if (special.at < lineEvery.from || (special.at - lineEvery.from) % lineEvery.step !== 0)
      add("milestones.json5", "", `special milestone ${special.at} is not on lineEvery's steps`);
  }
  return problems;
}

/** Flotsam and the island's clock (02-the-run.md 13.4). */
function checkFlotsam(content: Content): Problem[] {
  const problems: Problem[] = [];
  const add = (file: string, id: string, message: string) => problems.push({ file, id, message });
  const { schedule, firstRun, kinds } = content.flotsam;
  const [shortest, longest] = schedule.gapMinutes;
  if (!(shortest < longest)) add("flotsam.json5", "", "gapMinutes must be [shortest, longest]");
  if (schedule.floatSeconds < 8) add("flotsam.json5", "", "flotsam must float 8 s or more");
  if (!kinds.some((kind) => kind.id === firstRun.kind))
    add("flotsam.json5", "", `unknown first-run kind \`${firstRun.kind}\``);
  let longestBuff = 0;
  for (const kind of kinds) {
    if ("lump" in kind.effect && kind.effect.lump.floorMinutes > kind.effect.lump.rateMinutes)
      add("flotsam.json5", kind.id, "floorMinutes must not pass rateMinutes");
    if ("buff" in kind.effect) longestBuff = Math.max(longestBuff, kind.effect.seconds);
  }
  // Natural spawns never stack two buffs: the shortest rainy gap outlasts the longest buff.
  if (!((shortest * 60) / schedule.rainFactor > longestBuff))
    add("flotsam.json5", "", "the shortest rainy gap must outlast the longest buff");
  const clock = content.islandClock;
  if (clock.id !== content.island)
    add("island.json5", clock.id, `the island must be \`${content.island}\` (lines.json5)`);
  if (clock.utcOffsetMinutes % 60 !== 0)
    add("island.json5", clock.id, "the island's clock is a whole number of hours from UTC");
  const { clear, rain, fog } = clock.weather;
  if (clear + rain + fog !== 100) add("island.json5", clock.id, "weather shares must sum to 100");
  return problems;
}

/** The formula checks (docs/redesign/09-architecture.md 8.3; 02-the-run.md 13.1). */
function checkLines(content: Content): Problem[] {
  const problems: Problem[] = [];
  const add = (id: string, message: string) => problems.push({ file: "lines.json5", id, message });
  const { lines, run } = content;
  const products = new Map(content.resources.map((resource) => [resource.id, resource.kind]));
  const crew = new Set(content.crew.map((member) => member.id));
  const hands = new Set<string>();
  const made = new Set<string>();

  for (const [index, line] of lines.entries()) {
    if (line.rung !== index + 1) add(line.id, `rungs must run 1, 2, 3, ...: found ${line.rung}`);
    if (!crew.has(line.hand)) add(line.id, `unknown hand \`${line.hand}\` (crew.json5)`);
    if (hands.has(line.hand)) add(line.id, `hand \`${line.hand}\` already runs another line`);
    hands.add(line.hand);
    if (products.get(line.product) !== "product")
      add(line.id, `product \`${line.product}\` must be a product in resources.json5`);
    if (made.has(line.product)) add(line.id, `product \`${line.product}\` is already made`);
    made.add(line.product);
    if (!(line.growth > 1 && line.growth <= 1.2)) add(line.id, "growth must be in (1, 1.2]");
    if (!(line.handPrice > line.cost)) add(line.id, "the hand must cost more than a unit");
    const top = line.cost * line.growth ** line.maxOwned;
    if (!(top < 1e200))
      add(line.id, `the ${line.maxOwned}th unit would cost ${top}: keep it under 1e200`);
    const previous = lines[index - 1];
    if (previous) {
      if (TIERS.indexOf(line.era) < TIERS.indexOf(previous.era))
        add(line.id, "a line's era must not come before the previous rung's");
      if (!(line.cost > previous.cost)) add(line.id, "cost must rise with the rung");
      if (!(line.rate > previous.rate)) add(line.id, "output must rise with the rung");
      if (!(line.cost / line.rate > previous.cost / previous.rate))
        add(line.id, "payback (cost ÷ output) must rise with the rung");
    }
  }
  const unused = content.resources.filter(
    (resource) => resource.kind === "product" && !made.has(resource.id),
  );
  for (const resource of unused)
    problems.push({ file: "resources.json5", id: resource.id, message: "no line makes it" });

  // N18: the Night Shift starts at 12 h at least and never passes 48 h.
  const { windowHours, maxHours } = run.nightShift;
  if (windowHours < 12) add("", "the Night Shift must start at 12 h or more (N18)");
  if (maxHours > 48) add("", "the Night Shift must never pass 48 h (N18)");
  if (windowHours > maxHours) add("", "the Night Shift's window is longer than its ceiling");
  for (const [index, stage] of content.stages.entries()) {
    const before = content.stages[index - 1];
    if (stage < 1 || (before !== undefined && stage <= before))
      add("", "stages must be counts of 1 or more, rising");
  }
  return problems;
}
