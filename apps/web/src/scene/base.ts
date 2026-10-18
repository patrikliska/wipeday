/**
 * The house: the base's one structure, drawn for the run's era (lean-to, cabin, stone house,
 * sheet-metal shed, armoured bunker) in the era's materials, with today's tier pop when an era
 * is bought (docs/redesign/02-the-run.md 6.2). The lines stand around it (`lines.ts`).
 */
import { Container, Graphics } from "pixi.js";
import type { Tier } from "../state/world";
import { Glow, type Particles } from "./effects";
import { MATERIALS, type Material, SKINS } from "./palette";
import { artSprite } from "./pixel";
import { easeOutBack, rand, shade } from "./util";

interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// --- material painters -----------------------------------------------------------

function planks(g: Graphics, x: number, y: number, w: number, h: number, m: Material): void {
  g.rect(x, y, w, h).fill(m.wall);
  for (let yy = y + 14; yy < y + h; yy += 16)
    g.rect(x, yy, w, 2).fill({ color: m.wallDark, alpha: 0.8 });
  g.rect(x, y, 4, h).fill(m.wallDark);
  g.rect(x + w - 4, y, 4, h).fill(m.wallDark);
}

function blocks(g: Graphics, x: number, y: number, w: number, h: number, m: Material): void {
  g.rect(x, y, w, h).fill(m.wallDark);
  const bh = 18;
  for (let row = 0, yy = y; yy < y + h; row++, yy += bh) {
    const offset = row % 2 === 0 ? 0 : 22;
    for (let xx = x - offset; xx < x + w; xx += 44) {
      const bx = Math.max(x, xx);
      const bw = Math.min(x + w, xx + 44) - bx;
      if (bw <= 2) continue;
      const tone = ((row * 7 + Math.abs(xx)) % 3) * 0.05 - 0.05;
      g.rect(bx + 1, yy + 1, bw - 2, Math.min(bh, y + h - yy) - 2).fill(shade(m.wall, tone));
    }
  }
}

function sheets(g: Graphics, x: number, y: number, w: number, h: number, m: Material): void {
  g.rect(x, y, w, h).fill(m.wall);
  for (let xx = x; xx < x + w; xx += 34) {
    g.rect(xx, y, 2, h).fill({ color: m.wallDark, alpha: 0.9 });
    for (let yy = y + 10; yy < y + h; yy += 22) g.circle(xx + 8, yy, 1.8).fill(m.wallDark);
  }
  g.rect(x, y, w, 6).fill(m.wallDark);
}

function plates(g: Graphics, x: number, y: number, w: number, h: number, m: Material): void {
  g.rect(x, y, w, h).fill(m.wallDark);
  for (let yy = y; yy < y + h; yy += 40) {
    for (let xx = x; xx < x + w; xx += 60) {
      const pw = Math.min(60, x + w - xx) - 4;
      const ph = Math.min(40, y + h - yy) - 4;
      g.rect(xx + 2, yy + 2, pw, ph).fill(shade(m.wall, 0.06));
      g.circle(xx + 8, yy + 8, 2).fill(m.trim);
      g.circle(xx + pw - 4, yy + ph - 4, 2).fill(m.trim);
    }
  }
}

function door(g: Graphics, x: number, y: number, w: number, h: number, m: Material): void {
  g.roundRect(x, y, w, h, 4).fill(m.trim);
  g.roundRect(x + 3, y + 3, w - 6, h - 3, 3).fill(shade(m.trim, 0.12));
  g.circle(x + w - 8, y + h * 0.55, 2.2).fill(0xd9c27a);
}

function windowPane(g: Graphics, x: number, y: number, w: number, h: number, m: Material): void {
  g.rect(x - 3, y - 3, w + 6, h + 6).fill(m.trim);
  g.rect(x, y, w, h).fill(0x1c2733);
  g.rect(x + w / 2 - 1, y, 2, h).fill(m.trim);
  g.rect(x, y + h / 2 - 1, w, 2).fill(m.trim);
}

/** Draws the structure for a tier with its bottom centre at (0, 0). Returns window rects for glows. */
function drawStructure(tier: Tier, g: Graphics, skin: string | null): WindowRect[] {
  const m: Material = { ...MATERIALS[tier], ...(skin ? SKINS[skin] : {}) };
  const windows: WindowRect[] = [];
  switch (tier) {
    case "twig": {
      g.moveTo(-84, 0).lineTo(0, -92).lineTo(84, 0).closePath().fill(m.wall);
      for (let i = -60; i <= 60; i += 20) {
        g.moveTo(i, 0)
          .lineTo(i * 0.2, -76 + Math.abs(i) * 0.2)
          .stroke({ width: 3, color: m.trim, alpha: 0.6 });
      }
      g.moveTo(-94, 4).lineTo(0, -100).lineTo(94, 4).stroke({ width: 9, color: m.roof });
      g.rect(-32, -36, 28, 36).fill(shade(m.trim, -0.25));
      windows.push({ x: -18, y: -20, w: 24, h: 28 });
      break;
    }
    case "wood": {
      planks(g, -110, -120, 220, 120, m);
      g.moveTo(-126, -118).lineTo(0, -196).lineTo(126, -118).closePath().fill(m.roof);
      g.moveTo(-126, -118)
        .lineTo(0, -196)
        .lineTo(126, -118)
        .stroke({ width: 5, color: m.roofDark });
      g.rect(60, -186, 18, 42).fill(m.trim);
      door(g, -18, -68, 36, 68, m);
      windowPane(g, 30, -92, 34, 30, m);
      windows.push({ x: 47, y: -77, w: 34, h: 30 });
      g.rect(-116, -6, 232, 8).fill(m.trim);
      break;
    }
    case "stone": {
      blocks(g, -130, -150, 260, 150, m);
      g.moveTo(-148, -148)
        .lineTo(-100, -212)
        .lineTo(100, -212)
        .lineTo(148, -148)
        .closePath()
        .fill(m.roof);
      for (let x = -140; x < 140; x += 22) {
        g.moveTo(x, -150)
          .lineTo(x + 8, -208)
          .stroke({ width: 1.5, color: m.roofDark, alpha: 0.5 });
      }
      g.moveTo(-148, -148)
        .lineTo(-100, -212)
        .lineTo(100, -212)
        .lineTo(148, -148)
        .stroke({ width: 4, color: m.roofDark });
      g.rect(70, -250, 22, 50).fill(m.wallDark).rect(66, -254, 30, 8).fill(m.trim);
      door(g, -20, -74, 40, 74, MATERIALS.wood);
      windowPane(g, -100, -110, 36, 34, m);
      windowPane(g, 44, -110, 36, 34, m);
      windows.push({ x: -82, y: -93, w: 36, h: 34 }, { x: 62, y: -93, w: 36, h: 34 });
      g.rect(-136, -6, 272, 8).fill(m.wallDark);
      break;
    }
    case "metal": {
      sheets(g, -150, -170, 300, 170, m);
      g.rect(-160, -182, 320, 16).fill(m.roof).rect(-160, -182, 320, 4).fill(m.roofDark);
      g.rect(-40, -226, 14, 46).fill(m.trim).circle(-33, -230, 5).fill(0xf05252);
      g.rect(90, -200, 28, 20).fill(m.wallDark).rect(94, -206, 20, 6).fill(m.trim);
      door(g, -26, -84, 52, 84, m);
      g.rect(-26, -84, 52, 6).fill(0xe3a32f).rect(-26, -78, 52, 6).fill(0x1b1a18);
      windowPane(g, -118, -124, 44, 26, m);
      windowPane(g, 64, -124, 44, 26, m);
      windows.push({ x: -96, y: -111, w: 44, h: 26 }, { x: 86, y: -111, w: 44, h: 26 });
      break;
    }
    case "hqm": {
      plates(g, -170, -190, 340, 190, m);
      g.rect(-182, -204, 364, 18).fill(m.roof).rect(-182, -204, 364, 4).fill(m.trim);
      g.rect(100, -236, 40, 32)
        .fill(m.roofDark)
        .rect(120, -230, 46, 8)
        .fill(m.trim)
        .circle(120, -240, 12)
        .fill(m.roofDark);
      g.rect(-150, -240, 10, 36).fill(m.roofDark).rect(-166, -246, 40, 14).fill(m.trim);
      door(g, -30, -94, 60, 94, m);
      for (let i = 0; i < 6; i++)
        g.rect(-30 + i * 10, -94, 5, 10).fill(i % 2 ? 0x1b1a18 : 0xe3a32f);
      windowPane(g, -132, -140, 40, 24, m);
      windowPane(g, 80, -140, 40, 24, m);
      windows.push({ x: -112, y: -128, w: 40, h: 24 }, { x: 100, y: -128, w: 40, h: 24 });
      break;
    }
  }
  return windows;
}

/** Where the chimney smoke comes from, per tier (structure space). */
const CHIMNEY: Record<Tier, { x: number; y: number } | null> = {
  twig: null,
  wood: { x: 69, y: -190 },
  stone: { x: 81, y: -256 },
  metal: { x: 104, y: -208 },
  hqm: null,
};

/** Footprint of each tier, for the scaffold outline. */
const FOOTPRINT: Record<Tier, [number, number]> = {
  twig: [180, 100],
  wood: [260, 200],
  stone: [300, 215],
  metal: [330, 230],
  hqm: [370, 250],
};

/** The stand-in drawing is made large and shown at this scale (the old scene's 0.4). */
const PROCEDURAL_SCALE = 0.4;

export class House {
  readonly container = new Container();
  /** Window glows, drawn above the night tint (D47); the scene stacks it on `lights`. */
  readonly lights = new Container();
  private structure: Container | null = null;
  private windowGlows: Glow[] = [];
  private floodGlow: Glow | null = null;
  private tier: Tier | null = null;
  private skin: string | null = null;
  private buildAnim = 0;
  private time = 0;
  /** The structure's drawing units: 1 for pixel art, PROCEDURAL_SCALE for the stand-in. */
  private unit = 1;
  private width = 180 * PROCEDURAL_SCALE;
  private smokeTimer = 0;

  constructor(private readonly particles: Particles) {}

  /** The house for `tier`; with `animate`, it pops up in a puff of dust. */
  setTier(tier: Tier, animate: boolean, skin: string | null = this.skin): void {
    if (tier === this.tier && skin === this.skin) return;
    this.tier = tier;
    this.skin = skin;
    this.structure?.destroy({ children: true });
    for (const glow of this.windowGlows) glow.sprite.destroy();
    this.windowGlows = [];
    this.floodGlow?.sprite.destroy();
    this.floodGlow = null;
    this.structure = new Container();
    this.container.addChild(this.structure);
    // Pixel art when the tier has it (`house/<tier>`); the stand-in drawing at its scale if not.
    const sprite = skin ? null : artSprite(`house/${tier}`);
    this.unit = sprite ? 1 : PROCEDURAL_SCALE;
    if (sprite) {
      this.structure.addChild(sprite);
      this.width = sprite.texture.frame.width * sprite.scale.x;
    } else {
      const g = new Graphics();
      const windows = drawStructure(tier, g, skin);
      g.scale.set(PROCEDURAL_SCALE);
      this.structure.addChild(g);
      this.width = FOOTPRINT[tier][0] * PROCEDURAL_SCALE;
      for (const w of windows) {
        const glow = new Glow(0xffc46b, Math.max(w.w, w.h) * 3.2 * PROCEDURAL_SCALE, 0.9);
        glow.sprite.position.set(w.x * PROCEDURAL_SCALE, w.y * PROCEDURAL_SCALE);
        this.lights.addChild(glow.sprite);
        this.windowGlows.push(glow);
      }
      if (tier === "hqm") {
        this.floodGlow = new Glow(0xdff6ff, 360 * PROCEDURAL_SCALE, 0.8);
        this.floodGlow.sprite.position.set(-120 * PROCEDURAL_SCALE, -160 * PROCEDURAL_SCALE);
        this.lights.addChild(this.floodGlow.sprite);
      }
    }
    this.buildAnim = animate ? 1 : 0;
    if (animate)
      this.particles.spawn("dust", this.container.x, this.container.y - 10, 26, 0xc9b78a);
  }

  /** The door, in world units: hands walk out from here. */
  get door(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  /** Half the house's width in world units, for spacing what stands beside it. */
  get halfWidth(): number {
    return (this.width / 2) * this.container.scale.x;
  }

  update(dt: number, darkness: number): void {
    this.time += dt;
    this.lights.position.copyFrom(this.container.position);
    this.lights.scale.copyFrom(this.container.scale);
    if (this.structure) {
      if (this.buildAnim > 0) {
        this.buildAnim = Math.max(0, this.buildAnim - dt * 0.9);
        const s = easeOutBack(1 - this.buildAnim);
        this.structure.scale.set(0.75 + 0.25 * s, 0.6 + 0.4 * s);
        if (this.buildAnim > 0.6 && Math.random() < 0.5) {
          this.particles.spawn(
            "dust",
            this.container.x + rand(-80, 80),
            this.container.y - 4,
            1,
            0xc9b78a,
          );
        }
      } else {
        this.structure.scale.set(1);
      }
    }
    for (const glow of this.windowGlows) glow.update(darkness, Math.sin(this.time * 3.1) * 0.03);
    this.floodGlow?.update(darkness, Math.sin(this.time * 9) * 0.02);
    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.4;
      // The stand-in drawing's chimneys; pixel houses smoke from their art (S3).
      const spot = this.tier && this.unit !== 1 ? CHIMNEY[this.tier] : null;
      if (spot && Math.random() < 0.5) {
        const scale = this.container.scale.x * this.unit;
        this.particles.spawn(
          "smoke",
          this.container.x + spot.x * scale,
          this.container.y + spot.y * scale,
          1,
          0xb5b5b5,
        );
      }
    }
  }
}
