/** Small numeric helpers shared by the scene layers. */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

export const easeOutCubic = (t: number): number => 1 - (1 - clamp(t, 0, 1)) ** 3;

export const easeOutBack = (t: number): number => {
  const x = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};

export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;

export const rand = (min: number, max: number): number => min + Math.random() * (max - min);

export const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));

export const pick = <T>(list: readonly T[]): T => {
  const item = list[Math.floor(Math.random() * list.length)];
  if (item === undefined) throw new Error("pick from an empty list");
  return item;
};

/** Deterministic 0..1 noise for layout (so hills do not change on every reload). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function lerpColor(a: number, b: number, t: number): number {
  const x = clamp(t, 0, 1);
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * x);
  const g = Math.round(ag + (bg - ag) * x);
  const bl = Math.round(ab + (bb - ab) * x);
  return (r << 16) | (g << 8) | bl;
}

export function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Darkens (t < 0) or lightens (t > 0) a colour. */
export function shade(color: number, t: number): number {
  return t < 0 ? lerpColor(color, 0x000000, -t) : lerpColor(color, 0xffffff, t);
}
