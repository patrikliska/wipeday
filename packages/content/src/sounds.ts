/**
 * The sound map (`data/sounds.json5`; 12-feel.md 3.3, D224): every cue with its files and the
 * procedural voice that stands in for them, every event with the cue (and the vibration) it
 * plays, and the packs the files come from, which the credits panel lists. The game rules never
 * read it: only the web client plays sounds, so it is not part of `Content`.
 */
import { z } from "zod";
import { ID_PATTERN, id } from "./schema";

/** A file under `apps/web/public/sound/`, without its extension: `<source>/<name>`. */
const FILE_PATTERN = /^[a-z0-9_]+\/[A-Za-z0-9_]+$/;

export const soundSourceSchema = z.strictObject({
  id,
  /** Where the pack is downloaded from (the build script's input, the credits' link). */
  url: z.url(),
  licence: z.enum(["CC0-1.0"]),
});

export const cueSchema = z.strictObject({
  /** The procedural voice (`apps/web/src/sound/voices.ts`) used until a file decodes, or alone. */
  voice: id,
  /** Variants, one picked at random per play; empty means the voice alone. */
  files: z.array(z.string().regex(FILE_PATTERN)).default([]),
  /** Loudness against the others, after the build normalises every file (1 = as built). */
  gain: z.number().finite().positive().max(2).default(1),
  /** Random pitch spread per play, in cents either way (files only; voices vary themselves). */
  detune: z.number().finite().min(0).max(300).default(0),
  /** The build cuts each file to this many seconds with a short fade (a tap stays short). */
  trim: z.number().finite().positive().max(3).optional(),
  /** At most this many plays a second; faster ones raise the next one's gain instead. */
  perSecond: z.number().finite().positive().max(60).optional(),
});
export type Cue = z.infer<typeof cueSchema>;

/** A vibration pattern in ms (Android only, 08-screens.md 5.4); taps never vibrate. */
const buzz = z.array(z.int().min(1).max(500)).min(1).max(7);

export const soundEventSchema = z.strictObject({
  /** A cue id; `{field}` is filled from the event (`tap_{target}` → `tap_ore`). */
  cue: z.string().regex(/^[a-z0-9_{}]+$/),
  buzz: buzz.optional(),
});
export type SoundEvent = z.infer<typeof soundEventSchema>;

export const soundsFileSchema = z.strictObject({
  sources: z.array(soundSourceSchema).min(1),
  cues: z.record(z.string().regex(ID_PATTERN), cueSchema),
  /** Every event the client hears of: what it plays, or `null` for silence (a stated choice). */
  events: z.record(z.string().regex(ID_PATTERN), soundEventSchema.nullable()),
});
export type Sounds = z.infer<typeof soundsFileSchema>;

/** The `{field}` names a cue template reads from its event. */
export function templateFields(cue: string): string[] {
  return [...cue.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1] ?? "");
}

/** A template filled from an event's fields; null when a field is missing. */
export function fillCue(cue: string, fields: Record<string, unknown>): string | null {
  let missing = false;
  const filled = cue.replace(/\{([a-z_]+)\}/g, (_, name: string) => {
    const value = fields[name];
    if (typeof value !== "string") {
      missing = true;
      return "";
    }
    return value;
  });
  return missing ? null : filled;
}

/**
 * Validates the file and its cross-references: every cue's files name a listed source, every
 * event's cue (each template filled with every value `values` lists for its field) is a cue.
 * Returns the problems as sentences; empty means sound.
 */
export function checkSounds(
  raw: unknown,
  values: Record<string, readonly string[]>,
): { sounds: Sounds | null; problems: string[] } {
  const parsed = soundsFileSchema.safeParse(raw);
  if (!parsed.success)
    return {
      sounds: null,
      problems: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  const sounds = parsed.data;
  const problems: string[] = [];
  const sources = new Set(sounds.sources.map((source) => source.id));
  for (const [cueId, cue] of Object.entries(sounds.cues)) {
    for (const file of cue.files) {
      const source = file.slice(0, file.indexOf("/"));
      if (!sources.has(source)) problems.push(`cue ${cueId}: ${file} names no listed source`);
    }
  }
  for (const [event, entry] of Object.entries(sounds.events)) {
    if (!entry) continue;
    const fields = templateFields(entry.cue);
    let combos: Record<string, string>[] = [{}];
    for (const field of fields) {
      const options = values[field];
      if (!options) {
        problems.push(`event ${event}: no values are known for {${field}}`);
        combos = [];
        break;
      }
      combos = combos.flatMap((combo) => options.map((value) => ({ ...combo, [field]: value })));
    }
    for (const combo of combos) {
      const cue = fillCue(entry.cue, combo);
      if (cue && !sounds.cues[cue]) problems.push(`event ${event}: cue ${cue} is not defined`);
    }
  }
  return { sounds, problems };
}
