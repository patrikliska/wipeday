/**
 * Raids in the scene (W6). The base tells the story:
 * - a shield over the walls says how the defence stands (calm, raiders sighted, broken
 *   in, shielded from raids) and opens the Defence panel; on phones it is the way in.
 *   It keeps a fixed size on screen (D48) and draws in the markers layer;
 * - once raiders are sighted, their torches gather on the ridge behind the holdfast
 *   until they land: dark figures in the world, the flames on the lights layer (D47).
 */
import { Container, Graphics, Sprite } from "pixi.js";
import { glowTexture } from "./textures";
import { clamp } from "./util";

export type ShieldState = "calm" | "sighted" | "broken" | "shielded";

const COLORS: Record<ShieldState, { fill: number; rim: number }> = {
  calm: { fill: 0x2e3540, rim: 0x9aa0a6 },
  sighted: { fill: 0x5a1f1a, rim: 0xf05252 },
  broken: { fill: 0x4a3518, rim: 0xe3a32f },
  shielded: { fill: 0x1f3a52, rim: 0x6cb6f0 },
};
/** The shield's height on screen, and its tap target (CSS px, D48). */
const SHIELD_PX = 30;
const TAP_PX = 26;

export class DefenceBadge {
  readonly container = new Container();
  private readonly shield = new Graphics();
  private state: ShieldState | null = null;
  private time = 0;
  private shown = false;

  constructor(onTap: () => void) {
    this.container.addChild(this.shield);
    this.container.eventMode = "static";
    this.container.cursor = "pointer";
    this.container.hitArea = { contains: (x, y) => x * x + y * y < TAP_PX * TAP_PX };
    this.container.on("pointertap", onTap);
    this.container.visible = false;
  }

  /** `at`: world point over the walls; null hides it (before raiders come). */
  set(at: { x: number; y: number } | null, state: ShieldState): void {
    this.shown = at !== null;
    if (at) this.container.position.set(at.x, at.y);
    if (state === this.state) return;
    this.state = state;
    const { fill, rim } = COLORS[state];
    const s = SHIELD_PX / 2;
    const g = this.shield.clear();
    g.circle(0, 2, s + 6).fill({ color: 0x000000, alpha: 0.28 });
    g.moveTo(0, -s)
      .lineTo(s * 0.85, -s * 0.62)
      .quadraticCurveTo(s * 0.8, s * 0.55, 0, s)
      .quadraticCurveTo(-s * 0.8, s * 0.55, -s * 0.85, -s * 0.62)
      .closePath()
      .fill(fill)
      .stroke({ width: 2.5, color: rim });
    if (state === "broken") {
      // A crack down the face.
      g.moveTo(-2, -s + 3)
        .lineTo(3, -4)
        .lineTo(-3, 2)
        .lineTo(2, s - 5)
        .stroke({ width: 2, color: rim });
    } else if (state === "sighted") {
      // A torch flame: raiders.
      g.moveTo(0, -s * 0.55)
        .quadraticCurveTo(s * 0.42, -s * 0.05, 0, s * 0.45)
        .quadraticCurveTo(-s * 0.42, -s * 0.05, 0, -s * 0.55)
        .fill(0xffa040);
    } else {
      // A cross band: a holdfast's arms.
      g.rect(-1.5, -s * 0.7, 3, s * 1.45).fill(rim);
      g.rect(-s * 0.6, -s * 0.2, s * 1.2, 3).fill(rim);
    }
  }

  /** `scale`: world-to-screen, so the shield keeps its size on screen. */
  update(dt: number, scale: number): void {
    this.time += dt;
    this.container.visible = this.shown;
    if (!this.shown) return;
    this.container.scale.set(1 / Math.max(0.1, scale));
    this.shield.alpha = this.state === "sighted" ? 0.75 + 0.25 * Math.sin(this.time * 5) : 1;
  }
}

/** Where the raiders wait on the ridge, relative to the base's door (world units). */
const TORCHES: readonly [number, number][] = [
  [178, -168],
  [214, -176],
  [252, -166],
  [292, -172],
  [326, -160],
];

export class RaiderTorches {
  readonly container = new Container();
  /** The flames: add to the scene's lights layer at the same position. */
  readonly light = new Container();
  private readonly flames: Sprite[] = [];
  private appear = 0;
  private target = 0;
  private time = 0;

  constructor(x: number, y: number) {
    const g = new Graphics();
    for (const [dx, dy] of TORCHES) {
      // A hunched figure with a torch held high, dark against the hill.
      g.ellipse(dx, dy + 1, 7, 2).fill({ color: 0x000000, alpha: 0.25 });
      g.roundRect(dx - 4, dy - 15, 8, 15, 3).fill(0x1d1b1a);
      g.circle(dx, dy - 18, 3.6).fill(0x1d1b1a);
      g.moveTo(dx + 3, dy - 11)
        .lineTo(dx + 8, dy - 26)
        .stroke({ width: 2, color: 0x3b2a1c });
      g.moveTo(dx + 8, dy - 34)
        .quadraticCurveTo(dx + 12, dy - 28, dx + 8, dy - 25)
        .quadraticCurveTo(dx + 4, dy - 28, dx + 8, dy - 34)
        .fill(0xffa040);
      const flame = new Sprite(glowTexture());
      flame.anchor.set(0.5);
      flame.blendMode = "add";
      flame.tint = 0xff9a3c;
      flame.width = 70;
      flame.height = 70;
      flame.position.set(dx + 8, dy - 29);
      this.light.addChild(flame);
      this.flames.push(flame);
    }
    this.container.addChild(g);
    this.container.position.set(x, y);
    this.light.position.set(x, y);
    this.container.visible = false;
    this.light.visible = false;
  }

  /** Raiders sighted and on their way. */
  set(on: boolean): void {
    this.target = on ? 1 : 0;
  }

  update(dt: number, darkness: number): void {
    this.time += dt;
    this.appear += (this.target - this.appear) * Math.min(1, dt * 2);
    const shown = this.appear > 0.02;
    this.container.visible = shown;
    this.light.visible = shown;
    if (!shown) return;
    this.container.alpha = clamp(this.appear, 0, 1);
    for (const [index, flame] of this.flames.entries()) {
      flame.alpha =
        (0.35 + darkness * 0.65) *
        (0.8 + 0.2 * Math.sin(this.time * 9 + index * 1.7)) *
        this.appear;
    }
  }
}
