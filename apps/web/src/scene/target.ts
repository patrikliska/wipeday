/**
 * The era's tap target (docs/redesign/02-the-run.md 6-7; 09-architecture.md 10.3): one hero
 * object on the rise, felled every `fellTaps` credited taps. Twig's Lone Pine, Timber's
 * Outcrop, Stone's Ore Seam, Sheet Metal's Sulfur Vent and Armored's Wreck. Each tap squashes
 * it and sheds chips; wear (an axe notch, cracks, peeling plates) shows how close the next fell
 * is. A fell plays the old body falling, crumbling, splitting, popping or bursting as a ghost
 * while the next one pops up within 0.3 s, so no tap is ever wasted on an animation.
 *
 * The tap area itself is a DOM button the scene keeps over the target at a fixed screen size
 * (D48, N27); this class only draws. The Hustle arc and its multiplier live in screen space
 * (D46) on `overlay`.
 */
import { BitmapText, Container, Graphics, Sprite } from "pixi.js";
import type { Emit, Particles } from "./effects";
import {
  GROUND,
  GROUND_LIGHT,
  HUSTLE_HI,
  HUSTLE_LO,
  MOSS,
  ORE_VEIN,
  ROCK,
  ROCK_DARK,
  SULFUR_VEIN,
  TREE_TRUNK,
} from "./palette";
import { artSprite } from "./pixel";
import { glowTexture } from "./textures";
import { clamp, easeOutBack, hash, lerpColor, reducedMotion, shade } from "./util";

export type TargetKind = "tree" | "stone" | "ore" | "sulfur" | "wreck";

type Point = readonly [number, number];

function polygon(g: Graphics, points: readonly Point[]): Graphics {
  const [first, ...rest] = points;
  if (!first) return g;
  g.moveTo(first[0], first[1]);
  for (const [x, y] of rest) g.lineTo(x, y);
  return g.closePath();
}

// --- the Lone Pine ----------------------------------------------------------------------

const PINE = [0x2c5f33, 0x37703b, 0x447f43];

function drawPine(g: Graphics): void {
  g.ellipse(6, 2, 70, 9).fill({ color: 0x000000, alpha: 0.22 });
  // Roots and trunk, lit from the left.
  polygon(g, [
    [-26, 2],
    [-11, -10],
    [-9, -68],
    [9, -68],
    [11, -10],
    [28, 2],
    [12, 0],
    [0, -6],
    [-12, 0],
  ]).fill(TREE_TRUNK);
  polygon(g, [
    [3, -68],
    [9, -68],
    [11, -10],
    [28, 2],
    [12, 0],
    [4, -4],
  ]).fill(shade(TREE_TRUNK, -0.3));
  g.rect(-7, -64, 3, 54).fill({ color: 0xffffff, alpha: 0.12 });
  // Five tiers of boughs, each with a ragged hem, dark on the shade side.
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const bottom = -52 - i * 44;
    const half = 82 - i * 13;
    const top = bottom - 78 - (i === tiers - 1 ? 22 : 0);
    const hem: Point[] = [];
    const teeth = 7 - Math.floor(i / 2);
    for (let k = 0; k <= teeth; k++) {
      const x = half - (k * half * 2) / teeth;
      const drop = k % 2 === 0 ? 0 : -9 - hash(i * 13 + k) * 6;
      hem.push([x, bottom + drop]);
    }
    polygon(g, [[0, top], ...hem]).fill(PINE[1] ?? 0x37703b);
    // Shade side and a lit left edge.
    polygon(g, [
      [0, top],
      [half, bottom],
      [half * 0.35, bottom - 6],
      [4, top + 18],
    ]).fill({ color: PINE[0] ?? 0x2c5f33, alpha: 0.85 });
    polygon(g, [
      [0, top],
      [-half * 0.55, bottom - 18],
      [-half, bottom],
      [-half * 0.82, bottom - 4],
    ]).fill({ color: PINE[2] ?? 0x447f43, alpha: 0.9 });
  }
  // A few cones.
  for (const [x, y] of [
    [-34, -70],
    [40, -118],
    [-22, -160],
  ] as const) {
    g.ellipse(x, y, 4, 6).fill(0x6b4423);
  }
}

// --- rocks: the Outcrop, the Ore Seam and the Sulfur Vent ------------------------------------

/** The rocks are drawn in small units and stretched to hero size by these. */
const ROCK_SX = 3.3;
const ROCK_SY = 3.7;
/** The Wreck is drawn large and shown smaller, so it leaves room for the lines beside it. */
const WRECK_SCALE = 0.8;

/** Where the mineral shows on the boulder's face (rock units). */
const PATCHES: readonly (readonly Point[])[] = [
  [
    [-30, -22],
    [-20, -27],
    [-10, -24],
    [-12, -16],
    [-26, -14],
  ],
  [
    [-10, -42],
    [2, -46],
    [10, -40],
    [2, -35],
    [-8, -36],
  ],
  [
    [10, -24],
    [22, -20],
    [24, -10],
    [12, -8],
  ],
];

function centre(points: readonly Point[]): Point {
  let x = 0;
  let y = 0;
  for (const [px, py] of points) {
    x += px;
    y += py;
  }
  return [x / points.length, y / points.length];
}

function drawNugget(g: Graphics, x: number, y: number, size: number, color: number, seed: number) {
  const points: Point[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + hash(seed + i) * 0.6;
    const r = size * (0.75 + hash(seed * 3 + i) * 0.4);
    points.push([x + Math.cos(angle) * r, y + Math.sin(angle) * r]);
  }
  polygon(g, points).fill(color);
  polygon(g, [points[2] ?? [x, y], points[3] ?? [x, y], [x, y]]).fill(shade(color, 0.3));
  g.circle(x - size * 0.3, y - size * 0.35, size * 0.18).fill({ color: 0xffffff, alpha: 0.45 });
}

function drawCrystals(
  g: Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
  seed: number,
) {
  for (let i = 0; i < 3; i++) {
    const lean = (i - 1) * 0.45 + (hash(seed + i) - 0.5) * 0.3;
    const h = size * (1.4 + hash(seed * 5 + i) * 0.9) * (i === 1 ? 1.3 : 1);
    const w = size * 0.55;
    const tipX = x + Math.sin(lean) * h;
    const tipY = y - Math.cos(lean) * h;
    polygon(g, [
      [x - w, y],
      [tipX - w * 0.4, tipY + w * 0.6],
      [tipX, tipY],
      [x + w, y],
    ]).fill(shade(color, -0.12));
    polygon(g, [
      [x - w, y],
      [tipX - w * 0.4, tipY + w * 0.6],
      [tipX, tipY],
      [x, y],
    ]).fill(shade(color, 0.22));
  }
}

function drawPebble(g: Graphics, x: number, y: number, w: number, h: number, color: number) {
  polygon(g, [
    [x - w, y],
    [x - w * 0.7, y - h * 0.8],
    [x - w * 0.1, y - h],
    [x + w * 0.7, y - h * 0.7],
    [x + w, y],
  ]).fill(color);
}

function drawRock(g: Graphics, kind: "stone" | "ore" | "sulfur"): void {
  const seed = kind === "ore" ? 1 : kind === "sulfur" ? 2 : 3;
  g.ellipse(4, 1, 52, 4).fill({ color: 0x000000, alpha: 0.22 });
  // A smaller rock behind, right.
  polygon(g, [
    [14, 0],
    [18, -22],
    [34, -30],
    [48, -14],
    [47, 0],
  ]).fill(shade(ROCK, -0.12));
  polygon(g, [
    [18, -22],
    [34, -30],
    [48, -14],
    [34, -16],
  ]).fill({ color: 0xffffff, alpha: 0.1 });
  // The main boulder: front face, lit top, dark right side.
  polygon(g, [
    [-42, 0],
    [-38, -24],
    [-20, -44],
    [2, -52],
    [24, -44],
    [34, -22],
    [30, 0],
  ]).fill(ROCK);
  polygon(g, [
    [-38, -24],
    [-20, -44],
    [2, -52],
    [24, -44],
    [6, -34],
    [-16, -30],
  ]).fill({ color: 0xffffff, alpha: 0.16 });
  polygon(g, [
    [24, -44],
    [34, -22],
    [30, 0],
    [10, 0],
    [12, -20],
    [6, -34],
  ]).fill({ color: ROCK_DARK, alpha: 0.6 });
  g.moveTo(6, -34).lineTo(12, -20).lineTo(10, 0).stroke({ width: 0.5, color: ROCK_DARK });
  if (kind === "stone") {
    g.moveTo(-24, -38)
      .lineTo(-18, -28)
      .lineTo(-22, -18)
      .lineTo(-14, -8)
      .stroke({ width: 0.6, color: ROCK_DARK, join: "round" });
    polygon(g, [
      [-20, -44],
      [-8, -50],
      [2, -52],
      [14, -48],
      [4, -45],
      [-6, -44],
      [-14, -40],
    ]).fill(MOSS);
    g.circle(-12, -44, 1.6).fill(shade(MOSS, 0.18));
  } else {
    // The mineral shows in broad patches on the face, nuggets or crystals clustered on each.
    const vein = kind === "ore" ? ORE_VEIN : SULFUR_VEIN;
    PATCHES.forEach((patch, p) => {
      polygon(g, patch).fill({ color: shade(vein, -0.35), alpha: 0.8 });
      const [cx, cy] = centre(patch);
      for (let i = 0; i < 3; i++) {
        const x = cx + (hash(seed * 7 + p * 3 + i) - 0.5) * 9;
        const y = cy + (hash(seed * 5 + p * 7 + i) - 0.5) * 4;
        const size = 2 + hash(seed * 11 + p * 5 + i) * 1.4;
        if (kind === "ore") drawNugget(g, x, y, size, vein, seed * 17 + p * 7 + i);
        else drawCrystals(g, x, y + 1.2, size * 0.7, vein, seed * 17 + p * 7 + i);
      }
    });
  }
  drawPebble(g, -46, 1, 5, 4, shade(ROCK, -0.05));
  drawPebble(g, 39, 2, 4, 3, shade(ROCK, 0.02));
  if (kind === "sulfur") {
    // The vent: a crusted mouth on top with a yellow rim and a pale steam stain.
    g.ellipse(2, -50, 13, 3.4).fill(0x4a4236);
    g.ellipse(2, -50.5, 10, 2.2).fill(0x2a2620);
    g.ellipse(2, -52, 14, 2).stroke({ width: 1.2, color: SULFUR_VEIN, alpha: 0.9 });
    for (const x of [-10, -2, 7, 13]) drawCrystals(g, x, -50, 1.3, SULFUR_VEIN, 31 + x);
  }
}

// --- the Wreck ----------------------------------------------------------------------------

const RUST = 0x8a4a2a;
const HULL = 0x5d6b73;

function drawWreck(g: Graphics): void {
  g.ellipse(8, 2, 150, 10).fill({ color: 0x000000, alpha: 0.24 });
  // A curved hull section, half buried and tipped back: keel in the sand, the deck edge up.
  const outline: Point[] = [
    [-140, 0],
    [-128, -60],
    [-96, -132],
    [-48, -186],
    [10, -210],
    [72, -196],
    [118, -150],
    [138, -86],
    [142, 0],
  ];
  polygon(g, outline).fill(HULL);
  // Plates: horizontal strakes following the curve, alternately lit.
  for (let row = 0; row < 6; row++) {
    const y = -18 - row * 32;
    const half = 136 - row * row * 3.2 - row * 6;
    g.rect(-half, y - 2, half * 2, 3).fill({ color: 0x2c3438, alpha: 0.55 });
    for (let x = -half + 10; x < half; x += 22) g.circle(x, y + 6, 2.2).fill(0x8fa3b5);
  }
  // Light from the left, rust on the right.
  polygon(g, [
    [-140, 0],
    [-128, -60],
    [-96, -132],
    [-48, -186],
    [-30, -180],
    [-80, -120],
    [-104, -50],
    [-112, 0],
  ]).fill({ color: 0xffffff, alpha: 0.1 });
  polygon(g, [
    [72, -196],
    [118, -150],
    [138, -86],
    [142, 0],
    [96, 0],
    [100, -90],
    [80, -150],
  ]).fill({ color: 0x000000, alpha: 0.22 });
  // Rust weeping from the seams, in drips that narrow as they run down.
  for (const [x, y, w, h] of [
    [40, -146, 16, 64],
    [-74, -94, 12, 52],
    [96, -60, 14, 50],
    [8, -82, 10, 40],
  ] as const) {
    polygon(g, [
      [x, y],
      [x + w, y],
      [x + w * 0.62, y + h],
      [x + w * 0.42, y + h * 0.92],
    ]).fill({ color: RUST, alpha: 0.7 });
  }
  // The porthole and the deck rail.
  g.circle(-20, -120, 20).fill(0x3a4448);
  g.circle(-20, -120, 15).fill(0x1c2733);
  g.circle(-26, -126, 5).fill({ color: 0xffffff, alpha: 0.25 });
  g.circle(-20, -120, 20).stroke({ width: 4, color: 0x8fa3b5 });
  g.moveTo(-48, -186).lineTo(10, -210).lineTo(72, -196).stroke({ width: 5, color: 0x3a4448 });
  for (const x of [-30, 0, 30, 58]) g.rect(x, -222, 3, 18).fill(0x3a4448);
  g.moveTo(-36, -220).lineTo(64, -214).stroke({ width: 3, color: 0x3a4448 });
  // Earth and grass heaped against the foot: it went into the rise.
  g.moveTo(-160, 4)
    .quadraticCurveTo(-60, -26, 40, -14)
    .quadraticCurveTo(120, -8, 162, 4)
    .closePath()
    .fill(GROUND);
  g.moveTo(-150, 0)
    .quadraticCurveTo(-60, -26, 40, -14)
    .stroke({ width: 4, color: GROUND_LIGHT, alpha: 0.8 });
}

// --- wear -----------------------------------------------------------------------------------

const CRACKS: readonly (readonly Point[])[] = [
  [
    [-18, -40],
    [-12, -30],
    [-16, -22],
    [-9, -12],
  ],
  [
    [6, -44],
    [2, -34],
    [9, -26],
    [4, -16],
  ],
  [
    [-30, -24],
    [-22, -20],
    [-18, -26],
  ],
  [
    [-6, -30],
    [4, -30],
    [12, -36],
  ],
];

/** `level` 0-4 of wear: how close the next fell is. */
function drawWear(g: Graphics, kind: TargetKind, level: number): void {
  g.clear();
  if (level <= 0) return;
  if (kind === "tree") {
    // A notch in the trunk, deeper with every quarter, pale wood inside.
    const depth = level * 3;
    g.poly([10, -44, 10 - depth, -34, 10, -24]).fill(0x3a2615);
    g.poly([10, -41, 10 - depth * 0.7, -34, 10, -27]).fill(0xd9b98a);
    for (let i = 0; i < level; i++) g.rect(14 + i * 5, -2, 4, 2).fill(0xd9b98a);
    return;
  }
  if (kind === "wreck") {
    // Plates peel: a lifted corner per level, bright metal under it.
    const peels: Point[] = [
      [-90, -40],
      [60, -110],
      [-40, -160],
      [100, -40],
    ];
    for (const [x, y] of peels.slice(0, level)) {
      // The gap behind a sprung plate, then the plate bent out over it, rivet and all.
      g.poly([x, y, x + 28, y, x + 28, y + 18, x + 4, y + 14]).fill(0x1c2226);
      g.poly([x, y, x + 28, y, x + 34, y + 10, x + 8, y + 12]).fill(shade(HULL, 0.22));
      g.circle(x + 6, y + 4, 2).fill(0x8fa3b5);
    }
    return;
  }
  // Rocks: a dark crack with a pale lip below it, one more per level.
  for (const [dx, dy, color, alpha] of [
    [0.4, 0.5, 0xffffff, 0.3],
    [0, 0, 0x24211d, 0.85],
  ] as const) {
    for (const crack of CRACKS.slice(0, level)) {
      const [first, ...rest] = crack;
      if (!first) continue;
      g.moveTo(first[0] + dx, first[1] + dy);
      for (const [x, y] of rest) g.lineTo(x + dx, y + dy);
    }
    g.stroke({ width: 0.9, color, alpha, join: "round", cap: "round" });
  }
}

// --- one body -------------------------------------------------------------------------------

interface Body {
  container: Container;
  wear: Graphics;
  /** Drawn from pixel art (`target/<kind>`): its wear is drawn on the grid, not as vectors. */
  pixel: boolean;
}

function makeBody(kind: TargetKind): Body {
  const container = new Container();
  const art = new Container();
  const wear = new Graphics();
  const sprite = artSprite(`target/${kind}`);
  if (sprite) {
    art.addChild(sprite, wear);
    container.addChild(art);
    return { container, wear, pixel: true };
  }
  const g = new Graphics();
  if (kind === "tree") drawPine(g);
  else if (kind === "wreck") {
    drawWreck(g);
    art.scale.set(WRECK_SCALE);
  } else {
    drawRock(g, kind);
    art.scale.set(ROCK_SX, ROCK_SY);
  }
  art.addChild(g, wear);
  container.addChild(art);
  return { container, wear, pixel: false };
}

/** Per kind: what a fell sheds, how long the ghost takes, and how it goes. */
const FELL: Record<
  TargetKind,
  { seconds: number; burst: Emit; color: number; second?: Emit; secondColor?: number }
> = {
  tree: { seconds: 1.1, burst: "leaves", color: 0x447f43 },
  stone: { seconds: 0.45, burst: "stone", color: 0x9aa0a6, second: "dust", secondColor: 0xb9b0a0 },
  ore: { seconds: 0.5, burst: "flakes", color: ORE_VEIN, second: "sparks", secondColor: 0xffc46b },
  sulfur: {
    seconds: 0.4,
    burst: "dust",
    color: SULFUR_VEIN,
    second: "flakes",
    secondColor: SULFUR_VEIN,
  },
  wreck: {
    seconds: 0.6,
    burst: "flakes",
    color: 0x8fa3b5,
    second: "sparks",
    secondColor: 0xffd25a,
  },
};

/** What a tap knocks off. */
const CHIPS: Record<TargetKind, { kind: Emit; color: number }> = {
  tree: { kind: "leaves", color: 0x447f43 },
  stone: { kind: "stone", color: 0x9aa0a6 },
  ore: { kind: "flakes", color: ORE_VEIN },
  sulfur: { kind: "flakes", color: SULFUR_VEIN },
  wreck: { kind: "sparks", color: 0xffd25a },
};

const POP_SECONDS = 0.3;
const SQUASH_SECONDS = 0.12;
/** The sea is on the left: trees fall toward it, away from the base. */
const FALL_DIRECTION = -1;

export class Target {
  /** In the world, standing on the rise; the scene positions it. */
  readonly container = new Container();
  /** A halo on the lights layer (D47), so the target reads at night and in fog. */
  readonly light = new Container();
  /** Screen space: the Hustle arc and its multiplier (D46). */
  readonly overlay = new Container();
  private kind: TargetKind | null = null;
  private body: Body | null = null;
  private ghost: { body: Body; kind: TargetKind; age: number } | null = null;
  private readonly halo: Sprite;
  private readonly arc = new Graphics();
  private readonly label: BitmapText;
  private level = 0;
  private squash = 1;
  private pop = 1;
  private flash = 0;
  private time = 0;
  /** Drawn bounds in the target's own units: the scene sizes the tap box from them. */
  bounds = { x: -80, y: -290, width: 160, height: 290 };
  /** The crown sits on the tap hint (02-the-run.md 11.1 rule 7): a soft, slow glow. */
  crowned = false;

  constructor(private readonly particles: Particles) {
    this.halo = new Sprite(glowTexture());
    this.halo.anchor.set(0.5);
    this.halo.blendMode = "add";
    this.halo.tint = 0xfff0c0;
    this.light.addChild(this.halo);
    this.label = new BitmapText({
      text: "",
      style: { fontFamily: "wipeday-floater", fontSize: 13 },
    });
    this.label.anchor.set(0, 0.5);
    this.overlay.addChild(this.arc, this.label);
  }

  get current(): TargetKind | null {
    return this.kind;
  }

  /** Shows `kind`. With `animate`, the old one is felled one last time and the new one pops up. */
  set(kind: TargetKind, animate: boolean): void {
    if (kind === this.kind) return;
    const old = this.body;
    const oldKind = this.kind;
    this.kind = kind;
    this.body = makeBody(kind);
    this.container.addChild(this.body.container);
    const b = this.body.container.getLocalBounds();
    this.bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
    this.halo.width = b.width * 1.6;
    this.halo.height = b.height * 1.3;
    this.halo.position.set(b.x + b.width / 2, b.y + b.height * 0.55);
    if (!this.body.pixel) drawWear(this.body.wear, kind, this.level);
    if (old && oldKind && animate) this.startGhost(old, oldKind);
    else old?.container.destroy({ children: true });
    this.pop = animate ? 0 : 1;
  }

  /** Taps so far toward the next fell, as a fraction: shown as 0-4 steps of wear. */
  setProgress(fraction: number): void {
    const level = clamp(Math.floor(fraction * 5), 0, 4);
    if (level === this.level || !this.body || !this.kind) return;
    this.level = level;
    if (!this.body.pixel) drawWear(this.body.wear, this.kind, level);
  }

  /** A tap landed: squash and shed a few chips at world (x, y). */
  hit(x: number, y: number): void {
    if (!this.kind) return;
    if (reducedMotion()) this.flash = 1;
    else this.squash = 0;
    const chips = CHIPS[this.kind];
    this.particles.spawn(chips.kind, x, y, 3, chips.color);
  }

  /** A refusal's "Tap the ore seam": one bright blink of the halo. */
  pulse(): void {
    this.flash = 1;
  }

  /** The target fell: the old body goes as a ghost, a fresh one pops up in its place. */
  fell(): void {
    if (!this.kind || !this.body) return;
    const old = this.body;
    this.body = makeBody(this.kind);
    this.container.addChild(this.body.container);
    this.level = 0;
    this.startGhost(old, this.kind);
    this.pop = 0;
  }

  private startGhost(old: Body, kind: TargetKind): void {
    if (this.ghost) this.ghost.body.container.destroy({ children: true });
    this.container.addChildAt(old.container, 0);
    this.ghost = { body: old, kind, age: 0 };
    const spec = FELL[kind];
    const cx = this.container.x + this.bounds.x + this.bounds.width / 2;
    const cy = this.container.y + this.bounds.y + this.bounds.height * 0.55;
    if (kind !== "tree") {
      this.particles.spawn(spec.burst, cx, cy, 24, spec.color);
      if (spec.second) this.particles.spawn(spec.second, cx, cy, 10, spec.secondColor);
    }
  }

  /** The point a tap's number rises from: just above the top (world units). */
  get floatPoint(): { x: number; y: number } {
    return {
      x: this.container.x + this.bounds.x + this.bounds.width / 2,
      y: this.container.y + this.bounds.y + 10,
    };
  }

  update(dt: number, wind: number, darkness: number, fog: number): void {
    this.time += dt;
    const body = this.body;
    if (!body) return;
    // Pop up (a fresh target), then squash and sway.
    this.pop = Math.min(1, this.pop + dt / POP_SECONDS);
    this.squash = Math.min(1, this.squash + dt / SQUASH_SECONDS);
    const grow = this.pop < 1 ? 0.2 + 0.8 * easeOutBack(this.pop) : 1;
    const s = this.squash < 1 ? Math.sin(this.squash * Math.PI) : 0;
    body.container.scale.set(grow * (1 + 0.06 * s), grow * (1 - 0.06 * s));
    body.container.alpha = clamp(this.pop * 3, 0, 1);
    const sway = this.kind === "tree" ? Math.sin(this.time * 1.3) * 0.006 + wind * 0.002 : 0;
    body.container.skew.x = sway;
    // Reduced motion: the halo blinks brighter instead of the body squashing.
    this.flash = Math.max(0, this.flash - dt * 6);

    const ghost = this.ghost;
    if (ghost) {
      ghost.age += dt;
      const spec = FELL[ghost.kind];
      const t = clamp(ghost.age / spec.seconds, 0, 1);
      const c = ghost.body.container;
      if (ghost.kind === "tree") {
        // Slow to tip, fast to land; leaves burst where it hits.
        c.rotation = FALL_DIRECTION * t * t * 1.45;
        c.alpha = 1 - clamp((t - 0.8) / 0.2, 0, 1);
        if (t >= 1) {
          const reach = this.bounds.height * 0.75;
          const x = this.container.x + FALL_DIRECTION * reach;
          this.particles.spawn("leaves", x, this.container.y - 20, 24, PINE[2]);
          this.particles.spawn("dust", x, this.container.y - 4, 8, 0xb9a98a);
        }
      } else if (ghost.kind === "sulfur") {
        c.scale.set(1 + t * 0.15);
        c.alpha = 1 - t;
      } else if (ghost.kind === "wreck") {
        c.position.x = Math.sin(t * 60) * 6 * (1 - t);
        c.scale.set(1 + t * 0.08, 1 - t * 0.5);
        c.alpha = 1 - t;
      } else {
        c.scale.set(1 + t * 0.18, 1 - t * 0.7);
        c.alpha = 1 - t;
      }
      if (t >= 1) {
        c.destroy({ children: true });
        this.ghost = null;
      }
    }

    const glow = this.crowned ? 0.1 + 0.06 * Math.sin(this.time * 2.9) : 0;
    this.halo.alpha = clamp(0.06 + darkness * 0.2 + fog * 0.25 + glow + this.flash * 0.4, 0, 0.6);
    this.light.position.copyFrom(this.container.position);
  }

  /**
   * The Hustle arc around the tap box (CSS px): 270°, open at the bottom, filling from the
   * left; its multiplier in small print at the end. Hidden at zero.
   */
  drawHustle(
    box: { x: number; y: number; width: number; height: number },
    fill: number,
    multiplier: string,
  ): void {
    this.arc.clear();
    if (fill <= 0.001) {
      this.label.visible = false;
      return;
    }
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const r = Math.min(box.width, box.height) / 2 + 6;
    const start = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    this.arc
      .arc(cx, cy, r, start, start + sweep)
      .stroke({ width: 4, color: 0x1b1a18, alpha: 0.35, cap: "round" });
    this.arc
      .arc(cx, cy, r, start, start + sweep * clamp(fill, 0, 1))
      .stroke({ width: 4, color: lerpColor(HUSTLE_LO, HUSTLE_HI, fill), cap: "round" });
    const end = start + sweep;
    this.label.visible = true;
    this.label.text = multiplier;
    this.label.position.set(
      Math.round(cx + Math.cos(end) * r + 6),
      Math.round(cy + Math.sin(end) * r + 2),
    );
    this.label.tint = lerpColor(HUSTLE_LO, HUSTLE_HI, fill);
  }
}
