/** Sky gradient, sun and moon, stars, clouds. */
import { Container, Graphics, Sprite } from "pixi.js";
import type { Palette } from "./palette";
import { glowTexture, puffTexture, verticalGradient } from "./textures";
import { clamp, hash, lerp, rand } from "./util";

interface Star {
  sprite: Graphics;
  phase: number;
  speed: number;
}

interface Cloud {
  container: Container;
  speed: number;
  baseY: number;
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

    const puff = puffTexture(128);
    for (let i = 0; i < 7; i++) {
      const cloud = new Container();
      const puffs = 4 + Math.floor(hash(i * 11) * 3);
      let x = 0;
      for (let p = 0; p < puffs; p++) {
        const sprite = new Sprite(puff);
        sprite.anchor.set(0.5);
        const s = rand(0.9, 1.7);
        sprite.scale.set(s * 1.3, s * 0.72);
        sprite.position.set(x, rand(-14, 14));
        sprite.alpha = rand(0.7, 0.95);
        cloud.addChild(sprite);
        x += rand(40, 70);
      }
      cloud.position.set(
        -extend + hash(i * 13.7) * (width + extend * 2),
        60 + hash(i * 17.3) * (horizon * 0.55),
      );
      cloud.scale.set(rand(0.9, 1.6));
      this.container.addChild(cloud);
      this.clouds.push({ container: cloud, speed: rand(6, 14), baseY: cloud.y });
    }
  }

  update(dt: number, dayFraction: number, palette: Palette, wind: number, gloom = 0): void {
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

    for (const cloud of this.clouds) {
      cloud.container.x += (cloud.speed + wind * 3) * dt;
      cloud.container.y = cloud.baseY + Math.sin(this.time * 0.2 + cloud.baseY) * 4;
      if (cloud.container.x > this.width + this.extend + 200)
        cloud.container.x = -this.extend - 300;
      for (const puff of cloud.container.children) (puff as Sprite).tint = palette.cloud;
    }
  }
}
