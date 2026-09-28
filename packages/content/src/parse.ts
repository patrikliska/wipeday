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
    baseRules: { decayProductionPercent: 50, tierLossAfterHours: 72, craftQueueSize: 1 },
    furnaces: [],
    items: [],
    buildings: [],
    perks: [],
    crew: [],
    recipes: [],
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

  const itemIds = new Map(content.items.map((item) => [item.id, item]));
  for (const item of content.items) {
    if (item.category === "storage" && item.capacity === undefined) {
      problems.push({ file: "items.json5", id: item.id, message: "storage items need `capacity`" });
    }
    if (!locale.has(`item.${item.id}.effect`)) {
      problems.push({
        file: "items.json5",
        id: item.id,
        message: `missing locale key \`item.${item.id}.effect\``,
      });
    }
  }
  for (const [index, recipe] of content.recipes.entries()) {
    const label = recipe.item || `#${index + 1}`;
    if (!itemIds.has(recipe.item)) {
      problems.push({ file: "recipes.json5", id: label, message: "not an item in items.json5" });
    }
    checkAmounts("recipes.json5", label, "cost", recipe.cost);
    if (content.recipes.findIndex((other) => other.item === recipe.item) !== index) {
      problems.push({ file: "recipes.json5", id: label, message: "item has two recipes" });
    }
  }
  for (const item of content.items) {
    if (!content.recipes.some((recipe) => recipe.item === item.id)) {
      problems.push({ file: "recipes.json5", id: item.id, message: "item has no recipe" });
    }
  }
  const levelEffects = content.buildings.flatMap((building) =>
    building.levels.map((level) => level.effects),
  );
  for (const level of [1, 2, 3]) {
    if (!levelEffects.some((effects) => effects.workbench === level)) {
      problems.push({
        file: "buildings.json5",
        id: "",
        message: `no building gives workbench level ${level}`,
      });
    }
  }
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
