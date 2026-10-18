/**
 * Validates the parsed data files and checks them against each other and the locale.
 * Browser-safe: the server reads the files from disk (`load.ts`), the web client gets the same
 * objects from its bundler, and both end up here. Collects every problem so one attempt shows
 * the whole list.
 */
import type { z } from "zod";
import { deriveLines } from "./lines";
import type { Locale } from "./locale";
import { deriveResearch, isScored, levelEffect, levelsCost, tierEra } from "./research";
import {
  achievementsFileSchema,
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
  researchFileSchema,
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
    ...content.research.map((def) => ({
      file: "research.json5",
      kind: "research" as const,
      id: def.id,
    })),
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
  const research = whole("research.json5", researchFileSchema);
  const milestones = whole("milestones.json5", milestonesFileSchema);
  const flotsam = whole("flotsam.json5", flotsamFileSchema);
  const islandClock = whole("island.json5", islandFileSchema);
  const pacing = whole("pacing.json5", pacingSchema);
  const achievements = whole("achievements.json5", achievementsFileSchema);

  if (
    problems.length > 0 ||
    !linesFile ||
    !prestige ||
    !targets ||
    !upgrades ||
    !research ||
    !milestones ||
    !flotsam ||
    !islandClock ||
    !pacing ||
    !achievements
  ) {
    throw new ContentError(problems);
  }

  const lines = deriveLines(linesFile.formula, linesFile.lines);
  const buffs: Content["buffs"] = {};
  for (const kind of flotsam.kinds) {
    if ("buff" in kind.effect) buffs[kind.effect.buff] = kind.effect.effects;
  }
  // Frenzy's buff: taps ×mult, lines ×mult as a visible speed-up and the rest as output.
  const frenzy = targets.tap.frenzy;
  buffs.frenzy = [
    { stat: "tap", op: "more", value: frenzy.mult },
    { stat: "speed", op: "more", value: frenzy.speed },
    { stat: "output", op: "more", value: frenzy.mult / frenzy.speed },
  ];
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
    upgrades: deriveUpgrades(tools, upgrades),
    research: deriveResearch(lines, research),
    workshop: { opensAfterSeconds: research.opensAfterSeconds },
    milestones,
    flotsam,
    islandClock,
    pacing,
    achievements,
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
  // A shelf row's or a Workshop item's id names nothing else (its locale key stays unambiguous).
  for (const { file, kind, id } of all) {
    if (kind !== "upgrade" && kind !== "research") continue;
    if (all.some((other) => other.kind !== kind && other.id === id))
      add(file, id, `this ${kind} id must not be used by any other entity`);
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
  problems.push(...checkResearch(content, locale));
  problems.push(...checkFlotsam(content));
  problems.push(...checkAchievements(content, locale));

  // The tap (N10, N9).
  const { tap } = content;
  if (tap.bucket.burst < tap.bucket.perSecond)
    add("targets.json5", "", "the bucket's burst must be at least a second's taps");
  if (tap.hustle.peak > tap.hustle.peakCeiling)
    add("targets.json5", "", "Hustle's peak must not pass its ceiling");
  if (tap.hustle.peakCeiling * tap.frenzy.mult > tap.frenzy.multCeiling)
    add("targets.json5", "frenzy", "Hustle's ceiling × Frenzy must stay within multCeiling");
  if (tap.frenzy.speed > tap.frenzy.mult)
    add("targets.json5", "frenzy", "Frenzy's speed-up must not exceed its multiplier");
  const c = tapCoefficient(content);
  if (c > TAP_COEFFICIENT_MAX)
    add("", "", `the tap's steady coefficient c is ${c.toFixed(3)}, above ${TAP_COEFFICIENT_MAX}`);

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
  // Crows: never two under 120 s apart, and one slot's crossing ends before the next can start.
  const gulls = content.flotsam.gulls;
  if (gulls.every - gulls.jitter < 120)
    add("flotsam.json5", "gulls", "crows must never cross under 120 s apart (every − jitter)");
  if (
    gulls.jitter + Math.max(gulls.crossSeconds, gulls.eliteCrossSeconds) + gulls.graceSeconds >=
    gulls.every
  )
    add("flotsam.json5", "gulls", "a crow's crossing must end before the next slot opens");
  if (gulls.eliteCrossSeconds > gulls.crossSeconds)
    add("flotsam.json5", "gulls", "a Magpie flies faster than a crow");
  if (gulls.eliteSeconds < gulls.seconds)
    add("flotsam.json5", "gulls", "a Magpie pays more than a crow");
  const clock = content.islandClock;
  if (clock.id !== content.island)
    add("island.json5", clock.id, `the island must be \`${content.island}\` (lines.json5)`);
  if (clock.utcOffsetMinutes % 60 !== 0)
    add("island.json5", clock.id, "the island's clock is a whole number of hours from UTC");
  const { clear, rain, fog } = clock.weather;
  if (clear + rain + fog !== 100) add("island.json5", clock.id, "weather shares must sum to 100");
  return problems;
}

/** The badges (D198, D239): ids, names, and conditions that name real things. */
function checkAchievements(content: Content, locale: Locale): Problem[] {
  const problems: Problem[] = [];
  const add = (id: string, message: string) =>
    problems.push({ file: "achievements.json5", id, message });
  const seen = new Set<string>();
  const chapters = new Set<string>();
  for (const badge of content.achievements.badges) {
    if (seen.has(badge.id)) add(badge.id, "id is used more than once");
    seen.add(badge.id);
    chapters.add(badge.chapter);
    for (const key of [`badge.${badge.id}.name`, `badge.${badge.id}.how`])
      if (!locale.has(key)) add(badge.id, `missing locale key \`${key}\``);
    const when = badge.when;
    if (when.kind === "state") {
      const exact = when.state === "supplies_digits";
      if (exact ? when.eq === undefined || when.gte !== undefined : when.gte === undefined)
        add(badge.id, exact ? "`supplies_digits` takes `eq`" : `\`${when.state}\` takes \`gte\``);
      if (
        when.era !== undefined &&
        when.state !== "lines_min_owned" &&
        when.state !== "hands_working"
      )
        add(badge.id, `\`${when.state}\` takes no \`era\``);
    } else if (when.kind === "buffs") {
      for (const kind of when.buffs)
        if (!(kind in content.buffs)) add(badge.id, `unknown buff \`${kind}\``);
    } else if (when.kind === "event") {
      const known: Record<string, readonly string[]> = {
        kind: content.flotsam.kinds.map((kind) => kind.id),
        era: content.eras.map((era) => era.id),
        target: content.targets.map((target) => target.id),
        item: content.research.map((item) => item.id),
      };
      for (const [field, value] of Object.entries(when.filters)) {
        const ids = known[field];
        if (ids && !ids.includes(String(value)))
          add(badge.id, `unknown ${field} \`${String(value)}\``);
      }
    }
  }
  for (const chapter of chapters)
    if (!locale.has(`logbook.chapter.${chapter}`))
      add("", `missing locale key \`logbook.chapter.${chapter}\``);
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

  // N18: the Night Shift starts at 2 h at least and never passes 24 h (D183).
  const { windowHours, maxHours } = run.nightShift;
  if (windowHours < 2) add("", "the Night Shift must start at 2 h or more (N18)");
  if (maxHours > 24) add("", "the Night Shift must never pass 24 h (N18)");
  if (windowHours > maxHours) add("", "the Night Shift's window is longer than its ceiling");
  for (const [index, stage] of content.stages.entries()) {
    const before = content.stages[index - 1];
    if (stage < 1 || (before !== undefined && stage <= before))
      add("", "stages must be counts of 1 or more, rising");
  }
  return problems;
}

/** The tap's steady coefficient may not pass this (game-design 5.2; 02-the-run.md 7.5). */
export const TAP_COEFFICIENT_MAX = 0.6;

/**
 * The tap's steady coefficient `c = taps/s × p × T × Hustle × crit` (game-design 5.2) at 6 taps a
 * second, with every shipped source at its top (Grip and the whole Workshop; the Blast Map's tap
 * nodes join in R4), and fells as their gain over the base fell: what a tap takes of the full
 * rate stays a share of it, never the game.
 */
export function tapCoefficient(content: Content): number {
  const top = content.research.map((def) => levelEffect(def.effect, def.levels));
  const grip = content.tools.flatMap((tool) => tool.effects);
  const sum = (stat: string, op: string, effects = top) =>
    effects.filter((e) => e.stat === stat && e.op === op).reduce((a, e) => a + e.value, 0);
  const product = (stat: string, op: string) =>
    top.filter((e) => e.stat === stat && e.op === op).reduce((a, e) => a * e.value, 1);
  const p = content.tap.share + sum("tap_share", "add", grip) + sum("tap_share", "add");
  const t = (1 + sum("tap", "inc")) * product("tap", "more");
  const crit = 1 + sum("crit_chance", "add") * sum("crit_mult", "add");
  const fellTaps = Math.min(...content.targets.map((target) => target.fellTaps));
  const fell = (bonus: number) => 1 + bonus / fellTaps;
  const fells =
    fell(content.tap.fellBonusTaps + sum("fell_bonus", "add")) / fell(content.tap.fellBonusTaps);
  return 6 * p * t * content.tap.hustle.peakCeiling * crit * fells;
}

/** The Workshop's tier items may cost at most this in all (12-feel.md 5): bought beside lines. */
export const RESEARCH_TREE_MAX = 1e18;

/** The Workshop (game-design 5.12; D185, D194, D195). */
function checkResearch(content: Content, locale: Locale): Problem[] {
  const problems: Problem[] = [];
  const add = (id: string, message: string) =>
    problems.push({ file: "research.json5", id, message });
  const lines = new Set(content.lines.map((line) => line.id));
  const eras = new Set<string>(TIERS);
  let tree = 0;
  let hours = 0;
  for (const def of content.research) {
    const { effect } = def;
    if (!isScored(effect))
      add(def.id, `the crown cannot score \`${effect.stat} ${effect.op}\` (research.ts SCORED)`);
    const scoped = effect.stat === "output" || effect.stat === "speed";
    const known =
      effect.scope === "all" ||
      (effect.scope !== undefined && (lines.has(effect.scope) || eras.has(effect.scope)));
    if (scoped && !known)
      add(def.id, `\`${effect.stat}\` needs a scope: a line, an era or \`all\``);
    if (!scoped && effect.scope !== undefined) add(def.id, `\`${effect.stat}\` takes no scope`);
    // A cost cut, when one ships, stops at ×0.6 at its top level (12-feel.md 5).
    if (effect.stat.endsWith("_cost") && levelEffect(effect, def.levels).value < 0.6)
      add(def.id, "a cost cut must stop at ×0.6");
    if (effect.stat === "night_shift") hours += levelEffect(effect, def.levels).value;
    if (def.kind === "tier") {
      if (def.era !== tierEra(def.tier))
        add(def.id, `tier ${def.tier} opens with the ${tierEra(def.tier)} era, not ${def.era}`);
      tree += levelsCost(def, 0, def.levels);
      continue;
    }
    for (const [i, cost] of def.costs.entries()) {
      const before = def.costs[i - 1];
      if (before !== undefined && !(cost > before)) add(def.id, "each Mk level must cost more");
      if (!(cost < MAX_REACHABLE_COST)) add(def.id, "its price must stay under 1e200");
    }
    for (const [i, need] of def.needOwned.entries()) {
      const before = def.needOwned[i - 1];
      if (before !== undefined && !(need > before))
        add(def.id, "each Mk level must need more units");
    }
    for (const level of MK_LEVELS.slice(0, def.levels)) {
      const key = `research.${def.id}.${level}`;
      if (!locale.has(key)) add(def.id, `missing locale key \`${key}\``);
    }
    if (def.levels > MK_LEVELS.length)
      add(def.id, `a Line Mk has at most ${MK_LEVELS.length} levels`);
  }
  if (!(tree < RESEARCH_TREE_MAX))
    add("", `the tier items cost ${tree.toExponential(2)} in all: keep the tree under 1e18`);
  // N18 with the Workshop: its hours fit under the ceiling and add at most 2 h a run (D195).
  const { windowHours, maxHours } = content.run.nightShift;
  if (hours > 2 + 1e-9) add("", "the Workshop may add at most 2 h to the Night Shift (D195)");
  if (windowHours + hours > maxHours + 1e-9)
    add("", "the Night Shift with the Workshop's hours passes its ceiling (N18)");
  return problems;
}

/** A Line Mk's levels by name (`research.{line}_mk.mk2`, ...). */
export const MK_LEVELS = ["mk2", "mk3", "mk4", "mk5", "mk6"] as const;
