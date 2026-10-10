/**
 * The icon files' rules (D141, D150): `icons/<kind>/<id>.svg`, a square 48 viewBox, shapes in
 * `currentColor` with at most one fixed accent, no raster, text, filters, gradients, references
 * or ids. Pure string checks, so the web, the bot and the tests share them; the 2-unit margin
 * needs a renderer and is checked by `pnpm icons`.
 */
import type { Content } from "./schema";
import { TIERS } from "./tiers";

export const ICON_KINDS = [
  "currency",
  "product",
  "line",
  "tier",
  "tool",
  "target",
  "flotsam",
  "crew",
  "toolbelt",
  "sector",
  "node_type",
  "node",
  "dare",
  "skin",
  "ui",
  "nav",
] as const;
export type IconKind = (typeof ICON_KINDS)[number];

/**
 * The fixed accents an icon may use, each taken from `apps/web/src/scene/palette.ts` or
 * `apps/web/src/styles/tokens.css` (a web test keeps them there).
 */
export const ICON_ACCENTS = {
  "#e3a32f": "scrap's gold (--warning)",
  "#ff6f3c": "fire and embers (dusk sunGlow)",
  "#cd412b": "the red band (--accent)",
  "#f05252": "a warning light (--danger)",
  "#45c2c0": "the Armored era's teal (hqm trim)",
  "#5f8a3e": "moss (MOSS)",
  "#a8603a": "ore veins (ORE_VEIN)",
  "#e3c04f": "sulfur (SULFUR_VEIN)",
  "#5faccf": "shallow sea (seaShallow)",
  "#d8262b": "the Big Red (BIG_RED)",
  "#6fd0a0": "crater glass (GLASS)",
} as const satisfies Record<string, string>;

const FORBIDDEN: [RegExp, string][] = [
  [/<text\b/, "<text>"],
  [/<image\b/, "a raster <image>"],
  [/<(filter|fe[A-Z]\w*)\b/, "a filter"],
  [/Gradient\b/, "a gradient"],
  [/<(pattern|mask|clipPath|use|style|script|foreignObject)\b/, "a forbidden element"],
  [/\bhref=/, "an external reference"],
  [/url\(/, "a url() reference"],
  [/\sid=/, "an id attribute"],
];

const ICON_ID = /^[a-z][a-z0-9_]{1,31}$/;

/** Every rule a file breaks, in words; empty when the file is fine. */
export function lintIcon(svg: string, id?: string): string[] {
  const problems: string[] = [];
  if (id !== undefined && !ICON_ID.test(id)) problems.push("the id is not snake_case, 2-32 chars");
  const root = /<svg\b[^>]*>/.exec(svg)?.[0];
  if (!root) return [...problems, "no <svg> root"];
  if (!root.includes('viewBox="0 0 48 48"')) problems.push('the root needs viewBox="0 0 48 48"');
  if (/\s(width|height)=/.test(root)) problems.push("the root has a width or height");
  for (const [pattern, what] of FORBIDDEN) if (pattern.test(svg)) problems.push(`uses ${what}`);
  const colours = new Set<string>();
  for (const [, , value = ""] of svg.matchAll(/\b(fill|stroke|color)="([^"]+)"/g)) {
    if (value === "currentColor" || value === "none" || value === "evenodd") continue;
    const colour = value.toLowerCase();
    if (!(colour in ICON_ACCENTS)) problems.push(`${value} is not one of the icon accents`);
    colours.add(colour);
  }
  if (colours.size > 1) problems.push(`${colours.size} fixed colours (at most one accent)`);
  for (const [, width = ""] of svg.matchAll(/stroke-width="([^"]+)"/g)) {
    if (!(Number(width) >= 3)) problems.push(`stroke-width ${width} is under 3`);
  }
  return problems;
}

/** The fixed accent a file uses, if any. */
export function iconAccent(svg: string): string | undefined {
  for (const [, , value = ""] of svg.matchAll(/\b(fill|stroke|color)="([^"]+)"/g)) {
    if (value.startsWith("#")) return value.toLowerCase();
  }
  return undefined;
}

/** The icons the shipped content names, kind by kind. */
export function iconsWanted(content: Content): { kind: IconKind; id: string }[] {
  return [
    ...content.resources.map((resource) => ({
      kind: resource.kind === "currency" ? ("currency" as const) : ("product" as const),
      id: resource.id,
    })),
    ...content.lines.map((line) => ({ kind: "line" as const, id: line.id })),
    ...content.crew.map((member) => ({ kind: "crew" as const, id: member.id })),
    ...TIERS.map((tier) => ({ kind: "tier" as const, id: tier })),
    ...content.tools.map((tool) => ({ kind: "tool" as const, id: tool.id })),
    ...content.targets.map((target) => ({ kind: "target" as const, id: target.id })),
    ...content.flotsam.kinds.map((kind) => ({ kind: "flotsam" as const, id: kind.id })),
  ];
}
