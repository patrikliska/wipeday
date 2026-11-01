/** Sky gradient, sun and moon, stars, and the pixel clouds (D218). */
import { Container, Graphics, Sprite } from "pixi.js";
import { cloudTexture } from "./clouds";
import type { Palette } from "./palette";
import { ART } from "./pixel";
import { glowTexture, verticalGradient } from "./textures";
import { clamp, hash, lerp, rand } from "./util";

/** Clouds in the sky; a clear sky shows the first `CLEAR_CLOUDS`, rain and fog all of them. */
const CLOUDS = 18;
const CLEAR_CLOUDS = 11;

interface Star {
  sprite: Graphics;
  phase: number;
  speed: number;
}

interface Cloud {
  sprite: Sprite;
  /** Where it is (stage units); drawn on the nearest whole art pixel. */
  x: number;
  speed: number;
  /** How opaque it is at full show: the far, low clouds are paler. */
  alpha: number;
}

export class Sky {
  readonly container = new Container();
  private readonly gradient: Sprite;
  private readonly sun: Sprite;
  private readonly sunGlow: Sprite;
  private readonly moon: Graphics;
  private readonly moonGlow: Sprite;
  private readonly stars: Star[] = [];
  private readonly clouds: Cloud[] = [];
  private lastGradientKey = "";
  private time = 0;

  constructor(
    private readonly width: number,
    private readonly horizon: number,
    private readonly extend: number,
  ) {
    this.gradient = new Sprite(
      verticalGradient([
        [0, 0x000000],
        [1, 0x000000],
      ]),
    );
    this.gradient.position.set(-extend, -extend);
    this.gradient.width = width + extend * 2;
    this.gradient.height = horizon + extend + 40;
    this.container.addChild(this.gradient);

    const starLayer = new Container();
    for (let i = 0; i < 140; i++) {
      const size = hash(i * 3.1) < 0.85 ? rand(0.7, 1.4) : rand(1.6, 2.4);
      const star = new Graphics().circle(0, 0, size).fill(0xffffff);
      star.position.set(
        -extend + hash(i * 1.7) * (width + extend * 2),
        -extend + hash(i * 2.3) * (horizon * 0.9 + extend),
      );
      starLayer.addChild(star);
      this.stars.push({
        sprite: star,
        phase: hash(i * 5.1) * Math.PI * 2,
        speed: 0.6 + hash(i * 7.7) * 1.6,
      });
    }
    this.container.addChild(starLayer);

    this.sunGlow = new Sprite(glowTexture());
    this.sunGlow.anchor.set(0.5);
    this.sunGlow.blendMode = "add";
    this.sunGlow.width = 420;
    this.sunGlow.height = 420;
    this.container.addChild(this.sunGlow);

    this.sun = new Sprite(glowTexture());
    this.sun.anchor.set(0.5);
    this.sun.width = 120;
    this.sun.height = 120;
    this.container.addChild(this.sun);

    this.moonGlow = new Sprite(glowTexture());
    this.moonGlow.anchor.set(0.5);
    this.moonGlow.blendMode = "add";
    this.moonGlow.tint = 0x9fb2ff;
    this.moonGlow.width = 320;
    this.moonGlow.height = 320;
    this.container.addChild(this.moonGlow);

    this.moon = new Graphics().circle(0, 0, 26).fill(0xf2f4ff);
    this.moon
      .circle(-8, -5, 4)
      .fill({ color: 0xd7dbea, alpha: 0.6 })
      .circle(6, 8, 6)
      .fill({ color: 0xd7dbea, alpha: 0.5 });
    this.container.addChild(this.moon);

    // Pixel clouds, each its own shape (D218): the high ones big and near, the low ones small,
    // pale and slow, as if far off over the city.
    for (let i = 0; i < CLOUDS; i++) {
      const height = hash(i * 17.3);
      const size = clamp(height * 1.1 - 0.05 + (hash(i * 5.9) - 0.5) * 0.3, 0, 1);
      const sprite = new Sprite(cloudTexture(i + 1, size));
      sprite.anchor.set(0, 1);
      sprite.scale.set(ART);
      // From above the skyline up to where a tall phone's sky ends (about 330 above 0).
      sprite.y = Math.round((horizon * (0.5 - height)) / ART) * ART;
      this.container.addChild(sprite);
      this.clouds.push({
        sprite,
        x: -extend + hash(i * 13.7) * (width + extend * 2),
        speed: 3 + size * 9,
        alpha: 0.55 + size * 0.35,
      });
    }
  }

  /** `cover` 0..1: how overcast (rain, fog): more clouds, more opaque. */
  update(
    dt: number,
    dayFraction: number,
    palette: Palette,
    wind: number,
    gloom = 0,
    cover = 0,
  ): void {
    this.time += dt;
    const key = `${palette.skyTop}-${palette.skyMid}-${palette.skyHorizon}`;
    if (key !== this.lastGradientKey) {
      this.lastGradientKey = key;
      this.gradient.texture = verticalGradient([
        [0, palette.skyTop],
        [0.55, palette.skyMid],
        [1, palette.skyHorizon],
      ]);
    }

    // Sun: rises at ~0.22, sets at ~0.78, arcs over the scene.
    const sunT = clamp((dayFraction - 0.22) / 0.56, -0.2, 1.2);
    const sunAngle = sunT * Math.PI;
    const sunX = lerp(-140, this.width + 140, sunT);
    const sunY = this.horizon + 40 - Math.sin(sunAngle) * (this.horizon * 0.72);
    this.sun.position.set(sunX, sunY);
    this.sunGlow.position.set(sunX, sunY);
    this.sun.tint = palette.sun;
    this.sunGlow.tint = palette.sunGlow;
    const sunUp = clamp(Math.sin(sunAngle) * 3, 0, 1);
    this.sun.alpha = sunUp * (1 - gloom * 0.8);
    this.sunGlow.alpha = sunUp * 0.55 * (1 - gloom);

    const moonT = clamp((((dayFraction + 0.5) % 1) - 0.22) / 0.56, -0.2, 1.2);
    const moonAngle = moonT * Math.PI;
    const moonX = lerp(-140, this.width + 140, moonT);
    const moonY = this.horizon + 40 - Math.sin(moonAngle) * (this.horizon * 0.7);
    this.moon.position.set(moonX, moonY);
    this.moonGlow.position.set(moonX, moonY);
    const moonUp = clamp(Math.sin(moonAngle) * 3, 0, 1) * palette.stars;
    this.moon.alpha = moonUp;
    this.moonGlow.alpha = moonUp * 0.7;

    for (const star of this.stars) {
      const twinkle = 0.65 + 0.35 * Math.sin(this.time * star.speed + star.phase);
      star.sprite.alpha = palette.stars * twinkle;
    }

    const shown = Math.round(lerp(CLEAR_CLOUDS, CLOUDS, clamp(cover, 0, 1)));
    for (const [i, cloud] of this.clouds.entries()) {
      cloud.x += (cloud.speed + wind * 2) * dt;
      if (cloud.x > this.width + this.extend + 100) cloud.x = -this.extend - 300;
      // Whole art pixels only: a cloud steps along the grid (D188).
      cloud.sprite.x = Math.round(cloud.x / ART) * ART;
      cloud.sprite.visible = i < shown;
      cloud.sprite.alpha = Math.min(1, cloud.alpha + cover * 0.25);
      cloud.sprite.tint = palette.cloud;
    }
  }
}
