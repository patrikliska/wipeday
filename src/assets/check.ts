/**
 * Verifies supplied files against the manifest: missing, wrong dimensions,
 * wrong format, oversize emoji, and files the manifest does not know (which
 * are nearly always typos of a name it does).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { sniff } from "./inspect";
import { type AssetSpec, FOLDERS, FORMAT_LABEL, type Folder } from "./spec";

/** Discord rejects application emoji larger than this. */
export const EMOJI_MAX_BYTES = 256 * 1024;

/** Agent-committed stand-ins, mirrored by folder: `assets/_placeholders/{folder}/{file}`. */
export const BUNDLED_DIR = "_placeholders";

export interface Finding {
  folder: Folder;
  file: string;
  phase: number;
  problem: string;
}

export interface Report {
  /** The manifest rows with `status` filled in. */
  specs: AssetSpec[];
  /** Manifest files that are not on disk (and have no bundled stand-in). */
  missing: Finding[];
  /** Files on disk that cannot be used as they are. */
  invalid: Finding[];
  /** Files on disk that no manifest row asks for. */
  unlisted: Finding[];
}

/**
 * True when the check command must exit non-zero: a file is unusable, or
 * something needed by a phase already being built is missing.
 */
export function reportFails(report: Report, currentPhase: number): boolean {
  return (
    report.invalid.length > 0 || report.missing.some((finding) => finding.phase <= currentPhase)
  );
}

export function checkAssets(assetsDir: string, specs: AssetSpec[]): Report {
  const report: Report = { specs: [], missing: [], invalid: [], unlisted: [] };

  for (const spec of specs) {
    const finding = (problem: string): Finding => ({
      folder: spec.folder,
      file: spec.file,
      phase: spec.phase,
      problem,
    });
    const path = join(assetsDir, spec.folder, spec.file);
    if (!existsSync(path)) {
      const bundled = existsSync(join(assetsDir, BUNDLED_DIR, spec.folder, spec.file));
      if (!bundled) report.missing.push(finding("missing"));
      report.specs.push({ ...spec, status: bundled ? "bundled" : "missing" });
      continue;
    }
    const problems = inspectFile(spec, readFileSync(path));
    report.invalid.push(...problems.map(finding));
    report.specs.push({ ...spec, status: problems.length > 0 ? "invalid" : "present" });
  }

  for (const folder of FOLDERS) {
    const dir = join(assetsDir, folder);
    if (!existsSync(dir)) continue;
    const names = readdirSync(dir)
      .filter((name) => !name.startsWith(".") && statSync(join(dir, name)).isFile())
      .sort();
    for (const name of names) {
      if (specs.some((spec) => spec.folder === folder && spec.file === name)) continue;
      const guess = closest(name, folder, specs);
      report.unlisted.push({
        folder,
        file: name,
        phase: 0,
        problem: guess ? `not in the manifest, did you mean \`${guess}\`?` : "not in the manifest",
      });
    }
  }
  return report;
}

export function inspectFile(spec: AssetSpec, bytes: Buffer): string[] {
  const sniffed = sniff(bytes);
  if (spec.format === "ttf") {
    return sniffed.kind === "font" ? [] : ["not a TrueType/OpenType font"];
  }

  const problems: string[] = [];
  if (sniffed.kind !== "png" && sniffed.kind !== "jpg") {
    return ["not a readable PNG or JPG"];
  }
  if (sniffed.kind !== spec.format) {
    problems.push(
      `wrong format: is ${sniffed.kind.toUpperCase()}, must be ${FORMAT_LABEL[spec.format]}`,
    );
  }
  if (sniffed.width !== spec.width || sniffed.height !== spec.height) {
    problems.push(
      `wrong size: is ${sniffed.width}x${sniffed.height}, must be ${spec.width}x${spec.height}`,
    );
  }
  if (spec.folder === "emoji_128" && bytes.length > EMOJI_MAX_BYTES) {
    problems.push(
      `too big for an emoji: ${Math.round(bytes.length / 1024)} KB, max ${EMOJI_MAX_BYTES / 1024} KB`,
    );
  }
  return problems;
}

/** The manifest file name in `folder` nearest to `name`, if near enough to be a typo. */
export function closest(name: string, folder: Folder, specs: AssetSpec[]): string | null {
  let best: { file: string; distance: number } | null = null;
  for (const spec of specs) {
    if (spec.folder !== folder) continue;
    const distance = editDistance(name.toLowerCase(), spec.file.toLowerCase());
    if (distance <= 3 && (best === null || distance < best.distance)) {
      best = { file: spec.file, distance };
    }
  }
  return best?.file ?? null;
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 0; i < a.length; i++) {
    const current = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const substitute = (previous[j] ?? 0) + (a[i] === b[j] ? 0 : 1);
      current.push(Math.min(substitute, (previous[j + 1] ?? 0) + 1, (current[j] ?? 0) + 1));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}
