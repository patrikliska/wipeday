/** Parallax hills, an island, the ground with its path and grass, the sea and an organic shoreline. */
import { Container, Graphics, Sprite } from "pixi.js";
import { DIRT, GROUND, GROUND_DARK, GROUND_LIGHT, type Palette, SAND, SAND_WET } from "./palette";
import { verticalGradient } from "./textures";
import { hash, lerpColor } from "./util";

export interface TerrainLayout {
  width: number;
  height: number;
  horizon: number;
  ground: number;
  /** Sea covers x < shoreX at ground level. */
  shoreX: number;
  /** Where the path starts. */
  baseX: number;
  extend: number;
}

/**
 * A soft ridge line: sum of a few sines, deterministic. Left of `dropFrom` the
 * ridge sinks below the horizon so the bay opens onto the sea.
 */
function ridge(x: number, seed: number, amplitude: number, spread: number): number {
  const dropFrom = 520 + seed * 40;
  const drop = Math.max(0, dropFrom - x) * (0.45 + seed * 0.1);
  return (
    Math.sin(x / spread + seed) * amplitude +
    Math.sin(x / (spread * 0.37) + seed * 2.1) * amplitude * 0.35 +
    Math.sin(x / (spread * 0.13) + seed * 3.7) * amplitude * 0.08 +
    drop
  );
}

function ridgeLayer(
  layout: TerrainLayout,
  baseY: number,
  seed: number,
  amplitude: number,
  spread: number,
): Graphics {
  const g = new Graphics();
  const left = -layout.extend - 200;
  const right = layout.width + layout.extend + 200;
  g.moveTo(left, layout.height + layout.extend);
  g.lineTo(left, baseY + ridge(left, seed, amplitude, spread));
  for (let x = left; x <= right; x += 24) g.lineTo(x, baseY + ridge(x, seed, amplitude, spread));
  g.lineTo(right, layout.height + layout.extend);
  g.closePath();
  g.fill(0xffffff);
  return g;
}

function treeline(
  layout: TerrainLayout,
  baseY: number,
  seed: number,
  amplitude: number,
  spread: number,
  size: number,
): Graphics {
  const g = new Graphics();
  const step = size * 0.55;
  for (let x = -layout.extend; x < layout.width + layout.extend; x += step) {
    const h = size * (0.7 + hash(x * 0.37 + seed) * 0.9);
    const y = baseY + ridge(x, seed, amplitude, spread) + 4;
    g.moveTo(x - size * 0.4, y)
      .lineTo(x, y - h)
      .lineTo(x + size * 0.4, y)
      .closePath();
  }
  g.fill(0xffffff);
  return g;
}

interface ParallaxLayer {
  graphics: Graphics;
  depth: number;
  /** How much of the haze colour this layer takes. */
  haze: number;
  base: number;
}

export class Terrain {
  /** Behind the base: hills, the island, the far shore. */
  readonly back = new Container();
  /** The ground everything stands on. */
  readonly ground = new Container();
  /** In front of everything: grass tufts, bushes, pebbles. */
  readonly front = new Container();
  private readonly layers: ParallaxLayer[] = [];
  private readonly sea: Sprite;
  private readonly waves: Graphics[] = [];
  private readonly sparkle: Graphics;
  private readonly foam: Graphics;
  private readonly seaFar: Graphics;
  private time = 0;

  /** The waterline x for a ground-level y: drifts left as it comes toward the viewer, with bays. */
  private shoreAt(y: number): number {
    const d = y - this.layout.ground;
    return this.layout.shoreX - 60 - d * 0.1 + Math.sin(d / 90) * 22 + Math.sin(d / 37 + 1) * 7;
  }

  constructor(private readonly layout: TerrainLayout) {
    const { width, horizon, ground, extend, height, baseX } = layout;
    const bottom = height + extend;

    // Far sea on the horizon, behind the hills.
    this.seaFar = new Graphics()
      .rect(-extend, horizon - 6, width + extend * 2, ground - horizon + 30)
      .fill(0xffffff);
    this.back.addChild(this.seaFar);

    // A distant island with a lighthouse, low on the left.
    const island = new Graphics();
    island
      .moveTo(-40, horizon + 2)
      .quadraticCurveTo(120, horizon - 46, 300, horizon - 30)
      .quadraticCurveTo(380, horizon - 22, 440, horizon + 2)
      .closePath()
      .fill(0xffffff);
    island
      .rect(236, horizon - 66, 10, 40)
      .fill(0xffffff)
      .moveTo(232, horizon - 66)
      .lineTo(250, horizon - 66)
      .lineTo(241, horizon - 76)
      .closePath()
      .fill(0xffffff);
    this.back.addChild(island);
    this.layers.push({ graphics: island, depth: 0.1, haze: 0.7, base: 0x3f5a63 });

    // Three ridges, far to near, each with a treeline.
    const specs: Array<[number, number, number, number, number, number, number]> = [
      [horizon - 150, 1.3, 70, 420, 0.12, 0.62, 0x6b8a9e],
      [horizon - 70, 4.1, 46, 260, 0.28, 0.42, 0x4c6f6b],
      [horizon - 12, 7.9, 22, 150, 0.5, 0.2, 0x3b5e45],
    ];
    for (const [baseY, seed, amplitude, spread, depth, haze, base] of specs) {
      const g = ridgeLayer(layout, baseY, seed, amplitude, spread);
      this.back.addChild(g);
      this.layers.push({ graphics: g, depth, haze, base });
      const trees = treeline(layout, baseY, seed, amplitude, spread, depth < 0.3 ? 16 : 34);
      this.back.addChild(trees);
      this.layers.push({
        graphics: trees,
        depth,
        haze: haze * 0.8,
        base: lerpColor(base, 0x000000, 0.25),
      });
    }

    // Ground: a wide band, lighter along the top edge, darker with depth, then detail on top.
    const groundGraphics = new Graphics();
    groundGraphics.rect(-extend, ground, width + extend * 2, bottom - ground).fill(GROUND);
    groundGraphics.rect(-extend, ground, width + extend * 2, 5).fill(GROUND_LIGHT);
    for (let band = 0; band < 6; band++) {
      const y = ground + 120 + band * 90;
      groundGraphics
        .rect(-extend, y, width + extend * 2, bottom - y)
        .fill({ color: GROUND_DARK, alpha: 0.18 });
    }
    // Worn patch around the base and a path down to the shore.
    groundGraphics.ellipse(baseX - 40, ground + 58, 280, 34).fill({ color: DIRT, alpha: 0.4 });
    groundGraphics
      .moveTo(baseX - 20, ground + 14)
      .quadraticCurveTo(baseX - 120, ground + 110, baseX - 330, ground + 150)
      .quadraticCurveTo(baseX - 480, ground + 180, this.shoreAt(ground + 260) + 150, ground + 250)
      .stroke({ width: 42, color: DIRT, alpha: 0.7 });
    groundGraphics
      .moveTo(baseX - 20, ground + 14)
      .quadraticCurveTo(baseX - 120, ground + 110, baseX - 330, ground + 150)
      .quadraticCurveTo(baseX - 480, ground + 180, this.shoreAt(ground + 260) + 150, ground + 250)
      .stroke({ width: 16, color: lerpColor(DIRT, 0x000000, 0.12), alpha: 0.5 });
    // Grass tufts and flowers scattered over the ground, thinner near the base.
    const tufts = new Graphics();
    const flowers = new Graphics();
    for (let i = 0; i < 1100; i++) {
      const x = -extend + hash(i * 1.91) * (width + extend * 2);
      const y = ground + 10 + hash(i * 2.73) ** 1.6 * (bottom - ground - 20);
      if (x > this.shoreAt(y) - 30 && x < this.shoreAt(y) + 150) continue;
      if (Math.abs(x - baseX) < 330 && y < ground + 90) continue;
      const h = 8 + hash(i * 3.3) * 16;
      tufts
        .moveTo(x - 5, y)
        .lineTo(x - 1, y - h)
        .lineTo(x + 1, y)
        .closePath();
      tufts
        .moveTo(x, y)
        .lineTo(x + 4, y - h * 0.8)
        .lineTo(x + 7, y)
        .closePath();
      if (hash(i * 9.9) > 0.7) {
        tufts
          .moveTo(x + 5, y)
          .lineTo(x + 9, y - h * 0.6)
          .lineTo(x + 12, y)
          .closePath();
      }
      if (hash(i * 4.7) > 0.86)
        flowers.circle(x + 2, y - h - 2, 2.2).fill(hash(i * 5.1) > 0.5 ? 0xf2e394 : 0xf0f0f0);
    }
    tufts.fill({ color: GROUND_DARK, alpha: 0.9 });
    // Pebbles.
    for (let i = 0; i < 40; i++) {
      const x = -extend + hash(i * 7.3) * (width + extend * 2);
      const y = ground + 30 + hash(i * 8.1) * (bottom - ground - 40);
      if (x > this.shoreAt(y) - 40 && x < this.shoreAt(y) + 160) continue;
      groundGraphics
        .ellipse(x, y, 3 + hash(i) * 5, 2 + hash(i * 2) * 3)
        .fill({ color: 0x5c6166, alpha: 0.8 });
    }
    this.ground.addChild(groundGraphics, tufts, flowers);

    // Sea: gradient from deep to shallow, then the sand, the wet sand and the foam along the shoreline.
    this.sea = new Sprite(
      verticalGradient([
        [0, 0x1e5c86],
        [1, 0x5faccf],
      ]),
    );
    this.sea.position.set(-extend, ground - 2);
    this.sea.width = this.layout.shoreX + extend + 200;
    this.sea.height = bottom - ground + 2;
    this.ground.addChild(this.sea);

    const sand = new Graphics();
    sand.moveTo(this.shoreAt(ground) - 10, ground - 2);
    for (let y = ground; y <= bottom; y += 12)
      sand.lineTo(this.shoreAt(y) + 160 - (y - ground) * 0.03, y);
    for (let y = bottom; y >= ground; y -= 12) sand.lineTo(this.shoreAt(y) - 20, y);
    sand.closePath().fill(SAND);
    sand.moveTo(this.shoreAt(ground) - 10, ground - 2);
    for (let y = ground; y <= bottom; y += 12) sand.lineTo(this.shoreAt(y) + 34, y);
    for (let y = bottom; y >= ground; y -= 12) sand.lineTo(this.shoreAt(y) - 20, y);
    sand.closePath().fill(SAND_WET);
    this.ground.addChild(sand);

    for (let i = 0; i < 6; i++) {
      const wave = new Graphics();
      this.waves.push(wave);
      this.ground.addChild(wave);
    }
    this.sparkle = new Graphics();
    this.foam = new Graphics();
    this.ground.addChild(this.sparkle, this.foam);

    // Foreground: big tufts, a couple of bushes and rocks along the bottom edge.
    const frontTufts = new Graphics();
    for (let x = -extend; x < width + extend; x += 22) {
      const h = 14 + hash(x * 0.71) * 22;
      const y = height - 26 + hash(x * 0.13) * 46;
      frontTufts
        .moveTo(x, y)
        .lineTo(x + 4, y - h)
        .lineTo(x + 8, y)
        .closePath();
      frontTufts
        .moveTo(x + 8, y)
        .lineTo(x + 13, y - h * 0.7)
        .lineTo(x + 17, y)
        .closePath();
    }
    frontTufts.fill(GROUND_DARK);
    this.front.addChild(frontTufts);
    for (let i = 0; i < 4; i++) {
      const bush = new Graphics();
      const bx = 300 + i * 420 + hash(i * 3.3) * 200;
      const by = height - 10 + hash(i * 1.7) * 30;
      bush
        .circle(bx - 26, by - 16, 24)
        .fill(0x2f5a2c)
        .circle(bx + 10, by - 24, 30)
        .fill(0x37652f)
        .circle(bx + 40, by - 12, 22)
        .fill(0x2f5a2c);
      bush.circle(bx + 4, by - 34, 12).fill({ color: 0xffffff, alpha: 0.08 });
      this.front.addChild(bush);
    }
  }

  update(dt: number, palette: Palette, wind: number, parallax: number): void {
    this.time += dt;
    const { ground, height, extend } = this.layout;
    const bottom = height + extend;

    for (const layer of this.layers) {
      layer.graphics.tint = lerpColor(layer.base, palette.haze, layer.haze);
      layer.graphics.x = parallax * layer.depth * 60;
    }
    this.seaFar.tint = lerpColor(palette.seaDeep, palette.haze, 0.5);
    this.seaFar.x = parallax * 0.08 * 60;

    this.sea.texture = verticalGradient([
      [0, palette.seaDeep],
      [0.6, palette.seaShallow],
      [1, lerpColor(palette.seaShallow, 0xffffff, 0.25)],
    ]);

    // Waves: thin bright bands rolling toward the shore, stopping at the waterline.
    const bright = lerpColor(palette.seaShallow, 0xffffff, 0.35);
    for (const [i, wave] of this.waves.entries()) {
      wave.clear();
      const y = ground + 50 + i * 70;
      const phase = this.time * (0.9 + i * 0.15) + i * 1.3;
      const end = this.shoreAt(y) - 14;
      wave.moveTo(-extend, y);
      for (let x = -extend; x <= end; x += 14) {
        wave.lineTo(x, y + Math.sin(x / 55 + phase) * 4 + Math.sin(x / 19 - phase * 1.7) * 1.5);
      }
      wave.stroke({ width: 2 + (i % 2), color: bright, alpha: 0.3 + 0.12 * Math.sin(phase) });
    }
    // Sun sparkle on the water, only by day.
    this.sparkle.clear();
    for (let i = 0; i < 40; i++) {
      const y = ground + 20 + hash(i * 3.1) * 400;
      const x = -extend + hash(i * 1.3) * (this.shoreAt(y) + extend - 60);
      const blink = 0.5 + 0.5 * Math.sin(this.time * (2 + hash(i) * 3) + i);
      this.sparkle
        .rect(x, y, 6 + hash(i * 2) * 8, 1.5)
        .fill({ color: 0xffffff, alpha: blink * 0.5 * palette.light });
    }

    // Foam: the waterline, breathing in and out.
    const breathe = Math.sin(this.time * 0.8) * 10;
    this.foam.clear();
    this.foam.moveTo(this.shoreAt(ground) + breathe, ground - 2);
    for (let y = ground; y <= bottom; y += 12) {
      this.foam.lineTo(this.shoreAt(y) + breathe + Math.sin(y / 23 + this.time * 2) * 5, y);
    }
    this.foam.stroke({
      width: 5,
      color: 0xffffff,
      alpha: (0.4 + 0.15 * Math.sin(this.time * 0.8 + 1)) * (0.35 + 0.65 * palette.light),
    });

    this.front.x = Math.sin(this.time * 1.8) * wind * 0.4;
  }
}
