/**
 * The pixel island's land and water (D188, D203), on the art grid: the far coast across the
 * water with its ruined landmarks, the sea on the left with rolling surface tiles, the three
 * terraces rising behind the beach (one per era after Twig), and the beach strip in front with
 * the earth below. Tiles come from the approved Scene Mock (`terrain/*`); the ridge and the deep
 * water are drawn from the palette. It replaces the stand-in scene's `Terrain` with the same
 * three layers: `back` (behind everything), `ground` (what the island stands on), `front`.
 *
 * Night, dusk, rain and fog reach it through the scene's ambient tint, like every sprite.
 */
import { Container, Graphics, type Texture, TilingSprite } from "pixi.js";
import { ROWS, SHORE, TERRACES } from "./island";
import type { Palette } from "./palette";
import { ART, art, artSprite, strip } from "./pixel";
import { hash, lerpColor } from "./util";

/** The palette colours the land draws itself (packages/content/art/palette.json). */
const COLOURS = {
  farWater: 0x1d565e,
  seaDeep: 0x10303a,
  ridge: 0x4a5560,
  earthDark: 0x150c19,
  dirt: 0x502f30,
} as const;

/** Each terrace's tint, lowest first: higher terraces sit further back, a little hazier. */
const HAZE = [0xf2ece6, 0xe2dbd6, 0xd0cac8];
/** The dirt's bands below the earth tile, darker with depth. */
const EARTH_BANDS = [0xb8b0b0, 0x8a8288, 0x5e5862];

/** Art rows of the plain ground tile: where its sand crest averages, where the dirt starts. */
const GROUND_TILE = { crest: 22, dirt: 34, height: 64 };

export interface LandscapeLayout {
  /** The stage, in stage units, and how far the land runs past it. */
  width: number;
  height: number;
  extend: number;
}

/** A tiling sprite of `texture` covering art pixels [x, x + w) × [y, y + h), on the grid. */
function tiles(texture: Texture, x: number, y: number, w: number, h: number): TilingSprite {
  const sprite = new TilingSprite({ texture, width: w * ART, height: h * ART });
  sprite.tileScale.set(ART);
  sprite.position.set(x * ART, y * ART);
  return sprite;
}

/** A rectangle of art pixels in one colour. */
function block(g: Graphics, x: number, y: number, w: number, h: number, color: number): Graphics {
  return g.rect(x * ART, y * ART, w * ART, h * ART).fill(color);
}

export class Landscape {
  readonly back = new Container();
  readonly ground = new Container();
  readonly front = new Container();
  private readonly far = new Container();
  private readonly ridge = new Graphics();
  private sea: TilingSprite | null = null;
  private time = 0;

  constructor(private readonly layout: LandscapeLayout) {}

  /** Lays the land out once the art has loaded (`loadArt`). */
  build(): void {
    const layout = this.layout;
    const left = Math.floor(-layout.extend / ART);
    const right = Math.ceil((layout.width + layout.extend) / ART);
    const bottom = Math.ceil((layout.height + layout.extend) / ART);
    const beach = ROWS.beach;

    // The far coast: water to the horizon, a low ridge, the ruins across the bay.
    const water = block(new Graphics(), left, 100, right - left, beach - 100 + 2, COLOURS.farWater);
    this.back.addChild(water);
    for (let x = left; x < right; x++) {
      const h =
        6 +
        Math.round(
          Math.sin(x / 23) * 3 + Math.sin(x / 9 + 1.3) * 1.5 + hash(Math.floor(x / 3)) * 1.2,
        );
      block(this.ridge, x, 100 - h, 1, h, COLOURS.ridge);
    }
    this.far.addChild(this.ridge);
    const landmarks = artSprite("terrain/far");
    if (landmarks) {
      landmarks.anchor.set(0, 1);
      landmarks.position.set(0, 102 * ART);
      this.far.addChild(landmarks);
    }
    this.back.addChild(this.far);

    // The sea on the left: rolling surface tiles, then the depth.
    const seaTile = art("terrain/sea");
    const seaRight = SHORE + 6;
    block(
      this.ground.addChild(new Graphics()),
      left,
      beach - 2,
      seaRight - left,
      bottom,
      COLOURS.seaDeep,
    );
    this.sea = seaTile ? tiles(seaTile, left, beach - 4, seaRight - left, 26) : null;
    if (this.sea) this.ground.addChild(this.sea);

    // The terraces, back to front: the ground tile (sand crest, dirt below) with its crest on
    // the row's feet line, each a little hazier than the one below it; the next terrace down
    // covers the rest of its dirt.
    const ground = art("terrain/ground_plain");
    const dirt = strip(
      "terrain/ground_plain",
      GROUND_TILE.dirt,
      GROUND_TILE.height - GROUND_TILE.dirt,
    );
    const terraces = [...TERRACES].reverse();
    for (const [i, terrace] of terraces.entries()) {
      if (!ground) break;
      const y = ROWS[terrace.row] - GROUND_TILE.crest;
      const w = terrace.right - terrace.left;
      const layer = new Container();
      layer.addChild(tiles(ground, terrace.left, y, w, GROUND_TILE.height));
      // A darker lip on the face's left edge reads as the terrace's corner.
      block(
        layer.addChild(new Graphics()),
        terrace.left,
        y + GROUND_TILE.crest + 4,
        1,
        GROUND_TILE.height - GROUND_TILE.crest - 4,
        COLOURS.dirt,
      );
      layer.tint = HAZE[terraces.length - 1 - i] ?? 0xffffff;
      this.ground.addChild(layer);
    }

    // The beach strip and the earth below it; its left end slopes into the sea.
    if (ground) {
      const from = SHORE - 34;
      const top = beach - GROUND_TILE.crest;
      const land = new Container();
      land.addChild(tiles(ground, from, top, right - from, GROUND_TILE.height));
      // Deeper down the dirt darkens in bands, then the bedrock's near-black.
      let depth = top + GROUND_TILE.height;
      const earth = art("terrain/earth");
      if (earth) {
        land.addChild(tiles(earth, from, depth, right - from, earth.height));
        depth += earth.height;
      }
      for (const tint of EARTH_BANDS) {
        if (!dirt) break;
        const band = tiles(dirt, from, depth, right - from, dirt.height);
        band.tint = tint;
        land.addChild(band);
        depth += dirt.height;
      }
      block(
        land.addChild(new Graphics()),
        from,
        depth,
        right - from,
        bottom - depth,
        COLOURS.earthDark,
      );
      // The slope: a stepped edge from the waterline down and to the left.
      const mask = new Graphics();
      mask.moveTo((SHORE + 2) * ART, top * ART);
      for (let y = top; y <= beach + 30; y += 2) {
        const x = SHORE + 2 - Math.max(0, Math.floor((y - beach + 2) * 0.9));
        mask.lineTo(x * ART, y * ART).lineTo(x * ART, (y + 2) * ART);
      }
      mask
        .lineTo((SHORE - 34) * ART, (beach + 32) * ART)
        .lineTo((SHORE - 34) * ART, bottom * ART)
        .lineTo(right * ART, bottom * ART)
        .lineTo(right * ART, top * ART)
        .closePath()
        .fill(0xffffff);
      land.mask = mask;
      this.ground.addChild(land, mask);
    }
  }

  update(dt: number, palette: Palette, _wind: number, parallax: number): void {
    this.time += dt;
    // The far coast takes the sky's haze and drifts a little with the pointer, on whole pixels.
    this.ridge.tint = lerpColor(0xffffff, palette.haze, 0.35);
    this.far.x = Math.round(parallax * 2) * ART;
    // The sea rolls: its surface tile steps one art pixel at a time.
    if (this.sea) this.sea.tilePosition.x = -Math.floor(this.time * 3) * ART;
  }
}
