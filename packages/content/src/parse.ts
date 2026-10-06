/**
 * Validates the parsed data files and checks them against each other and the
 * locale. Browser-safe: the server reads the files from disk (`load.ts`), the
 * web client gets the same objects from its bundler, and both end up here.
 * Collects every problem so one attempt shows the whole list.
 */
import { z } from "zod";
import type { Locale } from "./locale";
import { betOptions, exactRtp } from "./odds";
import {
  type Amounts,
  activeSchema,
  baseRulesSchema,
  type Content,
  craftingSchema,
  crewRulesSchema,
  DATA_FILES,
  type DataFile,
  denSchema,
  type EntityKind,
  FILES,
  mapRulesSchema,
  nodeSchema,
  pacingSchema,
  raidsSchema,
  recipeSchema,
  tripEventRulesSchema,
} from "./schema";
import { TIERS } from "./tiers";

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
  return FILES.flatMap(({ file, field, kind }) =>
    content[field].map((entity) => ({ file, kind, id: entity.id })),
  );
}

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((issue) =>
    issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
  );
}

/** A content object with every list empty, filled in by `parseContent`. */
function emptyContent(): Content {
  return {
    resources: [],
    tools: [],
    baseTiers: [],
    baseRules: { decayProductionPercent: 50, tierLossAfterHours: 72 },
    furnaces: [],
    items: [],
    buildings: [],
    traits: [],
    crew: [],
    crewRules: {
      start: [],
      baseCap: 1,
      arrivalHours: 1,
      levels: [1],
      successPerLevel: 0,
      successPerCompanion: 0,
      treat: {},
      jobs: {
        nodePercent: 1,
        stationPercent: 0,
        guardScore: 0,
        awakeHours: 1,
        sleepHours: 1,
        tiredPercent: 100,
      },
      bonds: { trips: 1, success: 0 },
    },
    regions: [],
    mapRules: {
      range: { twig: 1, wood: 1, stone: 1, metal: 1, hqm: 1 },
      maxParty: 1,
      boatBuilding: "",
      boatTrait: "",
      findPity: 1,
    },
    sites: [],
    tripEvents: [],
    tripEventRules: { most: 1 },
    recipes: [],
    crafting: {
      queueSlots: [1],
      batchSize: [1],
      salvagePercent: 0,
      salvageScrap: { twig: 0, wood: 0, stone: 0, metal: 0, hqm: 0 },
      blueprints: { barrelPercent: 0, perfectRunPercent: 0 },
    },
    nodeKinds: [],
    nodes: [],
    active: {
      node: {
        maxHits: 1,
        hitWindowSeconds: 1,
        graceSeconds: 0,
        perfectBonusHits: 0,
        dailyHaulMinutes: 1,
        afterHaulPercent: 0,
      },
      barrels: { firstAfterMinutes: 0, everyMinutes: 1, expiresMinutes: 1, rolls: 1, loot: [] },
      tasks: { perDay: 1, pool: [] },
    },
    pacing: {
      casual: {
        stone: { earliestDay: 1, latestDay: 1 },
        metal: { earliestDay: 1, latestDay: 1 },
        hqm: { earliestDay: 1, latestDay: 1 },
        buildings: { day: 1, count: 1 },
        firstMade: {},
        stationsWorkedByDay: 1,
        firstTripByDay: 1,
        tierThreeSiteByDay: 1,
        jobsByDay: 1,
        tierFourSiteByDay: 1,
        tierFiveSiteByDay: 1,
        crew: { day: 1, count: 1 },
        tool: { id: "", byDay: 1 },
        scrap: { day: 1, min: 0, max: 0 },
      },
      optimal: {
        hqmNotBeforeDay: 1,
        tierThreeSiteNotBeforeDay: 1,
        lastSite: { id: "", notBeforeDay: 1 },
      },
      tierCostRatio: { min: 1, max: 1 },
    },
    den: {
      open: { tier: "stone" },
      map: { region: "", x: 0, y: 0 },
      market: {
        refPer100: {},
        floorPercent: 50,
        feePercent: 0,
        minFee: 0,
        maxListings: 1,
        listingHours: 1,
      },
      stock: { perDay: 1, markupPercent: 100, blueprintPrice: 1, pool: [] },
      contracts: { perDay: 1, payPercent: 1, pool: [] },
      casino: {
        betStep: 1,
        limits: {},
        bigWin: 2,
        wheel: { roundSeconds: 30, closeSeconds: 0, segments: [] },
        slots: { symbols: [], jackpot: { feedPercent: 0, pays: 0 } },
        dice: { options: [] },
      },
    },
    raids: {
      capPercent: 10,
      scrapCeiling: {},
      minChance: 0,
      maxChance: 100,
      damagedPercent: 100,
      repair: {},
      npc: {
        startTier: "stone",
        firstAfterHours: 0,
        planDays: 1,
        windowStartHour: 0,
        windowHours: 1,
        warnBaseHours: 0,
        lossPercent: 1,
        scrapPerPoint: 1,
        strength: {},
        held: {},
      },
      pvp: {
        minTier: "metal",
        maxTierGap: 0,
        charges: {},
        attack: {},
        shieldHours: 1,
        attackHours: 1,
        sameTargetHours: 1,
        revengeHours: 1,
        revengePercent: 100,
      },
    },
  };
}

/**
 * Validates every file. `raw` holds each file's parsed JSON5 (undefined when it
 * could not be read, which is reported). Throws `ContentError` listing all problems.
 */
export function parseContent(
  raw: Partial<Record<DataFile, unknown>>,
  locale: Locale,
  readProblems: Problem[] = [],
): Content {
  const problems: Problem[] = [...readProblems];
  const content = emptyContent();
  // Every file must arrive: a bundler that forgets one would otherwise run on defaults.
  for (const file of DATA_FILES) {
    if (raw[file] === undefined && !readProblems.some((problem) => problem.file === file)) {
      problems.push({ file, id: "", message: "file is missing" });
    }
  }

  for (const { file, key, field, schema } of FILES) {
    const data = raw[file];
    if (data === undefined) continue;
    // Some files carry more than their entity list: base rules, node placements.
    const extras =
      field === "baseTiers"
        ? { rules: baseRulesSchema }
        : field === "nodeKinds"
          ? { nodes: z.array(nodeSchema) }
          : field === "crew"
            ? { rules: crewRulesSchema }
            : field === "regions"
              ? { rules: mapRulesSchema }
              : field === "tripEvents"
                ? { rules: tripEventRulesSchema }
                : {};
    const parsed = z.strictObject({ [key]: z.array(z.unknown()), ...extras }).safeParse(data);
    if (!parsed.success) {
      problems.push({ file, id: "", message: issuesOf(parsed.error).join("; ") });
      continue;
    }
    if (field === "baseTiers")
      content.baseRules = (parsed.data as { rules: Content["baseRules"] }).rules;
    if (field === "nodeKinds") content.nodes = (parsed.data as { nodes: Content["nodes"] }).nodes;
    if (field === "crew")
      content.crewRules = (parsed.data as { rules: Content["crewRules"] }).rules;
    if (field === "regions")
      content.mapRules = (parsed.data as { rules: Content["mapRules"] }).rules;
    if (field === "tripEvents")
      content.tripEventRules = (parsed.data as { rules: Content["tripEventRules"] }).rules;
    const rows = (parsed.data as Record<string, unknown[]>)[key] ?? [];
    for (const [index, row] of rows.entries()) {
      const result = schema.safeParse(row);
      if (result.success) {
        (content[field] as unknown[]).push(result.data);
        continue;
      }
      const id =
        typeof (row as { id?: unknown })?.id === "string" ? (row as { id: string }).id : "";
      for (const message of issuesOf(result.error)) {
        problems.push({ file, id: id || `#${index + 1}`, message });
      }
    }
  }

  const single = <T>(file: DataFile, schema: z.ZodType<T>, apply: (value: T) => void): void => {
    const data = raw[file];
    if (data === undefined) return;
    const parsed = schema.safeParse(data);
    if (parsed.success) apply(parsed.data);
    else problems.push({ file, id: "", message: issuesOf(parsed.error).join("; ") });
  };
  single("recipes.json5", z.strictObject({ recipes: z.array(recipeSchema) }), (value) => {
    content.recipes = value.recipes;
  });
  single("crafting.json5", craftingSchema, (value) => {
    content.crafting = value;
  });
  single("pacing.json5", pacingSchema, (value) => {
    content.pacing = value;
  });
  single("active.json5", activeSchema, (value) => {
    content.active = value;
  });
  single("den.json5", denSchema, (value) => {
    content.den = value;
  });
  single("raids.json5", raidsSchema, (value) => {
    content.raids = value;
  });

  problems.push(...crossCheck(content, locale));
  if (problems.length > 0) throw new ContentError(problems);
  return content;
}

/** Checks that span entities or files. */
export function crossCheck(content: Content, locale: Locale): Problem[] {
  const problems: Problem[] = [];
  const seen = new Map<string, number>();

  for (const entity of identities(content)) {
    const slot = `${entity.kind}:${entity.id}`;
    seen.set(slot, (seen.get(slot) ?? 0) + 1);
    if (seen.get(slot) === 2) {
      problems.push({ file: entity.file, id: entity.id, message: "id is used more than once" });
    }
    const key = `${entity.kind}.${entity.id}.name`;
    if (!locale.has(key)) {
      problems.push({ file: entity.file, id: entity.id, message: `missing locale key \`${key}\`` });
    }
  }

  const resourceIds = new Set(content.resources.map((resource) => resource.id));
  const checkAmounts = (file: string, id: string, field: string, table: Amounts) => {
    for (const resource of Object.keys(table)) {
      if (!resourceIds.has(resource)) {
        problems.push({ file, id, message: `${field} names unknown resource \`${resource}\`` });
      }
    }
  };
  for (const tool of content.tools) {
    checkAmounts("tools.json5", tool.id, "rates", tool.rates);
    checkAmounts("tools.json5", tool.id, "cost", tool.cost);
  }
  for (const tier of content.baseTiers) {
    checkAmounts("base_tiers.json5", tier.id, "cost", tier.cost);
    checkAmounts("base_tiers.json5", tier.id, "upkeep", tier.upkeep);
  }
  for (const furnace of content.furnaces) {
    if (!resourceIds.has(furnace.fuel)) {
      problems.push({
        file: "furnaces.json5",
        id: furnace.id,
        message: `fuel names unknown resource \`${furnace.fuel}\``,
      });
    }
  }
  for (const resource of content.resources) {
    if (resource.smeltsInto === undefined) continue;
    const target = content.resources.find((candidate) => candidate.id === resource.smeltsInto);
    if (target?.kind !== "refined") {
      problems.push({
        file: "resources.json5",
        id: resource.id,
        message: `smeltsInto \`${resource.smeltsInto}\` is not a refined resource`,
      });
    }
  }

  // Tiers are a fixed list in code (colours, ordering), so the file must match it.
  const found = content.baseTiers.map((tier) => tier.id);
  if (found.join() !== TIERS.join()) {
    problems.push({
      file: "base_tiers.json5",
      id: "",
      message: `must list exactly [${TIERS.join(", ")}] in that order, found [${found.join(", ")}]`,
    });
  }
  const caps = content.baseTiers.map((tier) => tier.storageCap);
  if (caps.some((cap, index) => index > 0 && cap <= (caps[index - 1] ?? 0))) {
    problems.push({
      file: "base_tiers.json5",
      id: "",
      message: "storageCap must increase with every tier",
    });
  }

  for (const item of content.items) {
    if (item.category === "storage" && item.capacity === undefined) {
      problems.push({ file: "items.json5", id: item.id, message: "storage items need `capacity`" });
    }
    const meal = item.category === "meal";
    if (meal !== (item.boostPercent !== undefined && item.hours !== undefined)) {
      problems.push({
        file: "items.json5",
        id: item.id,
        message: meal
          ? "meals need `boostPercent` and `hours`"
          : "only meals have `boostPercent` and `hours`",
      });
    }
    if (!locale.has(`item.${item.id}.effect`)) {
      problems.push({
        file: "items.json5",
        id: item.id,
        message: `missing locale key \`item.${item.id}.effect\``,
      });
    }
  }
  problems.push(...checkRecipes(content));
  for (const building of content.buildings) {
    if (!locale.has(`building.${building.id}.blurb`)) {
      problems.push({
        file: "buildings.json5",
        id: building.id,
        message: `missing locale key \`building.${building.id}.blurb\``,
      });
    }
    for (const [index, level] of building.levels.entries()) {
      const label = `${building.id} level ${index + 1}`;
      checkAmounts("buildings.json5", label, "cost", level.cost);
      checkAmounts("buildings.json5", label, "upkeep", level.upkeep);
      checkAmounts("buildings.json5", label, "rates", level.effects.rates ?? {});
      checkAmounts("buildings.json5", label, "flat", level.effects.flat ?? {});
      const furnace = level.effects.furnace;
      if (furnace !== undefined && furnace > content.furnaces.length) {
        problems.push({
          file: "buildings.json5",
          id: label,
          message: `furnace ${furnace} does not exist (furnaces.json5 lists ${content.furnaces.length})`,
        });
      }
    }
  }

  problems.push(...checkCrewAndMap(content, locale));
  problems.push(...checkDen(content, locale));
  problems.push(...checkRaids(content, locale));

  const kindIds = new Set(content.nodeKinds.map((kind) => kind.id));
  for (const kind of content.nodeKinds) {
    checkAmounts("nodes.json5", kind.id, "yields", kind.yields);
  }
  const nodeIds = new Set<string>();
  for (const node of content.nodes) {
    if (nodeIds.has(node.id)) {
      problems.push({
        file: "nodes.json5",
        id: node.id,
        message: "node id is used more than once",
      });
    }
    nodeIds.add(node.id);
    if (!kindIds.has(node.kind)) {
      problems.push({
        file: "nodes.json5",
        id: node.id,
        message: `unknown node kind \`${node.kind}\``,
      });
    }
  }

  for (const [index, entry] of content.active.barrels.loot.entries()) {
    if (!resourceIds.has(entry.resource)) {
      problems.push({
        file: "active.json5",
        id: entry.resource || `#${index + 1}`,
        message: "loot names an unknown resource",
      });
    }
  }
  const taskIds = new Set<string>();
  for (const task of content.active.tasks.pool) {
    if (taskIds.has(task.id)) {
      problems.push({
        file: "active.json5",
        id: task.id,
        message: "task id is used more than once",
      });
    }
    taskIds.add(task.id);
    checkAmounts("active.json5", task.id, "reward", task.reward);
    if (!locale.has(`task.${task.id}.name`)) {
      problems.push({
        file: "active.json5",
        id: task.id,
        message: `missing locale key \`task.${task.id}.name\``,
      });
    }
  }
  return problems;
}

/**
 * The crafting web: every recipe makes a part or an item at a real station level, every
 * part and item has a recipe and is reachable from what the island gives (gathering,
 * smelting, barrels, tasks), every part is used by something, and no part hides behind a
 * blueprint (blueprints are for extras, never the road to tiers and tools).
 */
export function checkRecipes(content: Content): Problem[] {
  const problems: Problem[] = [];
  const file = "recipes.json5";
  const resources = new Map(content.resources.map((resource) => [resource.id, resource]));
  const items = new Set(content.items.map((item) => item.id));
  const buildings = new Map(content.buildings.map((building) => [building.id, building]));
  const seen = new Set<string>();
  const stationLevels = Math.max(0, ...content.recipes.map((recipe) => recipe.level));

  for (const recipe of content.recipes) {
    const label = recipe.output;
    if (seen.has(label)) problems.push({ file, id: label, message: "has two recipes" });
    seen.add(label);
    const resource = resources.get(label);
    if (resource && resource.kind !== "part") {
      problems.push({ file, id: label, message: `makes a ${resource.kind} resource, not a part` });
    } else if (!resource && !items.has(label)) {
      problems.push({ file, id: label, message: "makes neither a part nor an item" });
    }
    const station = buildings.get(recipe.station);
    if (!station) {
      problems.push({
        file,
        id: label,
        message: `station \`${recipe.station}\` is not a building`,
      });
    } else if (recipe.level > station.levels.length) {
      problems.push({ file, id: label, message: `${recipe.station} has no level ${recipe.level}` });
    }
    for (const id of Object.keys(recipe.cost)) {
      if (!resources.has(id)) {
        problems.push({ file, id: label, message: `cost names unknown resource \`${id}\`` });
      }
    }
    if (recipe.blueprint && resource) {
      problems.push({ file, id: label, message: "a part cannot need a blueprint" });
    }
  }
  for (const resource of content.resources) {
    if (resource.kind === "part" && !seen.has(resource.id)) {
      problems.push({ file, id: resource.id, message: "part has no recipe" });
    }
  }
  for (const item of content.items) {
    // Keycodes are only ever found (sites.json5 `finds`), never made.
    if (item.category === "keycode") continue;
    if (!seen.has(item.id)) problems.push({ file, id: item.id, message: "item has no recipe" });
  }
  for (const rule of ["queueSlots", "batchSize"] as const) {
    if (content.crafting[rule].length < stationLevels) {
      problems.push({
        file: "crafting.json5",
        id: "",
        message: `${rule} needs a value for every station level up to ${stationLevels}`,
      });
    }
  }

  // Everything a part can be used for.
  const uses = new Set<string>();
  const use = (table: Amounts) => {
    for (const id of Object.keys(table)) uses.add(id);
  };
  for (const recipe of content.recipes) use(recipe.cost);
  for (const tool of content.tools) use(tool.cost);
  for (const tier of content.baseTiers) {
    use(tier.cost);
    use(tier.upkeep);
  }
  for (const building of content.buildings) {
    for (const level of building.levels) {
      use(level.cost);
      use(level.upkeep);
    }
  }
  for (const furnace of content.furnaces) uses.add(furnace.fuel);
  for (const resource of content.resources) {
    if (resource.kind === "part" && !uses.has(resource.id)) {
      problems.push({ file, id: resource.id, message: "part is made but nothing uses it" });
    }
  }

  // Reachable from what the island gives, following smelting and recipes to a fixed point.
  const have = new Set<string>();
  const give = (table: Amounts) => {
    for (const id of Object.keys(table)) have.add(id);
  };
  for (const tool of content.tools) give(tool.rates);
  for (const building of content.buildings) {
    for (const level of building.levels) give(level.effects.flat ?? {});
  }
  for (const entry of content.active.barrels.loot) have.add(entry.resource);
  for (const task of content.active.tasks.pool) give(task.reward);
  for (const resource of content.resources) {
    if (resource.smeltsInto && have.has(resource.id)) have.add(resource.smeltsInto);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const recipe of content.recipes) {
      if (have.has(recipe.output)) continue;
      if (Object.keys(recipe.cost).every((id) => have.has(id))) {
        have.add(recipe.output);
        grew = true;
      }
    }
  }
  for (const recipe of content.recipes) {
    if (!have.has(recipe.output)) {
      const missing = Object.keys(recipe.cost).filter((id) => !have.has(id));
      problems.push({
        file,
        id: recipe.output,
        message: `cannot be made: nothing on the island gives ${missing.join(", ")}`,
      });
    }
  }

  for (const id of Object.keys(content.pacing.casual.firstMade)) {
    if (!seen.has(id)) {
      problems.push({ file: "pacing.json5", id, message: "firstMade names no recipe output" });
    }
  }
  return problems;
}

/**
 * Survivors and the island: traits and treatment items exist, the start crew is in the pool,
 * every region is reachable from the one at ring 0 through two-way neighbours, every site
 * sits in a region with loot that names real resources, and the locale has every blurb and
 * report line the map and the report cards show.
 */
export function checkCrewAndMap(content: Content, locale: Locale): Problem[] {
  const problems: Problem[] = [];
  const traits = new Set(content.traits.map((trait) => trait.id));
  const crew = new Set(content.crew.map((member) => member.id));
  const items = new Set(content.items.map((item) => item.id));
  const resources = new Set(content.resources.map((resource) => resource.id));
  for (const member of content.crew) {
    for (const trait of member.traits) {
      if (!traits.has(trait)) {
        problems.push({ file: "crew.json5", id: member.id, message: `unknown trait \`${trait}\`` });
      }
    }
  }
  for (const id of content.crewRules.start) {
    if (!crew.has(id)) {
      problems.push({ file: "crew.json5", id, message: "start names no survivor in `crew`" });
    }
  }
  for (const id of Object.keys(content.crewRules.treat)) {
    if (!items.has(id)) problems.push({ file: "crew.json5", id, message: "treat names no item" });
  }
  const buildings = new Set(content.buildings.map((building) => building.id));
  for (const trait of content.traits) {
    for (const station of Object.keys(trait.craft ?? {})) {
      if (station !== "any" && !buildings.has(station)) {
        problems.push({
          file: "traits.json5",
          id: trait.id,
          message: `craft names unknown station \`${station}\``,
        });
      }
    }
    if (!locale.has(`trait.${trait.id}.effect`)) {
      problems.push({
        file: "traits.json5",
        id: trait.id,
        message: `missing locale key \`trait.${trait.id}.effect\``,
      });
    }
  }

  const { boatBuilding, boatTrait } = content.mapRules;
  if (content.regions.some((region) => region.access === "sea")) {
    if (!buildings.has(boatBuilding)) {
      problems.push({
        file: "regions.json5",
        id: "",
        message: `boatBuilding names unknown building \`${boatBuilding}\``,
      });
    }
    if (!traits.has(boatTrait)) {
      problems.push({
        file: "regions.json5",
        id: "",
        message: `boatTrait names unknown trait \`${boatTrait}\``,
      });
    }
  }
  const regions = new Map(content.regions.map((region) => [region.id, region]));
  const homes = content.regions.filter((region) => region.ring === 0);
  if (content.regions.length > 0 && homes.length !== 1) {
    problems.push({
      file: "regions.json5",
      id: "",
      message: `exactly one region must be ring 0, found ${homes.length}`,
    });
  }
  for (const region of content.regions) {
    for (const other of region.neighbours) {
      const neighbour = regions.get(other);
      if (!neighbour) {
        problems.push({
          file: "regions.json5",
          id: region.id,
          message: `unknown neighbour \`${other}\``,
        });
      } else if (!neighbour.neighbours.includes(region.id)) {
        problems.push({
          file: "regions.json5",
          id: region.id,
          message: `\`${other}\` does not list it back as a neighbour`,
        });
      }
    }
    for (const id of Object.keys(region.scout.cost)) {
      if (!resources.has(id)) {
        problems.push({
          file: "regions.json5",
          id: region.id,
          message: `scout cost names unknown resource \`${id}\``,
        });
      }
    }
    // A boat leaves from the shore: every sea region touches a shore or another sea region.
    if (
      region.access === "sea" &&
      !region.neighbours.some((other) => {
        const neighbour = regions.get(other);
        return neighbour?.terrain === "shore" || neighbour?.access === "sea";
      })
    ) {
      problems.push({
        file: "regions.json5",
        id: region.id,
        message: "a sea region must border a shore or another sea region",
      });
    }
    if (!locale.has(`region.${region.id}.blurb`)) {
      problems.push({
        file: "regions.json5",
        id: region.id,
        message: `missing locale key \`region.${region.id}.blurb\``,
      });
    }
  }
  const home = homes[0];
  if (home) {
    const seen = new Set([home.id]);
    const queue = [home.id];
    while (queue.length > 0) {
      const next = regions.get(queue.shift() ?? "");
      for (const other of next?.neighbours ?? []) {
        if (!seen.has(other) && regions.has(other)) {
          seen.add(other);
          queue.push(other);
        }
      }
    }
    for (const region of content.regions) {
      if (!seen.has(region.id)) {
        problems.push({
          file: "regions.json5",
          id: region.id,
          message: "cannot be reached from ring 0",
        });
      }
    }
  }

  for (const site of content.sites) {
    const file = "sites.json5";
    if (!regions.has(site.region)) {
      problems.push({ file, id: site.id, message: `unknown region \`${site.region}\`` });
    }
    for (const entry of site.loot) {
      if (!resources.has(entry.resource)) {
        problems.push({
          file,
          id: site.id,
          message: `loot names unknown resource \`${entry.resource}\``,
        });
      }
    }
    for (const id of Object.keys(site.rations)) {
      if (!resources.has(id)) {
        problems.push({ file, id: site.id, message: `rations name unknown resource \`${id}\`` });
      }
    }
    const keycodes = [site.keycode, ...(site.finds ?? []).map((find) => find.item)];
    for (const id of keycodes) {
      if (id !== undefined && !items.has(id)) {
        problems.push({ file, id: site.id, message: `names unknown item \`${id}\`` });
      }
    }
    // A keycode must drop somewhere, or the site behind it can never be reached.
    if (
      site.keycode &&
      !content.sites.some((other) => other.finds?.some((find) => find.item === site.keycode))
    ) {
      problems.push({
        file,
        id: site.id,
        message: `no site finds its keycode \`${site.keycode}\``,
      });
    }
    for (const key of [
      `site.${site.id}.blurb`,
      `story.${site.id}.success`,
      `story.${site.id}.partial`,
      `story.${site.id}.fail`,
    ]) {
      if (!locale.has(key))
        problems.push({ file, id: site.id, message: `missing locale key \`${key}\`` });
    }
  }

  for (const event of content.tripEvents) {
    for (const id of Object.keys(event.traits ?? {})) {
      if (!traits.has(id)) {
        problems.push({
          file: "events.json5",
          id: event.id,
          message: `unknown trait \`${id}\``,
        });
      }
    }
    if (!locale.has(`trip_event.${event.id}.line`)) {
      problems.push({
        file: "events.json5",
        id: event.id,
        message: `missing locale key \`trip_event.${event.id}.line\``,
      });
    }
  }
  return problems;
}

/** Every bet option returns between these (a 5-10% edge for the Den, CLAUDE.md section 8). */
export const RTP_RANGE = { min: 0.9, max: 0.95 } as const;

/**
 * The Den (W5): every tradeable good has a price, the stock and the contracts name real
 * goods, nothing can be bought from the Den and delivered back at a profit, every bet
 * option keeps the Den's edge between 5 and 10% and pays whole scrap, and the locale has a
 * name for every contract, wheel segment, slot symbol and dice option.
 */
export function checkDen(content: Content, locale: Locale): Problem[] {
  const problems: Problem[] = [];
  const file = "den.json5";
  const { den } = content;
  const goods = new Set([
    ...content.resources.filter((resource) => resource.kind !== "currency").map((r) => r.id),
    ...content.items.map((item) => item.id),
  ]);
  const add = (id: string, message: string) => problems.push({ file, id, message });
  if (content.resources.length === 0) return problems;

  if (!content.regions.some((region) => region.id === den.map.region))
    add("map", `unknown region \`${den.map.region}\``);
  for (const good of goods) {
    if (den.market.refPer100[good] === undefined) add(good, "tradeable good has no refPer100");
  }
  for (const good of Object.keys(den.market.refPer100)) {
    if (!goods.has(good)) add(good, "refPer100 names no tradeable resource or item");
  }
  for (const offer of den.stock.pool) {
    if (offer.good !== "blueprint" && !goods.has(offer.good))
      add(offer.id, `stock names unknown good \`${offer.good}\``);
  }
  // Contracts pay below what the Den sells for: buy-and-deliver can never make scrap.
  if (den.contracts.payPercent >= den.stock.markupPercent) {
    add("contracts", "payPercent must be below the stock's markupPercent (no arbitrage)");
  }
  for (const contract of den.contracts.pool) {
    if (!goods.has(contract.good))
      add(contract.id, `contract names unknown good \`${contract.good}\``);
    if (Object.keys(contract.amount).length === 0) add(contract.id, "wants nothing at any tier");
    if (!locale.has(`contract.${contract.id}.line`))
      add(contract.id, `missing locale key \`contract.${contract.id}.line\``);
  }

  const { casino } = den;
  const openAt = TIERS.indexOf(den.open.tier);
  for (const tier of TIERS.slice(openAt)) {
    const limit = casino.limits[tier];
    if (!limit) {
      add(tier, "casino needs limits for every tier the Den is open at");
      continue;
    }
    if (limit.maxBet % casino.betStep !== 0) add(tier, "maxBet must be a whole number of chips");
    if (limit.maxBet > limit.dailyWager) add(tier, "maxBet is above the daily wager cap");
  }
  if (casino.wheel.closeSeconds >= casino.wheel.roundSeconds)
    add("wheel", "closeSeconds must be shorter than roundSeconds");
  const allPays = [
    ...casino.wheel.segments.map((segment) => [segment.id, segment.pays] as const),
    ...casino.slots.symbols.flatMap((symbol) => [
      [symbol.id, symbol.three ?? 0] as const,
      [symbol.id, symbol.two ?? 0] as const,
    ]),
    ...casino.dice.options.map((option) => [option.id, option.pays] as const),
    ["jackpot", casino.slots.jackpot.pays] as const,
  ];
  for (const [id, pay] of allPays) {
    if ((casino.betStep * pay) % 100 !== 0)
      add(id, `pays ${pay}% of a ${casino.betStep}-scrap chip is not whole scrap`);
  }
  const jackpots = casino.slots.symbols.filter((symbol) => symbol.jackpot);
  if (jackpots.length !== 1) add("slots", "exactly one symbol must be the jackpot");
  for (const { game, option } of betOptions(casino)) {
    const rtp = exactRtp(casino, game, option);
    if (rtp < RTP_RANGE.min || rtp > RTP_RANGE.max) {
      add(
        option ?? game,
        `${game} returns ${(rtp * 100).toFixed(1)}%, outside ${RTP_RANGE.min * 100}-${RTP_RANGE.max * 100}%`,
      );
    }
  }
  const named = [
    ...casino.wheel.segments.map((segment) => `casino.segment.${segment.id}`),
    ...casino.slots.symbols.map((symbol) => `casino.symbol.${symbol.id}`),
    ...casino.dice.options.map((option) => `casino.dice.${option.id}`),
  ];
  for (const key of named) {
    if (!locale.has(key)) add("casino", `missing locale key \`${key}\``);
  }
  return problems;
}

/**
 * Raids (W6): every tier raiders or PvP reach has its numbers, the losses stay inside the cap,
 * the landing window fits in a day, every resource named exists, every camp has charges in
 * its rations (a camp is where charges go) and the report lines are in the locale.
 */
export function checkRaids(content: Content, locale: Locale): Problem[] {
  const problems: Problem[] = [];
  const file = "raids.json5";
  const { raids } = content;
  const add = (id: string, message: string) => problems.push({ file, id, message });
  if (content.resources.length === 0) return problems;
  const resources = new Set(content.resources.map((resource) => resource.id));
  const from = (tier: (typeof TIERS)[number]) => TIERS.slice(TIERS.indexOf(tier));

  if (raids.minChance >= raids.maxChance) add("", "minChance must be below maxChance");
  if (raids.npc.lossPercent > raids.capPercent) add("npc", "lossPercent is above capPercent");
  if (raids.npc.windowStartHour + raids.npc.windowHours > 24)
    add("npc", "the landing window must end by midnight");
  for (const tier of from(raids.npc.startTier)) {
    if (raids.scrapCeiling[tier] === undefined) add(tier, "needs a scrapCeiling");
    if (!raids.repair[tier]) add(tier, "needs a repair cost");
    const strength = raids.npc.strength[tier];
    if (!strength) add(tier, "npc needs a strength");
    else if (strength.max < strength.base) add(tier, "npc strength max is below its base");
    if (!raids.npc.held[tier]) add(tier, "npc needs held loot");
  }
  for (const tier of from(raids.pvp.minTier)) {
    if (raids.pvp.charges[tier] === undefined) add(tier, "pvp needs a charge cost");
    if (raids.pvp.attack[tier] === undefined) add(tier, "pvp needs an attack");
    if (raids.scrapCeiling[tier] === undefined) add(tier, "needs a scrapCeiling");
    if (!raids.repair[tier]) add(tier, "needs a repair cost");
  }
  const named = [
    ...Object.values(raids.repair).flatMap((cost) => Object.keys(cost ?? {})),
    ...Object.values(raids.npc.held).flatMap((lines) => (lines ?? []).map((line) => line.resource)),
  ];
  for (const id of named) {
    if (!resources.has(id)) add(id, "names an unknown resource");
  }
  if (!resources.has("charge")) add("charge", "raids need a `charge` resource");

  for (const site of content.sites.filter((candidate) => candidate.camp)) {
    if ((site.rations.charge ?? 0) < 1)
      problems.push({ file: "sites.json5", id: site.id, message: "a camp's rations need charges" });
  }
  for (const key of ["raid.npc.held", "raid.npc.breached", "raid.pvp.held", "raid.pvp.breached"]) {
    if (!locale.has(key)) add("", `missing locale key \`${key}\``);
  }
  return problems;
}
