/**
 * Runtime lookup of owner-supplied files.
 *
 * Scans the asset folders once at startup. A lookup that misses is not an
 * error: callers fall back to a placeholder tile (cards) or a Unicode emoji
 * (inline text), so the bot runs with nothing supplied.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { log } from "../log";
import { BUNDLED_DIR } from "./check";
import { readManifest } from "./manifest";
import { type AssetSpec, FOLDERS, type Folder } from "./spec";

export interface AssetFile {
  path: string;
  /** SHA-256 of the contents. Keys the render cache and the emoji sync diff. */
  hash: string;
  bytes: number;
}

export const FONT_FILES = {
  regular: "RobotoCondensed-Regular.ttf",
  bold: "RobotoCondensed-Bold.ttf",
} as const;

export class AssetRegistry {
  private readonly files = new Map<string, AssetFile>();
  private readonly dataUris = new Map<string, string>();
  /** Changes whenever any supplied file is added, removed or replaced. */
  readonly fingerprint: string;

  private constructor(
    readonly root: string,
    readonly specs: AssetSpec[],
    scan: boolean,
  ) {
    if (scan) this.scan();
    const digest = createHash("sha256");
    for (const [key, file] of [...this.files].sort(([a], [b]) => a.localeCompare(b))) {
      digest.update(`${key}:${file.hash};`);
    }
    this.fingerprint = digest.digest("hex").slice(0, 16);
  }

  static load(assetsDir: string): AssetRegistry {
    return new AssetRegistry(assetsDir, readManifest(assetsDir), true);
  }

  /**
   * Same root (so bundled fonts still load) but pretends no file was supplied:
   * what a fresh deployment looks like. Used by the preview and by tests.
   */
  static bare(assetsDir: string): AssetRegistry {
    return new AssetRegistry(assetsDir, readManifest(assetsDir), false);
  }

  private scan(): void {
    for (const folder of FOLDERS) {
      const dir = join(this.root, folder);
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name.startsWith(".") || !statSync(path).isFile()) continue;
        const bytes = readFileSync(path);
        this.files.set(`${folder}/${name}`, {
          path,
          hash: createHash("sha256").update(bytes).digest("hex"),
          bytes: bytes.length,
        });
      }
    }
  }

  file(folder: Folder, fileName: string): AssetFile | undefined {
    return this.files.get(`${folder}/${fileName}`);
  }

  /** Every supplied file in `folder`, by file name. */
  in(folder: Folder): Map<string, AssetFile> {
    const prefix = `${folder}/`;
    const found = new Map<string, AssetFile>();
    for (const [key, file] of this.files) {
      if (key.startsWith(prefix)) found.set(key.slice(prefix.length), file);
    }
    return found;
  }

  /** The picture `name` in `folder` as a data URI for a card, if supplied. */
  imageUri(folder: Folder, name: string): string | undefined {
    for (const [extension, mime] of [
      ["png", "image/png"],
      ["jpg", "image/jpeg"],
    ] as const) {
      const key = `${folder}/${name}.${extension}`;
      const cached = this.dataUris.get(key);
      if (cached) return cached;
      const file = this.files.get(key);
      if (!file) continue;
      const uri = `data:${mime};base64,${readFileSync(file.path).toString("base64")}`;
      this.dataUris.set(key, uri);
      return uri;
    }
    return undefined;
  }

  /** A font's bytes: the owner's copy if supplied, else the bundled one. */
  font(fileName: string): Buffer {
    const supplied = this.files.get(`fonts/${fileName}`);
    const path = supplied?.path ?? join(this.root, BUNDLED_DIR, "fonts", fileName);
    try {
      return readFileSync(path);
    } catch {
      throw new Error(
        `font ${fileName} not found in assets/fonts/ or assets/${BUNDLED_DIR}/fonts/: cards cannot render text`,
      );
    }
  }

  /** `[supplied, planned]` over the manifest. */
  counts(): [number, number] {
    const supplied = this.specs.filter((spec) => this.file(spec.folder, spec.file)).length;
    return [supplied, this.specs.length];
  }

  /** Logs the one startup summary line. */
  logSummary(): void {
    const [present, planned] = this.counts();
    log.info(`assets: ${present}/${planned} present, ${planned - present} placeholders`);
  }
}
