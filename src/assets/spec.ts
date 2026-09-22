/** What one owner-supplied asset file must look like. */
import { z } from "zod";
import { LAST_PHASE } from "../content/schema";

/** The size folders under `assets/` (CLAUDE.md section 7.2), in checklist order. */
export const FOLDERS = [
  "fonts",
  "emoji_128",
  "icons_256",
  "portraits_256",
  "thumbs_512",
  "banners_1600x600",
  "ui",
] as const;
export type Folder = (typeof FOLDERS)[number];

/** Pixel size every file in the folder shares. `ui` is per entry, fonts have none. */
export const FOLDER_SIZE: Record<Folder, readonly [number, number] | null> = {
  fonts: null,
  emoji_128: [128, 128],
  icons_256: [256, 256],
  portraits_256: [256, 256],
  thumbs_512: [512, 512],
  banners_1600x600: [1600, 600],
  ui: null,
};

/** One line for the ASSETS.md section heading. */
export const FOLDER_PURPOSE: Record<Folder, string> = {
  fonts:
    "Card fonts. Optional: an open-licence copy ships in `assets/_placeholders/fonts/` and is used until these are supplied.",
  emoji_128:
    "Inline icons and button emojis. Uploaded automatically as application emojis. Max 256 KB each.",
  icons_256: "Item and resource icons drawn inside rendered cards.",
  portraits_256: "Survivor portraits.",
  thumbs_512: "Monument, base-tier and event thumbnails.",
  banners_1600x600: "Wide card backgrounds.",
  ui: "Casino artwork. Exact size per row.",
};

export const FORMATS = ["png", "jpg", "ttf"] as const;
export type Format = (typeof FORMATS)[number];

export const FORMAT_LABEL: Record<Format, string> = {
  png: "PNG, transparent background",
  jpg: "JPG, opaque",
  ttf: "TTF",
};

/** `bundled`: not supplied, but an agent-committed stand-in file is in use (fonts). */
export type Status = "missing" | "present" | "invalid" | "bundled";

export const assetSpecSchema = z.strictObject({
  /** Exact file name including extension, e.g. `sulfur_ore.png`. */
  file: z.string().min(1),
  folder: z.enum(FOLDERS),
  format: z.enum(FORMATS),
  /** 0 for fonts. */
  width: z.int().min(0),
  height: z.int().min(0),
  depicts: z.string().min(1),
  /** Rust item shortname or monument name, to make sourcing easy. */
  rustRef: z.string(),
  usedIn: z.array(z.string()),
  /** First phase that uses the file. */
  phase: z.int().min(0).max(LAST_PHASE),
  status: z.enum(["missing", "present", "invalid", "bundled"]).default("missing"),
});

export type AssetSpec = z.infer<typeof assetSpecSchema>;

/** File name without extension: the asset's name and its emoji name. */
export function assetName(file: string): string {
  const dot = file.lastIndexOf(".");
  return dot > 0 ? file.slice(0, dot) : file;
}

export function sizeLabel(spec: AssetSpec): string {
  return spec.folder === "fonts" ? "n/a" : `${spec.width}x${spec.height}`;
}
