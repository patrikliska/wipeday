/**
 * The sound engine (08-screens.md 5; 09-architecture.md 10.6; D224): one AudioContext, cue →
 * gain → master → compressor → out, at most 8 voices at once. A cue is a row of
 * `data/sounds.json5`: its files (Ogg, or MP3 where Ogg does not play), one picked at random,
 * and the procedural voice (`voices.ts`) that plays until a file has decoded, or alone. A cue
 * with `perSecond` drops plays past its rate and makes the next one louder instead.
 *
 * Sound starts with the first tap (12-feel.md 3.3): before it, no AudioContext exists. Once the
 * player has tapped, any later gesture (a new page load) wakes it. Nothing here knows an event:
 * `director.ts` turns the bus into cues. Muted means no audio work at all; the switch and the
 * volume are kept in localStorage, on at 70% by default.
 */
import type { Cue as CueDef } from "@wipe-day/content/sounds";
import { sounds } from "./map";
import { type CueOptions, VOICES } from "./voices";

const ENABLED_KEY = "wipeday.sound";
const VOLUME_KEY = "wipeday.volume";
const STARTED_KEY = "wipeday.sound_started";
const MAX_VOICES = 8;
/** Fast cues (taps) leave room for the rest. */
const MAX_FAST_VOICES = 5;

function read(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the setting lasts for this page only.
  }
}

/** The file format this browser decodes: Ogg Vorbis, else MP3. */
function extension(): "ogg" | "mp3" {
  try {
    return new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? "ogg" : "mp3";
  } catch {
    return "mp3";
  }
}

interface Throttle {
  lastMs: number;
  swallowed: number;
}

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private files = new Map<string, AudioBuffer>();
  private live = 0;
  private fast = 0;
  private throttles = new Map<string, Throttle>();
  enabled = read(ENABLED_KEY, "1") === "1";
  volume = Number(read(VOLUME_KEY, "0.7"));
  /** The player has tapped once (on any page load): later gestures may start the sound. */
  started = read(STARTED_KEY, "0") === "1";

  /** The first tap: from now on the sound is on (inside the tap's gesture). */
  start(): void {
    if (!this.started) {
      this.started = true;
      write(STARTED_KEY, "1");
    }
    this.unlock();
  }

  /** Creates the context on a user gesture; later calls resume it. Muted or unstarted: nothing. */
  unlock(): void {
    if (!this.enabled || !this.started) return;
    if (this.ctx) {
      if (this.ctx.state === "suspended" && !document.hidden) void this.ctx.resume();
      return;
    }
    const Context =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    // The silent switch mutes the game, and the player's music keeps playing.
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "ambient";
    const ctx = new Context();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 6;
    compressor.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = this.volume;
    master.connect(compressor);
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.ctx = ctx;
    this.master = master;
    this.noise = noise;
    document.addEventListener("visibilitychange", this.onVisibility);
    void this.loadFiles(ctx);
  }

  private readonly onVisibility = (): void => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else if (this.enabled) void this.ctx.resume();
  };

  /** Every cue's files, the most frequent first; one that fails leaves its voice playing. */
  private async loadFiles(ctx: AudioContext): Promise<void> {
    const ext = extension();
    const all = new Set<string>();
    const cues = Object.values(sounds.cues).sort((a, b) => (b.perSecond ?? 0) - (a.perSecond ?? 0));
    for (const cue of cues) for (const file of cue.files) all.add(file);
    await Promise.all(
      [...all].map(async (file) => {
        try {
          const response = await fetch(`/sound/${file}.${ext}`);
          if (!response.ok || !response.headers.get("content-type")?.startsWith("audio")) return;
          this.files.set(file, await ctx.decodeAudioData(await response.arrayBuffer()));
        } catch {
          // No file, or one that does not decode: the procedural voice stays.
        }
      }),
    );
  }

  /** Whether `cue` may play now; past its rate it is swallowed and boosts the next one. */
  private admit(id: string, cue: CueDef): number | null {
    if (!cue.perSecond) return 1;
    const nowMs = performance.now();
    const throttle = this.throttles.get(id) ?? { lastMs: -1e9, swallowed: 0 };
    this.throttles.set(id, throttle);
    if (nowMs - throttle.lastMs < 1000 / cue.perSecond) {
      throttle.swallowed += 1;
      return null;
    }
    const boost = Math.min(1.6, 1 + throttle.swallowed * 0.15);
    throttle.swallowed = 0;
    throttle.lastMs = nowMs;
    return boost;
  }

  play(id: string, options: CueOptions = {}): void {
    const { ctx, master, noise } = this;
    if (!this.enabled || !ctx || !master || !noise || ctx.state !== "running") return;
    const cue = sounds.cues[id];
    if (!cue) return;
    const isFast = (cue.perSecond ?? 0) >= 10;
    if (this.live >= MAX_VOICES || (isFast && this.fast >= MAX_FAST_VOICES)) return;
    const boost = this.admit(id, cue);
    if (boost === null) return;
    const out = ctx.createGain();
    out.gain.value = cue.gain * boost;
    out.connect(master);
    const loaded = cue.files.filter((file) => this.files.has(file));
    const file = loaded[Math.floor(Math.random() * loaded.length)];
    const buffer = file ? this.files.get(file) : undefined;
    let seconds: number;
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const cents = (Math.random() * 2 - 1) * cue.detune + (options.pitch ?? 0) * 100;
      const rate = 2 ** (cents / 1200);
      source.playbackRate.value = rate;
      source.connect(out);
      source.start();
      seconds = buffer.duration / rate;
    } else {
      const voice = VOICES[cue.voice as keyof typeof VOICES];
      if (!voice) {
        out.disconnect();
        return;
      }
      seconds = voice({ ctx, out, noise, at: ctx.currentTime }, options);
    }
    this.live += 1;
    if (isFast) this.fast += 1;
    window.setTimeout(
      () => {
        this.live -= 1;
        if (isFast) this.fast -= 1;
        out.disconnect();
      },
      seconds * 1000 + 50,
    );
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    write(ENABLED_KEY, enabled ? "1" : "0");
    if (enabled) {
      // Turning it on is a gesture of its own: the sound may start now.
      this.start();
      return;
    }
    if (this.ctx) void this.ctx.suspend();
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    write(VOLUME_KEY, String(this.volume));
    if (this.master) this.master.gain.value = this.volume;
  }
}

export const sound = new Sound();

const HAPTICS_KEY = "wipeday.haptics";

/** Android vibration (iOS has no web API, so this is a no-op there). Taps never vibrate. */
export const haptics = {
  enabled: read(HAPTICS_KEY, "1") === "1",
  supported: typeof navigator !== "undefined" && typeof navigator.vibrate === "function",
  buzz(pattern: number | readonly number[]): void {
    if (!this.enabled || !this.supported) return;
    try {
      navigator.vibrate(typeof pattern === "number" ? pattern : [...pattern]);
    } catch {
      // Some browsers throw before the first user gesture: nothing to do.
    }
  },
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    write(HAPTICS_KEY, enabled ? "1" : "0");
  },
};
