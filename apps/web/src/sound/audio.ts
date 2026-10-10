/**
 * The game's sound (docs/redesign/08-screens.md 5; 09-architecture.md 10.6): one AudioContext,
 * made on the first touch (iOS needs a gesture), cue → master gain → compressor → out. At most
 * 8 voices at once; `tap` at most 15 a second, faster taps raising its gain instead of stacking
 * voices. Every cue is procedural (`voices.ts`); a file at `public/sound/<cue>.ogg` replaces its
 * cue (owner decision 15). Muted means no audio work at all. Settings (S3) call `setEnabled`
 * and `setVolume`; both are kept in localStorage, on at 70% by default.
 */
import { type Cue, type CueOptions, VOICES } from "./voices";

const ENABLED_KEY = "wipeday.sound";
const VOLUME_KEY = "wipeday.volume";
const MAX_VOICES = 8;
/** The token bucket's rate: no more tap sounds than taps the server credits. */
const TAP_MIN_GAP_MS = 1000 / 15;
/** Cues an owner file may replace (R1's set). */
const FILE_CUES: readonly Cue[] = [
  "tap",
  "buy",
  "milestone",
  "fell",
  "flotsam_in",
  "flotsam_claim",
  "rally",
  "ui_open",
  "ui_close",
  "ui_toggle",
  "refuse",
];

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

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private files = new Map<Cue, AudioBuffer>();
  private live = 0;
  private lastTapMs = -1e9;
  /** Taps swallowed by the throttle since the last tap sound: they make the next one louder. */
  private swallowed = 0;
  enabled = read(ENABLED_KEY, "1") === "1";
  volume = Number(read(VOLUME_KEY, "0.7"));

  /** Creates the context on a user gesture; later calls resume it. Muted: does nothing. */
  unlock(): void {
    if (!this.enabled) return;
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

  /** Owner sound files: a cue whose `.ogg` decodes replaces the procedural voice. */
  private async loadFiles(ctx: AudioContext): Promise<void> {
    for (const cue of FILE_CUES) {
      try {
        const response = await fetch(`/sound/${cue}.ogg`);
        if (!response.ok || !response.headers.get("content-type")?.startsWith("audio")) continue;
        this.files.set(cue, await ctx.decodeAudioData(await response.arrayBuffer()));
      } catch {
        // No file, or one that does not decode: the procedural voice stays.
      }
    }
  }

  play(cue: Cue, options: CueOptions = {}): void {
    const { ctx, master, noise } = this;
    if (!this.enabled || !ctx || !master || !noise || ctx.state !== "running") return;
    let gain = 1;
    if (cue === "tap") {
      const nowMs = performance.now();
      if (nowMs - this.lastTapMs < TAP_MIN_GAP_MS) {
        this.swallowed += 1;
        return;
      }
      gain = Math.min(1.6, 1 + this.swallowed * 0.15);
      this.swallowed = 0;
      this.lastTapMs = nowMs;
    }
    if (this.live >= MAX_VOICES) return;
    const out = ctx.createGain();
    out.gain.value = gain;
    out.connect(master);
    const file = this.files.get(cue);
    let seconds: number;
    if (file) {
      const source = ctx.createBufferSource();
      source.buffer = file;
      source.connect(out);
      source.start();
      seconds = file.duration;
    } else {
      seconds = VOICES[cue]({ ctx, out, noise, at: ctx.currentTime }, options);
    }
    this.live += 1;
    window.setTimeout(
      () => {
        this.live -= 1;
        out.disconnect();
      },
      seconds * 1000 + 50,
    );
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    write(ENABLED_KEY, enabled ? "1" : "0");
    if (!this.ctx) return;
    if (enabled) void this.ctx.resume();
    else void this.ctx.suspend();
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
  buzz(pattern: number | number[]): void {
    if (!this.enabled || !this.supported) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers throw before the first user gesture: nothing to do.
    }
  },
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    write(HAPTICS_KEY, enabled ? "1" : "0");
  },
};

/** The vibration patterns (08-screens.md 5.4), in ms. */
export const BUZZ = {
  fell: 20,
  milestone: [15, 40, 15],
  era: [30, 50, 30],
  flotsam: 15,
} as const;
