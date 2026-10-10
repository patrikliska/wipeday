/**
 * Owns the Pixi application and the camera, stacks the layers, and turns store state and events
 * into motion. Game state only ever changes through store actions; the scene reads it once per
 * frame.
 *
 * R0 draws a bare island (sky, sea, the land, the day's light): its land is the run's tap surface
 * until R1 stands the era target on the rise. A tap, or each quarter second of a held press,
 * goes to the store's taps tail; the gain rises from the finger. Animation runs on the `wall`
 * clock, never the game clock, so a demo jump moves no animation (rule 6.3.9).
 */
import { Application, Container, Graphics } from "pixi.js";
import { countFrame, isFrozen } from "../debug";
import { wall } from "../state/clocks";
import { type GameEvent, on } from "../state/events";
import { gameSeconds, localSeconds, useWorld } from "../state/store";
import { heldTaps } from "../state/taps";
import { content, dayFraction, fmt } from "../state/world";
import { Floaters, Particles, Weather } from "./effects";
import { gloom, paletteAt } from "./palette";
import { Sky } from "./sky";
import { Terrain } from "./terrain";
import { clamp, lerp } from "./util";

/** Design space: a 16:9 stage, the ground line a little below centre. */
const W = 1600;
const H = 900;
const HORIZON = 520;
const GROUND = 560;
const SHORE_X = 540;
const BASE_X = 1000;
/** Sky and ground continue this far past the stage so no screen shape shows an edge. */
const EXTEND = 800;
/** Narrow screens always see at least this many world units across... */
const MIN_VISIBLE_W = 880;
/** ...centred here, so the land and the shore both fit on a phone. */
const FOCUS_X = 915;
/** Rapid taps share one rising number: at most one new floater this often (ms). */
const FLOAT_EVERY_MS = 140;

export class Scene {
  private readonly app = new Application();
  private readonly world = new Container();
  /** Multiplied over the world: white by day, blue at night. Screen space. */
  private readonly ambient = new Graphics();
  /** World-aligned layer above the ambient tint, for things that emit light. */
  private readonly lights = new Container();
  private readonly particles = new Particles();
  private readonly floaters = new Floaters();
  private readonly weather = new Weather(1200, 800);
  private readonly sky = new Sky(W, HORIZON, EXTEND);
  private readonly terrain = new Terrain({
    width: W,
    height: H,
    horizon: HORIZON,
    ground: GROUND,
    shoreX: SHORE_X,
    baseX: BASE_X,
    extend: EXTEND,
  });
  private unsubscribe: (() => void) | null = null;
  private destroyed = false;
  private ready = false;
  private viewW = 0;
  private viewH = 0;
  private scale = 1;
  private centerX = W / 2;
  private top = 0;
  private time = 0;
  private wind = 1;
  private parallax = 0;
  private parallaxTarget = 0;
  /** The wall clock at the last frame (ms). */
  private lastMs = wall.nowMs();
  /** A press held on the land: where, since when (wall ms), and taps counted for it so far. */
  private held: { x: number; y: number; since: number; counted: number } | null = null;
  /** Gains not yet shown, and where and when the last floater rose. */
  private pending = { gain: 0, x: 0, y: 0, at: 0 };

  constructor(private readonly host: HTMLElement) {
    this.ambient.blendMode = "multiply";
    this.world.addChild(
      this.sky.container,
      this.terrain.back,
      this.terrain.ground,
      this.particles.container,
      this.terrain.front,
    );
  }

  async init(): Promise<void> {
    await this.app.init({
      resizeTo: this.host,
      autoDensity: true,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      backgroundAlpha: 0,
    });
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.ready = true;
    this.host.appendChild(this.app.canvas);
    this.app.stage.addChild(
      this.world,
      this.ambient,
      this.lights,
      this.floaters.container,
      this.weather.container,
    );
    this.unsubscribe = on((event) => this.handle(event));
    const canvas = this.app.canvas;
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    this.app.ticker.add(this.frame);
  }

  destroy(): void {
    this.destroyed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (!this.ready) return;
    this.ready = false;
    const canvas = this.app.canvas;
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.app.ticker.remove(this.frame);
    this.app.destroy(true, { children: true });
  }

  /** The world point under a screen point (CSS px). */
  private toWorld(x: number, y: number): { x: number; y: number } {
    const visibleW = this.viewW / this.scale;
    const left = this.centerX - visibleW / 2;
    return { x: (x + this.parallax * 6) / this.scale + left, y: y / this.scale + this.top };
  }

  /** The land: on or below the ground line, east of the surf. */
  private onLand(x: number, y: number): boolean {
    const point = this.toWorld(x, y);
    return point.y >= GROUND - 24 && point.x >= SHORE_X - 40;
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") {
      this.parallaxTarget = (event.clientX / Math.max(1, this.viewW) - 0.5) * 2;
    }
    if (this.held) {
      this.held.x = event.offsetX;
      this.held.y = event.offsetY;
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const { offsetX: x, offsetY: y } = event;
    if (!this.onLand(x, y)) return;
    this.held = { x, y, since: wall.nowMs(), counted: 0 };
    useWorld.getState().tap(1, x, y);
  };

  private readonly onPointerUp = (): void => {
    this.held = null;
  };

  /** Hold to work: a press held on the land counts 4 taps a second after a moment. */
  private holdTaps(): void {
    const held = this.held;
    if (!held) return;
    const { holdAfterSeconds, holdTapsPerSecond } = content.tap;
    const due = heldTaps(wall.nowMs() - held.since, holdAfterSeconds * 1000, holdTapsPerSecond);
    if (due > held.counted) {
      useWorld.getState().tap(due - held.counted, held.x, held.y);
      held.counted = due;
    }
  }

  /** Camera: cover the viewport, keep at least MIN_VISIBLE_W across, horizon in the upper half on tall screens. */
  private layout(): void {
    const vw = this.app.screen.width;
    const vh = this.app.screen.height;
    if (vw === this.viewW && vh === this.viewH) return;
    this.viewW = vw;
    this.viewH = vh;
    // Desktop: fill the height with a little zoom; phones: never narrower than MIN_VISIBLE_W.
    this.scale = Math.min(vh / (H - 100), vw / MIN_VISIBLE_W);
    const visibleW = vw / this.scale;
    const visibleH = vh / this.scale;
    this.centerX = visibleW >= W ? W / 2 : clamp(FOCUS_X, visibleW / 2, W - visibleW / 2);
    // The ground line sits lower on wide screens (more sky) and near the middle on tall ones.
    const wideness = clamp(vw / vh - 0.6, 0, 1);
    const groundFraction = lerp(0.66, 0.72, wideness);
    this.top = clamp(GROUND - groundFraction * visibleH, -EXTEND + 40, H + EXTEND - visibleH - 40);
    this.world.scale.set(this.scale);
    this.ambient.clear().rect(0, 0, vw, vh).fill(0xffffff);
    this.weather.resize(vw, vh);
  }

  private readonly frame = (): void => {
    countFrame();
    const nowMs = wall.nowMs();
    const dt = Math.min(0.05, Math.max(0, (nowMs - this.lastMs) / 1000));
    this.lastMs = nowMs;
    if (isFrozen()) return;
    this.time += dt;
    this.step(dt);
  };

  private step(dt: number): void {
    this.layout();
    this.holdTaps();
    useWorld.getState().tick();
    this.showPending(false);
    const fraction = dayFraction(localSeconds(gameSeconds()));
    const palette = gloom(paletteAt(fraction), 0);
    const darkness = clamp(1 - palette.light, 0, 1);
    this.wind = 1 + Math.sin(this.time * 0.23) * 0.8;
    this.parallax += (this.parallaxTarget - this.parallax) * Math.min(1, dt * 3);

    const visibleW = this.viewW / this.scale;
    const left = this.centerX - visibleW / 2;
    this.world.position.set(-left * this.scale - this.parallax * 6, -this.top * this.scale);
    this.floaters.setCamera(this.world.position.x, this.world.position.y, this.scale);
    this.lights.position.copyFrom(this.world.position);
    this.lights.scale.copyFrom(this.world.scale);

    this.sky.update(dt, fraction, palette, this.wind, 0);
    this.terrain.update(dt, palette, this.wind, this.parallax);
    this.particles.update(dt, this.wind);
    this.floaters.update(dt);
    this.weather.update(dt, this.wind, darkness);
    this.ambient.tint = palette.ambient;
  }

  /** Floating text size in CSS pixels: 22 on phones and laptops, up to 28 on big screens. */
  private floatSize(multiplier = 1): number {
    return Math.round(clamp(22 * this.scale, 22, 28) * multiplier);
  }

  /** Rises the gains gathered since the last floater, at most one every FLOAT_EVERY_MS. */
  private showPending(force: boolean): void {
    const pending = this.pending;
    if (pending.gain <= 0) return;
    const nowMs = wall.nowMs();
    if (!force && nowMs - pending.at < FLOAT_EVERY_MS) return;
    const at = this.toWorld(pending.x, pending.y);
    this.floaters.add(
      at.x,
      at.y - 18 / this.scale,
      `+${fmt(pending.gain, "cost")}`,
      0xffffff,
      this.floatSize(),
    );
    this.particles.spawn("dust", at.x, at.y, 4, 0xc9b78a);
    pending.gain = 0;
    pending.at = nowMs;
  }

  private handle(event: GameEvent): void {
    if (event.type !== "tap_at") return;
    const first = this.pending.gain === 0 && wall.nowMs() - this.pending.at >= FLOAT_EVERY_MS;
    this.pending.gain += event.gain;
    this.pending.x = event.x;
    this.pending.y = event.y;
    if (first) this.showPending(true);
  }
}
