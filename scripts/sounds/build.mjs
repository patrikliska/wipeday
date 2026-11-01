#!/usr/bin/env node
/**
 * `pnpm sounds`: builds every file `packages/content/data/sounds.json5` names into
 * `apps/web/public/sound/<source>/<name>.ogg` and `.mp3` (D224). Each source pack is downloaded
 * once into `var/sound-packs/<source>/` from its page's zip link and unpacked with Python's
 * zipfile. Every file is trimmed of leading silence, levelled to one loudness (the cue's `gain`
 * mixes them after), cut to the cue's `trim` with a short fade, made mono, and written as Ogg
 * Vorbis (Chrome, Firefox, Safari 17+) and MP3 (older Safari). The pack's licence goes beside
 * its files; files no cue names any more are removed.
 *
 * Needs ffmpeg (with libvorbis and libmp3lame) and python on the PATH.
 *   pnpm sounds            build what is missing or changed
 *   pnpm sounds --force    rebuild everything
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// JSON5 is the content package's dependency: resolve it from there.
const JSON5 = createRequire(join(root, "packages/content/package.json"))("json5");
const dataFile = join(root, "packages/content/data/sounds.json5");
const packs = join(root, "var/sound-packs");
const out = join(root, "apps/web/public/sound");
const force = process.argv.includes("--force");

/** The level every file is brought to (mean, dBFS), never past a -1 dBFS peak. */
const TARGET_MEAN = -18;
const PEAK = -1;
const FADE = 0.04;

const sounds = JSON5.parse(readFileSync(dataFile, "utf8"));

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });
}

/** Every file under `dir`, recursively. */
function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found;
}

async function fetchPack(source) {
  const dir = join(packs, source.id);
  if (existsSync(dir) && readdirSync(dir).length > 0) return dir;
  console.log(`downloading ${source.id} from ${source.url}`);
  const page = await (await fetch(source.url)).text();
  const zip = page.match(/https:\/\/[^"']+\.zip/)?.[0];
  if (!zip) throw new Error(`no zip link on ${source.url}`);
  const bytes = Buffer.from(await (await fetch(zip)).arrayBuffer());
  mkdirSync(dir, { recursive: true });
  const archive = join(packs, `${source.id}.zip`);
  writeFileSync(archive, bytes);
  run("python", ["-I", "-m", "zipfile", "-e", archive, dir]);
  rmSync(archive);
  return dir;
}

/** ffmpeg with `args`; returns its stderr (where it reports), throws when it fails. */
function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr}`);
  return result.stderr;
}

/** The mean and peak (dBFS) of `input` after `filters`. */
function measure(input, filters) {
  const report = ffmpeg(["-i", input, "-af", `${filters},volumedetect`, "-f", "null", "-"]);
  const mean = Number(report.match(/mean_volume: (-?[\d.]+) dB/)?.[1]);
  const max = Number(report.match(/max_volume: (-?[\d.]+) dB/)?.[1]);
  if (!Number.isFinite(mean) || !Number.isFinite(max)) throw new Error(`${input}: no levels`);
  return { mean, max };
}

async function main() {
  const sources = new Map(sounds.sources.map((source) => [source.id, source]));
  /** Wanted output (`<source>/<name>`) → the shortest trim any cue asks of it. */
  const wanted = new Map();
  for (const cue of Object.values(sounds.cues)) {
    for (const file of cue.files ?? []) {
      const before = wanted.get(file);
      const trim = cue.trim ?? null;
      wanted.set(
        file,
        before === undefined ? trim : before === null ? trim : Math.min(before, trim ?? before),
      );
    }
  }
  const packFiles = new Map();
  for (const source of sources.values()) {
    const used = [...wanted.keys()].some((file) => file.startsWith(`${source.id}/`));
    if (!used) continue;
    const dir = await fetchPack(source);
    const files = walk(dir);
    packFiles.set(source.id, files);
    const licence = files.find((path) => /licen[cs]e\.txt$/i.test(path));
    mkdirSync(join(out, source.id), { recursive: true });
    if (licence) copyFileSync(licence, join(out, source.id, "License.txt"));
    else throw new Error(`${source.id}: the pack has no licence file`);
  }

  let built = 0;
  for (const [file, trim] of wanted) {
    const [sourceId, name] = file.split("/");
    const input = packFiles
      .get(sourceId)
      ?.find(
        (path) =>
          basename(path).replace(/\.(ogg|wav|mp3)$/i, "") === name && /\.(ogg|wav)$/i.test(path),
      );
    if (!input) throw new Error(`${file}: not found in the ${sourceId} pack`);
    const ogg = join(out, sourceId, `${name}.ogg`);
    const mp3 = join(out, sourceId, `${name}.mp3`);
    const stamp = join(packs, ".stamps", sourceId, `${name}.json`);
    mkdirSync(dirname(stamp), { recursive: true });
    const recipe = JSON.stringify({ trim, TARGET_MEAN, PEAK, FADE, size: statSync(input).size });
    if (
      !force &&
      existsSync(ogg) &&
      existsSync(mp3) &&
      existsSync(stamp) &&
      readFileSync(stamp, "utf8") === recipe
    )
      continue;
    const silence = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.004";
    const { mean, max } = measure(input, silence);
    const gain = Math.min(TARGET_MEAN - mean, PEAK - max);
    const filters = [silence, `volume=${gain.toFixed(2)}dB`];
    if (trim)
      filters.push(
        `afade=t=out:st=${Math.max(0, trim - FADE).toFixed(3)}:d=${FADE}`,
        `atrim=0:${trim}`,
      );
    const af = filters.join(",");
    const common = ["-loglevel", "error", "-y", "-i", input, "-af", af, "-ac", "1", "-ar", "44100"];
    ffmpeg([...common, "-c:a", "libvorbis", "-q:a", "4", ogg]);
    ffmpeg([...common, "-c:a", "libmp3lame", "-q:a", "4", mp3]);
    writeFileSync(stamp, recipe);
    built += 1;
    console.log(
      `${file}: ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB${trim ? `, cut at ${trim}s` : ""}`,
    );
  }

  // Files no cue names any more go.
  let removed = 0;
  if (existsSync(out)) {
    for (const sourceId of readdirSync(out)) {
      const dir = join(out, sourceId);
      if (!statSync(dir).isDirectory()) continue;
      for (const entry of readdirSync(dir)) {
        if (entry === "License.txt") continue;
        const name = entry.replace(/\.(ogg|mp3)$/, "");
        if (!wanted.has(`${sourceId}/${name}`)) {
          rmSync(join(dir, entry));
          removed += 1;
        }
      }
    }
  }
  console.log(`sounds: ${built} built, ${wanted.size - built} up to date, ${removed} removed`);
}

await main();
