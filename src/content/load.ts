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
import { type Content, type EntityKind, FILES } from "./schema";

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

/** Reads and validates everything. Throws `ContentError` listing all problems. */
export function loadContent(dataDir: string, locale: Locale): Content {
  const problems: Problem[] = [];
  const content: Content = {
    resources: [],
    tools: [],
    baseTiers: [],
    furnaces: [],
    items: [],
    monuments: [],
    perks: [],
  };

  for (const { file, field, schema } of FILES) {
    let raw: unknown;
    try {
      raw = JSON5.parse(readFileSync(join(dataDir, file), "utf8"));
    } catch (error) {
      problems.push({ file, id: "", message: `cannot be read: ${(error as Error).message}` });
      continue;
    }
    const parsed = z.strictObject({ [field]: z.array(z.unknown()) }).safeParse(raw);
    if (!parsed.success) {
      problems.push({ file, id: "", message: `must be an object with one \`${field}\` array` });
      continue;
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
      for (const issue of result.error.issues) {
        const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        problems.push({ file, id: id || `#${index + 1}`, message: `${where}${issue.message}` });
      }
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

  // Tiers are a fixed list in code (colours, ordering), so the file must match it.
  const found = content.baseTiers.map((tier) => tier.id);
  if (found.join() !== TIERS.join()) {
    problems.push({
      file: "base_tiers.json5",
      id: "",
      message: `must list exactly [${TIERS.join(", ")}] in that order, found [${found.join(", ")}]`,
    });
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
