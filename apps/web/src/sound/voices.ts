/**
 * The procedural voices (docs/redesign/08-screens.md 5.2): small functions of oscillators,
 * noise and envelopes, each returning how long it sounds. A cue in `data/sounds.json5` names
 * one as its `voice`: it plays until the cue's files have decoded, or alone for a cue with none
 * (the hire's whistle, the era's rise). Later phases add theirs with their features.
 */

export interface CueOptions {
  /** The era's target id (tree, stone, ore, sulfur, wreck): tap and fell sound like it. */
  target?: string;
  /** Hustle 0..1: the tap rises up to 4 semitones. */
  hustle?: number;
  /** A bulk purchase adds a third note. */
  bulk?: boolean;
  /** Semitones up (files only: a voice pitches itself from `hustle`). */
  pitch?: number;
}

export interface Voice {
  ctx: AudioContext;
  out: AudioNode;
  noise: AudioBuffer;
  at: number;
}

type Play = (voice: Voice, options: CueOptions) => number;

/** A gain envelope: attack to `peak`, then an exponential fall to silence by `end`. */
function envelope(
  ctx: AudioContext,
  at: number,
  peak: number,
  attack: number,
  end: number,
): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + end);
  return gain;
}

function tone(
  { ctx, out }: Voice,
  type: OscillatorType,
  from: number,
  to: number,
  at: number,
  length: number,
  peak: number,
  filter?: BiquadFilterNode,
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + length);
  const gain = envelope(ctx, at, peak, 0.005, length);
  osc.connect(gain);
  gain.connect(filter ?? out);
  if (filter) filter.connect(out);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

function noiseBurst(
  { ctx, out, noise }: Voice,
  at: number,
  length: number,
  peak: number,
  shape: (filter: BiquadFilterNode) => void,
): void {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.playbackRate.value = 0.8 + Math.random() * 0.4;
  const filter = ctx.createBiquadFilter();
  shape(filter);
  const gain = envelope(ctx, at, peak, 0.003, length);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(at, Math.random() * 0.5);
  source.stop(at + length + 0.02);
}

/** Per target: the bandpass a tap goes through, and an extra ping for the ore. */
const TAP_HZ: Record<string, number> = {
  tree: 700,
  stone: 1600,
  ore: 2400,
  sulfur: 500,
  wreck: 3000,
};

const tap: Play = (voice, { target = "tree", hustle = 0 }) => {
  const semitones = hustle * 4 + (Math.random() - 0.5) * 0.5;
  const pitch = 2 ** (semitones / 12);
  const hz = (TAP_HZ[target] ?? 700) * pitch;
  noiseBurst(voice, voice.at, 0.05, target === "sulfur" ? 0.5 : 0.7, (filter) => {
    filter.type = "bandpass";
    filter.frequency.value = hz;
    filter.Q.value = target === "sulfur" ? 0.8 : 2.2;
  });
  if (target === "ore") tone(voice, "triangle", 1200 * pitch, 1200 * pitch, voice.at, 0.08, 0.12);
  if (target === "wreck") tone(voice, "square", 1800 * pitch, 1500 * pitch, voice.at, 0.05, 0.05);
  return 0.1;
};

const buy: Play = (voice, { bulk = false }) => {
  const { ctx, at } = voice;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3500;
  tone(voice, "square", 880, 880, at, 0.035, 0.12, filter);
  tone(voice, "square", 1320, 1320, at + 0.035, 0.06, 0.12, filter);
  if (bulk) tone(voice, "square", 1760, 1760, at + 0.095, 0.06, 0.1, filter);
  return bulk ? 0.17 : 0.11;
};

const milestone: Play = (voice) => {
  const { at } = voice;
  for (const [i, hz] of [523, 659, 784].entries())
    tone(voice, "triangle", hz, hz, at + i * 0.06, 0.18, 0.22);
  noiseBurst(voice, at + 0.12, 0.3, 0.05, (filter) => {
    filter.type = "highpass";
    filter.frequency.value = 6000;
  });
  return 0.45;
};

const fell: Play = (voice, { target = "tree" }) => {
  const { ctx, at } = voice;
  switch (target) {
    case "stone": {
      noiseBurst(voice, at, 0.45, 0.6, (filter) => {
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(3000, at);
        filter.frequency.exponentialRampToValueAtTime(300, at + 0.4);
      });
      tone(voice, "sine", 70, 50, at, 0.25, 0.5);
      return 0.5;
    }
    case "ore": {
      for (const [i, hz] of [1047, 2637, 3951].entries())
        tone(voice, "sine", hz, hz, at, 0.9 - i * 0.2, 0.18);
      tone(voice, "sine", 70, 50, at, 0.2, 0.3);
      return 0.95;
    }
    case "sulfur": {
      tone(voice, "sine", 300, 900, at, 0.08, 0.5);
      noiseBurst(voice, at + 0.02, 0.35, 0.25, (filter) => {
        filter.type = "bandpass";
        filter.frequency.value = 500;
        filter.Q.value = 0.7;
      });
      return 0.4;
    }
    case "wreck": {
      for (const hz of [220, 563, 891]) tone(voice, "triangle", hz, hz * 0.97, at, 0.7, 0.16);
      noiseBurst(voice, at, 0.15, 0.4, (filter) => {
        filter.type = "highpass";
        filter.frequency.value = 2500;
      });
      return 0.75;
    }
    default: {
      // The pine: a creak as it tips, then the thump of it landing.
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      tone(voice, "sawtooth", 180, 90, at, 0.3, 0.14, filter);
      tone(voice, "sine", 70, 45, at + 0.3, 0.35, 0.7);
      noiseBurst(voice, at + 0.3, 0.3, 0.3, (f) => {
        f.type = "lowpass";
        f.frequency.value = 800;
      });
      return 0.7;
    }
  }
};

/** Something washes up: a soft bell, panned toward the sea on the left (08-screens.md 5.2). */
const flotsamIn: Play = (voice) => {
  const { ctx, out, at } = voice;
  const pan = ctx.createStereoPanner();
  pan.pan.value = -0.6;
  pan.connect(out);
  const bell: Voice = { ...voice, out: pan };
  tone(bell, "sine", 1568, 1568, at, 1.2, 0.16);
  tone(bell, "sine", 3136, 3136, at, 0.4, 0.04);
  return 1.2;
};

/** Caught: a splash, then the buy chime. */
const flotsamClaim: Play = (voice) => {
  noiseBurst(voice, voice.at, 0.2, 0.35, (filter) => {
    filter.type = "bandpass";
    filter.frequency.value = 1500;
    filter.Q.value = 0.9;
  });
  buy({ ...voice, at: voice.at + 0.06 }, {});
  return 0.25;
};

/** Rally starts: a saw revving up from 80 to 160 Hz with a tremolo. */
const rally: Play = (voice) => {
  const { ctx, out, at } = voice;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1200;
  const tremolo = ctx.createGain();
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = 8;
  depth.gain.value = 0.5;
  lfo.connect(depth);
  depth.connect(tremolo.gain);
  filter.connect(tremolo);
  tremolo.connect(out);
  tone({ ...voice, out: filter }, "sawtooth", 80, 160, at, 0.6, 0.22);
  lfo.start(at);
  lfo.stop(at + 0.65);
  return 0.65;
};

const sweep =
  (up: boolean): Play =>
  (voice) => {
    const { at } = voice;
    noiseBurst(voice, at, 0.08, 0.04, (filter) => {
      filter.type = "highpass";
      filter.frequency.setValueAtTime(up ? 1500 : 5000, at);
      filter.frequency.exponentialRampToValueAtTime(up ? 5000 : 1500, at + 0.08);
    });
    return 0.1;
  };

const toggle: Play = (voice) => {
  tone(voice, "square", 2000, 2000, voice.at, 0.012, 0.05);
  return 0.03;
};

const refuse: Play = (voice) => {
  const filter = voice.ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 600;
  tone(voice, "square", 180, 180, voice.at, 0.09, 0.2, filter);
  return 0.11;
};

/** A crit: the tap, then a bright 2.6 kHz ping. */
const crit: Play = (voice, options) => {
  tap(voice, options);
  tone(voice, "sine", 2637, 2637, voice.at + 0.01, 0.12, 0.16);
  return 0.14;
};

/** A hire: a two-note whistle, a sine gliding 1,200 → 1,500 Hz, twice. */
const hand: Play = (voice) => {
  const { at } = voice;
  tone(voice, "sine", 1200, 1500, at, 0.16, 0.14);
  tone(voice, "sine", 1200, 1500, at + 0.2, 0.18, 0.14);
  return 0.4;
};

/** An era: two detuned saws G4 → C5 under a lowpass opening 400 Hz → 3 kHz, then a thump. */
const era: Play = (voice) => {
  const { ctx, at } = voice;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(400, at);
  filter.frequency.exponentialRampToValueAtTime(3000, at + 0.6);
  for (const detune of [0.997, 1.003]) {
    tone(voice, "sawtooth", 392 * detune, 392 * detune, at, 0.3, 0.08, filter);
    tone(voice, "sawtooth", 523 * detune, 523 * detune, at + 0.3, 0.5, 0.09, filter);
  }
  tone(voice, "sine", 70, 45, at + 0.3, 0.35, 0.5);
  return 0.85;
};

export const VOICES = {
  tap,
  buy,
  milestone,
  fell,
  flotsam_in: flotsamIn,
  flotsam_claim: flotsamClaim,
  rally,
  ui_open: sweep(true),
  ui_close: sweep(false),
  ui_toggle: toggle,
  refuse,
  crit,
  hand,
  era,
} satisfies Record<string, Play>;

export type VoiceId = keyof typeof VOICES;
