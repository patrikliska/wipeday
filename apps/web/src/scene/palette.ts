/**
 * The look, in one place: the time-of-day keyframes every layer samples, and
 * the material colours of each base tier. Numbers are 0xRRGGBB.
 */
import type { Tier } from "../state/world";
import { clamp, lerp, lerpColor } from "./util";

export interface Palette {
  skyTop: number;
  skyMid: number;
  skyHorizon: number;
  /** The world is multiplied by this: white by day, deep blue at night. */
  ambient: number;
  /** Colour of the haze that distant layers blend toward. */
  haze: number;
  sun: number;
  sunGlow: number;
  cloud: number;
  seaDeep: number;
  seaShallow: number;
  /** 0 at midnight, 1 at noon. */
  light: number;
  stars: number;
}

interface Keyframe extends Palette {
  at: number;
}

const NIGHT: Omit<Keyframe, "at"> = {
  skyTop: 0x05081a,
  skyMid: 0x0d1636,
  skyHorizon: 0x1b2a55,
  ambient: 0x4a5a8a,
  haze: 0x16224a,
  sun: 0xe8ecff,
  sunGlow: 0x8ea2ff,
  cloud: 0x30406a,
  seaDeep: 0x0a1a33,
  seaShallow: 0x1c3a5f,
  light: 0.05,
  stars: 1,
};

const DAY: Omit<Keyframe, "at"> = {
  skyTop: 0x4c93d6,
  skyMid: 0x8dc3ea,
  skyHorizon: 0xd6ebf5,
  ambient: 0xffffff,
  haze: 0xa9cde3,
  sun: 0xfff3d0,
  sunGlow: 0xffe2a0,
  cloud: 0xffffff,
  seaDeep: 0x1e5c86,
  seaShallow: 0x5faccf,
  light: 1,
  stars: 0,
};

const KEYFRAMES: Keyframe[] = [
  { at: 0.0, ...NIGHT },
  {
    at: 0.2,
    skyTop: 0x14163a,
    skyMid: 0x3a2b5c,
    skyHorizon: 0x7a4a5f,
    ambient: 0x66668c,
    haze: 0x4a3b64,
    sun: 0xffd9a8,
    sunGlow: 0xff9d6b,
    cloud: 0x6a4f75,
    seaDeep: 0x14263f,
    seaShallow: 0x36527a,
    light: 0.25,
    stars: 0.6,
  },
  {
    at: 0.27,
    skyTop: 0x3d4f87,
    skyMid: 0xc17a6a,
    skyHorizon: 0xf3b27a,
    ambient: 0xa08c96,
    haze: 0xb98a86,
    sun: 0xffd08a,
    sunGlow: 0xff8f5a,
    cloud: 0xe1a48f,
    seaDeep: 0x2a4a6a,
    seaShallow: 0x6b8fb0,
    light: 0.6,
    stars: 0.1,
  },
  { at: 0.4, ...DAY },
  { at: 0.6, ...DAY, skyTop: 0x4a8fd0, skyMid: 0x8cbfe8, skyHorizon: 0xd9e9f2 },
  {
    at: 0.74,
    skyTop: 0x3a4f8a,
    skyMid: 0xc76b57,
    skyHorizon: 0xffa25c,
    ambient: 0xb9948e,
    haze: 0xc98b74,
    sun: 0xffb765,
    sunGlow: 0xff6f3c,
    cloud: 0xf0946d,
    seaDeep: 0x2a4066,
    seaShallow: 0x8a6f7e,
    light: 0.6,
    stars: 0.05,
  },
  {
    at: 0.82,
    skyTop: 0x14163a,
    skyMid: 0x3a2b5c,
    skyHorizon: 0x6f4560,
    ambient: 0x6a6a90,
    haze: 0x453a66,
    sun: 0xffc48a,
    sunGlow: 0xd86a4a,
    cloud: 0x5f4a72,
    seaDeep: 0x14263f,
    seaShallow: 0x36527a,
    light: 0.25,
    stars: 0.6,
  },
  { at: 0.9, ...NIGHT },
  { at: 1.0, ...NIGHT },
];

const COLOR_KEYS = [
  "skyTop",
  "skyMid",
  "skyHorizon",
  "ambient",
  "haze",
  "sun",
  "sunGlow",
  "cloud",
  "seaDeep",
  "seaShallow",
] as const;

/** The palette at a fraction of the day (0 midnight, 0.5 noon). */
export function paletteAt(fraction: number): Palette {
  const f = ((fraction % 1) + 1) % 1;
  let a = KEYFRAMES[0];
  let b = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const from = KEYFRAMES[i];
    const to = KEYFRAMES[i + 1];
    if (from && to && f >= from.at && f <= to.at) {
      a = from;
      b = to;
      break;
    }
  }
  if (!a || !b) throw new Error("palette keyframes missing");
  const span = b.at - a.at;
  const t = span <= 0 ? 0 : (f - a.at) / span;
  const out = {} as Palette;
  for (const key of COLOR_KEYS) out[key] = lerpColor(a[key], b[key], t);
  out.light = lerp(a.light, b.light, t);
  out.stars = lerp(a.stars, b.stars, t);
  return out;
}

/** Greys the palette for rain and fog; 0 leaves it untouched. */
export function gloom(palette: Palette, amount: number): Palette {
  const t = clamp(amount, 0, 1);
  if (t <= 0) return palette;
  return {
    ...palette,
    skyTop: lerpColor(palette.skyTop, 0x5a6472, t * 0.7),
    skyMid: lerpColor(palette.skyMid, 0x7d8894, t * 0.7),
    skyHorizon: lerpColor(palette.skyHorizon, 0x9aa3ab, t * 0.7),
    haze: lerpColor(palette.haze, 0x8a939c, t * 0.6),
    cloud: lerpColor(palette.cloud, 0x6f7883, t * 0.7),
    seaDeep: lerpColor(palette.seaDeep, 0x2f3f4c, t * 0.5),
    seaShallow: lerpColor(palette.seaShallow, 0x55697a, t * 0.5),
    ambient: lerpColor(palette.ambient, 0x8a919c, t * 0.5),
    light: palette.light * (1 - t * 0.35),
  };
}

export interface Material {
  wall: number;
  wallDark: number;
  roof: number;
  roofDark: number;
  trim: number;
  accent: number;
}

/** Wall, roof and trim colours per base tier; one identity colour each, as on the cards. */
export const MATERIALS: Record<Tier, Material> = {
  twig: {
    wall: 0xc9b070,
    wallDark: 0x9c8752,
    roof: 0xb59a5a,
    roofDark: 0x8a7343,
    trim: 0x6f5a33,
    accent: 0xc2a868,
  },
  wood: {
    wall: 0xa06a36,
    wallDark: 0x7a4f27,
    roof: 0x6b4423,
    roofDark: 0x4d2f17,
    trim: 0x3f2a16,
    accent: 0xb07840,
  },
  stone: {
    wall: 0x8e949a,
    wallDark: 0x6a7076,
    roof: 0x5d6368,
    roofDark: 0x424749,
    trim: 0x33383c,
    accent: 0x9aa0a6,
  },
  metal: {
    wall: 0x5f7f9c,
    wallDark: 0x46607a,
    roof: 0x3f5266,
    roofDark: 0x2c3a4a,
    trim: 0x22303d,
    accent: 0x6c97bc,
  },
  hqm: {
    wall: 0x2f4f52,
    wallDark: 0x22393b,
    roof: 0x1d3133,
    roofDark: 0x132122,
    trim: 0x45c2c0,
    accent: 0x45c2c0,
  },
};

export const GROUND = 0x4a7338;
export const GROUND_DARK = 0x35552c;
export const GROUND_LIGHT = 0x6b9a48;
export const DIRT = 0x6f5638;
export const SAND = 0xd9c893;
export const SAND_WET = 0xb9a97a;
export const TREE_CANOPY = [0x3f7a3c, 0x4f8f45, 0x2f6a34, 0x5c9b4a];
export const TREE_TRUNK = 0x5a3d26;
export const ROCK = 0x7b7f83;
export const ROCK_DARK = 0x5a5e62;
export const ORE_VEIN = 0x8c6a4f;
export const SULFUR_VEIN = 0xe3c04f;
export const FIBRE = 0x7fa043;
export const SKIN = 0xe5c39c;
export const CLOTHES = [0x4a5d6e, 0x6e5a4a, 0x55684a, 0x6b4a5d];
