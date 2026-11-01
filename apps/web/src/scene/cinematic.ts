/**
 * The launch (docs/redesign/03-the-big-red.md 7; D270): one pure function of the variant, the
 * seed and the milliseconds since the hold ended, so every frame can be pinned for a shot and
 * nothing in it reads a clock or `Math.random`. `frameAt` says where the Kettle is, what glows,
 * how much the camera shakes, which tint lies over the island, where the cloud's puffs are and
 * whether the island has become the crater; the scene (`Scene.ts`) draws it, on the `wall`
 * clock only (rule 6.3.9), and the HUD reads `flash` and `phase`.
 *
 * Coordinates are world (stage) units: the pad `P` is the Kettle's feet, the base `B` the impact
 * point (the target's foot), `view` what the camera shows, so the arc over the "sea" stays on a
 * phone's screen. The camera keeps its whole-pixel zoom (D188): the flight is designed inside
 * the view instead of the plan's camera ease-out.
 */
import { clamp, easeInOutSine, easeOutBack, easeOutCubic, hash, lerp } from "./util";

export type Variant = "u_turn" | "loop_the_loop" | "sputter_drop" | "fizzle";
export const VARIANTS: readonly Variant[] = ["u_turn", "loop_the_loop", "sputter_drop", "fizzle"];

/** Impact `I` per variant (ms). */
export const IMPACT: Record<Variant, number> = {
  u_turn: 4100,
  loop_the_loop: 4300,
  sputter_drop: 3000,
  fizzle: 2600,
};

/** Liftoff: the pad shudders from 900 and the Kettle leaves it at 1,400 ms. */
const IGNITE_MS = 900;
const LIFTOFF_MS = 1400;
/** After impact: the postcard slides up at I + POSTCARD_MS; the film is over at I + END_MS. */
const POSTCARD_MS = 2700;
const END_MS = 2700;
/** Skip jumps here (03 7.4). */
const SKIP_TO_MS = 2600;
/** Reduced motion (03 7.4): 2.5 s of cross-faded stills. */
export const REDUCED_MS = 2500;

export type PhaseId =
  | "scramble"
  | "ignite"
  | "liftoff"
  | "flight"
  | "whistle"
  | "flash"
  | "fireball"
  | "cloud"
  | "settle";

/** The named phases (03 7.5): where each begins, for pins. */
export function phases(variant: Variant): Record<PhaseId, number> {
  const impact = IMPACT[variant];
  return {
    scramble: 600,
    ignite: 1100,
    liftoff: 1500,
    flight: Math.min(2800, impact - 800),
    whistle: impact - 400,
    flash: impact + 40,
    fireball: impact + 400,
    cloud: impact + 1400,
    settle: impact + 2500,
  };
}

/** When the film is over (the postcard is up), for the scene to hand back to the HUD. */
export const filmLength = (variant: Variant, reduced: boolean): number =>
  reduced ? REDUCED_MS : IMPACT[variant] + END_MS;

/** Where Skip jumps to. */
export const skipTo = (variant: Variant): number => IMPACT[variant] + SKIP_TO_MS;

export interface Point {
  x: number;
  y: number;
}

export interface Geometry {
  /** The Kettle's feet. */
  pad: Point;
  /** The impact point: the target's foot. */
  base: Point;
  /** What the camera shows (world units). */
  view: { left: number; right: number; top: number; bottom: number };
}

export interface Puff {
  x: number;
  y: number;
  /** Radius (world units). */
  r: number;
  alpha: number;
  /** 0 white, 1 the hot orange, 2 the cold grey: the scene lerps the colours. */
  heat: number;
}

export type Crew = "look" | "scramble" | "rowing" | "duck" | "wave";

export interface Frame {
  ms: number;
  phase: PhaseId;
  /** The Kettle: where its feet are, its lean, whether it still exists. */
  kettle: { x: number; y: number; rotation: number; visible: boolean; alpha: number };
  /** The pad shudders by this much (±units) while igniting. */
  shudder: number;
  /** The exhaust glow under the Kettle (0..1) and whether the smoke trail runs. */
  exhaust: number;
  smoke: boolean;
  /** Three sputter coughs before liftoff: true on the frames a puff is due. */
  cough: boolean;
  /** The CSS flash's opacity. */
  flash: number;
  fireball: { r: number; alpha: number } | null;
  shock: { r: number; alpha: number } | null;
  /** Camera offset (world units) and the zoom punch (1 = none). */
  shake: Point;
  punch: number;
  /** Tints over the ambient: burnt orange, ash, then the afterglow green. */
  burnt: number;
  ash: number;
  green: number;
  /** The mushroom cloud's puffs, or null before and long after it. */
  cloud: { stem: Puff[]; cap: Puff[]; glow: number } | null;
  /** Dust puffs along the ground at the shockwave (count due this frame). */
  dust: number;
  /** The island has become the crater (the props are gone). */
  crater: boolean;
  /** The sign's drop: 0 hidden, 1 landed (a bounce in between); a small blast never shows it. */
  sign: number;
  /** A gull has landed on the sign. */
  gull: boolean;
  /** Ash falling (0..1): the weather's `ash` amount. */
  ashFall: number;
  crew: Crew;
  /** The postcard may slide up. */
  postcard: boolean;
  done: boolean;
}

/** Position along a quadratic curve from `a` over `c` to `b`. */
function bezier(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

/** The lean along a curve: the direction of travel, nose first (0 = nose up). */
function heading(from: Point, to: Point): number {
  return Math.atan2(to.x - from.x, -(to.y - from.y));
}

/** The point at `t` along a curve and its lean, read from a step just behind it. */
function along(
  a: Point,
  c: Point,
  b: Point,
  t: number,
): { x: number; y: number; rotation: number } {
  const k = clamp(t, 0, 1);
  const at = bezier(a, c, b, k);
  const behind = bezier(a, c, b, Math.max(0, k - 0.03));
  const ahead = bezier(a, c, b, Math.min(1, k + 0.03));
  return { ...at, rotation: heading(behind, ahead) };
}

/** The flight from liftoff to impact: the Kettle's feet and its lean at `ms`. */
function flight(
  variant: Variant,
  ms: number,
  geometry: Geometry,
): { x: number; y: number; rotation: number; exhaust: number; smoke: boolean; crew: Crew } {
  const { pad: P, base: B, view } = geometry;
  const impact = IMPACT[variant];
  const width = view.right - view.left;
  const height = view.bottom - view.top;
  const step = (from: number, to: number) => clamp((ms - from) / (to - from), 0, 1);
  if (variant === "u_turn") {
    // Up and left over the sea to the apex, a hover and a shrug, the turn, then home.
    const apex = { x: view.left + width * 0.16, y: view.top + height * 0.22 };
    // The control sits below the apex, so it arrives still climbing, nose up and left.
    const climbCtrl = { x: P.x - width * 0.1, y: apex.y + height * 0.3 };
    if (ms < 2900) {
      const t = easeOutCubic(step(LIFTOFF_MS, 2900));
      return { ...along(P, climbCtrl, apex, t), exhaust: 1, smoke: true, crew: "rowing" };
    }
    if (ms < 3200) {
      // The hover: a bob and a shrug (a wag of the nose).
      const t = step(2900, 3200);
      const bob = Math.sin(t * Math.PI * 2) * 6;
      return {
        x: apex.x,
        y: apex.y + bob,
        rotation: -0.35 + Math.sin(t * Math.PI * 3) * 0.12,
        exhaust: 0.4,
        smoke: false,
        crew: "rowing",
      };
    }
    if (ms < 3400) {
      // It turns toward home.
      const t = easeInOutSine(step(3200, 3400));
      return {
        x: apex.x,
        y: apex.y,
        rotation: lerp(-0.35, 2.4, t),
        exhaust: 0.6,
        smoke: true,
        crew: "duck",
      };
    }
    // The whistle home, nose first, speeding up.
    const t = step(3400, impact);
    const k = t * t;
    const ctrl = { x: (apex.x + B.x) / 2, y: apex.y - height * 0.05 };
    return { ...along(apex, ctrl, B, k), exhaust: 1, smoke: true, crew: "duck" };
  }
  if (variant === "loop_the_loop") {
    // Up over the sea, one full loop, then home.
    const entry = { x: view.left + width * 0.3, y: view.top + height * 0.45 };
    const radius = Math.min(110, height * 0.2);
    const centre = { x: entry.x, y: entry.y - radius };
    if (ms < 2300) {
      const t = easeOutCubic(step(LIFTOFF_MS, 2300));
      const ctrl = { x: P.x - width * 0.05, y: entry.y + height * 0.1 };
      return { ...along(P, ctrl, entry, t), exhaust: 1, smoke: true, crew: "rowing" };
    }
    if (ms < 3500) {
      // The loop: a full turn from the bottom, anticlockwise (up the right side first).
      const t = easeInOutSine(step(2300, 3500));
      const angle = Math.PI / 2 - t * Math.PI * 2;
      const at = { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius };
      const tangent = { x: at.x - Math.sin(angle), y: at.y + Math.cos(angle) };
      return {
        ...at,
        rotation: heading(at, tangent),
        exhaust: 1,
        smoke: true,
        crew: "rowing",
      };
    }
    const t = step(3500, impact);
    const k = t * t;
    const ctrl = { x: (entry.x + B.x) / 2, y: entry.y - height * 0.15 };
    return { ...along(entry, ctrl, B, k), exhaust: 1, smoke: true, crew: "duck" };
  }
  if (variant === "sputter_drop") {
    // It rises a little, coughs, the engine dies, it tips and drops onto the base.
    const top = { x: P.x + 20, y: P.y - 60 };
    if (ms < 2000) {
      const t = easeOutCubic(step(LIFTOFF_MS, 2000));
      const wobble = Math.sin(ms / 40) * 3 * (1 - t);
      return {
        x: lerp(P.x, top.x, t) + wobble,
        y: lerp(P.y, top.y, t),
        rotation: Math.sin(ms / 90) * 0.08,
        exhaust: 1,
        smoke: true,
        crew: "rowing",
      };
    }
    if (ms < 2300) {
      // Coughs: the exhaust stutters.
      const t = step(2000, 2300);
      const on = Math.floor(t * 6) % 2 === 0;
      return {
        x: top.x,
        y: top.y + Math.sin(t * Math.PI * 4) * 2,
        rotation: 0.05,
        exhaust: on ? 0.8 : 0.1,
        smoke: on,
        crew: "rowing",
      };
    }
    if (ms < 2600) {
      // The engine dies; it tips toward the base.
      const t = easeInOutSine(step(2300, 2600));
      return {
        x: top.x + t * 10,
        y: top.y + t * 4,
        rotation: lerp(0.05, 0.9, t),
        exhaust: lerp(0.1, 0, t),
        smoke: false,
        crew: "duck",
      };
    }
    const t = step(2600, impact);
    const k = t * t;
    const from = { x: top.x + 10, y: top.y + 4 };
    return {
      x: lerp(from.x, B.x, k),
      y: lerp(from.y, B.y, k),
      rotation: lerp(0.9, 2.2, k),
      exhaust: 0,
      smoke: false,
      crew: "duck",
    };
  }
  // Fizzle: the frame hops off the pad, flops over, and goes off where it lands.
  const hop = { x: P.x + 24, y: P.y - 40 };
  if (ms < 1900) {
    const t = step(LIFTOFF_MS, 1900);
    const up = Math.sin(t * Math.PI);
    return {
      x: lerp(P.x, hop.x, t),
      y: P.y - up * 40,
      rotation: lerp(0, 0.5, t),
      exhaust: 0.6 * (1 - t),
      smoke: t < 0.6,
      crew: "look",
    };
  }
  if (ms < 2300) {
    // The flop: over onto its side.
    const t = easeOutBack(step(1900, 2300));
    return {
      x: hop.x + t * 14,
      y: P.y,
      rotation: lerp(0.5, Math.PI / 2, t),
      exhaust: 0,
      smoke: false,
      crew: "look",
    };
  }
  return { x: hop.x + 14, y: P.y, rotation: Math.PI / 2, exhaust: 0, smoke: false, crew: "duck" };
}

/** The mushroom cloud at `t` (0 at I+400, 1 at I+2600): 10 stem and 18 cap puffs from the seed. */
function cloudAt(seed: number, t: number, base: Point, scale: number, small: boolean) {
  const rise = easeOutCubic(t);
  // World units: 1 art px is 5, so the cloud stands about 90 art px tall on a Wipe Day.
  const height = (small ? 120 : 450) * scale;
  const stem: Puff[] = [];
  const cap: Puff[] = [];
  const stemCount = small ? 4 : 10;
  const capCount = small ? 6 : 18;
  for (let i = 0; i < stemCount; i++) {
    const h = hash(seed * 7.1 + i * 3.3);
    const along = (i + 0.5) / stemCount;
    if (along > rise + 0.08) continue;
    stem.push({
      x: base.x + (h - 0.5) * 60 * scale,
      y: base.y - along * height * 0.85,
      r: (60 + hash(seed + i * 1.7) * 30 + along * 30) * scale,
      alpha: 0.85 * clamp((rise + 0.08 - along) * 6, 0, 1),
      heat: clamp(t * 2.2 - along * 0.6, 0, 2),
    });
  }
  const spread = easeOutCubic(clamp((t - 0.25) / 0.75, 0, 1));
  for (let i = 0; i < capCount; i++) {
    const a = (i / capCount) * Math.PI * 2 + hash(seed * 2.3 + i) * 0.4;
    const rr = (0.55 + hash(seed * 5.9 + i * 2.1) * 0.45) * (small ? 70 : 260) * scale * spread;
    cap.push({
      x: base.x + Math.cos(a) * rr,
      y: base.y - height * rise + Math.sin(a) * rr * 0.45 - 10 * scale,
      r: (80 + hash(seed + i * 9.7) * 60) * scale * (0.6 + spread * 0.4),
      alpha: 0.9 * clamp((t - 0.2) * 5, 0, 1),
      heat: clamp(t * 2.4 - 0.2, 0, 2),
    });
  }
  return { stem, cap, glow: clamp(1 - t * 1.3, 0, 1) };
}

/** A seeded shake direction (unit-ish) for the impact. */
function shakeDir(seed: number, ms: number): Point {
  const k = Math.floor(ms / 33);
  return { x: hash(seed + k * 1.3) * 2 - 1, y: hash(seed * 1.7 + k * 2.9) * 2 - 1 };
}

const EMPTY_SHAKE: Point = { x: 0, y: 0 };

/** The sign's drop with its bounce; exactly 0 before it starts (the ease's float noise clipped). */
const dropEase = (p: number): number => {
  const eased = easeOutBack(p);
  return eased < 1e-6 ? 0 : eased;
};

/** The frame at `ms` since the hold ended. Pure: the same inputs give the same frame. */
export function frameAt(
  variant: Variant,
  seed: number,
  ms: number,
  geometry: Geometry,
  options: { reduced?: boolean; wipeDay?: boolean; zoom?: number } = {},
): Frame {
  const reduced = options.reduced === true;
  const wipeDay = options.wipeDay !== false;
  const scale = options.zoom ?? 1;
  const small = variant === "fizzle";
  const { pad: P, base: B } = geometry;
  const impact = IMPACT[variant];
  const names = phases(variant);
  const frame: Frame = {
    ms,
    phase: "scramble",
    kettle: { x: P.x, y: P.y, rotation: 0, visible: true, alpha: 1 },
    shudder: 0,
    exhaust: 0,
    smoke: false,
    cough: false,
    flash: 0,
    fireball: null,
    shock: null,
    shake: EMPTY_SHAKE,
    punch: 1,
    burnt: 0,
    ash: 0,
    green: 0,
    cloud: null,
    dust: 0,
    crater: false,
    sign: 0,
    gull: false,
    ashFall: 0,
    crew: "look",
    postcard: false,
    done: false,
  };

  if (reduced) {
    // 03 7.4: the scene darkens to burnt orange with the Kettle still mid-air, cross-fades to
    // the crater, the sign and a still cloud, then the postcard. No shake, no flash.
    const apex = flight(variant, small ? 1800 : 2600, geometry);
    frame.kettle = { x: apex.x, y: apex.y, rotation: apex.rotation, visible: true, alpha: 1 };
    frame.burnt = easeInOutSine(clamp(ms / 600, 0, 1));
    const fade = clamp((ms - 600) / 1200, 0, 1);
    frame.kettle.alpha = 1 - fade;
    frame.kettle.visible = fade < 1;
    frame.crater = ms >= 600;
    frame.cloud = ms >= 600 ? cloudAt(seed, 0.85, B, scale, small) : null;
    if (frame.cloud) {
      for (const puff of [...frame.cloud.stem, ...frame.cloud.cap]) puff.alpha *= fade;
      frame.cloud.glow = 0;
    }
    frame.sign = wipeDay && !small ? dropEase(clamp((ms - 1200) / 300, 0, 1)) : 0;
    frame.gull = frame.sign >= 1 && ms >= 1800;
    frame.ash = fade;
    frame.ashFall = fade;
    frame.green = clamp((ms - 1500) / 1000, 0, 1) * 0.5;
    frame.crew = ms < 600 ? "look" : "wave";
    frame.phase = ms < 600 ? "scramble" : ms < 1800 ? "cloud" : "settle";
    frame.postcard = ms >= REDUCED_MS - 100;
    frame.done = ms >= REDUCED_MS;
    return frame;
  }

  // The phase name: the last one begun.
  for (const [id, at] of Object.entries(names) as [PhaseId, number][])
    if (ms >= at) frame.phase = id;

  if (ms < impact) {
    if (ms < IGNITE_MS) {
      frame.crew = ms < 300 ? "look" : "scramble";
    } else if (ms < LIFTOFF_MS) {
      // Ignition: a shudder and three coughs at 950, 1,100 and 1,250.
      frame.shudder = Math.sin(ms / 12) * 2;
      frame.cough = [950, 1100, 1250].some((at) => ms >= at && ms < at + 34);
      frame.exhaust = 0.3 + (frame.cough ? 0.5 : 0);
      frame.crew = "rowing";
    } else {
      const f = flight(variant, ms, geometry);
      frame.kettle = { x: f.x, y: f.y, rotation: f.rotation, visible: true, alpha: 1 };
      frame.exhaust = f.exhaust;
      frame.smoke = f.smoke;
      frame.crew = f.crew;
    }
    return frame;
  }

  // Impact and after: the Kettle holds its last flight point until the flash swallows it.
  const since = ms - impact;
  const last = flight(variant, impact - 1, geometry);
  frame.kettle = { x: last.x, y: last.y, rotation: last.rotation, visible: true, alpha: 1 };
  frame.crew = since < 2200 ? "duck" : "wave";
  const flashIn = small ? 0.5 : 1;
  frame.flash =
    since < 80
      ? (since / 80) * flashIn
      : since < 140
        ? flashIn
        : Math.max(0, flashIn * (1 - (since - 140) / 600));
  frame.crater = since >= 80;
  frame.kettle.visible = since < 80;
  if (since >= 80) {
    const t = clamp((since - 80) / 1220, 0, 1);
    const grow = small ? 0.35 : 1;
    frame.fireball = { r: lerp(60, 520, easeOutCubic(t)) * scale * grow, alpha: (1 - t) * 0.95 };
    const s = clamp((since - 80) / 720, 0, 1);
    frame.shock = { r: lerp(40, 900, easeOutCubic(s)) * scale * grow, alpha: 0.8 * (1 - s) };
    frame.dust = s < 0.5 ? (Math.floor(since / 33) % 2 === 0 ? 2 : 0) * (small ? 0 : 1) : 0;
    const shakeT = clamp((since - 80) / 920, 0, 1);
    const amp = 18 * Math.exp(-(since - 80) / 250) * (small ? 0.5 : 1);
    const dir = shakeDir(seed, since);
    frame.shake = shakeT < 1 ? { x: dir.x * amp, y: dir.y * amp } : EMPTY_SHAKE;
    const punchT = clamp((since - 80) / 300, 0, 1);
    frame.punch = small ? 1 : 1 + Math.sin(punchT * Math.PI) * 0.04;
  }
  // Tints: burnt orange at once, fading over 3 s; ash from I+1,200; the green from I+2,000.
  frame.burnt = since >= 80 ? clamp(1 - (since - 80) / 2920, 0, 1) * (small ? 0.5 : 1) : 0;
  frame.ash = clamp((since - 1200) / 800, 0, 1) * (small ? 0.4 : 1);
  frame.green = clamp((since - 2000) / 700, 0, 1) * 0.5;
  if (since >= 400) {
    const t = clamp((since - 400) / 2200, 0, 1);
    frame.cloud = cloudAt(seed, t, B, scale, small);
    // It thins once the postcard is up (the landing clears it).
    const thin = clamp((since - 2600) / 1400, 0, 1);
    if (thin > 0)
      for (const puff of [...frame.cloud.stem, ...frame.cloud.cap]) puff.alpha *= 1 - thin;
  }
  frame.ashFall = clamp((since - 1800) / 800, 0, 1);
  if (wipeDay && !small) {
    frame.sign = dropEase(clamp((since - 2300) / 300, 0, 1));
    frame.gull = since >= 2500;
  }
  frame.postcard = since >= POSTCARD_MS;
  frame.done = since >= END_MS;
  return frame;
}
