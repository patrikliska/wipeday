/**
 * Resource nodes (trees, rocks, a fibre patch) and the barrel on the shore.
 * Nodes are clickable; a click starts the "work the node" game: a marker
 * appears on the node, hit it before it fades, five times.
 */
import { Container, Graphics, Sprite } from "pixi.js";
import { FIBRE, ORE_VEIN, ROCK, ROCK_DARK, SULFUR_VEIN, TREE_CANOPY, TREE_TRUNK } from "./palette";
import { glowTexture } from "./textures";
import { clamp, easeOutBack, hash, pick, rand, shade } from "./util";

export type NodeKind = "tree" | "ore" | "sulfur" | "fibre";

export interface NodeDef {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  scale: number;
}

interface NodeView {
  def: NodeDef;
  container: Container;
  body: Container;
  phase: number;
  shake: number;
  hover: number;
}

export interface NodeRun {
  node: string;
  hits: number;
  marker: { x: number; y: number };
  lastHitAt: number;
}

export interface NodeCallbacks {
  onStart: (node: string) => void;
  onHit: (node: string, hits: number, x: number, y: number) => void;
  /** `x`, `y`: the marker's last position in world units, where the player was looking. */
  onRunOver: (node: string, perfect: boolean, x: number, y: number) => void;
}

export const MAX_HITS = 5;
const WINDOW = 4.5;
/** Marker hit radius in CSS pixels: tight for a mouse, finger-sized on touch. The ring shows exactly this. */
const HIT_PX = { mouse: 18, touch: 26 };
/** The next marker lands at least this many hit radii away, so every hit needs a new aim. */
const MIN_JUMP = 2.5;

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

function drawRock(kind: "ore" | "sulfur", scale: number): Container {
  const c = new Container();
  const g = new Graphics();
  const seed = kind === "ore" ? 1 : 2;
  // Contact shadow hugging the base, longer on the right (light comes from the left).
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
  // Veins: a dark crack, then nuggets (ore) or crystals (sulfur) along it.
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
  // Pebbles at the foot.
  drawPebble(g, -46, 1, 6, 5, shade(ROCK, -0.05));
  drawPebble(g, -37, 2, 4, 3, ROCK_DARK);
  drawPebble(g, 39, 2, 5, 3.5, shade(ROCK, 0.02));
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
      const body =
        def.kind === "tree"
          ? drawTree(def.scale)
          : def.kind === "fibre"
            ? drawFibre(def.scale)
            : drawRock(def.kind, def.scale);
      const container = new Container();
      container.position.set(def.x, def.y);
      container.addChild(body);
      container.eventMode = "static";
      container.cursor = "pointer";
      const halfWidth = 50 * def.scale;
      const height = (def.kind === "tree" ? 170 : def.kind === "fibre" ? 60 : 60) * def.scale;
      container.hitArea = {
        contains: (x: number, y: number) => x > -halfWidth && x < halfWidth && y < 8 && y > -height,
      };
      const view: NodeView = {
        def,
        container,
        body,
        phase: hash(def.x) * 6.28,
        shake: 0,
        hover: 0,
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
    this.run = { node: view.def.id, hits: 0, marker: this.randomSpot(view), lastHitAt: now };
    this.callbacks.onStart(view.def.id);
  }

  private hit(view: NodeView): void {
    const run = this.run;
    if (!run || run.node !== view.def.id) return;
    run.hits += 1;
    run.lastHitAt = this.time;
    view.shake = 1;
    this.callbacks.onHit(
      view.def.id,
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

  private endRun(view: NodeView, perfect: boolean): void {
    const marker = this.run?.marker ?? { x: 0, y: -40 };
    this.run = null;
    this.callbacks.onRunOver(
      view.def.id,
      perfect,
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
    if (view) view.shake = 1;
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
      const sway = Math.sin(this.time * 1.3 + view.phase) * 0.012 + wind * 0.004;
      const jolt = view.shake * Math.sin(this.time * 40);
      if (view.def.kind === "tree") {
        const canopy = view.body.children[1];
        if (canopy) canopy.rotation = sway + jolt * 0.06;
      } else {
        view.body.rotation = jolt * 0.04;
        view.body.x = jolt * 4;
      }
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
export class Barrel {
  readonly container = new Container();
  private readonly glow: Sprite;
  private readonly body: Graphics;
  private readonly tag: Graphics;
  private time = 0;
  private target = 0;
  private appear = 0;

  constructor(
    private readonly x: number,
    private readonly y: number,
    onTap: () => void,
  ) {
    this.glow = new Sprite(glowTexture());
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.glow.tint = 0xffd25a;
    this.glow.width = 170;
    this.glow.height = 170;
    this.glow.alpha = 0;
    this.body = new Graphics();
    this.body.roundRect(-18, -48, 36, 48, 6).fill(0x4a6b8a);
    this.body
      .rect(-18, -40, 36, 4)
      .fill(0x2f4a63)
      .rect(-18, -26, 36, 4)
      .fill(0x2f4a63)
      .rect(-18, -12, 36, 4)
      .fill(0x2f4a63);
    this.body.roundRect(-14, -44, 10, 40, 3).fill({ color: 0xffffff, alpha: 0.12 });
    this.body.circle(6, -30, 5).fill(0xe3a32f);
    this.tag = new Graphics();
    this.tag.roundRect(-14, -84, 28, 24, 6).fill(0xe3a32f);
    this.tag.moveTo(-6, -60).lineTo(0, -52).lineTo(6, -60).closePath().fill(0xe3a32f);
    this.tag.rect(-2, -78, 4, 10).fill(0x1b1a18).circle(0, -65, 2.2).fill(0x1b1a18);
    this.container.addChild(this.glow, this.body, this.tag);
    this.container.position.set(x, y);
    this.container.eventMode = "static";
    this.container.cursor = "pointer";
    this.container.hitArea = {
      contains: (px: number, py: number) => Math.abs(px) < 30 && py < 10 && py > -90,
    };
    this.container.on("pointertap", onTap);
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
    this.container.position.set(this.x, this.y + Math.sin(this.time * 1.6) * 4);
    this.body.rotation = Math.sin(this.time * 1.1) * 0.08;
    this.container.scale.set(easeOutBack(clamp(this.appear, 0, 1)));
    this.glow.alpha = 0.08 + 0.08 * Math.sin(this.time * 3) + darkness * 0.3;
    this.tag.y = Math.sin(this.time * 3) * 4;
  }
}
