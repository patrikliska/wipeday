/**
 * The asset manifest: the complete list of files the owner supplies.
 *
 * The list is derived, never hand-maintained: every entity in `data/*.json5`
 * implies its asset rows (a resource needs an emoji and a card icon, a monument
 * needs an emoji and a thumbnail, ...). Assets that belong to no entity (fonts,
 * portraits, casino art) live in `assets/manifest.extra.json5`. `pnpm assets`
 * writes the result to `manifest.json` and `ASSETS.md`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSON5 from "json5";
import { z } from "zod";
import { identities } from "../content/load";
import { type Content, type EntityKind, ID_PATTERN } from "../content/schema";
import type { Locale } from "../ui/locale";
import {
  type AssetSpec,
  assetName,
  assetSpecSchema,
  FOLDER_PURPOSE,
  FOLDER_SIZE,
  FOLDERS,
  FORMAT_LABEL,
  type Folder,
  sizeLabel,
} from "./spec";

export const MANIFEST_FILE = "manifest.json";
export const EXTRA_FILE = "manifest.extra.json5";
export const CHECKLIST_FILE = "ASSETS.md";

/**
 * Asset (and emoji) name of an entity. All kinds share one emoji namespace, so
 * kinds whose ids collide with another kind's get a prefix: the `wood` base
 * tier is `tier_wood`, the `wood` resource stays `wood`.
 */
export function entityAssetName(kind: EntityKind, id: string): string {
  if (kind === "base_tier") return `tier_${id}`;
  if (kind === "perk") return `perk_${id}`;
  return id;
}

interface Use {
  folder: Folder;
  what: string;
  usedIn: string[];
}

const EMOJI_USES = ["emoji", "buttons", "select menus"];

/** Which folders an entity kind needs a picture in, and what for. */
const USES: Record<EntityKind, Use[]> = {
  resource: [
    { folder: "emoji_128", what: "resource icon", usedIn: EMOJI_USES },
    {
      folder: "icons_256",
      what: "resource icon",
      usedIn: ["base card", "inventory card", "report cards"],
    },
  ],
  tool: [
    { folder: "emoji_128", what: "tool icon", usedIn: EMOJI_USES },
    { folder: "icons_256", what: "tool icon", usedIn: ["base card", "gather card"] },
  ],
  furnace: [
    { folder: "emoji_128", what: "item icon", usedIn: EMOJI_USES },
    { folder: "icons_256", what: "item icon", usedIn: ["furnace card"] },
  ],
  item: [
    { folder: "emoji_128", what: "item icon", usedIn: EMOJI_USES },
    {
      folder: "icons_256",
      what: "item icon",
      usedIn: ["inventory card", "loadout card", "report cards"],
    },
  ],
  base_tier: [
    { folder: "emoji_128", what: "base tier badge", usedIn: EMOJI_USES },
    {
      folder: "thumbs_512",
      what: "base of this tier, exterior shot",
      usedIn: ["base card", "raid report card"],
    },
  ],
  monument: [
    { folder: "emoji_128", what: "monument icon (map marker style)", usedIn: EMOJI_USES },
    {
      folder: "thumbs_512",
      what: "monument, recognisable wide shot",
      usedIn: ["expedition confirm card", "expedition report card"],
    },
  ],
  perk: [{ folder: "emoji_128", what: "perk icon", usedIn: EMOJI_USES }],
};

/** The full planned asset list: entity-derived rows plus the extras file. */
export function plannedAssets(content: Content, locale: Locale, assetsDir: string): AssetSpec[] {
  const specs: AssetSpec[] = [];

  for (const entity of identities(content)) {
    const display = locale.t(`${entity.kind}.${entity.id}.name`);
    for (const use of USES[entity.kind]) {
      const [width, height] = FOLDER_SIZE[use.folder] ?? [0, 0];
      specs.push({
        file: `${entityAssetName(entity.kind, entity.id)}.png`,
        folder: use.folder,
        format: "png",
        width,
        height,
        depicts: `${display}: ${use.what}`,
        rustRef: entity.rustRef,
        usedIn: use.usedIn,
        phase: entity.phase,
        status: "missing",
      });
    }
  }

  const extraPath = join(assetsDir, EXTRA_FILE);
  const extra = z
    .strictObject({ assets: z.array(assetSpecSchema) })
    .parse(JSON5.parse(readFileSync(extraPath, "utf8")));
  specs.push(...extra.assets);

  const seen = new Set<string>();
  for (const spec of specs) {
    const fail = (reason: string): never => {
      throw new Error(`asset \`${spec.folder}/${spec.file}\`: ${reason}`);
    };
    const slot = `${spec.folder}/${spec.file}`;
    if (seen.has(slot)) fail("listed twice (two entities map to the same file name)");
    seen.add(slot);
    // Font file names are fixed by the foundry and never become emoji names.
    if (spec.folder !== "fonts" && !ID_PATTERN.test(assetName(spec.file))) {
      fail("file name must be lowercase snake_case");
    }
    if (!spec.file.endsWith(`.${spec.format}`)) fail("extension does not match format");
    const fixed = FOLDER_SIZE[spec.folder];
    if (fixed && (fixed[0] !== spec.width || fixed[1] !== spec.height)) {
      fail(`must be ${fixed[0]}x${fixed[1]} in this folder`);
    }
  }

  // Stable: folder, then phase; content order is kept within a phase.
  return specs
    .map((spec, index) => ({ spec, index }))
    .sort(
      (a, b) =>
        FOLDERS.indexOf(a.spec.folder) - FOLDERS.indexOf(b.spec.folder) ||
        a.spec.phase - b.spec.phase ||
        a.index - b.index,
    )
    .map(({ spec }) => spec);
}

/** Reads `assets/manifest.json`. Missing file = empty manifest: the bot must start with nothing. */
export function readManifest(assetsDir: string): AssetSpec[] {
  const path = join(assetsDir, MANIFEST_FILE);
  if (!existsSync(path)) return [];
  const parsed = z
    .strictObject({ generated: z.string(), assets: z.array(assetSpecSchema) })
    .parse(JSON.parse(readFileSync(path, "utf8")));
  return parsed.assets;
}

/** Writes `manifest.json` and `ASSETS.md`. */
export function writeManifest(assetsDir: string, specs: AssetSpec[], currentPhase: number): void {
  const manifest = {
    generated:
      "by `pnpm assets sync` from data/*.json5 + assets/manifest.extra.json5. Do not edit.",
    assets: specs,
  };
  writeFileSync(join(assetsDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(assetsDir, CHECKLIST_FILE), checklist(specs, currentPhase));
}

const isSupplied = (spec: AssetSpec) => spec.status === "present";

/** The human-readable checklist: progress first, then one table per folder. */
export function checklist(specs: AssetSpec[], currentPhase: number): string {
  const lines: string[] = [
    "# Wipe Day assets",
    "",
    "Generated by `pnpm assets sync`. Do not edit by hand.",
    "",
    `**${specs.filter(isSupplied).length}/${specs.length} supplied.** Current phase: **${currentPhase}**. ` +
      "The bot runs with none of these: cards fall back to tinted placeholder tiles, " +
      "inline icons to Unicode emoji, and fonts to the bundled copy.",
    "",
    "Drop each file into the folder of its section, named exactly as listed. If a picture " +
      "appears in two sections, supply it once per folder at that folder's size, with the " +
      "same file name. Then run `pnpm assets check`.",
    "",
    "## Progress by phase",
    "",
    "| Phase | Files | Supplied | Missing |",
    "| --- | --- | --- | --- |",
  ];

  const phases = [...new Set(specs.map((spec) => spec.phase))].sort((a, b) => a - b);
  for (const phase of phases) {
    const ofPhase = specs.filter((spec) => spec.phase === phase);
    const have = ofPhase.filter(isSupplied).length;
    const marker =
      phase === currentPhase ? " (current)" : phase === currentPhase + 1 ? " (next)" : "";
    lines.push(`| ${phase}${marker} | ${ofPhase.length} | ${have} | ${ofPhase.length - have} |`);
  }

  for (const folder of FOLDERS) {
    const rows = specs.filter((spec) => spec.folder === folder);
    if (rows.length === 0) continue;
    lines.push(
      "",
      `## \`assets/${folder}/\``,
      "",
      FOLDER_PURPOSE[folder],
      "",
      "| File name | Format | Size | What it depicts | Rust reference | Used in | Phase | Status |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const spec of rows) {
      lines.push(
        `| \`${spec.file}\` | ${FORMAT_LABEL[spec.format]} | ${sizeLabel(spec)} | ${spec.depicts} | ` +
          `\`${spec.rustRef}\` | ${spec.usedIn.join(", ")} | ${spec.phase} | ${spec.status} |`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
