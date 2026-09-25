/**
 * Resource nodes (trees, rocks, a fibre patch) and the barrel on the shore.
 * Nodes are clickable; a click starts the "work the node" game: a marker
 * appears on the node, hit it before it fades, five times.
 */
import { Container, Graphics, Sprite } from "pixi.js";
import { FIBRE, ORE_VEIN, ROCK, ROCK_DARK, SULFUR_VEIN, TREE_CANOPY, TREE_TRUNK } from "./palette";
import { glowTexture } from "./textures";
import { clamp, easeOutBack, hash, pick, rand } from "./util";

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
  onRunOver: (node: string, perfect: boolean) => void;
}

export const MAX_HITS = 5;
const WINDOW = 4.5;

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

function drawRock(kind: "ore" | "sulfur", scale: number): Container {
  const c = new Container();
  const g = new Graphics();
  g.ellipse(0, 2, 44, 6).fill({ color: 0x000000, alpha: 0.25 });
  g.moveTo(-40, 0)
    .lineTo(-30, -34)
    .lineTo(-6, -52)
    .lineTo(24, -44)
    .lineTo(42, -14)
    .lineTo(36, 0)
    .closePath()
    .fill(ROCK);
  g.moveTo(-30, -34)
    .lineTo(-6, -52)
    .lineTo(24, -44)
    .lineTo(8, -30)
    .closePath()
    .fill({ color: 0xffffff, alpha: 0.12 });
  g.moveTo(24, -44)
    .lineTo(42, -14)
    .lineTo(36, 0)
    .lineTo(8, -30)
    .closePath()
    .fill({ color: ROCK_DARK, alpha: 0.5 });
  const vein = kind === "ore" ? ORE_VEIN : SULFUR_VEIN;
  const seed = kind === "ore" ? 1 : 2;
  for (let i = 0; i < 6; i++) {
    g.circle(-22 + hash(i * 3 + seed) * 44, -8 - hash(i * 5 + seed) * 34, 3 + hash(i * 7) * 3).fill(
      vein,
    );
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

export class Nodes {
  readonly container = new Container();
  private readonly views = new Map<string, NodeView>();
  private readonly marker: Sprite;
  private readonly ring: Graphics;
  private run: NodeRun | null = null;
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
    this.container.addChild(this.marker, this.ring);
  }

  private tap(view: NodeView, localX: number, localY: number): void {
    const now = this.time;
    if (this.run && this.run.node === view.def.id) {
      const distance = Math.hypot(localX - this.run.marker.x, localY - this.run.marker.y);
      if (distance < 36) {
        this.run.hits += 1;
        this.run.lastHitAt = now;
        view.shake = 1;
        this.callbacks.onHit(
          view.def.id,
          this.run.hits,
          view.container.x + this.run.marker.x,
          view.container.y + this.run.marker.y,
        );
        if (this.run.hits >= MAX_HITS) {
          this.callbacks.onRunOver(view.def.id, true);
          this.run = null;
        } else {
          this.run.marker = this.randomSpot(view);
        }
      } else {
        this.callbacks.onRunOver(view.def.id, false);
        this.run = null;
      }
      return;
    }
    view.shake = 1;
    this.run = { node: view.def.id, hits: 0, marker: this.randomSpot(view), lastHitAt: now };
    this.callbacks.onStart(view.def.id);
  }

  private randomSpot(view: NodeView): { x: number; y: number } {
    const s = view.def.scale;
    if (view.def.kind === "tree") return { x: rand(-40, 40) * s, y: rand(-140, -80) * s };
    if (view.def.kind === "fibre") return { x: rand(-24, 24) * s, y: rand(-46, -16) * s };
    return { x: rand(-30, 30) * s, y: rand(-44, -12) * s };
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
      this.callbacks.onRunOver(this.run.node, false);
      this.run = null;
    }
    const view = this.run ? this.views.get(this.run.node) : undefined;
    if (this.run && view) {
      const x = view.container.x + this.run.marker.x;
      const y = view.container.y + this.run.marker.y;
      const remaining = clamp(1 - (this.time - this.run.lastHitAt) / WINDOW, 0, 1);
      const pop = easeOutBack(clamp((this.time - this.run.lastHitAt) * 4, 0, 1));
      this.marker.visible = true;
      this.marker.position.set(x, y);
      this.marker.width = this.marker.height = 110 * pop * (0.9 + Math.sin(this.time * 8) * 0.1);
      this.marker.alpha = 0.6 + remaining * 0.4;
      this.ring.visible = true;
      this.ring.clear();
      this.ring.circle(x, y, 26).stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
      this.ring
        .moveTo(x, y - 32)
        .arc(x, y, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining)
        .stroke({ width: 4, color: 0xffd25a, alpha: 0.95 });
      this.ring
        .moveTo(x - 10, y)
        .lineTo(x + 10, y)
        .moveTo(x, y - 10)
        .lineTo(x, y + 10)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    } else {
      this.marker.visible = false;
      this.ring.visible = false;
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
