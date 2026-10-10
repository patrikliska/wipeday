/**
 * The 14 lines' drawings (docs/redesign/02-the-run.md 2.3): each drawn anew at 1, 25 and 100
 * owned (stages 1-3). Eleven reuse the W-phase buildings' three levels; the Beachcomber, the
 * Ship Breaker and the Reactor are new. Flat vector like the rest of the scene; windows, fires
 * and lamps carry glows that the scene moves to the light layer so they stay warm at night
 * (D47). Origin: the drawing's bottom centre on the ground.
 */
import { Container, Graphics } from "pixi.js";
import { Glow } from "./effects";
import { clamp, lerp } from "./util";

/** One line's drawing, its lights and moving parts. */
export interface Station {
  id: string;
  container: Container;
  glow?: Glow;
  /** More lights than one (lamp posts, a boathouse with two windows). */
  glows?: Glow[];
  /** Per-frame animation (flames, a blinking mast light). */
  animate?: (t: number) => void;
  /** Where smoke and sparks come from, relative to the station. */
  chimney?: { x: number; y: number };
  /** Where its product piles up, relative to the station. */
  pile?: { x: number; y: number };
  /** Where its hand stands to work, relative to the station. */
  work?: number;
  /** Shown only while the station is working (the furnace's lit interior and flames). */
  fire?: Container;
  /** The station's fire and glows, moved to the light layer when the station is placed. */
  light?: Container;
}

const WOOD = 0x8a5a30;
const WOOD_DARK = 0x5a3d26;
const WOOD_LIGHT = 0xa87444;
const PLANK = 0x9a6a3a;
const STONE = 0x8a8f94;
const METAL = 0x6c97bc;
const METAL_DARK = 0x46607a;
const ROOF = 0x6b4423;
const CANVAS = 0xd8c9a3;
const GLASS = 0x2a3440;
const WARM = 0xffc46b;
const SOIL = 0x5a3d26;
const LEAF = 0x6f9f3f;
const LEAF_LIGHT = 0x9cc05a;

/** A soft contact shadow under a footprint `w` wide. */
function shadow(g: Graphics, w: number): void {
  g.ellipse(0, 0, w / 2 + 4, 6).fill({ color: 0x000000, alpha: 0.2 });
}

/** A lit window: a dark pane now, warm light at night through a glow. */
function windowAt(g: Graphics, x: number, y: number, w: number, h: number, glows: Glow[]): void {
  g.rect(x - 2, y - 2, w + 4, h + 4).fill(WOOD_DARK);
  g.rect(x, y, w, h).fill(GLASS);
  g.rect(x + w / 2 - 1, y, 2, h).fill(WOOD_DARK);
  const glow = new Glow(WARM, Math.max(w, h) * 3.4, 0.9);
  glow.sprite.position.set(x + w / 2, y + h / 2);
  glows.push(glow);
}

function station(
  id: string,
  g: Graphics,
  glows: Glow[] = [],
  extra: Partial<Station> = {},
): Station {
  const container = new Container();
  container.addChild(g);
  for (const glow of glows) container.addChild(glow.sprite);
  return { id, container, glows, ...extra };
}

// --- crafts ----------------------------------------------------------------------------

function loom(level: number): Station {
  const g = new Graphics();
  shadow(g, 64);
  if (level >= 2) {
    // A lean-to keeps the loom dry.
    g.rect(-36, -84, 5, 84).fill(WOOD_DARK).rect(31, -70, 5, 70).fill(WOOD_DARK);
    g.moveTo(-42, -88).lineTo(42, -74).lineTo(42, -68).lineTo(-42, -82).closePath().fill(ROOF);
  }
  // The frame, the warp and a half-woven cloth.
  g.rect(-24, -60, 5, 60).fill(WOOD).rect(19, -60, 5, 60).fill(WOOD);
  g.rect(-26, -62, 52, 6).fill(WOOD_LIGHT).rect(-26, -18, 52, 5).fill(WOOD_LIGHT);
  for (let x = -17; x <= 17; x += 4) g.rect(x, -56, 1, 38).fill({ color: 0xece2c8, alpha: 0.9 });
  g.rect(-18, -40, 36, 20).fill(0xb9a36a);
  if (level === 3) {
    // Finished rope hangs in coils from the lean-to's posts.
    for (const x of [-33, 33]) {
      g.rect(x - 1, -70, 2, 8).fill(WOOD_DARK);
      g.ellipse(x, -52, 9, 12).stroke({ width: 4, color: 0xb8a27a });
      g.ellipse(x, -52, 4.5, 6.5).stroke({ width: 3, color: 0x9a845c });
    }
  }
  return station("loom", g);
}

function tannery(level: number): Station {
  const g = new Graphics();
  shadow(g, 80);
  const rack = (x: number) => {
    g.rect(x - 22, -52, 4, 52)
      .fill(WOOD_DARK)
      .rect(x + 18, -52, 4, 52)
      .fill(WOOD_DARK);
    g.rect(x - 24, -54, 48, 4).fill(WOOD);
    g.moveTo(x - 16, -50)
      .lineTo(x + 14, -50)
      .lineTo(x + 12, -18)
      .lineTo(x, -12)
      .lineTo(x - 14, -20)
      .closePath()
      .fill(0x9a6a44);
  };
  rack(-14);
  if (level >= 2) {
    // A soaking vat.
    g.roundRect(18, -26, 26, 26, 4).fill(WOOD).rect(18, -26, 26, 4).fill(0x5b4a2e);
  }
  if (level === 3) {
    rack(-58);
    g.moveTo(-84, -64).lineTo(52, -64).lineTo(46, -74).lineTo(-78, -74).closePath().fill(ROOF);
  }
  return station("tannery", g);
}

// --- food, light, lookout --------------------------------------------------------------

function garden(level: number): Station {
  const g = new Graphics();
  const beds = level;
  const width = 58 * beds + 10 * (beds - 1);
  shadow(g, width);
  for (let bed = 0; bed < beds; bed++) {
    const x = -width / 2 + bed * 68;
    g.roundRect(x, -10, 58, 12, 4).fill(SOIL);
    for (let row = 0; row < 5; row++) {
      const px = x + 7 + row * 11;
      const tall = (bed + row) % 2 === 0;
      g.moveTo(px, -8)
        .lineTo(px - 5, tall ? -22 : -17)
        .lineTo(px + 5, tall ? -24 : -18)
        .closePath();
      g.fill(tall ? LEAF : LEAF_LIGHT);
    }
  }
  if (level >= 2) {
    // A low fence along the back.
    for (let x = -width / 2 - 6; x <= width / 2 + 6; x += 12) g.rect(x, -22, 3, 14).fill(WOOD);
    g.rect(-width / 2 - 6, -18, width + 15, 2).fill(WOOD_LIGHT);
  }
  if (level === 3) {
    // Scarecrow and a rain barrel.
    g.rect(width / 2 + 10, -58, 3, 58)
      .fill(WOOD_DARK)
      .rect(width / 2 - 2, -46, 27, 3)
      .fill(WOOD_DARK);
    g.circle(width / 2 + 11, -62, 6)
      .fill(CANVAS)
      .rect(width / 2 + 3, -70, 17, 4)
      .fill(0x6b4423);
    g.roundRect(-width / 2 - 26, -24, 16, 24, 3)
      .fill(WOOD)
      .rect(-width / 2 - 26, -24, 16, 3)
      .fill(0x4a7fb5);
  }
  return station("garden", g);
}

// --- power and the sea -----------------------------------------------------------------

function generator(level: number): Station {
  const g = new Graphics();
  const glows: Glow[] = [];
  const w = [0, 50, 64, 80][level] ?? 50;
  shadow(g, w + 10);
  if (level === 3) {
    g.rect(-w / 2 - 6, -70, w + 12, 70).fill(STONE);
    g.moveTo(-w / 2 - 12, -70)
      .lineTo(0, -88)
      .lineTo(w / 2 + 12, -70)
      .closePath()
      .fill(METAL);
  }
  // Skid, engine block, flywheel, exhaust.
  g.rect(-w / 2, -8, w, 8).fill(0x3b3833);
  g.roundRect(-w / 2 + 4, -36, w - 18, 28, 4).fill(level === 1 ? 0x7a5a3a : METAL_DARK);
  g.circle(w / 2 - 10, -22, 12)
    .fill(0x3b3833)
    .circle(w / 2 - 10, -22, 5)
    .fill(0x8a8f94);
  g.rect(-w / 2 + 10, -52, 6, 18).fill(0x2e2b27);
  const panel = new Glow(0x9fd4ff, 70, 0.9);
  panel.sprite.position.set(-w / 2 + 22, -26);
  g.rect(-w / 2 + 18, -30, 8, 6).fill(0x9fd4ff);
  glows.push(panel);
  if (level >= 2) {
    // A cable pole carries the power off to the furnace.
    g.rect(w / 2 + 12, -84, 4, 84)
      .fill(WOOD_DARK)
      .rect(w / 2 + 6, -82, 16, 3)
      .fill(WOOD_DARK);
  }
  return station("generator", g, glows, { chimney: { x: -w / 2 + 13, y: -52 } });
}

function radioMast(level: number): Station {
  const g = new Graphics();
  const glows: Glow[] = [];
  const h = [0, 150, 196, 250][level] ?? 150;
  shadow(g, 30);
  if (level === 1) {
    g.rect(-3, -h, 6, h).fill(WOOD_DARK);
    g.moveTo(0, -h)
      .lineTo(-40, 0)
      .moveTo(0, -h)
      .lineTo(40, 0)
      .stroke({ width: 1, color: 0x2e2b27, alpha: 0.6 });
    g.rect(-18, -h + 8, 36, 3).fill(WOOD_DARK);
  } else {
    // Lattice mast: two rails and cross bracing, tapering to the top.
    const base = level === 2 ? 14 : 18;
    g.moveTo(-base, 0)
      .lineTo(-3, -h)
      .lineTo(3, -h)
      .lineTo(base, 0)
      .stroke({ width: 3, color: 0x9aa0a6 });
    for (let y = 0; y > -h + 12; y -= 18) {
      const k = 1 + y / h;
      const next = 1 + (y - 18) / h;
      g.moveTo(-base * k, y)
        .lineTo(base * next, y - 18)
        .moveTo(base * k, y)
        .lineTo(-base * next, y - 18);
    }
    g.stroke({ width: 1.2, color: 0x9aa0a6, alpha: 0.9 });
    if (level === 3) {
      g.ellipse(-10, -h * 0.55, 14, 18)
        .fill(0xd8dde2)
        .ellipse(-8, -h * 0.55, 8, 12)
        .fill(0xaeb4ba);
    }
  }
  // A red light on top, blinking.
  const beacon = new Glow(0xff4a3a, 70, 1);
  beacon.sprite.position.set(0, -h - 2);
  g.circle(0, -h - 2, 3).fill(0xff4a3a);
  glows.push(beacon);
  return station("radio_mast", g, glows, {
    animate: (t) => {
      beacon.sprite.visible = Math.sin(t * 3) > 0;
    },
  });
}

function dock(level: number): Station {
  const g = new Graphics();
  const glows: Glow[] = [];
  const length = [0, 96, 150, 170][level] ?? 96;
  // A jetty on posts, reaching out to the left over the water.
  for (let x = -length; x <= 0; x += 24) g.rect(x - 2, -6, 5, 24).fill(WOOD_DARK);
  g.rect(-length - 4, -12, length + 10, 8).fill(PLANK);
  for (let x = -length; x < 4; x += 10)
    g.rect(x, -12, 1.5, 8).fill({ color: WOOD_DARK, alpha: 0.7 });
  // The boat.
  const bx = -length + 30;
  g.moveTo(bx - 26, 4)
    .quadraticCurveTo(bx, 18, bx + 26, 4)
    .closePath()
    .fill(level === 1 ? WOOD : 0x4a7fb5);
  if (level >= 2) {
    g.rect(bx - 1, -42, 3, 46).fill(WOOD_DARK);
    g.moveTo(bx + 2, -40)
      .lineTo(bx + 24, 0)
      .lineTo(bx + 2, 0)
      .closePath()
      .fill(0xece2c8);
  }
  if (level === 3) {
    // A boathouse at the shore end, with a lamp.
    g.rect(-24, -54, 42, 42)
      .fill(WOOD)
      .moveTo(-30, -54)
      .lineTo(-3, -74)
      .lineTo(24, -54)
      .closePath()
      .fill(ROOF);
    windowAt(g, -12, -44, 12, 10, glows);
  }
  return station("dock", g, glows);
}

// --- the stations that became buildings, drawn by level -----------------------------------

function kiln(level: number): Station {
  const g = new Graphics();
  const s = 1 + (level - 1) * 0.15;
  shadow(g, 56 * s);
  g.moveTo(-28 * s, 0)
    .lineTo(-20 * s, -60 * s)
    .lineTo(20 * s, -60 * s)
    .lineTo(28 * s, 0)
    .closePath()
    .fill(level === 3 ? 0x6a5a4a : 0x7a5a3a);
  g.rect(-8 * s, -80 * s, 16 * s, 22 * s)
    .fill(0x5a4a3a)
    .roundRect(-9 * s, -26 * s, 18 * s, 20 * s, 4)
    .fill(0x1b1a18);
  if (level >= 2) g.rect(-26 * s, -34 * s, 52 * s, 4).fill(0x3b3833);
  return station("kiln", g, [], { chimney: { x: 0, y: -80 * s } });
}

function press(level: number): Station {
  const g = new Graphics();
  shadow(g, 64);
  g.rect(-30, -14, 60, 14)
    .fill(WOOD_DARK)
    .rect(-24, -60, 8, 46)
    .fill(METAL)
    .rect(16, -60, 8, 46)
    .fill(METAL);
  g.rect(-28, -66, 56, 8)
    .fill(METAL_DARK)
    .rect(-6, -58, 12, 30)
    .fill(0x8a8f94)
    .rect(-16, -28, 32, 10)
    .fill(0x9aa0a6);
  g.rect(-20, -8, 12, 6).fill(0xc85a2b);
  if (level >= 2) g.roundRect(34, -26, 18, 26, 3).fill(WOOD).rect(34, -26, 18, 3).fill(0xc85a2b);
  if (level === 3) g.roundRect(54, -22, 16, 22, 3).fill(WOOD).rect(54, -22, 16, 3).fill(0xc85a2b);
  return station("press", g);
}

function workbench(level: number): Station {
  const g = new Graphics();
  shadow(g, 90);
  g.rect(-44, -40, 88, 8).fill(WOOD).rect(-44, -40, 88, 3).fill(0xa06a36);
  g.rect(-40, -32, 6, 32).fill(WOOD_DARK).rect(34, -32, 6, 32).fill(WOOD_DARK);
  g.rect(-36, -18, 72, 4).fill(WOOD_DARK);
  g.rect(-30, -52, 14, 12)
    .fill(0x9aa0a6)
    .rect(-8, -50, 22, 10)
    .fill(0x5a5a5a)
    .circle(22, -46, 6)
    .fill(METAL);
  if (level >= 2) {
    // A tool board with a saw and a hammer, and a vise.
    g.rect(-40, -86, 60, 34).fill(PLANK).stroke({ width: 2, color: WOOD_DARK });
    g.rect(-34, -78, 22, 4)
      .fill(0x9aa0a6)
      .rect(-4, -80, 3, 18)
      .fill(WOOD_DARK)
      .rect(-8, -80, 11, 5)
      .fill(0x5a5a5a);
    g.rect(30, -48, 12, 8).fill(0x3b3833);
  }
  if (level === 3) {
    // An anvil and a lamp.
    g.moveTo(48, -30).lineTo(76, -30).lineTo(70, -22).lineTo(54, -22).closePath().fill(0x3b3833);
    g.rect(58, -22, 8, 22).fill(0x3b3833);
  }
  const glows: Glow[] = [];
  if (level === 3) {
    g.roundRect(8, -92, 10, 12, 2).fill(0xffe08a);
    const glow = new Glow(0xffe08a, 90, 0.55);
    glow.sprite.position.set(13, -86);
    glows.push(glow);
  }
  return station("workbench", g, glows);
}

/** Two flame shapes, redrawn each frame with a flicker factor. */
export function drawFlame(flame: Graphics, f: number, scale: number): void {
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

function campfire(level: number): Station {
  const container = new Container();
  const g = new Graphics();
  if (level === 3) {
    // The kitchen: an open roof on posts over the fire, a table beside it.
    g.rect(-40, -86, 5, 86).fill(WOOD_DARK).rect(35, -86, 5, 86).fill(WOOD_DARK);
    g.moveTo(-50, -86).lineTo(0, -106).lineTo(50, -86).closePath().fill(ROOF);
  }
  g.ellipse(0, -2, 26, 8).fill(0x3a3a3a);
  g.rect(-16, -8, 30, 7).fill(WOOD_DARK);
  g.rect(-12, -12, 30, 7).fill(0x6b4423);
  for (let i = 0; i < 8; i++) g.circle(-20 + i * 6, 0, 3).fill(0x6a6d70);
  if (level >= 2) {
    // A tripod with a pot, and a log bench.
    g.moveTo(-22, 0).lineTo(0, -52).lineTo(22, 0).stroke({ width: 3, color: WOOD_DARK });
    g.roundRect(-9, -40, 18, 14, 4).fill(0x2e2b27);
    g.roundRect(-58, -12, 30, 10, 4).fill(WOOD);
  }
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

// --- the furnace: stone furnace, the large furnace, the electric smelter -----------------------

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

function stoneFurnace(size: number): Station {
  const container = new Container();
  const g = new Graphics();
  g.scale.set(size);
  g.ellipse(0, 0, 40, 7).fill({ color: 0x000000, alpha: 0.22 });
  g.roundRect(-37, -10, 74, 10, 3).fill(0x4a4d50);
  g.rect(-37, -10, 74, 3).fill(0x5d6064);
  g.moveTo(-32, -8).lineTo(-23, -70).lineTo(23, -70).lineTo(32, -8).closePath().fill(0x3f4246);
  const tones = [0x7c7f83, 0x707377, 0x676a6e, 0x75787c];
  for (let row = 0; row < 5; row++) {
    const top = -70 + row * 12.4;
    let x = -furnaceHalfWidth(top + 6) + 1;
    const right = furnaceHalfWidth(top + 6) - 1;
    let n = row * 3;
    while (x < right - 3) {
      const width = Math.min(right - x, row % 2 === 0 ? 12 + (n % 3) * 3 : 10 + ((n + 1) % 3) * 4);
      g.roundRect(x, top + 1, width - 1.5, 10.4, 2).fill(tones[n % tones.length] ?? 0x707377);
      x += width;
      n++;
    }
  }
  g.moveTo(14, -70).lineTo(23, -70).lineTo(32, -8).lineTo(20, -8).closePath();
  g.fill({ color: 0x000000, alpha: 0.2 });
  const bandHalf = furnaceHalfWidth(-52);
  g.rect(-bandHalf - 1, -55, bandHalf * 2 + 2, 5).fill(0x3b3833);
  g.roundRect(-27, -77, 54, 8, 2).fill(0x5d6064);
  g.rect(-6, -98, 12, 22).fill(0x3b3833);
  g.roundRect(-8, -102, 16, 5, 1.5).fill(0x2e2b27);
  furnaceMouth(g, 17, -8, -30).fill(0x8a8d90);
  furnaceMouth(g, 12, -8, -30).fill(0x1b1a18);
  const fire = new Container();
  fire.scale.set(size);
  const interior = new Graphics();
  const flame = new Graphics();
  flame.position.set(0, -12);
  fire.addChild(interior, flame);
  const glow = new Glow(0xff8a3c, 120 * size, 1);
  glow.sprite.position.set(0, -26 * size);
  container.addChild(g, fire, glow.sprite);
  return {
    id: "furnace",
    container,
    glow,
    fire,
    chimney: { x: 0, y: -102 * size },
    animate: (t) => {
      const f = 0.85 + Math.sin(t * 17) * 0.15;
      interior.clear();
      furnaceMouth(interior, 12, -8, -30).fill({ color: 0x6e2410, alpha: 0.95 });
      furnaceMouth(interior, 9, -9, -28).fill({ color: 0xb8461c, alpha: 0.45 + 0.3 * f });
      interior.rect(-11, -12, 22, 3).fill({ color: 0xffb347, alpha: 0.7 + 0.3 * f });
      drawFlame(flame, f, 0.6);
    },
  };
}

function electricFurnace(): Station {
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
  // A cable runs off to the generator.
  g.moveTo(32, -70).quadraticCurveTo(52, -40, 60, 0).stroke({ width: 2.5, color: 0x2e2b27 });
  const fire = new Container();
  const pane = new Graphics();
  fire.addChild(pane);
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
      const f = 0.8 + Math.sin(t * 11) * 0.2;
      pane
        .clear()
        .roundRect(-17, -55, 34, 24, 2)
        .fill({ color: 0xff6a1a, alpha: 0.6 + 0.4 * f });
    },
  };
}

function furnace(level: number): Station {
  if (level >= 3) return electricFurnace();
  return stoneFurnace(level === 2 ? 1.18 : 1);
}

// --- the Beachcomber (new) -----------------------------------------------------------------

const DRIFT = 0xb3a386;
const DRIFT_DARK = 0x8a7a62;
const SACK = 0xc9b58a;

/** A bleached log lying at `angle`, `len` long, centred on (x, y). */
function driftLog(g: Graphics, x: number, y: number, len: number, angle: number, thick = 6): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const p = (u: number, v: number): [number, number] => [x + u * c - v * s, y + u * s + v * c];
  g.poly([
    ...p(-len / 2, -thick / 2),
    ...p(len / 2, -thick / 2),
    ...p(len / 2, thick / 2),
    ...p(-len / 2, thick / 2),
  ]).fill(DRIFT_DARK);
  g.poly([
    ...p(-len / 2, -thick / 2),
    ...p(len / 2, -thick / 2),
    ...p(len / 2, -thick / 6),
    ...p(-len / 2, -thick / 6),
  ]).fill(DRIFT);
}

/** A small figure with a sack over the shoulder, origin at the feet. */
function sackFigure(): Graphics {
  const g = new Graphics();
  g.ellipse(0, 0, 9, 2.5).fill({ color: 0x000000, alpha: 0.25 });
  g.roundRect(-4, -18, 3.5, 18, 1.5).fill(0x3b3f45).roundRect(1, -18, 3.5, 18, 1.5).fill(0x34383d);
  g.roundRect(-6, -36, 12, 20, 4).fill(0x6e5a4a);
  g.circle(0, -42, 6).fill(0xe5c39c);
  g.moveTo(-6, -45).quadraticCurveTo(0, -52, 6, -45).fill(0x4a5d6e);
  // The sack, slung behind.
  g.roundRect(-16, -40, 12, 18, 5).fill(SACK);
  g.moveTo(-6, -34).lineTo(4, -38).stroke({ width: 2, color: 0x8a7a5a });
  return g;
}

function beachcomber(level: number): Station {
  const container = new Container();
  const g = new Graphics();
  shadow(g, 70);
  // Bundles of driftwood at the tideline.
  for (let i = 0; i < (level >= 3 ? 1 : 2); i++) {
    driftLog(g, 18 + i * 4, -4 - i * 6, 34, -0.08 + i * 0.12);
    g.rect(14 + i * 4, -10 - i * 6, 3, 8).fill(0x8a6a3a);
  }
  if (level >= 2) {
    // A drying rack: two A-frames and poles hung with bleached sticks; a second sack.
    for (const x of [-46, -14]) {
      g.moveTo(x - 7, 0)
        .lineTo(x, -44)
        .lineTo(x + 7, 0)
        .stroke({ width: 3, color: DRIFT_DARK });
    }
    g.rect(-50, -40, 40, 3).fill(DRIFT_DARK);
    for (let x = -44; x < -14; x += 6) g.rect(x, -38, 3, 22 + ((x * 7) % 5)).fill(DRIFT);
    g.roundRect(-8, -16, 12, 16, 5).fill(SACK).roundRect(-8, -16, 12, 4, 2).fill(0xa8946a);
  }
  if (level >= 3) {
    // A tarp shelter, a handcart and a big stack.
    g.moveTo(-96, 0).lineTo(-96, -50).stroke({ width: 3, color: DRIFT_DARK });
    g.moveTo(-60, 0).lineTo(-60, -38).stroke({ width: 3, color: DRIFT_DARK });
    g.poly([-104, -54, -54, -40, -56, -34, -102, -48]).fill(0x4a7fb5);
    g.poly([-104, -54, -54, -40, -78, -46]).fill({ color: 0xffffff, alpha: 0.12 });
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 4 - row; k++)
        driftLog(g, -92 + k * 9 + row * 4.5, -4 - row * 7, 30, 0, 7);
    }
    g.roundRect(30, -24, 32, 14, 2).fill(0x8a5a30).rect(30, -24, 32, 3).fill(0xa87444);
    g.circle(46, -8, 7).fill(0x3b3833).circle(46, -8, 2.5).fill(0x8a8f94);
    g.moveTo(62, -20).lineTo(80, -30).stroke({ width: 3, color: 0x5a3d26 });
    for (let k = 0; k < 3; k++) driftLog(g, 46, -28 - k * 5, 30, 0.05, 5);
  }
  const walker = sackFigure();
  container.addChild(g, walker);
  return {
    id: "beachcomber",
    container,
    pile: { x: 18, y: -18 },
    work: -20,
    animate: (t) => {
      // Up and down the tideline, turning at each end.
      const phase = (t * 0.12) % 2;
      const along = phase < 1 ? phase : 2 - phase;
      walker.x = lerp(-70, 70, along) + (level >= 3 ? 40 : 0);
      walker.y = 10;
      walker.scale.x = phase < 1 ? 1 : -1;
      walker.rotation = Math.sin(t * 9) * 0.04;
    },
  };
}

// --- the Ship Breaker (new) ----------------------------------------------------------------

const HULL = 0x6a5a52;
const RUSTY = 0x8a4a2a;

function hullSection(g: Graphics, x: number, w: number, h: number): void {
  g.moveTo(x - w / 2, 0)
    .quadraticCurveTo(x - w / 2 + 6, -h, x + w * 0.1, -h)
    .lineTo(x + w / 2, -h * 0.9)
    .lineTo(x + w / 2, 0)
    .closePath()
    .fill(HULL);
  g.rect(x - w / 2 + 8, -h * 0.55, w - 12, 3).fill({ color: 0x2c2420, alpha: 0.6 });
  for (let k = 0; k < 4; k++) g.circle(x - w / 3 + k * (w / 5), -h * 0.75, 1.8).fill(0x9aa0a6);
  g.poly([x + w * 0.15, -h, x + w / 2, -h * 0.9, x + w / 2, -h * 0.4, x + w * 0.3, -h * 0.5]).fill({
    color: RUSTY,
    alpha: 0.7,
  });
  // The cut edge, bright where the torch went.
  g.moveTo(x + w / 2, -h * 0.9)
    .lineTo(x + w / 2, 0)
    .stroke({ width: 2.5, color: 0xd8dde2 });
}

function shipbreaker(level: number): Station {
  const container = new Container();
  const g = new Graphics();
  shadow(g, level >= 3 ? 170 : 100);
  const glows: Glow[] = [];
  if (level >= 3) {
    // The slipway, half a ship on it, and a sledge of cut plates.
    g.poly([-110, 0, 70, 0, 70, -6, -110, -18]).fill(0x7a5236);
    for (let x = -100; x < 70; x += 16) g.rect(x, -14 + (x + 110) * 0.06, 3, 12).fill(0x5a3d26);
    hullSection(g, -30, 140, 92);
    g.rect(-60, -110, 4, 20).fill(0x3a4448);
    g.roundRect(70, -12, 46, 10, 3).fill(0x5a3d26);
    for (let k = 0; k < 4; k++)
      g.rect(72 + k, -18 - k * 4, 40, 4).fill(k % 2 ? 0x8fa3b5 : 0x7a8c9c);
  } else {
    hullSection(g, -6, 86, 54);
  }
  if (level >= 2) {
    // A gantry over the hull with a winch and a hook.
    const gx = level >= 3 ? -30 : -6;
    const span = level >= 3 ? 90 : 64;
    g.moveTo(gx - span, 0)
      .lineTo(gx - span + 10, -120)
      .stroke({ width: 4, color: 0x3a4448 });
    g.moveTo(gx + span, 0)
      .lineTo(gx + span - 10, -120)
      .stroke({ width: 4, color: 0x3a4448 });
    g.rect(gx - span + 4, -124, span * 2 - 8, 6).fill(0x3a4448);
    g.roundRect(gx - 10, -134, 20, 12, 2).fill(0xe3a32f);
    g.moveTo(gx, -118).lineTo(gx, -84).stroke({ width: 1.5, color: 0x2e2b27 });
    g.moveTo(gx - 4, -84)
      .quadraticCurveTo(gx, -76, gx + 4, -84)
      .stroke({ width: 2, color: 0x2e2b27 });
  }
  // The torch: a gas bottle and a hissing flame at the cut.
  const tx = level >= 3 ? 46 : 42;
  g.roundRect(tx + 8, -26, 9, 26, 3).fill(0x4a7fb5);
  const flame = new Graphics();
  flame.position.set(tx - 2, level >= 3 ? -60 : -34);
  const glow = new Glow(0x9fd4ff, 90, 1);
  glow.sprite.position.copyFrom(flame.position);
  glows.push(glow);
  container.addChild(g, flame);
  for (const item of glows) container.addChild(item.sprite);
  return {
    id: "shipbreaker",
    container,
    glows,
    pile: { x: level >= 3 ? 92 : 60, y: -12 },
    work: tx - 14,
    animate: (t) => {
      const f = 0.7 + Math.abs(Math.sin(t * 23)) * 0.3;
      flame.clear();
      flame
        .moveTo(0, 0)
        .lineTo(-9 * f, -3)
        .lineTo(0, -6)
        .closePath()
        .fill(0xdff6ff);
      flame
        .moveTo(0, -1)
        .lineTo(-5 * f, -3)
        .lineTo(0, -5)
        .closePath()
        .fill(0xffffff);
    },
  };
}

// --- the Reactor (new) ---------------------------------------------------------------------

function reactor(level: number): Station {
  const container = new Container();
  const g = new Graphics();
  const glows: Glow[] = [];
  shadow(g, level >= 3 ? 150 : 90);
  // The fenced pit with a salvaged drum in it.
  g.ellipse(0, -2, 40, 8).fill(0x2e2b27);
  g.roundRect(-14, -34, 28, 34, 4).fill(0x7a8a7a);
  g.rect(-14, -26, 28, 5).fill(0xe3a32f);
  g.rect(-14, -12, 28, 3).fill({ color: 0x000000, alpha: 0.25 });
  g.ellipse(0, -34, 14, 3.5).fill(0x5d6b5d);
  for (let x = -48; x <= 48; x += 12) g.rect(x - 1, -26, 2, 26).fill(0x5d6064);
  g.moveTo(-48, -22)
    .lineTo(48, -22)
    .moveTo(-48, -8)
    .lineTo(48, -8)
    .stroke({ width: 1, color: 0x8a8f94, alpha: 0.8 });
  const lamps: Glow[] = [];
  if (level >= 2) {
    // Pipes out of the pit and a short cooling stack.
    g.moveTo(14, -24).lineTo(40, -24).lineTo(40, -60).stroke({ width: 5, color: 0x8a8f94 });
    g.roundRect(30, -100, 22, 44, 3).fill(0x9aa0a6);
    g.rect(30, -88, 22, 4).fill(0xcd412b);
    g.moveTo(-14, -18).lineTo(-36, -18).lineTo(-36, 0).stroke({ width: 4, color: 0x8a8f94 });
  }
  if (level >= 3) {
    // The cooling tower: a waisted shell with a red band, and warning lights.
    const cx = -80;
    g.moveTo(cx - 34, 0)
      .quadraticCurveTo(cx - 16, -60, cx - 24, -120)
      .lineTo(cx + 24, -120)
      .quadraticCurveTo(cx + 16, -60, cx + 34, 0)
      .closePath()
      .fill(0xb8b4aa);
    g.moveTo(cx + 6, 0)
      .quadraticCurveTo(cx + 12, -60, cx + 10, -120)
      .lineTo(cx + 24, -120)
      .quadraticCurveTo(cx + 16, -60, cx + 34, 0)
      .closePath()
      .fill({ color: 0x000000, alpha: 0.16 });
    g.rect(cx - 25, -112, 50, 4).fill(0xcd412b);
    g.ellipse(cx, -120, 24, 4).fill(0x8a867c);
    for (const [x, y] of [
      [cx - 22, -124],
      [cx + 22, -124],
      [41, -104],
    ] as const) {
      g.circle(x, y, 2.5).fill(0xf05252);
      const lamp = new Glow(0xf05252, 46, 1);
      lamp.sprite.position.set(x, y);
      lamps.push(lamp);
      glows.push(lamp);
    }
  }
  // The core's glow through the drum's seams.
  const core = new Glow(0x9be564, 80, 0.8);
  core.sprite.position.set(0, -18);
  glows.push(core);
  container.addChild(g);
  for (const item of glows) container.addChild(item.sprite);
  const chimney = level >= 3 ? { x: -80, y: -124 } : level >= 2 ? { x: 41, y: -102 } : null;
  return {
    id: "reactor",
    container,
    glows,
    ...(chimney ? { chimney } : {}),
    pile: { x: 60, y: -6 },
    work: 52,
    animate: (t) => {
      const on = Math.sin(t * 2.4) > 0;
      for (const lamp of lamps) lamp.sprite.visible = on;
    },
  };
}

// --- the table -----------------------------------------------------------------------------

/** Per line: where the product piles and where the hand works, when the drawing sets neither. */
const SPOTS: Record<string, { pile: [number, number]; work: number }> = {
  campfire: { pile: [34, -6], work: -30 },
  garden: { pile: [0, -14], work: 40 },
  loom: { pile: [36, -8], work: -34 },
  workbench: { pile: [-58, -6], work: 0 },
  kiln: { pile: [36, -8], work: -36 },
  furnace: { pile: [44, -8], work: -42 },
  tannery: { pile: [40, -8], work: -40 },
  press: { pile: [-44, -8], work: 0 },
  dock: { pile: [-20, -18], work: -60 },
  generator: { pile: [-40, -8], work: 30 },
  radio_mast: { pile: [30, -8], work: -24 },
};

const DRAW: Record<string, (stage: number) => Station> = {
  beachcomber,
  campfire,
  garden,
  loom,
  workbench,
  kiln,
  furnace,
  tannery,
  press,
  dock,
  generator,
  radio_mast: radioMast,
  shipbreaker,
  reactor,
};

/** Line `id` drawn at `stage` (1 at one owned, 2 at 25, 3 at 100), or null for an unknown id. */
export function drawLine(id: string, stage: number): Station | null {
  const draw = DRAW[id];
  if (!draw) return null;
  const drawn = draw(clamp(stage, 1, 3));
  const spot = SPOTS[id];
  drawn.pile ??= spot ? { x: spot.pile[0], y: spot.pile[1] } : { x: 30, y: -8 };
  drawn.work ??= spot?.work ?? -30;
  return drawn;
}
