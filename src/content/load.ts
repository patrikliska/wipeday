/**
 * Loads and validates `data/*.json5`. Collects every problem so one startup
 * attempt shows the whole list instead of making the owner fix them one run
 * at a time. Also what `/idle-admin reload-data` will call.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import JSON5 from "json5";
import { z } from "zod";
import type { Locale } from "../ui/locale";
import { TIERS } from "../ui/theme";
import {
  type Amounts,
  baseRulesSchema,
  type Content,
  type EntityKind,
  FILES,
  pacingSchema,
  recipeSchema,
} from "./schema";

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

/** The identity every entity shares, with where it came from. */
export interface Identity {
  file: string;
  kind: EntityKind;
  id: string;
  rustRef: string;
  fallbackEmoji: string;
  phase: number;
}

/** Every entity in file order. */
export function identities(content: Content): Identity[] {
  return FILES.flatMap(({ file, field, kind }) =>
    content[field].map((entity) => ({
      file,
      kind,
      id: entity.id,
      rustRef: entity.rustRef,
      fallbackEmoji: entity.fallbackEmoji,
      phase: entity.phase,
    })),
  );
}

function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((issue) =>
    issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
  );
}

/** Reads and validates everything. Throws `ContentError` listing all problems. */
export function loadContent(dataDir: string, locale: Locale): Content {
  const problems: Problem[] = [];
  const content: Content = {
    resources: [],
    tools: [],
    baseTiers: [],
    baseRules: { decayProductionPercent: 50, tierLossAfterHours: 72 },
    furnaces: [],
    items: [],
    monuments: [],
    perks: [],
    recipes: [],
    pacing: {
      casual: {
        stone: { earliestDay: 1, latestDay: 1 },
        metal: { earliestDay: 1, latestDay: 1 },
        hqm: { earliestDay: 1, latestDay: 1 },
      },
      optimal: { hqmNotBeforeDay: 1 },
      tierCostRatio: { min: 1, max: 1 },
    },
  };

  const read = (file: string): unknown => {
    try {
      return JSON5.parse(readFileSync(join(dataDir, file), "utf8"));
    } catch (error) {
      problems.push({ file, id: "", message: `cannot be read: ${(error as Error).message}` });
      return undefined;
    }
  };

  for (const { file, field, schema } of FILES) {
    const raw = read(file);
    if (raw === undefined) continue;
    // base_tiers.json5 also carries the upkeep rules next to its entity array.
    const extras = field === "baseTiers" ? { rules: baseRulesSchema } : {};
    const parsed = z.strictObject({ [field]: z.array(z.unknown()), ...extras }).safeParse(raw);
    if (!parsed.success) {
      problems.push({ file, id: "", message: issuesOf(parsed.error).join("; ") });
      continue;
    }
    if (field === "baseTiers") {
      content.baseRules = (parsed.data as { rules: Content["baseRules"] }).rules;
    }
    const rows = (parsed.data as Record<string, unknown[]>)[field] ?? [];
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

  const recipesRaw = read("recipes.json5");
  if (recipesRaw !== undefined) {
    const parsed = z.strictObject({ recipes: z.array(recipeSchema) }).safeParse(recipesRaw);
    if (parsed.success) content.recipes = parsed.data.recipes;
    else {
      problems.push({ file: "recipes.json5", id: "", message: issuesOf(parsed.error).join("; ") });
    }
  }
  const pacingRaw = read("pacing.json5");
  if (pacingRaw !== undefined) {
    const parsed = pacingSchema.safeParse(pacingRaw);
    if (parsed.success) content.pacing = parsed.data;
    else {
      problems.push({ file: "pacing.json5", id: "", message: issuesOf(parsed.error).join("; ") });
    }
  }

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
    checkAmounts("furnaces.json5", furnace.id, "cost", furnace.cost);
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
    if (item.category === "workbench" && item.workbenchLevel === undefined) {
      problems.push({
        file: "items.json5",
        id: item.id,
        message: "workbench items need `workbenchLevel`",
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
  for (const level of [1, 2, 3]) {
    const item = content.items.find((candidate) => candidate.workbenchLevel === level);
    if (!item) {
      problems.push({
        file: "items.json5",
        id: "",
        message: `no workbench item for level ${level}`,
      });
    } else if (!content.recipes.some((recipe) => recipe.item === item.id)) {
      problems.push({ file: "recipes.json5", id: item.id, message: "workbench has no recipe" });
    }
  }

  const orders = content.monuments.map((monument) => monument.order).sort((a, b) => a - b);
  if (orders.some((order, index) => order !== index + 1)) {
    problems.push({
      file: "monuments.json5",
      id: "",
      message: `\`order\` must be 1..${orders.length} with no gaps or repeats`,
    });
  }
  for (const monument of content.monuments) {
    if (monument.keycard === undefined) continue;
    const isKeycard = content.items.some(
      (item) => item.id === monument.keycard && item.category === "keycard",
    );
    if (!isKeycard) {
      problems.push({
        file: "monuments.json5",
        id: monument.id,
        message: `keycard \`${monument.keycard}\` is not a keycard item in items.json5`,
      });
    }
  }
  return problems;
}
