/**
 * Player-visible strings, keyed. UI code never contains a string literal a
 * player can read; it asks the Locale.
 *
 * `locale/en.json` is nested JSON, flattened to dotted keys at load:
 * `{ resource: { wood: { name } } }` becomes `resource.wood.name`.
 * Values may hold `{placeholders}`.
 *
 * Pure: reading the file is `loadLocale` in `./load`, so browsers can use this too.
 */
export type LocaleArgs = Record<string, string | number>;

export class Locale {
  private constructor(
    private readonly strings: ReadonlyMap<string, string>,
    private readonly onMissing: ((key: string) => void) | undefined,
  ) {}

  /** `onMissing` hears about every lookup of a key that does not exist (the bot logs it). */
  static fromObject(tree: unknown, onMissing?: (key: string) => void): Locale {
    const strings = new Map<string, string>();
    flatten("", tree, strings);
    return new Locale(strings, onMissing);
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
   * A missing key renders as `⟦key⟧` and is reported to `onMissing` rather than thrown:
   * one typo must not take a whole screen down. Startup validation and the
   * preview outlines are where missing keys get caught.
   */
  t(key: string, args?: LocaleArgs): string {
    const template = this.strings.get(key);
    if (template === undefined) {
      this.onMissing?.(key);
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
