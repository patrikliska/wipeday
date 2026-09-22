/**
 * Player-visible strings, keyed. UI code never contains a string literal a
 * player can read; it asks the Locale.
 *
 * `locale/en.json` is nested JSON, flattened to dotted keys at load:
 * `{ resource: { wood: { name } } }` becomes `resource.wood.name`.
 * Values may hold `{placeholders}`.
 */
import { readFileSync } from "node:fs";
import { log } from "../log";

export type LocaleArgs = Record<string, string | number>;

export class Locale {
  private constructor(private readonly strings: ReadonlyMap<string, string>) {}

  static load(file: string): Locale {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      throw new Error(`could not load locale file ${file}: ${(error as Error).message}`);
    }
    return Locale.fromObject(parsed);
  }

  static fromObject(tree: unknown): Locale {
    const strings = new Map<string, string>();
    flatten("", tree, strings);
    return new Locale(strings);
  }

  has(key: string): boolean {
    return this.strings.has(key);
  }

  keys(): string[] {
    return [...this.strings.keys()];
  }

  /**
   * The string for `key`, with `{name}` placeholders filled from `args`.
   *
   * A missing key renders as `⟦key⟧` and logs a warning rather than throwing:
   * one typo must not take a whole screen down. Startup validation and the
   * preview outlines are where missing keys get caught.
   */
  t(key: string, args?: LocaleArgs): string {
    const template = this.strings.get(key);
    if (template === undefined) {
      log.warn("missing locale key", { key });
      return `⟦${key}⟧`;
    }
    if (!args) return template;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in args ? String(args[name]) : whole,
    );
  }
}

function flatten(prefix: string, node: unknown, out: Map<string, string>): void {
  if (typeof node === "string") {
    out.set(prefix, node);
    return;
  }
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    throw new Error(`locale key \`${prefix}\` must be a string or an object`);
  }
  for (const [name, value] of Object.entries(node)) {
    flatten(prefix ? `${prefix}.${name}` : name, value, out);
  }
}
