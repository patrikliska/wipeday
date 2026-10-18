/**
 * The wasteland's land and skyline (D208, D209), on the art grid: three layers of a ruined city
 * behind the ground (far, mid, near), each paler with distance, as on the comparison page the
 * owner chose; then the ground itself, painted whole. No sea: what washed in now drops from the
 * sky (`flotsam.ts`). The three containers keep the stand-in scene's roles: `back` (behind
 * everything), `ground` (what the lines stand on), `front` (nothing yet).
 *
 * A layer is generated art (`skyline/<layer>_<n>`, 512 px wide): its variants are laid left to
 * right in a seeded order, some mirrored, never the same one twice in a row, so even a 2k screen
 * shows no repeat. The haze is baked into each layer once (a wash of the haze colour over its
 * own pixels); night, rain and fog reach it through the scene's ambient tint, like every sprite.
 */
import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { paintGround } from "./ground";
import { GROUND_BACK, ROWS } from "./island";
import type { Palette } from "./palette";
import { ART, art } from "./pixel";

/** The skyline's layers, far to near: variants, where they stand, how hazy, how much they drift. */
// The owner prefers an open wasteland with only a few buildings (D210): the dense city is a faint
// far silhouette; the mid and near layers are sparse (a lone house, a water tower, poles, wrecks).
const LAYERS = [
  { name: "far", variants: 2, bottom: GROUND_BACK - 1, haze: 0.86, drift: 1 },
  { name: "mid", variants: 2, bottom: GROUND_BACK + 1, haze: 0.42, drift: 2 },
  { name: "near", variants: 2, bottom: GROUND_BACK + 2, haze: 0.18, drift: 3 },
] as const;

/** The dusty air: what the far layers fade toward (the comparison page's pale orange). */
const HAZE = "#efc39a";
/** The far plain under the city: its rows and its hazy sand (the ground's colour in the haze). */
const PLAIN_ROWS = 3;
const PLAIN = 0xd9ab84;
const PLAIN_LIGHT = 0xe6bf98;
/** Rows below the ground's lip over which the earth darkens to bedrock. */
const DARKEN = 70;
/** Layers overlap their neighbours by this many art px, so no gap shows at a seam. */
const OVERLAP = 12;

export interface LandscapeLayout {
  /** The stage, in stage units, and how far the land runs past it. */
  width: number;
  height: number;
  extend: number;
}

/** A deterministic hash in [0, 1). */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** `texture` with `amount` of the haze washed over its own pixels (its alpha kept). */
function hazed(texture: Texture, amount: number): Texture {
  const { width, height } = texture.frame;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return texture;
  ctx.imageSmoothingEnabled = false;
  const source = texture.source.resource as CanvasImageSource;
  ctx.drawImage(source, texture.frame.x, texture.frame.y, width, height, 0, 0, width, height);
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = amount;
  ctx.fillStyle = HAZE;
  ctx.fillRect(0, 0, width, height);
  const out = Texture.from(canvas);
  out.source.scaleMode = "nearest";
  return out;
}

export class Landscape {
  readonly back = new Container();
  readonly ground = new Container();
  readonly front = new Container();
  private readonly layers: { container: Container; drift: number }[] = [];

  constructor(private readonly layout: LandscapeLayout) {}

  /** Lays the land out once the art has loaded (`loadArt`). */
  build(): void {
    const layout = this.layout;
    const left = Math.floor(-layout.extend / ART);
    const right = Math.ceil((layout.width + layout.extend) / ART);
    const bottom = Math.ceil((layout.height + layout.extend) / ART);

    for (const [index, layer] of LAYERS.entries()) {
      const textures: Texture[] = [];
      for (let n = 0; n < layer.variants; n++) {
        const texture = art(`skyline/${layer.name}_${n}`);
        if (texture) textures.push(hazed(texture, layer.haze));
      }
      if (textures.length === 0) continue;
      const container = new Container();
      let x = left - 40;
      let previous = -1;
      for (let i = 0; x < right + 40; i++) {
        // A seeded variant, never the one just used; a mirror half the time.
        let pick = Math.floor(hash(index * 97 + i * 13) * textures.length);
        if (pick === previous && textures.length > 1) pick = (pick + 1) % textures.length;
        previous = pick;
        const texture = textures[pick];
        if (!texture) break;
        const sprite = new Sprite(texture);
        const width = texture.frame.width;
        const mirror = hash(index * 31 + i * 7 + 5) < 0.5;
        sprite.anchor.set(mirror ? 1 : 0, 1);
        sprite.scale.set(mirror ? -ART : ART, ART);
        sprite.position.set(x * ART, layer.bottom * ART);
        container.addChild(sprite);
        x += width - OVERLAP;
      }
      this.back.addChild(container);
      this.layers.push({ container, drift: layer.drift });
      // The far plain: a strip of hazy desert in front of the city's foot, down to the ground's
      // far edge, so the city stands on land in the distance with no sky showing under it.
      if (layer.name === "far") {
        const plain = new Graphics();
        const top = GROUND_BACK - PLAIN_ROWS;
        plain.rect(left * ART, top * ART, (right - left) * ART, (PLAIN_ROWS + 2) * ART).fill(PLAIN);
        plain.rect(left * ART, top * ART, (right - left) * ART, ART).fill(PLAIN_LIGHT);
        this.back.addChild(plain);
      }
    }

    // The ground: one painted piece from its far edge down past the bottom of every screen.
    const piece = new Sprite(
      paintGround({
        width: right - left,
        height: bottom - GROUND_BACK,
        surface: ROWS.front - GROUND_BACK,
        seed: 7,
        darken: DARKEN,
      }),
    );
    piece.scale.set(ART);
    piece.position.set(left * ART, GROUND_BACK * ART);
    this.ground.addChild(piece);
  }

  update(_dt: number, _palette: Palette, _wind: number, parallax: number): void {
    // The skyline drifts a little with the pointer, far layers least, on whole art pixels.
    for (const layer of this.layers) layer.container.x = Math.round(parallax * layer.drift) * ART;
  }
}
