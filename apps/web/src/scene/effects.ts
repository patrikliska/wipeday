/**
 * Particles, floating numbers, rain and fog, glows: everything that is motion rather than a
 * thing. Both particles and floaters are pooled (docs/redesign/08-screens.md 4.2-4.3): nothing
 * is allocated in the frame loop once the pools are warm.
 */
import { BitmapFont, BitmapText, Container, Graphics, Sprite, type Texture } from "pixi.js";
import { productTexture } from "./icons";
import { glowTexture, puffTexture, shapeTexture } from "./textures";
import { clamp, easeOutBack, easeOutCubic, lerp, rand, reducedMotion } from "./util";

// --- particles ---------------------------------------------------------------------------

export type Emit = "smoke" | "sparks" | "leaves" | "dust" | "splash" | "coins" | "stone" | "flakes";

interface Particle {
  sprite: Sprite;
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

/** At most this many live; the pool holds a few more so a burst at the cap never allocates. */
const PARTICLE_CAP = 160;
const PARTICLE_POOL = 200;

interface Kind {
  texture: () => Texture;
  /** Base size in world units (the texture is scaled to it). */
  size: [number, number];
  vx: [number, number];
  vy: [number, number];
  gravity: number;
  drag: number;
  life: [number, number];
  grow: number;
  spin: number;
  alpha: number;
  color: number;
}

const KINDS: Record<Emit, Kind> = {
  smoke: {
    texture: () => puffTexture(64),
    size: [14, 18],
    vx: [-6, 6],
    vy: [-34, -22],
    gravity: -4,
    drag: 0.98,
    life: [2.6, 3.8],
    grow: 1.1,
    spin: 0,
    alpha: 0.35,
    color: 0x9a9a9a,
  },
  sparks: {
    texture: () => shapeTexture("dot"),
    size: [2.4, 4.8],
    vx: [-40, 40],
    vy: [-90, -40],
    gravity: 120,
    drag: 0.985,
    life: [0.5, 1],
    grow: 0,
    spin: 0,
    alpha: 1,
    color: 0xffb347,
  },
  leaves: {
    texture: () => shapeTexture("leaf"),
    size: [6, 10],
    vx: [-50, 50],
    vy: [-70, -20],
    gravity: 90,
    drag: 0.97,
    life: [0.8, 1.4],
    grow: 0,
    spin: 6,
    alpha: 1,
    color: 0x5c9b4a,
  },
  stone: {
    texture: () => shapeTexture("chip"),
    size: [3, 5],
    vx: [-60, 60],
    vy: [-110, -40],
    gravity: 260,
    drag: 0.98,
    life: [0.5, 0.9],
    grow: 0,
    spin: 8,
    alpha: 1,
    color: 0x9aa0a6,
  },
  dust: {
    texture: () => puffTexture(64),
    size: [16, 22],
    vx: [-60, 60],
    vy: [-30, -8],
    gravity: -6,
    drag: 0.94,
    life: [0.9, 1.5],
    grow: 1.6,
    spin: 0,
    alpha: 0.5,
    color: 0xb9a98a,
  },
  splash: {
    texture: () => shapeTexture("dot"),
    size: [3, 6],
    vx: [-70, 70],
    vy: [-140, -60],
    gravity: 300,
    drag: 0.99,
    life: [0.5, 0.9],
    grow: 0,
    spin: 0,
    alpha: 0.9,
    color: 0xcfe8f3,
  },
  coins: {
    texture: () => shapeTexture("coin"),
    size: [6, 7],
    vx: [-50, 50],
    vy: [-160, -90],
    gravity: 320,
    drag: 0.99,
    life: [0.7, 1.1],
    grow: 0,
    spin: 10,
    alpha: 1,
    color: 0xe3c04f,
  },
  flakes: {
    texture: () => shapeTexture("chip"),
    size: [4, 7],
    vx: [-70, 70],
    vy: [-150, -60],
    gravity: 280,
    drag: 0.98,
    life: [0.6, 1.1],
    grow: 0,
    spin: 12,
    alpha: 1,
    color: 0xa8603a,
  },
};

export class Particles {
  readonly container = new Container();
  private readonly live: Particle[] = [];
  private readonly free: Sprite[] = [];

  constructor() {
    for (let i = 0; i < PARTICLE_POOL; i++) {
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.container.addChild(sprite);
      this.free.push(sprite);
    }
  }

  get count(): number {
    return this.live.length;
  }

  /** A burst of `count`; near the cap it shrinks to half, at the cap it is dropped. */
  spawn(kind: Emit, x: number, y: number, count = 8, color?: number): void {
    let n = reducedMotion() ? Math.ceil(count / 4) : count;
    if (this.live.length + n > PARTICLE_CAP) n = Math.ceil(n / 2);
    for (let i = 0; i < n && this.live.length < PARTICLE_CAP; i++) this.one(kind, x, y, color);
  }

  private one(kind: Emit, x: number, y: number, color?: number): void {
    const sprite = this.free.pop();
    if (!sprite) return;
    const k = KINDS[kind];
    sprite.texture = k.texture();
    const size = rand(k.size[0], k.size[1]);
    const scale = size / Math.max(1, sprite.texture.width);
    sprite.scale.set(scale);
    sprite.tint = color ?? k.color;
    sprite.alpha = k.alpha;
    sprite.rotation = rand(0, Math.PI * 2) * (k.spin ? 1 : 0);
    sprite.position.set(x, y);
    sprite.visible = true;
    this.live.push({
      sprite,
      vx: rand(k.vx[0], k.vx[1]),
      vy: rand(k.vy[0], k.vy[1]),
      gravity: k.gravity,
      drag: k.drag,
      life: rand(k.life[0], k.life[1]),
      age: 0,
      grow: k.grow * scale,
      spin: k.spin ? rand(-k.spin, k.spin) : 0,
      startAlpha: k.alpha,
      startScale: scale,
    });
  }

  update(dt: number, wind: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      if (!p) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.sprite.visible = false;
        this.free.push(p.sprite);
        this.live[i] = this.live[this.live.length - 1] as Particle;
        this.live.pop();
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

// --- floaters ----------------------------------------------------------------------------

const FONT = "wipeday-floater";
/** The font is rasterised at twice the largest floater (28 px), with the ink stroke baked in. */
const FONT_SIZE = 56;
const INK = 0x1b1a18;
const FLOATER_CAP = 12;
const FLOATER_POOL = 16;
/** A tap within this of the last one grows the running number instead of starting a new one. */
const MERGE_MS = 250;
/** The running number holds this long after the last tap, then rises and fades. */
const HOLD_MS = 500;
const FADE_MS = 600;
const RISE_PX = 40;
const FLY_MS = 700;

/** Who wins a slot when the pool is full: higher first. */
export type FloatKind = "line" | "tap" | "flotsam" | "event";
const PRIORITY: Record<FloatKind, number> = { line: 0, tap: 1, flotsam: 2, event: 3 };

interface Float {
  kind: FloatKind;
  container: Container;
  text: BitmapText;
  badge: Graphics;
  icon: Sprite;
  /** World point it rises from (followed every frame, so camera moves carry it). */
  x: number;
  y: number;
  dx: number;
  /** Wall ms: born, last grown (taps), and when its fade starts. */
  born: number;
  touched: number;
  fadeAt: number;
  /** Flying to the counter: screen point to reach, and what to do on arrival. */
  fly: { x: number; y: number; arrive: () => void } | null;
  from: { x: number; y: number };
  amount: number;
  size: number;
  live: boolean;
}

export interface FloatOptions {
  color?: number;
  /** CSS px. */
  size?: number;
  /** A product id: its icon rides on a dark badge left of the number. */
  icon?: string;
  iconColor?: number;
  /** Fly to this screen point (the counter) instead of rising, then call `arrive`. */
  fly?: { x: number; y: number; arrive: () => void };
  /** How long an event stays before it fades (ms); a sentence needs longer than a number. */
  holdMs?: number;
}

let fontInstalled = false;

function installFont(): void {
  if (fontInstalled) return;
  fontInstalled = true;
  BitmapFont.install({
    name: FONT,
    chars: [[" ", "~"], "×"],
    resolution: 1,
    padding: 6,
    style: {
      fontFamily: "Roboto Condensed",
      fontWeight: "700",
      fontSize: FONT_SIZE,
      fill: 0xffffff,
      stroke: { color: INK, width: Math.round(FONT_SIZE * 0.2), join: "round" },
    },
  });
}

/**
 * "+214" rising from where it came from (rule 6.3.7). Floaters live in screen space (D46): the
 * scene hands over the world's transform each frame and the text is placed on whole pixels at
 * its CSS size, never stretched by the camera zoom.
 */
export class Floaters {
  readonly container = new Container();
  private readonly pool: Float[] = [];
  private cameraX = 0;
  private cameraY = 0;
  private cameraScale = 1;
  /** The screen's width (CSS px): a floater never runs off either side. */
  private viewWidth = 0;
  /** The running tap number, while taps keep merging into it. */
  private running: Float | null = null;

  constructor(private readonly format: (amount: number) => string) {
    installFont();
    for (let i = 0; i < FLOATER_POOL; i++) {
      const container = new Container();
      const badge = new Graphics();
      const icon = new Sprite();
      icon.anchor.set(0.5);
      const text = new BitmapText({ text: "", style: { fontFamily: FONT, fontSize: 22 } });
      text.anchor.set(0, 0.5);
      container.addChild(badge, icon, text);
      container.visible = false;
      this.container.addChild(container);
      this.pool.push({
        kind: "tap",
        container,
        text,
        badge,
        icon,
        x: 0,
        y: 0,
        dx: 0,
        born: 0,
        touched: 0,
        fadeAt: 0,
        fly: null,
        from: { x: 0, y: 0 },
        amount: 0,
        size: 22,
        live: false,
      });
    }
  }

  get count(): number {
    let n = 0;
    for (const float of this.pool) if (float.live) n += 1;
    return n;
  }

  /** The world's screen transform; the scene sets it every frame. */
  setCamera(x: number, y: number, scale: number, viewWidth = 0): void {
    this.cameraX = x;
    this.cameraY = y;
    this.cameraScale = scale;
    this.viewWidth = viewWidth;
  }

  /** `x` moved so the row (centred on it) keeps 8 px from both edges of the screen. */
  private inside(float: Float, x: number): number {
    if (this.viewWidth <= 0) return x;
    const half = float.container.pivot.x * float.container.scale.x;
    const edge = 8 + half;
    if (this.viewWidth < edge * 2) return this.viewWidth / 2;
    return clamp(x, edge, this.viewWidth - edge);
  }

  /** A tap's gain at world (x, y): merges into the running number while taps keep coming. */
  tap(x: number, y: number, gain: number, nowMs: number, size: number): void {
    const running = this.running;
    if (running?.live && running.kind === "tap" && nowMs - running.touched < MERGE_MS) {
      running.amount += gain;
      running.touched = nowMs;
      running.fadeAt = nowMs + HOLD_MS;
      this.setText(running, `+${this.format(running.amount)}`);
      return;
    }
    const float = this.add("tap", x, y, `+${this.format(gain)}`, nowMs, { size });
    if (!float) return;
    float.amount = gain;
    float.fadeAt = nowMs + HOLD_MS;
    this.running = float;
  }

  /** One floater; returns it, or null when the pool is full of more important ones. */
  add(
    kind: FloatKind,
    x: number,
    y: number,
    label: string,
    nowMs: number,
    options: FloatOptions = {},
  ): Float | null {
    const float = this.slot(kind);
    if (!float) return null;
    if (this.running === float) this.running = null;
    const size = options.size ?? 22;
    float.kind = kind;
    float.x = x;
    float.y = y;
    float.dx = kind === "tap" ? 0 : Math.round(rand(-6, 6));
    float.born = nowMs;
    float.touched = nowMs;
    float.fadeAt = nowMs + (options.holdMs ?? (kind === "event" ? 1100 : 700));
    float.fly = options.fly ?? null;
    float.amount = 0;
    float.size = size;
    float.live = true;
    float.text.style.fontSize = size;
    float.text.tint = options.color ?? 0xffffff;
    const iconSize = Math.round(size * 0.95);
    const texture = options.icon ? productTexture(options.icon) : null;
    float.badge.clear();
    if (options.icon) {
      const r = iconSize * 0.62;
      float.badge
        .circle(r, 0, r)
        .fill({ color: INK, alpha: 0.82 })
        .circle(r, 0, r)
        .stroke({ width: 1.5, color: options.iconColor ?? 0xffffff, alpha: 0.6 });
      if (texture) {
        float.icon.texture = texture;
        float.icon.visible = true;
        float.icon.tint = options.iconColor ?? 0xffffff;
        float.icon.width = iconSize * 0.9;
        float.icon.height = iconSize * 0.9;
        float.icon.position.set(r, 0);
      } else {
        float.icon.visible = false;
        float.badge.circle(r, 0, r * 0.45).fill(options.iconColor ?? 0xffffff);
      }
      float.text.position.set(r * 2 + 3, 0);
    } else {
      float.icon.visible = false;
      float.text.position.set(0, 0);
    }
    this.setText(float, label);
    float.from = this.screenOf(float);
    float.container.visible = true;
    float.container.alpha = 1;
    this.place(float, nowMs);
    return float;
  }

  /** A free slot, or the oldest of the lowest priority at or under `kind`'s (fast-forwarded). */
  private slot(kind: FloatKind): Float | null {
    let live = 0;
    let free: Float | null = null;
    let victim: Float | null = null;
    for (const float of this.pool) {
      if (!float.live) {
        free ??= float;
        continue;
      }
      live += 1;
      if (PRIORITY[float.kind] > PRIORITY[kind]) continue;
      if (
        !victim ||
        PRIORITY[float.kind] < PRIORITY[victim.kind] ||
        (PRIORITY[float.kind] === PRIORITY[victim.kind] && float.born < victim.born)
      ) {
        victim = float;
      }
    }
    if (free && live < FLOATER_CAP) return free;
    if (!victim) return null;
    // The old one makes room: it ends now (its fly lands at once), the new one takes its place.
    victim.fly?.arrive();
    this.retire(victim);
    return victim;
  }

  private retire(float: Float): void {
    float.live = false;
    float.fly = null;
    float.container.visible = false;
    if (this.running === float) this.running = null;
  }

  private setText(float: Float, label: string): void {
    float.text.text = label;
    // Centre the whole row (badge and number) on its point.
    const width = float.text.x + float.text.width;
    float.container.pivot.x = Math.round(width / 2);
  }

  private screenOf(float: Float): { x: number; y: number } {
    return {
      x: this.cameraX + float.x * this.cameraScale + float.dx,
      y: this.cameraY + float.y * this.cameraScale,
    };
  }

  update(nowMs: number): void {
    for (const float of this.pool) {
      if (!float.live) continue;
      if (float.fly) {
        const t = clamp((nowMs - float.born) / FLY_MS, 0, 1);
        if (t >= 1) {
          float.fly.arrive();
          this.retire(float);
          continue;
        }
        this.place(float, nowMs);
        continue;
      }
      const end = float.fadeAt + FADE_MS;
      if (nowMs >= end) {
        this.retire(float);
        continue;
      }
      this.place(float, nowMs);
    }
  }

  private place(float: Float, nowMs: number): void {
    const reduced = reducedMotion();
    const container = float.container;
    if (float.fly) {
      // Ease in toward the counter: slow off the building, fast into the number.
      const t = clamp((nowMs - float.born) / FLY_MS, 0, 1);
      const start = this.screenOf(float);
      const k = t * t;
      container.position.set(
        Math.round(lerp(start.x, float.fly.x, k)),
        Math.round(lerp(start.y - 10, float.fly.y, k) - Math.sin(t * Math.PI) * 30),
      );
      container.scale.set(lerp(1, 0.7, k));
      container.alpha = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;
      return;
    }
    const at = this.screenOf(float);
    const fading = clamp((nowMs - float.fadeAt) / FADE_MS, 0, 1);
    const age = nowMs - float.born;
    // A tap's number stays put while it grows; events rise from the start.
    const rise =
      float.kind === "tap"
        ? RISE_PX * easeOutCubic(fading)
        : RISE_PX * 1.6 * easeOutCubic(clamp(age / (float.fadeAt + FADE_MS - float.born), 0, 1));
    const sinceTouch = nowMs - float.touched;
    const pop =
      reduced || sinceTouch > 120
        ? 1
        : lerp(1.12, 1, sinceTouch / 120) * (age < 120 ? easeOutBack(age / 120) : 1);
    container.scale.set(pop);
    container.position.set(
      Math.round(this.inside(float, at.x)),
      Math.round(at.y - (reduced ? 0 : rise)),
    );
    container.alpha = 1 - fading;
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

/** Rain streaks and drifting fog, in screen space. */
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
        height * (0.25 + 0.3 * ((i * 0.61) % 1)),
      );
    }
    for (const drop of this.drops) drop.position.set(rand(-200, width + 200), rand(-100, height));
  }

  set(weather: "clear" | "rain" | "fog", instant = false): void {
    this.targetRain = weather === "rain" ? 1 : 0;
    this.targetFog = weather === "fog" ? 1 : weather === "rain" ? 0.35 : 0;
    if (instant) {
      this.rain = this.targetRain;
      this.fog = this.targetFog;
    }
  }

  update(dt: number, wind: number, darkness: number): void {
    this.rain = lerp(this.rain, this.targetRain, Math.min(1, dt * 0.8));
    this.fog = lerp(this.fog, this.targetFog, Math.min(1, dt * 0.5));
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
      fog.alpha = this.fog * (0.22 + 0.1 * ((i * 7) % 3)) * (1 - darkness * 0.4);
      fog.x += (12 + wind * 2 + (i % 3) * 4) * dt;
      if (fog.x > this.width + 400) fog.x = -400;
    }
  }

  /** How much rain and fog are showing now, 0..1 each: the palette greys by it. */
  get amount(): { rain: number; fog: number } {
    return { rain: this.rain, fog: this.fog };
  }
}
