/**
 * The buildings around the base (W2), one drawing per type and level: level 1
 * is a humble start (a lean-to, a tent, a single bed of greens), level 3 the
 * finished thing (a stone-and-metal warehouse, a lit mast, a boathouse).
 * Flat vector like the rest of the scene; windows and lamps carry glows that
 * the base moves to the light layer so they stay warm at night (D47).
 */
import { Container, Graphics } from "pixi.js";
import { Glow } from "./effects";
import type { Station } from "./station";

const WOOD = 0x8a5a30;
const WOOD_DARK = 0x5a3d26;
const WOOD_LIGHT = 0xa87444;
const PLANK = 0x9a6a3a;
const STONE = 0x8a8f94;
const STONE_DARK = 0x5d6064;
const METAL = 0x6c97bc;
const METAL_DARK = 0x46607a;
const ROOF = 0x6b4423;
const CANVAS = 0xd8c9a3;
const CANVAS_DARK = 0xb2a07a;
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

// --- storage and crew --------------------------------------------------------------------

function warehouse(level: number): Station {
  const g = new Graphics();
  const glows: Glow[] = [];
  if (level <= 1) {
    // A lean-to over stacked sacks and crates.
    shadow(g, 96);
    g.rect(-44, -58, 6, 58).fill(WOOD_DARK).rect(38, -46, 6, 46).fill(WOOD_DARK);
    g.moveTo(-52, -62).lineTo(50, -48).lineTo(50, -42).lineTo(-52, -56).closePath().fill(ROOF);
    g.rect(-30, -24, 26, 24).fill(PLANK).stroke({ width: 2, color: WOOD_DARK });
    g.roundRect(0, -20, 18, 20, 5).fill(CANVAS).roundRect(18, -16, 16, 16, 5).fill(CANVAS_DARK);
    return station("warehouse", g);
  }
  const w = level === 2 ? 112 : 136;
  const h = level === 2 ? 78 : 96;
  shadow(g, w);
  const wall = level === 2 ? PLANK : STONE;
  g.rect(-w / 2, -h, w, h).fill(wall);
  if (level === 2) {
    for (let y = -h + 12; y < 0; y += 14)
      g.rect(-w / 2, y, w, 2).fill({ color: WOOD_DARK, alpha: 0.6 });
  } else {
    for (let y = -h + 16; y < 0; y += 16)
      g.rect(-w / 2, y, w, 2).fill({ color: STONE_DARK, alpha: 0.5 });
    g.rect(-w / 2, -h, 8, h)
      .fill(STONE_DARK)
      .rect(w / 2 - 8, -h, 8, h)
      .fill(STONE_DARK);
  }
  // Gable roof: timber shingles, then corrugated metal at level 3.
  const roof = level === 2 ? ROOF : METAL;
  g.moveTo(-w / 2 - 10, -h)
    .lineTo(0, -h - 34)
    .lineTo(w / 2 + 10, -h)
    .closePath()
    .fill(roof);
  g.moveTo(0, -h - 34)
    .lineTo(w / 2 + 10, -h)
    .lineTo(w / 4, -h)
    .closePath();
  g.fill({ color: 0x000000, alpha: 0.18 });
  // Big double door.
  const dw = level === 2 ? 40 : 48;
  g.rect(-dw / 2, -h * 0.62, dw, h * 0.62).fill(WOOD_DARK);
  g.moveTo(-dw / 2, -h * 0.62)
    .lineTo(dw / 2, 0)
    .moveTo(dw / 2, -h * 0.62)
    .lineTo(-dw / 2, 0);
  g.stroke({ width: 2, color: WOOD, alpha: 0.9 });
  windowAt(g, -w / 2 + 12, -h + 16, 16, 14, glows);
  if (level === 3) windowAt(g, w / 2 - 28, -h + 16, 16, 14, glows);
  return station("warehouse", g, glows);
}

function bunkhouse(level: number): Station {
  const g = new Graphics();
  const glows: Glow[] = [];
  if (level <= 1) {
    // A canvas tent with a lamp inside.
    shadow(g, 76);
    g.moveTo(-38, 0).lineTo(0, -54).lineTo(38, 0).closePath().fill(CANVAS);
    g.moveTo(0, -54).lineTo(38, 0).lineTo(14, 0).closePath().fill(CANVAS_DARK);
    g.moveTo(-10, 0).lineTo(0, -34).lineTo(10, 0).closePath().fill(0x3a3026);
    const glow = new Glow(WARM, 80, 0.8);
    glow.sprite.position.set(0, -12);
    glows.push(glow);
    return station("bunkhouse", g, glows);
  }
  const w = level === 2 ? 92 : 104;
  const h = level === 2 ? 58 : 96;
  shadow(g, w);
  g.rect(-w / 2, -h, w, h).fill(level === 2 ? WOOD : PLANK);
  for (let y = -h + 10; y < 0; y += 12)
    g.rect(-w / 2, y, w, 2).fill({ color: WOOD_DARK, alpha: 0.55 });
  g.moveTo(-w / 2 - 8, -h)
    .lineTo(0, -h - 30)
    .lineTo(w / 2 + 8, -h)
    .closePath()
    .fill(ROOF);
  g.rect(-10, -34, 20, 34).fill(WOOD_DARK);
  windowAt(g, -w / 2 + 12, -h + 14, 14, 14, glows);
  windowAt(g, w / 2 - 26, -h + 14, 14, 14, glows);
  if (level === 3) {
    // Second floor: a row of bunks behind two more windows, and a stovepipe.
    g.rect(-w / 2, -h / 2 - 3, w, 5).fill(WOOD_DARK);
    windowAt(g, -w / 2 + 12, -h / 2 + 8, 14, 12, glows);
    windowAt(g, w / 2 - 26, -h / 2 + 8, 14, 12, glows);
    g.rect(w / 4, -h - 34, 8, 20).fill(0x3b3833);
    return station("bunkhouse", g, glows, { chimney: { x: w / 4 + 4, y: -h - 34 } });
  }
  return station("bunkhouse", g, glows);
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
  g.rect(-18, -40, 36, 20).fill(level === 3 ? 0x8a4f6a : 0xb9a36a);
  if (level === 3) {
    // Finished bolts hang from the lean-to: colour says "cloth, soon".
    g.rect(-34, -66, 10, 30).fill(0x4a7fb5).rect(26, -64, 10, 34).fill(0xc85a2b);
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

function lights(level: number): Station {
  const g = new Graphics();
  const glows: Glow[] = [];
  // Lamp posts along the yard: two, then three, then four with brighter lamps.
  const spots = [-96, 96, -210, 210].slice(0, level + 1);
  for (const x of spots) {
    const tall = level === 3 ? 78 : 64;
    g.rect(x - 2, -tall, 4, tall).fill(level === 3 ? METAL_DARK : WOOD_DARK);
    g.rect(x - 10, -tall, 20, 3).fill(level === 3 ? METAL_DARK : WOOD_DARK);
    g.roundRect(x - 6, -tall + 3, 12, 14, 3)
      .fill(0x2a2a2a)
      .rect(x - 4, -tall + 5, 8, 10)
      .fill(0xffe08a);
    const glow = new Glow(0xffe08a, level === 3 ? 200 : 160, 1);
    glow.sprite.position.set(x, -tall + 10);
    glows.push(glow);
  }
  return station("lights", g, glows);
}

function watchtower(level: number): Station {
  const g = new Graphics();
  const glows: Glow[] = [];
  const h = [0, 108, 146, 168][level] ?? 108;
  shadow(g, 56);
  if (level === 3) {
    // A stone foot, timber above.
    g.moveTo(-26, 0).lineTo(-20, -60).lineTo(20, -60).lineTo(26, 0).closePath().fill(STONE);
    for (let y = -52; y < 0; y += 13) g.rect(-24, y, 48, 2).fill({ color: STONE_DARK, alpha: 0.6 });
  }
  // Legs, braces and a ladder.
  g.moveTo(-22, 0).lineTo(-14, -h).lineTo(-9, -h).lineTo(-16, 0).closePath().fill(WOOD_DARK);
  g.moveTo(22, 0).lineTo(14, -h).lineTo(9, -h).lineTo(16, 0).closePath().fill(WOOD_DARK);
  for (let y = -h + 24; y < -8; y += 30) {
    g.moveTo(-18, y)
      .lineTo(18, y - 22)
      .moveTo(18, y)
      .lineTo(-18, y - 22);
  }
  g.stroke({ width: 2, color: WOOD, alpha: 0.9 });
  // Platform with a rail.
  g.rect(-24, -h - 6, 48, 6)
    .fill(WOOD)
    .rect(-24, -h - 22, 3, 16)
    .fill(WOOD_DARK)
    .rect(21, -h - 22, 3, 16)
    .fill(WOOD_DARK);
  g.rect(-24, -h - 22, 48, 3).fill(WOOD_LIGHT);
  if (level >= 2) {
    g.moveTo(-30, -h - 22)
      .lineTo(0, -h - 46)
      .lineTo(30, -h - 22)
      .closePath()
      .fill(ROOF);
  }
  if (level === 3) {
    g.rect(-1, -h - 70, 2, 26).fill(WOOD_DARK);
    g.moveTo(1, -h - 70)
      .lineTo(22, -h - 64)
      .lineTo(1, -h - 58)
      .closePath()
      .fill(0xcd412b);
    const glow = new Glow(WARM, 120, 0.9);
    glow.sprite.position.set(0, -h - 12);
    glows.push(glow);
  }
  return station("watchtower", g, glows);
}

/** The wall behind the base, `from` to `to` (container units): palisade, stone, sheet metal. */
function walls(level: number, from: number, to: number): Station {
  const g = new Graphics();
  if (level <= 1) {
    for (let x = from; x < to; x += 11) {
      const h = 34 + ((Math.abs(x) * 7) % 9);
      g.moveTo(x, 0)
        .lineTo(x, -h)
        .lineTo(x + 4.5, -h - 7)
        .lineTo(x + 9, -h)
        .lineTo(x + 9, 0)
        .closePath();
      g.fill(x % 2 === 0 ? WOOD : WOOD_LIGHT);
    }
    g.rect(from, -24, to - from, 3).fill(WOOD_DARK);
  } else if (level === 2) {
    g.rect(from, -44, to - from, 44).fill(STONE);
    for (let y = -44; y < 0; y += 11) {
      for (let x = from + ((y / 11) % 2 === 0 ? 0 : 12); x < to; x += 24) {
        g.rect(x, y, 23, 10).fill({ color: STONE_DARK, alpha: 0.35 });
      }
    }
    for (let x = from; x < to; x += 30) g.rect(x, -54, 16, 10).fill(STONE);
  } else {
    g.rect(from, -56, to - from, 56).fill(METAL);
    for (let x = from; x < to; x += 22)
      g.rect(x, -56, 2, 56).fill({ color: METAL_DARK, alpha: 0.7 });
    g.rect(from, -30, to - from, 4).fill(METAL_DARK);
    for (let x = from + 6; x < to; x += 18) {
      g.moveTo(x, -56)
        .lineTo(x + 4, -66)
        .lineTo(x + 8, -56)
        .closePath()
        .fill(0x9aa0a6);
    }
  }
  return station("walls", g);
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

/** A building drawn at `level`, or null for ids the scene places elsewhere (the furnace). */
export function makeBuilding(id: string, level: number, span?: [number, number]): Station | null {
  switch (id) {
    case "warehouse":
      return warehouse(level);
    case "bunkhouse":
      return bunkhouse(level);
    case "loom":
      return loom(level);
    case "tannery":
      return tannery(level);
    case "garden":
      return garden(level);
    case "lights":
      return lights(level);
    case "watchtower":
      return watchtower(level);
    case "walls":
      return walls(level, span?.[0] ?? -300, span?.[1] ?? 300);
    case "generator":
      return generator(level);
    case "radio_mast":
      return radioMast(level);
    case "dock":
      return dock(level);
    case "kiln":
      return kiln(level);
    case "press":
      return press(level);
    case "workbench":
      return workbench(level);
    case "campfire":
      return campfire(level);
    default:
      return null;
  }
}

/** Rough footprint of a building's drawing, for its construction scaffold. */
export const FOOTPRINTS: Record<string, [number, number]> = {
  warehouse: [120, 110],
  bunkhouse: [100, 110],
  loom: [70, 80],
  tannery: [80, 60],
  garden: [130, 30],
  lights: [120, 70],
  watchtower: [60, 150],
  walls: [120, 50],
  generator: [70, 60],
  radio_mast: [40, 200],
  dock: [120, 40],
  kiln: [60, 80],
  press: [60, 70],
  workbench: [90, 96],
  campfire: [60, 40],
  furnace: [70, 100],
};
