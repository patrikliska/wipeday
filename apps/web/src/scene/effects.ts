/**
 * Particles, floating numbers, rain and fog, glows. Everything that is
 * motion rather than a thing.
 */
import { Container, Graphics, Sprite, Text, type TextStyleOptions } from "pixi.js";
import { glowTexture, puffTexture } from "./textures";
import { clamp, easeOutCubic, lerp, rand } from "./util";

interface Particle {
  sprite: Sprite | Graphics;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  age: number;
  grow: number;
  spin: number;
  startAlpha: number;
  startScale: number;
}

export type Emit = "smoke" | "sparks" | "leaves" | "dust" | "splash" | "coins" | "stone";

export class Particles {
  readonly container = new Container();
  private readonly live: Particle[] = [];
  private readonly puff = puffTexture(64);

  spawn(kind: Emit, x: number, y: number, count = 8, color?: number): void {
    for (let i = 0; i < count; i++) this.one(kind, x, y, color);
  }

  private one(kind: Emit, x: number, y: number, color?: number): void {
    let particle: Particle;
    switch (kind) {
      case "smoke": {
        const sprite = new Sprite(this.puff);
        sprite.anchor.set(0.5);
        sprite.tint = color ?? 0x9a9a9a;
        sprite.alpha = 0.35;
        sprite.scale.set(0.25);
        particle = {
          sprite,
          vx: rand(-6, 6),
          vy: rand(-34, -22),
          gravity: -4,
          drag: 0.98,
          life: rand(2.6, 3.8),
          age: 0,
          grow: 0.28,
          spin: 0,
          startAlpha: 0.35,
          startScale: 0.25,
        };
        break;
      }
      case "sparks": {
        const g = new Graphics().circle(0, 0, rand(1.2, 2.4)).fill(color ?? 0xffb347);
        particle = {
          sprite: g,
          vx: rand(-40, 40),
          vy: rand(-90, -40),
          gravity: 120,
          drag: 0.985,
          life: rand(0.5, 1),
          age: 0,
          grow: 0,
          spin: 0,
          startAlpha: 1,
          startScale: 1,
        };
        break;
      }
      case "leaves": {
        const g = new Graphics().ellipse(0, 0, rand(3, 5), rand(1.6, 2.6)).fill(color ?? 0x5c9b4a);
        particle = {
          sprite: g,
          vx: rand(-50, 50),
          vy: rand(-70, -20),
          gravity: 90,
          drag: 0.97,
          life: rand(0.8, 1.4),
          age: 0,
          grow: 0,
          spin: rand(-6, 6),
          startAlpha: 1,
          startScale: 1,
        };
        break;
      }
      case "stone": {
        const g = new Graphics().rect(-2, -2, rand(3, 5), rand(3, 5)).fill(color ?? 0x9aa0a6);
        particle = {
          sprite: g,
          vx: rand(-60, 60),
          vy: rand(-110, -40),
          gravity: 260,
          drag: 0.98,
          life: rand(0.5, 0.9),
          age: 0,
          grow: 0,
          spin: rand(-8, 8),
          startAlpha: 1,
          startScale: 1,
        };
        break;
      }
      case "dust": {
        const sprite = new Sprite(this.puff);
        sprite.anchor.set(0.5);
        sprite.tint = color ?? 0xb9a98a;
        sprite.alpha = 0.5;
        sprite.scale.set(0.3);
        particle = {
          sprite,
          vx: rand(-60, 60),
          vy: rand(-30, -8),
          gravity: -6,
          drag: 0.94,
          life: rand(0.9, 1.5),
          age: 0,
          grow: 0.5,
          spin: 0,
          startAlpha: 0.5,
          startScale: 0.3,
        };
        break;
      }
      case "splash": {
        const g = new Graphics().circle(0, 0, rand(1.5, 3)).fill(color ?? 0xcfe8f3);
        particle = {
          sprite: g,
          vx: rand(-70, 70),
          vy: rand(-140, -60),
          gravity: 300,
          drag: 0.99,
          life: rand(0.5, 0.9),
          age: 0,
          grow: 0,
          spin: 0,
          startAlpha: 0.9,
          startScale: 1,
        };
        break;
      }
      case "coins": {
        const g = new Graphics()
          .circle(0, 0, 3)
          .fill(color ?? 0xe3c04f)
          .stroke({ width: 1, color: 0x8a6a1a });
        particle = {
          sprite: g,
          vx: rand(-50, 50),
          vy: rand(-160, -90),
          gravity: 320,
          drag: 0.99,
          life: rand(0.7, 1.1),
          age: 0,
          grow: 0,
          spin: rand(-10, 10),
          startAlpha: 1,
          startScale: 1,
        };
        break;
      }
    }
    particle.sprite.position.set(x, y);
    this.container.addChild(particle.sprite);
    this.live.push(particle);
  }

  update(dt: number, wind: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      if (!p) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.sprite.destroy();
        this.live.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx = p.vx * p.drag + wind * dt * 8;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += p.spin * dt;
      p.sprite.alpha = p.startAlpha * (1 - easeOutCubic(t));
      if (p.grow) p.sprite.scale.set(p.startScale + p.grow * t);
    }
  }
}

const FLOAT_STYLE: TextStyleOptions = {
  fontFamily: "Roboto Condensed",
  fontWeight: "700",
  fontSize: 22,
  fill: 0xffffff,
  stroke: { color: 0x1b1a18, width: 5, join: "round" },
};

interface Float {
  text: Text;
  age: number;
  life: number;
  vy: number;
}

/** "+120" rising and fading. */
export class Floaters {
  readonly container = new Container();
  private readonly live: Float[] = [];

  add(x: number, y: number, label: string, color = 0xffffff, size = 22): void {
    const text = new Text({ text: label, style: { ...FLOAT_STYLE, fill: color, fontSize: size } });
    text.anchor.set(0.5, 1);
    text.position.set(x + rand(-8, 8), y);
    this.container.addChild(text);
    this.live.push({ text, age: 0, life: 1.4, vy: -46 });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const f = this.live[i];
      if (!f) continue;
      f.age += dt;
      const t = f.age / f.life;
      if (t >= 1) {
        f.text.destroy();
        this.live.splice(i, 1);
        continue;
      }
      f.text.y += f.vy * dt;
      f.vy *= 0.97;
      f.text.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const pop = t < 0.15 ? 1 + (0.15 - t) * 1.5 : 1;
      f.text.scale.set(pop);
    }
  }
}

/** A glow that follows the night: alpha = darkness. */
export class Glow {
  readonly sprite: Sprite;

  constructor(
    color: number,
    size: number,
    private readonly strength = 1,
  ) {
    this.sprite = new Sprite(glowTexture());
    this.sprite.anchor.set(0.5);
    this.sprite.tint = color;
    this.sprite.blendMode = "add";
    this.sprite.width = size;
    this.sprite.height = size;
    this.sprite.alpha = 0;
  }

  update(darkness: number, flicker = 0): void {
    this.sprite.alpha = clamp(darkness * this.strength + flicker, 0, 1);
  }
}

/** Rain streaks and drifting fog. */
export class Weather {
  readonly container = new Container();
  private readonly drops: Graphics[] = [];
  private readonly fogs: Sprite[] = [];
  private rain = 0;
  private fog = 0;
  private targetRain = 0;
  private targetFog = 0;

  constructor(
    private width: number,
    private height: number,
  ) {
    for (let i = 0; i < 160; i++) {
      const drop = new Graphics()
        .moveTo(0, 0)
        .lineTo(-2, 14)
        .stroke({ width: 1.2, color: 0xcfe8ff, alpha: 0.55 });
      drop.position.set(rand(-200, width + 200), rand(-100, height));
      drop.visible = false;
      this.drops.push(drop);
      this.container.addChild(drop);
    }
    const puff = puffTexture(128);
    for (let i = 0; i < 9; i++) {
      const fog = new Sprite(puff);
      fog.anchor.set(0.5);
      fog.tint = 0xd8e2ea;
      fog.alpha = 0;
      fog.scale.set(rand(3.5, 6), rand(1.2, 2));
      fog.position.set(rand(-200, width + 200), rand(height * 0.55, height * 0.8));
      this.fogs.push(fog);
      this.container.addChild(fog);
    }
  }

  /** The area to cover, in the container's own units. */
  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    for (const [i, fog] of this.fogs.entries()) {
      fog.position.set(
        -200 + ((i * 0.37) % 1) * (width + 400),
        height * (0.5 + 0.3 * ((i * 0.61) % 1)),
      );
    }
    for (const drop of this.drops) drop.position.set(rand(-200, width + 200), rand(-100, height));
  }

  set(weather: "clear" | "rain" | "fog"): void {
    this.targetRain = weather === "rain" ? 1 : 0;
    this.targetFog = weather === "fog" ? 1 : weather === "rain" ? 0.35 : 0;
  }

  update(dt: number, wind: number, darkness: number): void {
    this.rain = lerp(this.rain, this.targetRain, dt * 0.8);
    this.fog = lerp(this.fog, this.targetFog, dt * 0.5);
    const visible = Math.floor(this.drops.length * this.rain);
    for (const [i, drop] of this.drops.entries()) {
      drop.visible = i < visible;
      if (!drop.visible) continue;
      drop.y += 620 * dt;
      drop.x += (wind * 6 - 40) * dt;
      if (drop.y > this.height + 20) {
        drop.y = rand(-140, -20);
        drop.x = rand(-200, this.width + 200);
      }
    }
    for (const [i, fog] of this.fogs.entries()) {
      fog.alpha = this.fog * (0.16 + 0.08 * ((i * 7) % 3)) * (1 - darkness * 0.4);
      fog.x += (12 + wind * 2 + (i % 3) * 4) * dt;
      if (fog.x > this.width + 400) fog.x = -400;
    }
  }

  get rainAmount(): number {
    return this.rain;
  }
}
