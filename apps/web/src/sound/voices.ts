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

/** Frenzy: a saw arpeggio C5-E5-G5-C6 under an opening lowpass, then a shimmer. */
const frenzy: Play = (voice) => {
  const { ctx, at } = voice;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, at);
  filter.frequency.exponentialRampToValueAtTime(5000, at + 0.45);
  for (const [i, note] of [523, 659, 784, 1047].entries())
    tone(voice, "sawtooth", note, note, at + i * 0.07, 0.22, 0.09, filter);
  tone(voice, "sine", 2093, 2093, at + 0.3, 0.4, 0.06);
  return 0.7;
};

/** A crow: two hoarse "kraa"s, a square sliding down through a bandpass. */
const caw: Play = (voice) => {
  const { ctx, at } = voice;
  for (const start of [0, 0.22]) {
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1100;
    filter.Q.value = 2.5;
    tone(voice, "square", 760, 520, at + start, 0.16, 0.12, filter);
  }
  return 0.4;
};

/** A crow caught: a flap of wings, then the buy chime. */
const gullCaught: Play = (voice) => {
  noiseBurst(voice, voice.at, 0.12, 0.3, (filter) => {
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.8;
  });
  buy({ ...voice, at: voice.at + 0.08 }, {});
  return 0.25;
};

/** A badge: a sine arpeggio G5-B5-D6-G6, bell-like. */
const badge: Play = (voice) => {
  for (const [i, note] of [784, 988, 1175, 1568].entries())
    tone(voice, "sine", note, note, voice.at + i * 0.08, 0.45, 0.1);
  return 0.8;
};

// --- R4, the Big Red (D270; 03-the-big-red.md 6-9; 08-screens.md 5.2) ----------------------

/** A detuned pair of saws gliding `from` → `to` Hz over `length` s, with a crank wobble. */
function saws(
  voice: Voice,
  from: number,
  to: number,
  length: number,
  peak: number,
  attack: number,
): void {
  const { ctx, out, at } = voice;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(600, at);
  filter.frequency.exponentialRampToValueAtTime(2400, at + length);
  filter.connect(out);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.setValueAtTime(peak, at + length - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  gain.connect(filter);
  // The crank's wobble: a slow LFO on the pitch.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 6;
  const depth = ctx.createGain();
  depth.gain.value = 8;
  lfo.connect(depth);
  for (const cents of [-7, 7]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.detune.value = cents;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + length);
    depth.connect(osc.frequency);
    osc.connect(gain);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
  lfo.start(at);
  lfo.stop(at + length + 0.05);
}

/** The siren rising over the 2 s hold: two saws 180 → 760 Hz. */
const sirenRise: Play = (voice) => {
  saws(voice, 180, 760, 2.0, 0.16, 0.15);
  return 2.05;
};

/** Let go early: the siren winds down over 500 ms. */
const sirenDown: Play = (voice) => {
  saws(voice, 520, 160, 0.5, 0.12, 0.02);
  return 0.55;
};

/** The launch: the siren's clunk, a 70 Hz thump and a short metal clank. */
const launch: Play = (voice) => {
  const { at } = voice;
  tone(voice, "sine", 90, 50, at, 0.25, 0.5);
  noiseBurst(voice, at, 0.12, 0.35, (filter) => {
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 1.2;
  });
  return 0.3;
};

/** Liftoff: a roar of noise, its lowpass opening 200 Hz → 1.5 kHz over 1.8 s. */
const liftoff: Play = (voice) => {
  const { ctx, out, noise, at } = voice;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(200, at);
  filter.frequency.exponentialRampToValueAtTime(1500, at + 1.2);
  filter.frequency.exponentialRampToValueAtTime(400, at + 2.4);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.5, at + 0.25);
  gain.gain.setValueAtTime(0.5, at + 1.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(at);
  source.stop(at + 2.45);
  return 2.45;
};

/** The whistle home: a sine 1.8 kHz → 500 Hz over 700 ms. */
const whistle: Play = (voice) => {
  tone(voice, "sine", 1800, 500, voice.at, 0.7, 0.12);
  return 0.72;
};

/** The boom: low-passed noise over 1.8 s plus a 48 Hz sine over 1.2 s. */
const boom: Play = (voice) => {
  const { ctx, out, noise, at } = voice;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, at);
  filter.frequency.exponentialRampToValueAtTime(120, at + 1.8);
  const gain = envelope(ctx, at, 0.9, 0.01, 1.8);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(at);
  source.stop(at + 1.85);
  tone(voice, "sine", 48, 40, at, 1.2, 0.6);
  return 1.9;
};

/** The postcard lands: a 50 ms paper flick and a two-note rise. */
const postcard: Play = (voice) => {
  const { at } = voice;
  noiseBurst(voice, at, 0.05, 0.25, (filter) => {
    filter.type = "highpass";
    filter.frequency.value = 3000;
  });
  tone(voice, "triangle", 784, 784, at + 0.04, 0.12, 0.1);
  tone(voice, "triangle", 1047, 1047, at + 0.14, 0.2, 0.1);
  return 0.4;
};

/** The rowboat lands: two soft oar knocks and a splash of dust. */
const landing: Play = (voice) => {
  const { at } = voice;
  for (const start of [0, 0.16]) tone(voice, "sine", 320, 220, at + start, 0.1, 0.18);
  noiseBurst(voice, at + 0.3, 0.2, 0.2, (filter) => {
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.7;
  });
  return 0.55;
};

/** Steam: a hiss of highpassed noise swelling for a second. */
const steam: Play = (voice) => {
  const { ctx, out, noise, at } = voice;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2500;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.22, at + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(at, 0.2);
  source.stop(at + 1.15);
  return 1.15;
};

/** Glass: two sines, 2,093 and 3,136 Hz, decaying over half a second. */
const glass: Play = (voice) => {
  tone(voice, "sine", 2093, 2093, voice.at, 0.5, 0.08);
  tone(voice, "sine", 3136, 3136, voice.at + 0.01, 0.45, 0.05);
  return 0.55;
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
  frenzy,
  caw,
  gull_caught: gullCaught,
  badge,
  siren_rise: sirenRise,
  siren_down: sirenDown,
  launch,
  liftoff,
  whistle,
  boom,
  postcard,
  landing,
  steam,
  glass,
} satisfies Record<string, Play>;

export type VoiceId = keyof typeof VOICES;
