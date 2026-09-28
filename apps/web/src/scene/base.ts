/**
 * The base: the structure for the current tier, the stations around it and
 * the build animation. Everything the player owns should be visible here.
 */
import { Container, Graphics } from "pixi.js";
import type { Tier } from "../state/world";
import { drawFlame, FOOTPRINTS, makeBuilding } from "./buildings";
import { Glow, type Particles } from "./effects";
import { MATERIALS, type Material } from "./palette";
import type { Station } from "./station";
import { clamp, easeOutBack, lerp, rand, shade } from "./util";

/** What stands around the base, as the scene reads it from the store. */
interface Owned {
  /** Building id -> level. */
  buildings: Record<string, number>;
  furnaceSlots: number;
  /** Crates in the inventory. */
  crates: number;
  /** Buildings going up right now, by id (their scaffold shows). */
  constructing: string[];
}

/**
 * Where each building stands, in world units from the base's door (x) and the ground line
 * (y, negative = up the slope behind). Layers: `back` up the slope, peeking over the strip
 * and the wall; `front` in the yard. Everything fits the phone view (about -535 to +345
 * from the door, D69); the dock reaches out over the water past its left edge on purpose.
 * The cupboard and furnaces (left) and the workbench and campfire (right) keep the strip
 * either side of the house; crates stack by the door.
 */
const SPOTS: Record<string, { x: number; y: number; layer: "back" | "front" }> = {
  watchtower: { x: -480, y: -10, layer: "back" },
  bunkhouse: { x: -410, y: -44, layer: "back" },
  warehouse: { x: -318, y: -48, layer: "back" },
  kiln: { x: -246, y: -46, layer: "back" },
  press: { x: -198, y: -42, layer: "back" },
  radio_mast: { x: 196, y: -40, layer: "back" },
  generator: { x: 250, y: -56, layer: "back" },
  loom: { x: 310, y: -60, layer: "back" },
  dock: { x: -505, y: 22, layer: "front" },
  tannery: { x: -272, y: 40, layer: "front" },
  garden: { x: -150, y: 58, layer: "front" },
  lights: { x: -10, y: 44, layer: "front" },
};
/** The wall runs behind everything, from here to here (world units from the door). */
const WALL_SPAN: [number, number] = [-390, 410];
/** The station layers are drawn at this scale; spots above are in world units. */
const STATION_SCALE = 0.85;

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
function drawStructure(tier: Tier, g: Graphics): WindowRect[] {
  const m = MATERIALS[tier];
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

// --- station drawings ---------------------------------------------------------------

function drawCupboard(): Container {
  const c = new Container();
  const g = new Graphics();
  g.rect(-16, -46, 32, 46).fill(0x6b4423);
  g.rect(-13, -43, 26, 18).fill(0x8a5a30).rect(-13, -22, 26, 18).fill(0x8a5a30);
  g.circle(0, -23, 4).fill(0xd9c27a);
  c.addChild(g);
  return c;
}

function drawCrates(count: number): Container {
  const c = new Container();
  const g = new Graphics();
  const stacks = Math.min(count, 6);
  for (let i = 0; i < stacks; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = -26 + col * 30 + (row % 2) * 6;
    const y = -row * 28;
    g.rect(x, y - 26, 28, 26)
      .fill(0x9a6a3a)
      .stroke({ width: 2, color: 0x5a3d26 });
    g.moveTo(x + 2, y - 24)
      .lineTo(x + 26, y - 2)
      .moveTo(x + 26, y - 24)
      .lineTo(x + 2, y - 2)
      .stroke({ width: 2, color: 0x5a3d26, alpha: 0.7 });
  }
  c.addChild(g);
  return c;
}

/** Half-width of the furnace body at height y (it tapers from 32 at the base to 23 under the cap). */
const furnaceHalfWidth = (y: number): number => lerp(32, 23, clamp((-y - 8) / 62, 0, 1));

/** The arched mouth, as a path on `g` (not filled). */
function furnaceMouth(g: Graphics, halfWidth: number, bottom: number, springY: number): Graphics {
  return g
    .moveTo(-halfWidth, bottom)
    .lineTo(-halfWidth, springY)
    .arc(0, springY, halfWidth, Math.PI, 0)
    .lineTo(halfWidth, bottom)
    .closePath();
}

/** The electric smelter (furnace level 3): a riveted cabinet with a glowing window. */
function makeElectricFurnace(index: number): Station {
  const container = new Container();
  const g = new Graphics();
  g.ellipse(0, 0, 38, 7).fill({ color: 0x000000, alpha: 0.22 });
  g.roundRect(-32, -86, 64, 86, 4).fill(0x6b625a);
  g.rect(-32, -86, 8, 86).fill({ color: 0xffffff, alpha: 0.08 });
  g.rect(24, -86, 8, 86).fill({ color: 0x000000, alpha: 0.18 });
  for (const y of [-78, -8]) for (const x of [-26, -10, 10, 26]) g.circle(x, y, 1.6).fill(0x9aa0a6);
  g.roundRect(-20, -58, 40, 30, 3).fill(0x1b1a18);
  g.rect(-4, -106, 8, 20).fill(0x3b3833);
  g.rect(20, -24, 10, 6).fill(0x9fd4ff);
  const fire = new Container();
  const window_ = new Graphics();
  fire.addChild(window_);
  const glow = new Glow(0xff8a3c, 120, 1);
  glow.sprite.position.set(0, -44);
  container.addChild(g, fire, glow.sprite);
  return {
    id: "furnace",
    container,
    glow,
    fire,
    chimney: { x: 0, y: -106 },
    animate: (t) => {
      const f = 0.8 + Math.sin(t * 11 + index) * 0.2;
      window_
        .clear()
        .roundRect(-17, -55, 34, 24, 2)
        .fill({ color: 0xff6a1a, alpha: 0.6 + 0.4 * f });
    },
  };
}

function makeFurnace(index: number, size = 1): Station {
  const container = new Container();
  container.scale.set(size);
  const g = new Graphics();
  // Contact shadow and plinth.
  g.ellipse(0, 0, 40, 7).fill({ color: 0x000000, alpha: 0.22 });
  g.roundRect(-37, -10, 74, 10, 3).fill(0x4a4d50);
  g.rect(-37, -10, 74, 3).fill(0x5d6064);
  // Body: mortar first, then stones that stay inside the taper.
  g.moveTo(-32, -8).lineTo(-23, -70).lineTo(23, -70).lineTo(32, -8).closePath().fill(0x3f4246);
  const tones = [0x7c7f83, 0x707377, 0x676a6e, 0x75787c];
  for (let row = 0; row < 5; row++) {
    const top = -70 + row * 12.4;
    let x = -furnaceHalfWidth(top + 6) + 1;
    const right = furnaceHalfWidth(top + 6) - 1;
    let n = row * 3 + index;
    while (x < right - 3) {
      const width = Math.min(right - x, row % 2 === 0 ? 12 + (n % 3) * 3 : 10 + ((n + 1) % 3) * 4);
      g.roundRect(x, top + 1, width - 1.5, 10.4, 2).fill(tones[n % tones.length] ?? 0x707377);
      x += width;
      n++;
    }
  }
  // Light from the left, shade on the right.
  g.moveTo(14, -70).lineTo(23, -70).lineTo(32, -8).lineTo(20, -8).closePath();
  g.fill({ color: 0x000000, alpha: 0.2 });
  g.moveTo(-23, -70).lineTo(-19, -70).lineTo(-27, -8).lineTo(-32, -8).closePath();
  g.fill({ color: 0xffffff, alpha: 0.08 });
  // Iron band with rivets.
  const bandHalf = furnaceHalfWidth(-52);
  g.rect(-bandHalf - 1, -55, bandHalf * 2 + 2, 5).fill(0x3b3833);
  for (const rx of [-bandHalf + 4, -7, 7, bandHalf - 4]) g.circle(rx, -52.5, 1.3).fill(0x8a847a);
  // Capstone slab and the chimney pipe.
  g.roundRect(-27, -77, 54, 8, 2).fill(0x5d6064);
  g.rect(-27, -77, 54, 2).fill(0x85888c);
  g.rect(-6, -98, 12, 22).fill(0x3b3833);
  g.rect(-6, -98, 4, 22).fill({ color: 0xffffff, alpha: 0.08 });
  g.roundRect(-8, -102, 16, 5, 1.5).fill(0x2e2b27);
  // Arched mouth: a ring of lighter voussoirs, then the dark hole and its grate.
  furnaceMouth(g, 17, -8, -30).fill(0x8a8d90);
  for (let i = 1; i < 5; i++) {
    const angle = Math.PI + (i * Math.PI) / 5;
    g.moveTo(Math.cos(angle) * 12, -30 + Math.sin(angle) * 12)
      .lineTo(Math.cos(angle) * 17, -30 + Math.sin(angle) * 17)
      .stroke({ width: 1.2, color: 0x3f4246 });
  }
  furnaceMouth(g, 12, -8, -30).fill(0x1b1a18);
  g.rect(-12, -14, 24, 2).fill(0x4a4540);
  for (let bx = -9; bx <= 9; bx += 6) g.rect(bx - 1, -14, 2, 6).fill(0x4a4540);
  // Lit interior, embers and flames: hidden while the furnace is idle.
  const fire = new Container();
  const interior = new Graphics();
  const flame = new Graphics();
  flame.position.set(0, -12);
  fire.addChild(interior, flame);
  const glow = new Glow(0xff8a3c, 120, 1);
  glow.sprite.position.set(0, -26);
  container.addChild(g, fire, glow.sprite);
  return {
    id: "furnace",
    container,
    glow,
    fire,
    chimney: { x: 0, y: -102 },
    animate: (t) => {
      const f = 0.85 + Math.sin(t * 17 + index) * 0.15;
      interior.clear();
      furnaceMouth(interior, 12, -8, -30).fill({ color: 0x6e2410, alpha: 0.95 });
      furnaceMouth(interior, 9, -9, -28).fill({ color: 0xb8461c, alpha: 0.45 + 0.3 * f });
      interior.rect(-11, -12, 22, 3).fill({ color: 0xffb347, alpha: 0.7 + 0.3 * f });
      drawFlame(flame, f, 0.6);
    },
  };
}

// --- the base -------------------------------------------------------------------------

export class Base {
  readonly container = new Container();
  /**
   * Fire and glows, drawn above the scene's night tint so flames stay warm in the dark.
   * Mirrors `container`; the scene stacks it after the ambient layer.
   */
  readonly lights = new Container();
  private readonly lightStations = new Container();
  private readonly stationsLayer = new Container();
  /** Buildings up the slope behind the house, and the wall. */
  private readonly backLayer = new Container();
  /** Buildings in the yard in front of the house (garden, lamp posts). */
  private readonly frontLayer = new Container();
  /** Scaffolds over buildings being built. */
  private scaffolds: Graphics[] = [];
  private readonly structureLayer = new Container();
  private readonly glowLayer = new Container();
  private structure: Container | null = null;
  private scaffold: Graphics | null = null;
  private windowGlows: Glow[] = [];
  private floodGlow: Glow | null = null;
  private stations: Station[] = [];
  private stationsKey = "";
  private tier: Tier | null = null;
  private buildAnim = 0;
  private time = 0;
  private smokeTimer = 0;
  private furnaceActive = false;

  constructor(private readonly particles: Particles) {
    for (const layer of [this.backLayer, this.stationsLayer, this.frontLayer]) {
      layer.scale.set(STATION_SCALE);
    }
    this.container.addChild(
      this.backLayer,
      this.stationsLayer,
      this.structureLayer,
      this.glowLayer,
      this.frontLayer,
    );
    this.lightStations.scale.set(STATION_SCALE);
    this.lights.addChild(this.lightStations);
  }

  setTier(tier: Tier, animate: boolean): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.structure?.destroy({ children: true });
    for (const glow of this.windowGlows) glow.sprite.destroy();
    this.windowGlows = [];
    this.floodGlow?.sprite.destroy();
    this.floodGlow = null;

    const g = new Graphics();
    const windows = drawStructure(tier, g);
    this.structure = new Container();
    this.structure.addChild(g);
    this.structureLayer.addChild(this.structure);
    for (const w of windows) {
      const glow = new Glow(0xffc46b, Math.max(w.w, w.h) * 3.2, 0.9);
      glow.sprite.position.set(w.x, w.y);
      this.glowLayer.addChild(glow.sprite);
      this.windowGlows.push(glow);
    }
    if (tier === "hqm") {
      this.floodGlow = new Glow(0xdff6ff, 360, 0.8);
      this.floodGlow.sprite.position.set(-120, -160);
      this.glowLayer.addChild(this.floodGlow.sprite);
    }
    this.showScaffold(null);
    this.buildAnim = animate ? 1 : 0;
    if (animate)
      this.particles.spawn("dust", this.container.x, this.container.y - 10, 26, 0xc9b78a);
  }

  /** A dashed outline of the tier being built, pulsing until it lands. */
  showScaffold(tier: Tier | null): void {
    this.scaffold?.destroy();
    this.scaffold = null;
    if (!tier) return;
    const [w, h] = FOOTPRINT[tier];
    const accent = MATERIALS[tier].accent;
    const g = new Graphics();
    for (let x = -w / 2; x < w / 2; x += 18)
      g.moveTo(x, -h)
        .lineTo(x + 9, -h)
        .moveTo(x, 0)
        .lineTo(x + 9, 0);
    for (let y = -h; y < 0; y += 18)
      g.moveTo(-w / 2, y)
        .lineTo(-w / 2, y + 9)
        .moveTo(w / 2, y)
        .lineTo(w / 2, y + 9);
    g.stroke({ width: 3, color: accent, alpha: 0.9 });
    g.moveTo(-w / 2, -h)
      .lineTo(w / 2, 0)
      .moveTo(w / 2, -h)
      .lineTo(-w / 2, 0)
      .stroke({ width: 1.5, color: accent, alpha: 0.35 });
    g.rect(-w / 2 - 14, -h - 20, 6, h + 20)
      .fill(0x8a6a3a)
      .rect(w / 2 + 8, -h - 20, 6, h + 20)
      .fill(0x8a6a3a);
    this.scaffold = g;
    this.structureLayer.addChild(g);
  }

  /** Rebuilds what stands around the base: every building at its spot and level. */
  setStations(owned: Owned): void {
    const key = `${this.tier}:${JSON.stringify(owned)}`;
    if (key === this.stationsKey) return;
    this.stationsKey = key;
    for (const station of this.stations) {
      station.container.destroy({ children: true });
      station.light?.destroy({ children: true });
    }
    for (const scaffold of this.scaffolds) scaffold.destroy();
    this.stations = [];
    this.scaffolds = [];
    const level = (id: string) => owned.buildings[id] ?? 0;
    const building = (id: string) => level(id) > 0 || owned.constructing.includes(id);
    const layers = { back: this.backLayer, strip: this.stationsLayer, front: this.frontLayer };

    /** Places a station (container units) and moves its fire and glows to the light layer. */
    const add = (
      station: Station,
      x: number,
      y = 0,
      scale = 1,
      layer: keyof typeof layers = "strip",
    ): void => {
      station.container.position.set(x, y);
      station.container.scale.set(scale);
      layers[layer].addChild(station.container);
      const emissive = [
        station.fire,
        station.glow?.sprite,
        ...(station.glows ?? []).map((glow) => glow.sprite),
      ].filter((item) => item !== undefined);
      if (emissive.length > 0) {
        const light = new Container();
        light.position.set(x, y);
        light.scale.set(scale);
        light.addChild(...emissive);
        this.lightStations.addChild(light);
        station.light = light;
      }
      this.stations.push(station);
    };

    /** A pulsing frame where a building is going up. */
    const scaffold = (id: string, x: number, y: number, layer: keyof typeof layers): void => {
      if (!owned.constructing.includes(id)) return;
      const [w, h] = FOOTPRINTS[id] ?? [80, 80];
      const g = new Graphics();
      for (let px = -w / 2; px < w / 2; px += 14) {
        g.moveTo(px, -h)
          .lineTo(px + 7, -h)
          .moveTo(px, 0)
          .lineTo(px + 7, 0);
      }
      for (let py = -h; py < 0; py += 14) {
        g.moveTo(-w / 2, py)
          .lineTo(-w / 2, py + 7)
          .moveTo(w / 2, py)
          .lineTo(w / 2, py + 7);
      }
      g.stroke({ width: 3, color: 0xe3a32f, alpha: 0.95 });
      g.rect(-w / 2 - 8, -h - 12, 5, h + 12)
        .fill(0x8a6a3a)
        .rect(w / 2 + 3, -h - 12, 5, h + 12)
        .fill(0x8a6a3a);
      g.position.set(x, y);
      layers[layer].addChild(g);
      this.scaffolds.push(g);
    };

    // Up the slope and in the yard: every building with a spot of its own.
    for (const [id, spot] of Object.entries(SPOTS)) {
      if (!building(id)) continue;
      const x = spot.x / STATION_SCALE;
      const y = spot.y / STATION_SCALE;
      // Up the slope things are further away: a little smaller.
      const scale = spot.layer === "back" && id !== "watchtower" ? 0.82 : 1;
      if (level(id) > 0) {
        const drawn = makeBuilding(id, level(id));
        if (drawn) add(drawn, x, y, scale, spot.layer);
      }
      scaffold(id, x, y, spot.layer);
    }

    // The wall runs in front of the slope, behind the strip.
    const wall = level("walls");
    if (building("walls")) {
      const [from, to] = WALL_SPAN.map((x) => x / STATION_SCALE) as [number, number];
      if (wall > 0) {
        const drawn = makeBuilding("walls", wall, [from, to]);
        if (drawn) add(drawn, 0, -14 / STATION_SCALE, 1, "back");
      }
      scaffold("walls", from + 80, -14 / STATION_SCALE, "back");
    }

    // Left of the door: cupboard, furnaces two by two (the second pair behind).
    const half = this.tier ? FOOTPRINT[this.tier][0] / 2 : 110;
    let left = -half - 24;
    add({ id: "cupboard", container: drawCupboard() }, left - 18);
    left -= 36 + 12;
    if (building("furnace")) {
      const furnace = level("furnace");
      const slots = Math.max(1, owned.furnaceSlots);
      const columns = Math.min(2, slots);
      const make = (i: number) =>
        furnace >= 3 ? makeElectricFurnace(i) : makeFurnace(i, furnace === 2 ? 1.14 : 1);
      if (furnace > 0) {
        for (let i = 2; i < slots; i++) add(make(i), left - 78 - (i - 2) * 80, -30, 0.88);
        for (let i = 0; i < columns; i++) add(make(i), left - 38 - i * 80);
      }
      scaffold("furnace", left - 38, 0, "strip");
      left -= columns * 80 + 4;
    }

    // Right of the door: workbench, campfire (a kitchen at level 3).
    let right = half + 24;
    if (building("workbench")) {
      const drawn = level("workbench") > 0 ? makeBuilding("workbench", level("workbench")) : null;
      if (drawn) add(drawn, right + 45);
      scaffold("workbench", right + 45, 0, "strip");
      right += 90 + 12 + (level("workbench") >= 3 ? 34 : 0);
    }
    if (building("campfire")) {
      const drawn = level("campfire") > 0 ? makeBuilding("campfire", level("campfire")) : null;
      if (drawn) add(drawn, right + 34);
      scaffold("campfire", right + 34, 0, "strip");
      right += 80;
    }

    // Crates stack against the wall left of the door, between the lamp posts.
    if (owned.crates > 0) {
      add(
        { id: "crate", container: drawCrates(owned.crates) },
        -132 / STATION_SCALE,
        4,
        1,
        "front",
      );
    }
  }

  /** World position of a building (for the "it landed" pulse), or null when not drawn. */
  buildingPosition(id: string): { x: number; y: number } | null {
    return this.stationPosition(id);
  }

  /** A point on a station, in world space (the station strip is scaled down a little). */
  private stationWorld(station: Station, dx = 0, dy = 0): { x: number; y: number } {
    const scale = this.stationsLayer.scale.x;
    return {
      x: this.container.x + (station.container.x + dx * station.container.scale.x) * scale,
      y: this.container.y + (station.container.y + dy * station.container.scale.y) * scale,
    };
  }

  setFurnaceActive(active: boolean): void {
    this.furnaceActive = active;
  }

  /** World position of a station, for effects and actors. */
  stationPosition(id: string): { x: number; y: number } | null {
    const station = this.stations.find((candidate) => candidate.id === id);
    return station ? this.stationWorld(station) : null;
  }

  update(dt: number, darkness: number, wind: number): void {
    this.time += dt;
    if (this.structure) {
      if (this.buildAnim > 0) {
        this.buildAnim = Math.max(0, this.buildAnim - dt * 0.9);
        const s = easeOutBack(1 - this.buildAnim);
        this.structure.scale.set(0.75 + 0.25 * s, 0.6 + 0.4 * s);
        if (this.buildAnim > 0.6 && Math.random() < 0.5) {
          this.particles.spawn(
            "dust",
            this.container.x + rand(-120, 120),
            this.container.y - 4,
            1,
            0xc9b78a,
          );
        }
      } else {
        this.structure.scale.set(1);
      }
    }
    if (this.scaffold) this.scaffold.alpha = 0.7 + Math.sin(this.time * 4) * 0.3;
    for (const scaffold of this.scaffolds) scaffold.alpha = 0.65 + Math.sin(this.time * 4) * 0.35;

    for (const glow of this.windowGlows) glow.update(darkness, Math.sin(this.time * 3.1) * 0.03);
    this.floodGlow?.update(darkness, Math.sin(this.time * 9) * 0.02);

    for (const station of this.stations) {
      const lit = station.id === "furnace" ? this.furnaceActive : true;
      if (station.fire) station.fire.visible = lit;
      if (station.id === "furnace" && !lit) {
        station.glow?.update(0);
        continue;
      }
      station.animate?.(this.time);
      if (station.id === "furnace")
        station.glow?.update(0.3 + darkness * 0.35, Math.sin(this.time * 17) * 0.06);
      else if (station.id === "campfire")
        station.glow?.update(0.12 + darkness * 0.88, Math.sin(this.time * 13) * 0.08);
      else station.glow?.update(darkness, Math.sin(this.time * 7) * 0.05);
      for (const glow of station.glows ?? []) glow.update(darkness, Math.sin(this.time * 5) * 0.03);
    }

    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.28;
      const spot = this.tier ? CHIMNEY[this.tier] : null;
      if (spot && Math.random() < 0.5) {
        this.particles.spawn(
          "smoke",
          this.container.x + spot.x,
          this.container.y + spot.y,
          1,
          0xb5b5b5,
        );
      }
      for (const station of this.stations) {
        if (!station.chimney) continue;
        if (station.id === "furnace" && !this.furnaceActive) continue;
        const { x: sx, y } = this.stationWorld(station, station.chimney.x, station.chimney.y);
        const x = sx + wind * 0.2;
        this.particles.spawn("smoke", x, y, 1, station.id === "furnace" ? 0x7a7a7a : 0x9a9a9a);
        if (Math.random() < 0.4) this.particles.spawn("sparks", x, y + 40, 1, 0xffd25a);
      }
    }
  }
}
