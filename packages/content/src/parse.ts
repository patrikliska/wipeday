/**
 * Validates the parsed data files and checks them against each other and the
 * locale. Browser-safe: the server reads the files from disk (`load.ts`), the
 * web client gets the same objects from its bundler, and both end up here.
 * Collects every problem so one attempt shows the whole list.
 */
import { z } from "zod";
import type { Locale } from "./locale";
import {
  type Amounts,
  activeSchema,
  baseRulesSchema,
  type Content,
  craftingSchema,
  type DataFile,
  type EntityKind,
  FILES,
  nodeSchema,
  pacingSchema,
  recipeSchema,
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
    perks: [],
    crew: [],
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
      },
      optimal: { hqmNotBeforeDay: 1 },
      tierCostRatio: { min: 1, max: 1 },
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

  for (const { file, key, field, schema } of FILES) {
    const data = raw[file];
    if (data === undefined) continue;
    // Some files carry more than their entity list: base rules, node placements.
    const extras =
      field === "baseTiers"
        ? { rules: baseRulesSchema }
        : field === "nodeKinds"
          ? { nodes: z.array(nodeSchema) }
          : {};
    const parsed = z.strictObject({ [key]: z.array(z.unknown()), ...extras }).safeParse(data);
    if (!parsed.success) {
      problems.push({ file, id: "", message: issuesOf(parsed.error).join("; ") });
      continue;
    }
    if (field === "baseTiers")
      content.baseRules = (parsed.data as { rules: Content["baseRules"] }).rules;
    if (field === "nodeKinds") content.nodes = (parsed.data as { nodes: Content["nodes"] }).nodes;
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

  const perkIds = new Set(content.perks.map((perk) => perk.id));
  for (const member of content.crew) {
    if (!perkIds.has(member.perk)) {
      problems.push({
        file: "crew.json5",
        id: member.id,
        message: `unknown perk \`${member.perk}\``,
      });
    }
  }

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
