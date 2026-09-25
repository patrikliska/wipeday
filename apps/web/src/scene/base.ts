/**
 * The base: the structure for the current tier, the stations around it and
 * the build animation. Everything the player owns should be visible here.
 */
import { Container, Graphics } from "pixi.js";
import type { ItemId, Tier } from "../state/world";
import { Glow, type Particles } from "./effects";
import { MATERIALS, type Material } from "./palette";
import { easeOutBack, rand, shade } from "./util";

type StationId = ItemId | "furnace" | "cupboard";

interface Station {
  id: StationId;
  container: Container;
  glow?: Glow;
  /** Per-frame animation (flames). */
  animate?: (t: number) => void;
  /** Where smoke and sparks come from, relative to the station. */
  chimney?: { x: number; y: number };
}

interface Owned {
  furnace: boolean;
  furnaceSlots: number;
  items: Partial<Record<ItemId, number>>;
}

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

function drawWorkbench(): Container {
  const c = new Container();
  const g = new Graphics();
  g.rect(-44, -40, 88, 8).fill(0x8a5a30).rect(-44, -40, 88, 3).fill(0xa06a36);
  g.rect(-40, -32, 6, 32).fill(0x5a3d26).rect(34, -32, 6, 32).fill(0x5a3d26);
  g.rect(-36, -18, 72, 4).fill(0x5a3d26);
  g.rect(-30, -52, 14, 12)
    .fill(0x9aa0a6)
    .rect(-8, -50, 22, 10)
    .fill(0x5a5a5a)
    .circle(22, -46, 6)
    .fill(0x6c97bc);
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

function drawKiln(): Container {
  const c = new Container();
  const g = new Graphics();
  g.moveTo(-28, 0).lineTo(-20, -60).lineTo(20, -60).lineTo(28, 0).closePath().fill(0x7a5a3a);
  g.rect(-8, -80, 16, 22).fill(0x5a4a3a).roundRect(-9, -26, 18, 20, 4).fill(0x1b1a18);
  c.addChild(g);
  return c;
}

function drawPress(): Container {
  const c = new Container();
  const g = new Graphics();
  g.rect(-30, -14, 60, 14)
    .fill(0x5a3d26)
    .rect(-24, -60, 8, 46)
    .fill(0x6c97bc)
    .rect(16, -60, 8, 46)
    .fill(0x6c97bc);
  g.rect(-28, -66, 56, 8)
    .fill(0x46607a)
    .rect(-6, -58, 12, 30)
    .fill(0x8a8f94)
    .rect(-16, -28, 32, 10)
    .fill(0x9aa0a6);
  g.rect(-20, -8, 12, 6).fill(0xc85a2b);
  c.addChild(g);
  return c;
}

/** Two flame shapes, redrawn each frame with a flicker factor. */
function drawFlame(flame: Graphics, f: number, scale: number): void {
  flame.clear();
  flame
    .moveTo(-10 * scale, 0)
    .quadraticCurveTo(-13 * scale, -14 * f * scale, 0, -30 * f * scale)
    .quadraticCurveTo(13 * scale, -14 * f * scale, 10 * scale, 0)
    .closePath()
    .fill(0xff7a2b);
  flame
    .moveTo(-5 * scale, 0)
    .quadraticCurveTo(-7 * scale, -9 * f * scale, 0, -18 * f * scale)
    .quadraticCurveTo(7 * scale, -9 * f * scale, 5 * scale, 0)
    .closePath()
    .fill(0xffd25a);
}

function makeFurnace(index: number): Station {
  const container = new Container();
  const g = new Graphics();
  g.ellipse(0, -10, 36, 12).fill(0x4a4d50);
  g.moveTo(-34, -10)
    .quadraticCurveTo(-36, -80, 0, -84)
    .quadraticCurveTo(36, -80, 34, -10)
    .closePath()
    .fill(0x66696d);
  for (let y = -74; y < -12; y += 14) {
    for (let x = -28 + (Math.round(y / 14) % 2 === 0 ? 7 : 0); x < 26; x += 14) {
      g.rect(x, y, 12, 11)
        .fill({ color: 0x5a5d61, alpha: 0.9 })
        .stroke({ width: 1, color: 0x43464a, alpha: 0.6 });
    }
  }
  g.roundRect(-13, -40, 26, 30, 6).fill(0x1b1a18);
  const flame = new Graphics();
  flame.position.set(0, -14);
  const glow = new Glow(0xff8a3c, 150, 1);
  glow.sprite.position.set(0, -26);
  container.addChild(g, flame, glow.sprite);
  return {
    id: "furnace",
    container,
    glow,
    chimney: { x: 0, y: -84 },
    animate: (t) => drawFlame(flame, 0.85 + Math.sin(t * 17 + index) * 0.15, 0.75),
  };
}

function makeCampfire(): Station {
  const container = new Container();
  const g = new Graphics();
  g.ellipse(0, -2, 26, 8).fill(0x3a3a3a);
  g.rect(-16, -8, 30, 7).fill(0x5a3d26);
  g.rect(-12, -12, 30, 7).fill(0x6b4423);
  for (let i = 0; i < 8; i++) g.circle(-20 + i * 6, 0, 3).fill(0x6a6d70);
  const flame = new Graphics();
  flame.position.set(0, -10);
  const glow = new Glow(0xffa64d, 220, 1);
  glow.sprite.position.set(0, -24);
  container.addChild(g, flame, glow.sprite);
  return {
    id: "campfire",
    container,
    glow,
    chimney: { x: 0, y: -34 },
    animate: (t) => drawFlame(flame, 0.8 + Math.sin(t * 13) * 0.2, 1),
  };
}

function makeLantern(): Station {
  const container = new Container();
  const g = new Graphics();
  g.rect(-2, -70, 4, 70).fill(0x3f2a16).rect(-14, -70, 28, 4).fill(0x3f2a16);
  g.roundRect(-8, -66, 16, 20, 3).fill(0x2a2a2a).rect(-5, -63, 10, 14).fill(0xffe08a);
  const glow = new Glow(0xffe08a, 220, 1);
  glow.sprite.position.set(0, -56);
  container.addChild(g, glow.sprite);
  return { id: "lantern", container, glow };
}

// --- the base -------------------------------------------------------------------------

export class Base {
  readonly container = new Container();
  private readonly stationsLayer = new Container();
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
    this.stationsLayer.scale.set(0.85);
    this.container.addChild(this.stationsLayer, this.structureLayer, this.glowLayer);
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

  /** Rebuilds the stations: what is owned appears, in a fixed layout around the structure. */
  setStations(owned: Owned): void {
    const key = `${this.tier}:${JSON.stringify(owned)}`;
    if (key === this.stationsKey) return;
    this.stationsKey = key;
    for (const station of this.stations) station.container.destroy({ children: true });
    this.stations = [];
    const half = this.tier ? FOOTPRINT[this.tier][0] / 2 : 110;
    const add = (station: Station, x: number, y = 0, scale = 1): void => {
      station.container.position.set(x, y);
      station.container.scale.set(scale);
      this.stationsLayer.addChild(station.container);
      this.stations.push(station);
    };

    // Left of the door: cupboard, furnaces two by two (the second pair behind), kiln, press.
    let left = -half - 24;
    add({ id: "cupboard", container: drawCupboard() }, left - 18);
    left -= 36 + 12;
    if (owned.furnace) {
      const slots = Math.max(1, owned.furnaceSlots);
      const columns = Math.min(2, slots);
      for (let i = 2; i < slots; i++) add(makeFurnace(i), left - 78 - (i - 2) * 80, -30, 0.88);
      for (let i = 0; i < columns; i++) add(makeFurnace(i), left - 38 - i * 80);
      left -= columns * 80 + 4;
    }
    if (owned.items.kiln) {
      add({ id: "kiln", container: drawKiln() }, left - 30);
      left -= 60 + 12;
    }
    if (owned.items.press) {
      add({ id: "press", container: drawPress() }, left - 32);
      left -= 64 + 12;
    }

    // Right of the door: workbench, crates, campfire, lantern.
    let right = half + 24;
    if (owned.items.workbench) {
      add({ id: "workbench", container: drawWorkbench() }, right + 45);
      right += 90 + 12;
    }
    const crates = owned.items.crate ?? 0;
    if (crates > 0) {
      add({ id: "crate", container: drawCrates(crates) }, right + 28);
      right += 56 + 12;
    }
    if (owned.items.campfire) {
      add(makeCampfire(), right + 30);
      right += 60 + 12;
    }
    if (owned.items.lantern) {
      add(makeLantern(), right + 15);
      right += 30 + 12;
    }
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
  stationPosition(id: StationId): { x: number; y: number } | null {
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

    for (const glow of this.windowGlows) glow.update(darkness, Math.sin(this.time * 3.1) * 0.03);
    this.floodGlow?.update(darkness, Math.sin(this.time * 9) * 0.02);

    for (const station of this.stations) {
      const lit = station.id === "furnace" ? this.furnaceActive : true;
      if (station.id === "furnace" && !lit) {
        (station.container.children[1] as Graphics | undefined)?.clear();
        station.glow?.update(0);
        continue;
      }
      station.animate?.(this.time);
      if (station.id === "furnace")
        station.glow?.update(0.35 + darkness * 0.65, Math.sin(this.time * 17) * 0.08);
      else if (station.id === "campfire")
        station.glow?.update(0.12 + darkness * 0.88, Math.sin(this.time * 13) * 0.08);
      else station.glow?.update(darkness, Math.sin(this.time * 7) * 0.05);
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
