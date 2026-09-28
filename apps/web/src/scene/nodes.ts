/**
 * Resource nodes (trees, stone, ore and sulfur rocks) and the barrel on the shore.
 * Nodes are clickable; a click starts the "work the node" game: a marker
 * appears on the node, hit it before it fades, five times. A worked node is
 * gone: the tree falls, the rock crumbles, and a stump or rubble with a
 * regrow clock stays until the store brings it back.
 */
import { ColorMatrixFilter, Container, Graphics, Sprite } from "pixi.js";
import {
  FIBRE,
  MOSS,
  ORE_VEIN,
  ROCK,
  ROCK_DARK,
  SAND,
  STUMP_FACE,
  SULFUR_VEIN,
  TREE_CANOPY,
  TREE_TRUNK,
} from "./palette";
import { glowTexture } from "./textures";
import { clamp, easeOutBack, hash, pick, rand, shade } from "./util";

export interface NodeDef {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  scale: number;
  /** Trees only: which way it falls, away from the base. Default right. */
  fall?: 1 | -1;
}

/** Up: workable. Falling and growing are the in-between animations. */
type NodeState = "up" | "falling" | "down" | "growing";

interface NodeView {
  def: NodeDef;
  container: Container;
  /** White silhouette rim behind the body: says "you can click this". */
  outline: Container;
  body: Container;
  /** Stump or rubble, shown while the node is worked out. */
  remnant: Container;
  /** Small pie clock over the remnant: how far the regrow is. */
  clock: Graphics;
  /** Axe cuts or cracks on a standing node that was hit but not worked out. */
  cracks: Graphics;
  /** How many hits `cracks` shows. */
  worn: number;
  state: NodeState;
  /** 0..1 through the current fall or grow animation. */
  anim: number;
  /** 0..1 through the regrow cooldown. */
  regrow: number;
  phase: number;
  shake: number;
  hover: number;
}

export interface NodeRun {
  node: string;
  /** The node's hits so far, counting its wear from earlier runs (D76). */
  hits: number;
  /** The wear the run started from: only a run from 0 can be perfect. */
  from: number;
  marker: { x: number; y: number };
  lastHitAt: number;
}

/** The node kinds the scene can draw; the ids match `nodes.json5` kinds. */
export type NodeKind = "tree" | "stone" | "ore" | "sulfur" | "fibre";

/** A worked-out node: down from `at` until `until` (game seconds), then it grows back. */
export interface Depleted {
  kind: string;
  at: number;
  until: number;
}

export interface NodeCallbacks {
  /** A tap on a standing node: the node's wear to start from, or null to refuse (the store says why). */
  onStart: (node: NodeDef) => number | null;
  onHit: (node: NodeDef, hits: number, x: number, y: number) => void;
  /**
   * The run ended: `done` when the node took its last hit (the server ended it), `from` the
   * wear it started at. `x`, `y`: the marker's last position, where the player was looking.
   */
  onRunOver: (
    node: NodeDef,
    run: { hits: number; from: number; done: boolean },
    x: number,
    y: number,
  ) => void;
  /** A tap on a stump or rubble. */
  onDepletedTap: (node: NodeDef) => void;
  /** A felled tree hit the ground at (x, y), or a rock finished crumbling. */
  onFelled: (node: NodeDef, x: number, y: number) => void;
}

export const MAX_HITS = 5;
const WINDOW = 4.5;
/** Marker hit radius in CSS pixels: tight for a mouse, finger-sized on touch. The ring shows exactly this. */
const HIT_PX = { mouse: 18, touch: 26 };
/** The next marker lands at least this many hit radii away, so every hit needs a new aim. */
const MIN_JUMP = 2.5;
/** Seconds: a tree takes a moment to fall, a rock crumbles fast, both grow back with a pop. */
const FALL_TIME = { tree: 1.1, rock: 0.45 };
const GROW_TIME = 0.8;
/** Regrow clock radius in CSS pixels. */
const CLOCK_PX = 11;
/** Where the clock floats over the remnant, in node units above the ground. */
const CLOCK_Y = { tree: 46, rock: 40 };
/** Pie colour on the regrow clock: the colour of what comes back. */
const CLOCK_COLOR: Record<NodeKind, number> = {
  tree: 0x7fc062,
  stone: 0xd6d9dc,
  ore: 0xd07a48,
  sulfur: 0xf0cf52,
  fibre: 0xc8d870,
};

function drawTree(scale: number): Container {
  const c = new Container();
  const trunk = new Graphics();
  trunk.moveTo(-8, 0).lineTo(-5, -70).lineTo(5, -70).lineTo(8, 0).closePath().fill(TREE_TRUNK);
  trunk.moveTo(-3, -40).lineTo(-22, -62).stroke({ width: 4, color: TREE_TRUNK });
  const canopy = new Container();
  const colors = [pick(TREE_CANOPY), pick(TREE_CANOPY), pick(TREE_CANOPY)];
  const g = new Graphics();
  g.circle(-26, -14, 30).fill(colors[0] ?? 0x3f7a3c);
  g.circle(26, -20, 32).fill(colors[1] ?? 0x4f8f45);
  g.circle(0, -50, 36).fill(colors[2] ?? 0x2f6a34);
  g.circle(0, -22, 34).fill(colors[1] ?? 0x4f8f45);
  g.circle(-10, -34, 18).fill({ color: 0xffffff, alpha: 0.08 });
  canopy.addChild(g);
  // The canopy pivots at the top of the trunk, so swaying looks right.
  canopy.position.set(0, -70);
  c.addChild(trunk, canopy);
  c.scale.set(scale);
  return c;
}

type Point = readonly [number, number];

function polygon(g: Graphics, points: readonly Point[]): Graphics {
  const [first, ...rest] = points;
  if (!first) return g;
  g.moveTo(first[0], first[1]);
  for (const [x, y] of rest) g.lineTo(x, y);
  return g.closePath();
}

/** Where the veins run on the main boulder: each a crack with nuggets (or crystals) along it. */
const VEINS: readonly (readonly Point[])[] = [
  [
    [-30, -18],
    [-18, -24],
    [-8, -20],
    [2, -28],
  ],
  [
    [-14, -40],
    [-4, -36],
    [8, -42],
  ],
  [
    [12, -24],
    [20, -14],
    [26, -8],
  ],
];

/** An angular nugget with a lit facet and a glint. */
function drawNugget(g: Graphics, x: number, y: number, size: number, color: number, seed: number) {
  const points: Point[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + hash(seed + i) * 0.6;
    const r = size * (0.75 + hash(seed * 3 + i) * 0.4);
    points.push([x + Math.cos(angle) * r, y + Math.sin(angle) * r]);
  }
  polygon(g, points).fill(color);
  polygon(g, [points[2] ?? [x, y], points[3] ?? [x, y], [x, y]]).fill(shade(color, 0.3));
  g.circle(x - size * 0.3, y - size * 0.35, size * 0.18).fill({ color: 0xffffff, alpha: 0.4 });
}

/** A yellow crystal cluster: three pointed prisms with a light face each. */
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

/** A small faceted stone sitting on the ground at (x, y), with a lit top facet. */
function drawPebble(g: Graphics, x: number, y: number, w: number, h: number, color: number) {
  const outline: Point[] = [
    [x - w, y],
    [x - w * 0.7, y - h * 0.8],
    [x - w * 0.1, y - h],
    [x + w * 0.7, y - h * 0.7],
    [x + w, y],
  ];
  polygon(g, outline).fill(color);
  polygon(g, [
    [x - w * 0.7, y - h * 0.8],
    [x - w * 0.1, y - h],
    [x + w * 0.7, y - h * 0.7],
    [x + w * 0.1, y - h * 0.45],
  ]).fill({ color: 0xffffff, alpha: 0.16 });
}

function drawRockShadow(g: Graphics): void {
  polygon(g, [
    [-47, 0],
    [-34, 3.5],
    [-6, 5.5],
    [26, 5],
    [50, 3],
    [55, 0.5],
    [44, -1.5],
    [10, -2],
    [-30, -1.5],
  ]).fill({ color: 0x000000, alpha: 0.2 });
  polygon(g, [
    [-40, 0.5],
    [-10, 2.8],
    [28, 2.4],
    [30, -0.5],
    [-38, -0.8],
  ]).fill({ color: 0x000000, alpha: 0.18 });
}

/** `silhouette` leaves out the shadow and pebbles: the outline traces only the rock. */
function drawRock(kind: "ore" | "sulfur" | "stone", scale: number, silhouette = false): Container {
  const c = new Container();
  const g = new Graphics();
  const seed = kind === "ore" ? 1 : kind === "sulfur" ? 2 : 3;
  // Contact shadow hugging the base, longer on the right (light comes from the left).
  if (!silhouette) drawRockShadow(g);
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
  const outline: Point[] = [
    [-42, 0],
    [-38, -24],
    [-20, -44],
    [2, -52],
    [24, -44],
    [34, -22],
    [30, 0],
  ];
  polygon(g, outline).fill(ROCK);
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
  g.moveTo(6, -34).lineTo(12, -20).lineTo(10, 0).stroke({ width: 1.2, color: ROCK_DARK });
  g.moveTo(-16, -30).lineTo(6, -34).stroke({ width: 1, color: 0xffffff, alpha: 0.25 });
  if (kind === "stone") drawStoneMarks(g);
  else drawVeins(g, kind, seed);
  // Pebbles at the foot.
  if (!silhouette) {
    drawPebble(g, -46, 1, 6, 5, shade(ROCK, -0.05));
    drawPebble(g, -37, 2, 4, 3, ROCK_DARK);
    drawPebble(g, 39, 2, 5, 3.5, shade(ROCK, 0.02));
  }
  c.addChild(g);
  c.scale.set(scale);
  return c;
}

/** Plain stone: no mineral, so cracks, a chipped facet and a cap of moss say "just rock". */
function drawStoneMarks(g: Graphics): void {
  g.moveTo(-24, -38)
    .lineTo(-18, -28)
    .lineTo(-22, -18)
    .lineTo(-14, -8)
    .stroke({ width: 1.6, color: ROCK_DARK, join: "round" });
  g.moveTo(-18, -28).lineTo(-8, -24).stroke({ width: 1.2, color: ROCK_DARK });
  g.moveTo(14, -40).lineTo(8, -30).lineTo(12, -22).stroke({ width: 1.3, color: ROCK_DARK });
  polygon(g, [
    [-6, -20],
    [4, -24],
    [6, -14],
    [-4, -12],
  ]).fill({ color: 0xffffff, alpha: 0.12 });
  polygon(g, [
    [-20, -44],
    [-8, -50],
    [2, -52],
    [14, -48],
    [4, -45],
    [-6, -44],
    [-14, -40],
  ]).fill(MOSS);
  g.circle(-12, -44, 2.2).fill(shade(MOSS, 0.18));
  g.circle(6, -48, 1.6).fill(shade(MOSS, 0.18));
}

/** Veins: a dark crack, then nuggets (ore) or crystals (sulfur) along it. */
function drawVeins(g: Graphics, kind: "ore" | "sulfur", seed: number): void {
  const vein = kind === "ore" ? ORE_VEIN : SULFUR_VEIN;
  VEINS.forEach((line, v) => {
    // A mineral band that tapers at both ends, not a drawn line.
    const top: Point[] = [];
    const bottom: Point[] = [];
    line.forEach(([x, y], i) => {
      const t = i / (line.length - 1);
      const half = 0.6 + Math.sin(t * Math.PI) * 2.6;
      top.push([x, y - half]);
      bottom.unshift([x, y + half]);
    });
    polygon(g, [...top, ...bottom]).fill({ color: shade(vein, -0.3), alpha: 0.75 });
    line.forEach(([x, y], i) => {
      if ((i + v) % 2 === 1 && i !== line.length - 1) return;
      const size = 3.2 + hash(seed * 11 + v * 5 + i) * 2.2;
      if (kind === "ore") drawNugget(g, x, y, size, vein, seed * 17 + v * 7 + i);
      else drawCrystals(g, x, y + 2, size * 0.8, vein, seed * 17 + v * 7 + i);
    });
  });
}

/** What a felled tree leaves: a stump with a pale cut face, roots and wood chips. */
function drawStump(scale: number): Container {
  const c = new Container();
  const g = new Graphics();
  g.ellipse(4, 1, 18, 2.6).fill({ color: 0x000000, alpha: 0.2 });
  polygon(g, [
    [-10, 0],
    [-17, 2],
    [-8, -5],
  ]).fill(TREE_TRUNK);
  polygon(g, [
    [10, 0],
    [16, 2],
    [8, -4],
  ]).fill(shade(TREE_TRUNK, -0.2));
  polygon(g, [
    [-10, 0],
    [-8, -16],
    [8, -15],
    [11, 0],
  ]).fill(TREE_TRUNK);
  polygon(g, [
    [3, -15.5],
    [8, -15],
    [11, 0],
    [4, 0],
  ]).fill(shade(TREE_TRUNK, -0.25));
  g.moveTo(-5, -12)
    .lineTo(-6, -3)
    .stroke({ width: 1, color: shade(TREE_TRUNK, -0.3) });
  g.ellipse(0, -15.5, 8.5, 3).fill(STUMP_FACE);
  g.ellipse(0, -15.5, 5, 1.8).stroke({ width: 0.8, color: shade(STUMP_FACE, -0.22) });
  g.ellipse(0, -15.5, 1.8, 0.7).fill(shade(STUMP_FACE, -0.22));
  for (const [x, y, w] of [
    [-22, 1, 4],
    [17, 2, 3],
    [24, 0, 2.5],
    [-15, 3, 2.5],
  ] as const) {
    g.rect(x, y - 1.5, w, 1.6).fill(STUMP_FACE);
  }
  c.addChild(g);
  c.scale.set(scale);
  return c;
}

/**
 * What a mined rock leaves: the broken-off foot of the boulder with a jagged top, chunks
 * scattered round it, and a fleck of the mineral that grows back.
 */
function drawRubble(kind: NodeKind, scale: number): Container {
  const c = new Container();
  const g = new Graphics();
  drawRockShadow(g);
  const top: Point[] = [
    [-38, -12],
    [-28, -19],
    [-18, -12],
    [-8, -22],
    [4, -14],
    [14, -20],
    [24, -12],
    [31, -8],
  ];
  polygon(g, [[-42, 0], ...top, [30, 0]]).fill(ROCK);
  // Fresh break: the jagged top is paler than the weathered sides.
  polygon(g, [...top, [24, -8], [4, -9], [-18, -8], [-36, -8]]).fill({
    color: 0xffffff,
    alpha: 0.2,
  });
  polygon(g, [
    [14, -20],
    [24, -12],
    [31, -8],
    [30, 0],
    [12, 0],
    [10, -12],
  ]).fill({ color: ROCK_DARK, alpha: 0.6 });
  g.moveTo(-8, -22).lineTo(-10, -10).lineTo(-6, 0).stroke({ width: 1.2, color: ROCK_DARK });
  drawPebble(g, -50, 1.5, 7, 6, shade(ROCK, -0.05));
  drawPebble(g, 38, 2, 8, 7, shade(ROCK, 0.02));
  drawPebble(g, 48, 2.5, 4, 3, ROCK_DARK);
  drawPebble(g, -30, 4, 5, 4, shade(ROCK, 0.05));
  if (kind === "ore") {
    drawNugget(g, -20, -8, 3.2, ORE_VEIN, 41);
    drawNugget(g, 6, -9, 2.6, ORE_VEIN, 43);
    drawNugget(g, 38, -3, 2.4, ORE_VEIN, 45);
  } else if (kind === "sulfur") {
    drawCrystals(g, -18, -9, 2.6, SULFUR_VEIN, 47);
    drawCrystals(g, 8, -10, 2.2, SULFUR_VEIN, 49);
  } else {
    polygon(g, [
      [-38, -12],
      [-28, -19],
      [-22, -15],
      [-32, -10],
    ]).fill(MOSS);
  }
  c.addChild(g);
  c.scale.set(scale);
  return c;
}

function drawFibre(scale: number): Container {
  const c = new Container();
  const g = new Graphics();
  for (let i = -3; i <= 3; i++) {
    const x = i * 9;
    const h = 30 + hash(i + 10) * 24;
    const lean = i % 2 ? 6 : -6;
    g.moveTo(x - 4, 0)
      .quadraticCurveTo(x + lean, -h * 0.6, x, -h)
      .quadraticCurveTo(x - lean / 2, -h * 0.5, x + 4, 0)
      .closePath()
      .fill(FIBRE);
    g.circle(x, -h, 3).fill(0xd8c86a);
  }
  c.addChild(g);
  c.scale.set(scale);
  return c;
}

function drawBody(def: NodeDef, silhouette = false): Container {
  if (def.kind === "tree") return drawTree(def.scale);
  if (def.kind === "fibre") return drawFibre(def.scale);
  return drawRock(def.kind, def.scale, silhouette);
}

/** Rock cracks, one more per hit; each a jagged line in the rock's own units. */
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

/** What `hits` of wear look like: axe cuts in a trunk, cracks in a rock. */
function drawWear(g: Graphics, kind: NodeKind, hits: number): void {
  g.clear();
  if (hits <= 0) return;
  if (kind === "tree") {
    // A notch cut into the trunk that deepens with every hit, pale wood inside.
    // Chest height, where a swing lands (and clear of anything standing at the foot).
    const depth = Math.min(4, hits) * 2.4;
    g.poly([6.5, -44, 6.5 - depth, -38, 6.5, -32]).fill(0x3a2615);
    g.poly([6.5, -42, 6.5 - depth * 0.7, -38, 6.5, -36]).fill(0xd9b98a);
    return;
  }
  // A dark crack with a pale lip below it, so it reads as cut into the rock.
  for (const [dx, dy, color, alpha] of [
    [0.9, 1.1, 0xffffff, 0.3],
    [0, 0, 0x24211d, 0.85],
  ] as const) {
    for (const crack of CRACKS.slice(0, hits)) {
      const [first, ...rest] = crack;
      if (!first) continue;
      g.moveTo(first[0] + dx, first[1] + dy);
      for (const [x, y] of rest) g.lineTo(x + dx, y + dy);
    }
    g.stroke({ width: 1.8, color, alpha, join: "round", cap: "round" });
  }
}

function drawRemnant(def: NodeDef): Container {
  return def.kind === "tree" ? drawStump(def.scale) : drawRubble(def.kind, def.scale);
}

/** Offsets of the silhouette copies that make the rim, in world units. */
const RIM = 1.4;
const RIM_OFFSETS: readonly (readonly [number, number])[] = [
  [RIM, 0],
  [-RIM, 0],
  [0, RIM],
  [0, -RIM],
  [RIM * 0.7, RIM * 0.7],
  [-RIM * 0.7, RIM * 0.7],
  [RIM * 0.7, -RIM * 0.7],
  [-RIM * 0.7, -RIM * 0.7],
];

/** Turns everything it draws white, keeping alpha: the silhouette colour. */
function whiteFilter(): ColorMatrixFilter {
  const filter = new ColorMatrixFilter();
  filter.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
  return filter;
}

export class Nodes {
  readonly container = new Container();
  /**
   * The marker, its ring and its tap target. The scene stacks this above every effect, the
   * night tint and the weather (aligned with the world), so nothing can cover the marker or
   * take its tap: a tap inside the ring always counts, even where another node overlaps.
   */
  readonly overlay = new Container();
  private readonly target = new Graphics();
  private targetX = 0;
  private targetY = 0;
  private targetR = 0;
  private readonly views = new Map<string, NodeView>();
  private readonly marker: Sprite;
  private readonly ring: Graphics;
  private run: NodeRun | null = null;
  /** Whether the last tap was a finger: sets the hit radius. */
  private touch = false;
  private time = 0;

  constructor(
    defs: NodeDef[],
    private readonly callbacks: NodeCallbacks,
  ) {
    for (const def of defs) {
      const body = drawBody(def);
      const cracks = new Graphics();
      body.addChild(cracks);
      const outline = new Container();
      for (const [dx, dy] of RIM_OFFSETS) {
        const copy = drawBody(def, true);
        copy.position.set(dx, dy);
        outline.addChild(copy);
      }
      outline.filters = [whiteFilter()];
      outline.alpha = 0.55;
      const remnant = drawRemnant(def);
      remnant.visible = false;
      // On the overlay, so a station in front of a stump never hides it.
      const clock = new Graphics();
      clock.visible = false;
      clock.eventMode = "none";
      clock.position.set(
        def.x,
        def.y - (def.kind === "tree" ? CLOCK_Y.tree : CLOCK_Y.rock) * def.scale,
      );
      this.overlay.addChild(clock);
      const container = new Container();
      container.position.set(def.x, def.y);
      container.addChild(remnant, outline, body);
      container.eventMode = "static";
      container.cursor = "pointer";
      const halfWidth = 50 * def.scale;
      const height = (def.kind === "tree" ? 170 : 60) * def.scale;
      const view: NodeView = {
        def,
        container,
        outline,
        body,
        remnant,
        clock,
        cracks,
        worn: 0,
        state: "up",
        anim: 1,
        regrow: 0,
        phase: hash(def.x) * 6.28,
        shake: 0,
        hover: 0,
      };
      // Worked out, only the stump or rubble (and its clock) answers a tap.
      container.hitArea = {
        contains: (x: number, y: number) => {
          const top = view.state === "up" ? height : 48 * def.scale;
          const half = view.state === "up" ? halfWidth : 30 * def.scale;
          return x > -half && x < half && y < 8 && y > -top;
        },
      };
      container.on("pointerover", () => {
        view.hover = 1;
      });
      container.on("pointerout", () => {
        view.hover = 0;
      });
      container.on("pointertap", (event) => {
        this.touch = event.pointerType === "touch";
        const local = container.toLocal(event.global);
        this.tap(view, local.x, local.y);
      });
      this.views.set(def.id, view);
      this.container.addChild(container);
    }

    this.marker = new Sprite(glowTexture());
    this.marker.anchor.set(0.5);
    this.marker.blendMode = "add";
    this.marker.tint = 0xffd25a;
    this.marker.visible = false;
    this.marker.eventMode = "none";
    this.ring = new Graphics();
    this.ring.visible = false;
    this.ring.eventMode = "none";
    this.target.eventMode = "static";
    this.target.cursor = "pointer";
    this.target.visible = false;
    this.target.hitArea = {
      contains: (x: number, y: number) =>
        Math.hypot(x - this.targetX, y - this.targetY) <= this.targetR,
    };
    this.target.on("pointertap", (event) => {
      this.touch = event.pointerType === "touch";
      const view = this.run ? this.views.get(this.run.node) : undefined;
      if (view) this.hit(view);
    });
    this.overlay.addChild(this.marker, this.ring, this.target);
  }

  private tap(view: NodeView, localX: number, localY: number): void {
    const now = this.time;
    if (view.state !== "up") {
      view.shake = 0.5;
      this.callbacks.onDepletedTap(view.def);
      return;
    }
    if (this.run && this.run.node === view.def.id) {
      const distance = Math.hypot(localX - this.run.marker.x, localY - this.run.marker.y);
      if (distance <= this.hitRadius(view.container)) {
        this.hit(view);
      } else {
        this.endRun(view, false);
      }
      return;
    }
    view.shake = 1;
    // A run on another node ends first; that node keeps its wear.
    const previous = this.run ? this.views.get(this.run.node) : undefined;
    if (previous) this.endRun(previous, false);
    const from = this.callbacks.onStart(view.def);
    if (from === null) return;
    this.run = {
      node: view.def.id,
      hits: from,
      from,
      marker: this.randomSpot(view),
      lastHitAt: now,
    };
  }

  private hit(view: NodeView): void {
    const run = this.run;
    if (!run || run.node !== view.def.id) return;
    run.hits += 1;
    run.lastHitAt = this.time;
    view.shake = 1;
    this.callbacks.onHit(
      view.def,
      run.hits,
      view.container.x + run.marker.x,
      view.container.y + run.marker.y,
    );
    if (run.hits >= MAX_HITS) {
      this.endRun(view, true);
    } else {
      run.marker = this.randomSpot(view, run.marker);
    }
  }

  private endRun(view: NodeView, done: boolean): void {
    const marker = this.run?.marker ?? { x: 0, y: -40 };
    const hits = this.run?.hits ?? 0;
    const from = this.run?.from ?? 0;
    this.run = null;
    this.callbacks.onRunOver(
      view.def,
      { hits, from, done },
      view.container.x + marker.x,
      view.container.y + marker.y,
    );
  }

  /** The active marker's centre in overlay (world) units, or null outside a run. */
  get markerPoint(): { x: number; y: number } | null {
    return this.target.visible ? { x: this.targetX, y: this.targetY } : null;
  }

  /** Hit radius in the node's own units, from the on-screen size in HIT_PX. */
  private hitRadius(space: Container): number {
    return (this.touch ? HIT_PX.touch : HIT_PX.mouse) / Math.max(0.01, space.worldTransform.a);
  }

  private randomSpot(
    view: NodeView,
    previous?: { x: number; y: number },
  ): { x: number; y: number } {
    const s = view.def.scale;
    const spot = (): { x: number; y: number } => {
      if (view.def.kind === "tree") return { x: rand(-40, 40) * s, y: rand(-140, -80) * s };
      if (view.def.kind === "fibre") return { x: rand(-24, 24) * s, y: rand(-46, -16) * s };
      return { x: rand(-30, 30) * s, y: rand(-44, -12) * s };
    };
    if (!previous) return spot();
    const minJump = this.hitRadius(view.container) * MIN_JUMP;
    let best = spot();
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = spot();
      const far = (spot: { x: number; y: number }): number =>
        Math.hypot(spot.x - previous.x, spot.y - previous.y);
      if (far(candidate) > far(best)) best = candidate;
      if (far(best) >= minJump) break;
    }
    return best;
  }

  shake(id: string): void {
    const view = this.views.get(id);
    if (view && view.state === "up") view.shake = 1;
  }

  /** Whether the node is standing and workable (false for stumps, rubble, and unknown ids). */
  isUp(id: string): boolean {
    return this.views.get(id)?.state === "up";
  }

  /** Ids of this layer's standing nodes of a kind. */
  standing(kind: NodeKind): string[] {
    return [...this.views.values()]
      .filter((view) => view.def.kind === kind && view.state === "up")
      .map((view) => view.def.id);
  }

  /** Follows the store: fells nodes that went on cooldown, grows back the ones that are done. */
  /** `wear`: hits each standing node has taken, including the run in progress. */
  sync(
    depleted: Readonly<Record<string, Depleted>>,
    clock: number,
    wear: Readonly<Record<string, number>>,
  ): void {
    for (const view of this.views.values()) {
      const worn = depleted[view.def.id] ? 0 : (wear[view.def.id] ?? 0);
      if (worn !== view.worn) {
        view.worn = worn;
        drawWear(view.cracks, view.def.kind, worn);
      }
      const entry = depleted[view.def.id];
      if (entry) {
        view.regrow = clamp((clock - entry.at) / Math.max(1, entry.until - entry.at), 0, 1);
        if (view.state === "up" || view.state === "growing") {
          if (this.run?.node === view.def.id) this.run = null;
          view.state = "falling";
          view.anim = 0;
          view.hover = 0;
        }
      } else if (view.state === "down" || view.state === "falling") {
        view.state = "growing";
        view.anim = 0;
      }
    }
  }

  /** Fall, crumble and grow: body, rim and remnant for one frame. */
  private animate(view: NodeView, dt: number): void {
    const { def, body, remnant } = view;
    const tree = def.kind === "tree";
    if (view.state === "falling") {
      view.anim = Math.min(1, view.anim + dt / (tree ? FALL_TIME.tree : FALL_TIME.rock));
      const t = view.anim;
      body.visible = true;
      if (tree) {
        // Slow to tip, fast to land, like a real fall; fades only once it is down.
        body.rotation = (def.fall ?? 1) * t * t * 1.5;
        body.alpha = 1 - clamp((t - 0.8) / 0.2, 0, 1);
      } else {
        body.scale.set(def.scale * (1 + t * 0.18), def.scale * (1 - t * 0.7));
        body.alpha = 1 - t;
      }
      remnant.visible = true;
      remnant.alpha = clamp(t * 2, 0, 1);
      if (t >= 1) {
        view.state = "down";
        const reach = tree ? 150 * def.scale : 0;
        this.callbacks.onFelled(def, def.x + (def.fall ?? 1) * reach, def.y);
      }
    } else if (view.state === "down") {
      body.visible = false;
      remnant.visible = true;
      remnant.alpha = 1;
    } else if (view.state === "growing") {
      view.anim = Math.min(1, view.anim + dt / GROW_TIME);
      const t = view.anim;
      body.visible = true;
      body.rotation = 0;
      body.alpha = clamp(t * 3, 0, 1);
      body.scale.set(def.scale * (0.2 + 0.8 * easeOutBack(t)));
      remnant.alpha = 1 - t;
      if (t >= 1) {
        view.state = "up";
        body.scale.set(def.scale);
        remnant.visible = false;
      }
    }
    view.outline.visible = view.state === "up";
    view.container.cursor = view.state === "up" ? "pointer" : "help";
    view.clock.visible = view.state === "down";
    if (view.clock.visible) this.drawClock(view);
  }

  /** A pie that fills as the node grows back, sized in screen pixels so it reads at any zoom. */
  private drawClock(view: NodeView): void {
    const r = CLOCK_PX / Math.max(0.01, view.container.worldTransform.a);
    const end = -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, view.regrow);
    const clock = view.clock;
    clock.clear();
    clock.circle(0, r * 0.12, r * 1.3).fill({ color: 0x000000, alpha: 0.25 });
    clock.circle(0, 0, r * 1.2).fill({ color: 0x1b1a18, alpha: 0.7 });
    clock
      .moveTo(0, 0)
      .lineTo(0, -r)
      .arc(0, 0, r, -Math.PI / 2, end)
      .closePath()
      .fill(CLOCK_COLOR[view.def.kind]);
    clock.circle(0, 0, r).stroke({ width: r * 0.16, color: 0xffffff, alpha: 0.85 });
  }

  position(id: string): { x: number; y: number } | null {
    const view = this.views.get(id);
    return view ? { x: view.container.x, y: view.container.y } : null;
  }

  get activeRun(): NodeRun | null {
    return this.run;
  }

  update(dt: number, wind: number): void {
    this.time += dt;
    for (const view of this.views.values()) {
      this.animate(view, dt);
      if (view.state !== "up") {
        // Out or on the way: no sway or hover, only a small wobble when the stump is tapped.
        view.shake = Math.max(0, view.shake - dt * 3);
        view.remnant.x = view.shake * Math.sin(this.time * 40) * 2;
        view.container.scale.set(1);
        continue;
      }
      const sway = Math.sin(this.time * 1.3 + view.phase) * 0.012 + wind * 0.004;
      const jolt = view.shake * Math.sin(this.time * 40);
      if (view.def.kind === "tree") {
        const canopy = view.body.children[1];
        if (canopy) canopy.rotation = sway + jolt * 0.06;
        for (const copy of view.outline.children) {
          const rim = copy.children[1];
          if (rim) rim.rotation = sway + jolt * 0.06;
        }
      } else {
        view.body.rotation = jolt * 0.04;
        view.body.x = jolt * 4;
        view.outline.rotation = view.body.rotation;
        view.outline.x = view.body.x;
      }
      // Soft at rest, bright under the pointer.
      view.outline.alpha += ((view.hover ? 0.95 : 0.5) - view.outline.alpha) * Math.min(1, dt * 10);
      view.shake = Math.max(0, view.shake - dt * 3);
      const target = 1 + view.hover * 0.04;
      view.container.scale.x += (target - view.container.scale.x) * dt * 10;
      view.container.scale.y = view.container.scale.x;
    }

    if (this.run && this.time - this.run.lastHitAt > WINDOW) {
      const faded = this.views.get(this.run.node);
      if (faded) this.endRun(faded, false);
      else this.run = null;
    }
    const view = this.run ? this.views.get(this.run.node) : undefined;
    if (this.run && view) {
      const x = view.container.x + this.run.marker.x;
      const y = view.container.y + this.run.marker.y;
      const remaining = clamp(1 - (this.time - this.run.lastHitAt) / WINDOW, 0, 1);
      const pop = easeOutBack(clamp((this.time - this.run.lastHitAt) * 4, 0, 1));
      this.marker.visible = true;
      this.marker.position.set(x, y);
      // Sized in screen pixels so the ring is exactly the hit area at any zoom.
      const px = 1 / Math.max(0.01, this.container.worldTransform.a);
      const r = this.hitRadius(this.container) * pop;
      this.marker.width = this.marker.height = r * 2.6 * (0.9 + Math.sin(this.time * 8) * 0.1);
      this.marker.alpha = 0.3 + remaining * 0.3;
      this.ring.visible = true;
      this.ring.clear();
      this.ring.circle(x, y, r).stroke({ width: 2 * px, color: 0xffffff, alpha: 0.95 });
      const arc = r + 5 * px;
      this.ring
        .moveTo(x, y - arc)
        .arc(x, y, arc, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining)
        .stroke({ width: 3 * px, color: 0xffd25a, alpha: 0.95 });
      this.ring.circle(x, y, 2 * px).fill({ color: 0xffffff, alpha: 0.95 });
      this.target.visible = true;
      this.targetX = x;
      this.targetY = y;
      this.targetR = this.hitRadius(this.container);
    } else {
      this.marker.visible = false;
      this.ring.visible = false;
      this.target.visible = false;
    }
  }
}

/** The barrel washed up on the shore. */
const BARREL_BLUE = 0x3d6e9c;
const BARREL_RUST = 0x9a5a34;
const BARREL_W = 19;
const BARREL_H = 50;

/**
 * A blue oil drum, tipped over a little and half sunk in the wet sand: rolled ribs, a lid
 * with a bung, chipped paint and rust, a strand of kelp over the top. Origin at the sand line.
 */
function drawBarrel(silhouette = false): Container {
  const root = new Container();
  const drum = new Graphics();
  drum.rotation = -0.16;
  drum.y = -1;
  const w = BARREL_W;
  const h = BARREL_H;
  const lid = 5;
  // Body: shaded in vertical strips so it reads as a cylinder.
  drum.roundRect(-w, -h, w * 2, h, 4).fill(BARREL_BLUE);
  if (!silhouette) {
    drum.rect(w * 0.45, -h + 2, w * 0.55, h - 2).fill(shade(BARREL_BLUE, -0.28));
    drum.rect(-w * 0.62, -h + 3, w * 0.34, h - 4).fill(shade(BARREL_BLUE, 0.16));
    drum.rect(-w * 0.5, -h + 4, w * 0.1, h - 8).fill({ color: 0xffffff, alpha: 0.18 });
    // Rolled ribs, curving down a touch because we look at the drum from slightly above.
    for (const y of [-h * 0.66, -h * 0.34]) {
      drum
        .moveTo(-w, y - 2)
        .quadraticCurveTo(0, y + 2, w, y - 2)
        .lineTo(w, y + 2)
        .quadraticCurveTo(0, y + 6, -w, y + 2)
        .closePath()
        .fill(shade(BARREL_BLUE, -0.38));
      drum
        .moveTo(-w, y - 2)
        .quadraticCurveTo(0, y + 2, w, y - 2)
        .stroke({ width: 1.2, color: shade(BARREL_BLUE, 0.3), alpha: 0.7 });
    }
    // Chipped paint and rust: along the ribs, the rim, the foot and a streak running down.
    drum
      .poly([-w, -12, -w * 0.4, -14, 0, -11, w * 0.5, -13, w, -10, w, -4, -w, -4])
      .fill({ color: BARREL_RUST, alpha: 0.75 });
    drum
      .poly([
        w * 0.2,
        -h * 0.66 + 3,
        w * 0.62,
        -h * 0.64 + 2,
        w * 0.5,
        -h * 0.58,
        w * 0.3,
        -h * 0.6,
      ])
      .fill(BARREL_RUST);
    drum
      .poly([
        -w * 0.8,
        -h * 0.34 + 3,
        -w * 0.35,
        -h * 0.33 + 4,
        -w * 0.5,
        -h * 0.26,
        -w * 0.75,
        -h * 0.28,
      ])
      .fill(BARREL_RUST);
    drum
      .poly([w * 0.36, -h * 0.58, w * 0.46, -h * 0.58, w * 0.42, -h * 0.44])
      .fill({ color: BARREL_RUST, alpha: 0.7 });
    drum.poly([-w * 0.1, -h + 3, w * 0.3, -h + 3, w * 0.12, -h + 8]).fill(shade(BARREL_RUST, -0.1));
    drum
      .poly([-w * 0.3, -h * 0.2, -w * 0.05, -h * 0.18, -w * 0.18, -h * 0.1])
      .fill({ color: 0xc7c2b4, alpha: 0.8 });
  }
  // Lid: the top ellipse, a darker rolled rim, and the bung.
  drum.ellipse(0, -h, w, lid).fill(shade(BARREL_BLUE, silhouette ? 0 : -0.3));
  if (!silhouette) {
    drum.ellipse(0, -h + 0.5, w - 2.5, lid - 1.6).fill(shade(BARREL_BLUE, 0.1));
    drum.ellipse(w * 0.45, -h, 3, 1.4).fill(0x2a2d31);
    drum.ellipse(w * 0.45, -h - 0.4, 2, 0.8).fill(0x8a8f94);
    // Kelp draped over the rim.
    drum
      .moveTo(-w * 0.55, -h - 2)
      .quadraticCurveTo(-w * 0.2, -h + 1, -w * 0.9, -h + 12)
      .quadraticCurveTo(-w * 1.05, -h + 20, -w * 0.8, -h + 26)
      .stroke({ width: 2.4, color: 0x3f5a2a, cap: "round" });
    drum
      .moveTo(-w * 0.3, -h - 1)
      .quadraticCurveTo(-w * 0.55, -h + 6, -w * 0.62, -h + 14)
      .stroke({ width: 1.6, color: 0x55703a, cap: "round" });
  }
  root.addChild(drum);
  if (!silhouette) {
    // Sand drifted against the foot of the drum, so it sits in the beach instead of on it.
    const sand = new Graphics();
    sand
      .moveTo(-w - 13, 4)
      .quadraticCurveTo(-w * 0.7, -12, w * 0.2, -11)
      .quadraticCurveTo(w + 4, -10, w + 14, 3)
      .quadraticCurveTo(0, 7, -w - 13, 4)
      .closePath()
      .fill(SAND);
    sand
      .moveTo(-w * 0.7, -5)
      .quadraticCurveTo(0, -9, w * 0.7, -5)
      .stroke({ width: 1.4, color: shade(SAND, 0.35), alpha: 0.8 });
    sand
      .moveTo(-w - 13, 4)
      .quadraticCurveTo(0, 7, w + 14, 3)
      .stroke({ width: 1.2, color: shade(SAND, -0.18), alpha: 0.6 });
    // A short damp shadow on the lee side.
    root.addChildAt(
      new Graphics()
        .poly([w * 0.4, -2, w + 10, -3, w + 20, 1, w + 8, 3])
        .fill({ color: shade(SAND, -0.35), alpha: 0.35 }),
      0,
    );
    root.addChild(sand);
  }
  return root;
}

export class Barrel {
  readonly container = new Container();
  private readonly glow: Sprite;
  private readonly body = new Container();
  private readonly outline = new Container();
  private readonly tag: Graphics;
  private time = 0;
  private target = 0;
  private appear = 0;
  private hover = false;

  constructor(x: number, y: number, onTap: () => void) {
    this.glow = new Sprite(glowTexture());
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.glow.tint = 0xffd25a;
    this.glow.width = 170;
    this.glow.height = 170;
    this.glow.y = -24;
    this.glow.alpha = 0;
    this.body.addChild(drawBarrel());
    for (const [dx, dy] of RIM_OFFSETS) {
      const copy = drawBarrel(true);
      copy.position.set(dx, dy);
      this.outline.addChild(copy);
    }
    this.outline.filters = [whiteFilter()];
    this.outline.alpha = 0.55;
    // Loot tag: a rounded badge with a dark edge and a pointer at the drum.
    this.tag = new Graphics();
    // One path for badge and pointer, so the edge runs around both without a seam.
    const badge = (dy: number) => {
      const [l, r, t, b, k] = [-15, 15, -96 + dy, -70 + dy, 7];
      this.tag
        .moveTo(l + k, t)
        .lineTo(r - k, t)
        .arcTo(r, t, r, t + k, k)
        .lineTo(r, b - k)
        .arcTo(r, b, r - k, b, k)
        .lineTo(6, b)
        .lineTo(0, b + 8)
        .lineTo(-6, b)
        .lineTo(l + k, b)
        .arcTo(l, b, l, b - k, k)
        .lineTo(l, t + k)
        .arcTo(l, t, l + k, t, k)
        .closePath();
    };
    badge(3);
    this.tag.fill({ color: 0x000000, alpha: 0.22 });
    badge(0);
    this.tag.fill(0xe3a32f);
    this.tag.roundRect(-15, -83, 30, 13, 6).fill({ color: 0xb87818, alpha: 0.35 });
    this.tag.roundRect(-11, -93, 22, 5, 2.5).fill({ color: 0xffffff, alpha: 0.28 });
    badge(0);
    this.tag.stroke({ width: 2, color: 0x5a3a0e, join: "round" });
    this.tag.roundRect(-2.2, -91, 4.4, 11, 2).fill(0x2a1c08).circle(0, -76, 2.4).fill(0x2a1c08);
    this.container.addChild(this.glow, this.outline, this.body, this.tag);
    this.container.position.set(x, y);
    this.container.eventMode = "static";
    this.container.cursor = "pointer";
    this.container.hitArea = {
      contains: (px: number, py: number) => Math.abs(px) < 32 && py < 10 && py > -100,
    };
    this.container.on("pointertap", onTap);
    this.container.on("pointerover", () => {
      this.hover = true;
    });
    this.container.on("pointerout", () => {
      this.hover = false;
    });
    this.container.visible = false;
  }

  set(present: boolean): void {
    this.target = present ? 1 : 0;
  }

  update(dt: number, darkness: number): void {
    this.time += dt;
    this.appear += (this.target - this.appear) * dt * 4;
    const shown = this.appear > 0.02;
    this.container.visible = shown;
    if (!shown) return;
    // Stuck in the sand: only a slow rock as the wash reaches it, while the tag bobs.
    const rock = Math.sin(this.time * 0.9) * 0.025;
    this.body.rotation = rock;
    this.outline.rotation = rock;
    this.outline.alpha += ((this.hover ? 0.95 : 0.55) - this.outline.alpha) * Math.min(1, dt * 10);
    this.container.scale.set(easeOutBack(clamp(this.appear, 0, 1)));
    this.glow.alpha = 0.08 + 0.08 * Math.sin(this.time * 3) + darkness * 0.3;
    this.tag.y = Math.sin(this.time * 3) * 4;
  }
}
