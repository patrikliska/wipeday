/**
 * Owns the Pixi application and the camera, stacks the layers, and turns store state and events
 * into motion. Game state only ever changes through store actions; the scene reads it once per
 * frame (docs/redesign/09-architecture.md 10.3).
 *
 * The island: the sea on the left, the era's target on a rise in the middle, the lines around
 * it and the house behind, every hand at their line. Taps go through a DOM button held over the
 * target at a fixed screen size (D48, N27), so keyboards and screen readers reach it too; a
 * press held still for a moment counts 4 taps a second (hold to work). Animation runs on the
 * `wall` clock, never the game clock, so a demo jump moves no animation (rule 6.3.9).
 */
import { lineOf } from "@wipe-day/domain/lines";
import type { BaseState } from "@wipe-day/domain/state";
import { hustleFactor, tapParts } from "@wipe-day/domain/taps";
import { islandHour, weatherAt } from "@wipe-day/domain/weather";
import { Application, Container, Graphics } from "pixi.js";
import { countFrame, isFrozen, registerScene } from "../debug";
import { BUZZ, haptics, sound } from "../sound/audio";
import { wall } from "../state/clocks";
import { type GameEvent, on } from "../state/events";
import { gameSeconds, useWorld } from "../state/store";
import { heldTaps } from "../state/taps";
import { content, crewName, fmt, lineName, resourceColor, type Tier, t } from "../state/world";
import { Hands, type Post } from "./actors";
import { House } from "./base";
import { Floaters, Particles, Weather } from "./effects";
import { loadProductIcons } from "./icons";
import { LAYOUT, Lines } from "./lines";
import { gloom, paletteAt } from "./palette";
import { milestoneCrossed } from "./reveal";
import { Sky } from "./sky";
import { Target, type TargetKind } from "./target";
import { Terrain } from "./terrain";
import { clamp, lerp } from "./util";

/** Design space: a 16:9 stage, the ground line a little below centre. */
const W = 1600;
const H = 900;
const HORIZON = 520;
const GROUND = 560;
/** The waterline at the ground line sits 60 units left of this. */
const SHORE_X = 660;
/** Sky and ground continue this far past the stage so no screen shape shows an edge. */
const EXTEND = 800;
/** Narrow screens always see at least this many world units across (D75)... */
const MIN_VISIBLE_W = 880;
/** ...centred here: the sea on the left, every line, the rise in the middle. */
const FOCUS_X = 870;
/** The rise the target stands on. */
const RISE = { x: 870, top: GROUND - 58, half: 165 };
const HOUSE = { x: 1150, y: GROUND - 44, scale: 0.4 };
/** Phones: the ground line at this fraction of the height, the target's centre near 40%. */
const PHONE_GROUND = 0.52;
/** The tap box: the drawn target padded by this, never smaller than the minimum (CSS px). */
const HIT_PAD = 12;
const HIT_MIN = { width: 140, height: 160 };
/** A press that moves further than this is not a hold (CSS px). */
const HOLD_SLOP = 12;
/** The counter bumps at most this often when line floaters land (ms). */
const BUMP_EVERY_MS = 250;

function targetOf(era: Tier): TargetKind {
  return (content.targets.find((target) => target.era === era)?.id ?? "tree") as TargetKind;
}

const color = (hex: string): number => Number.parseInt(hex.slice(1), 16);

export class Scene {
  private readonly app = new Application();
  private readonly world = new Container();
  /** Multiplied over the world: white by day, blue at night. Screen space. */
  private readonly ambient = new Graphics();
  /** World-aligned layer above the ambient tint, for things that emit light. */
  private readonly lights = new Container();
  /** The island's things, sorted back to front: lines, the house, the target, the hands. */
  private readonly props = new Container();
  private readonly particles = new Particles();
  private readonly floaters = new Floaters((amount) => fmt(amount, "cost"));
  private readonly weather = new Weather(1200, 800);
  private readonly sky = new Sky(W, HORIZON, EXTEND);
  private readonly terrain = new Terrain({
    width: W,
    height: H,
    horizon: HORIZON,
    ground: GROUND,
    shoreX: SHORE_X,
    baseX: HOUSE.x,
    rise: RISE,
    extend: EXTEND,
  });
  private readonly target = new Target(this.particles);
  private readonly house = new House(this.particles);
  private readonly lines: Lines;
  private readonly hands: Hands;
  /** The tap area: a transparent button over the target, sized on screen. */
  private readonly button: HTMLButtonElement;
  /** Hold to work: a ring round the finger while a held press counts taps (screen space). */
  private readonly holdRing = new Graphics();
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
  private lastMs = wall.nowMs();
  /** The base the scene last followed, and its run number (a new run redraws at once). */
  private seen: BaseState | null = null;
  private era: Tier | null = null;
  private roster = 0;
  /** The tap box on screen (CSS px). */
  private box = { x: 0, y: 0, width: 0, height: 0 };
  private boxKey = "";
  /** A press on the target: where, since when (wall ms), and taps counted for it so far. */
  private held: {
    x: number;
    y: number;
    startX: number;
    startY: number;
    since: number;
    counted: number;
    still: boolean;
  } | null = null;
  private hustle = {
    base: null as BaseState | null,
    second: -1,
    hold: 2,
    drain: 10,
    cap: 100,
    peak: 2,
  };
  private lastBumpMs = 0;
  /** The store's demo patch count at the last frame. */
  private patches = 0;
  /** The game clock at the last frame. */
  private lastNow = 0;

  constructor(private readonly host: HTMLElement) {
    this.ambient.blendMode = "multiply";
    this.props.sortableChildren = true;
    this.lines = new Lines(this.props, GROUND, this.particles, {
      float: (line, x, y, amount) => this.lineFloater(line.product, x, y, amount),
    });
    this.hands = new Hands(this.props);
    this.target.container.position.set(RISE.x, RISE.top + 4);
    this.target.container.zIndex = GROUND;
    this.house.container.position.set(HOUSE.x, HOUSE.y);
    this.house.container.scale.set(HOUSE.scale);
    this.house.container.zIndex = HOUSE.y;
    this.props.addChild(this.house.container, this.target.container);
    this.world.addChild(
      this.sky.container,
      this.hands.sky,
      this.terrain.back,
      this.terrain.ground,
      this.props,
      this.particles.container,
      this.terrain.front,
    );
    this.lights.addChild(this.house.lights, this.lines.lights, this.target.light);
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "target-hit";
    this.button.addEventListener("pointerdown", this.onPress);
    this.button.addEventListener("keydown", this.onKeyDown);
    this.button.addEventListener("keyup", this.onKeyUp);
    this.button.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  async init(): Promise<void> {
    await this.app.init({
      resizeTo: this.host,
      autoDensity: true,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      backgroundAlpha: 0,
    });
    await loadProductIcons();
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.ready = true;
    this.host.appendChild(this.app.canvas);
    this.host.appendChild(this.button);
    this.app.stage.addChild(
      this.world,
      this.ambient,
      this.lights,
      this.weather.container,
      this.lines.overlay,
      this.target.overlay,
      this.holdRing,
      this.floaters.container,
    );
    this.unsubscribe = on((event) => this.handle(event));
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onRelease);
    window.addEventListener("pointercancel", this.onRelease);
    window.addEventListener("pointerdown", this.onAnyPress, { capture: true });
    registerScene({
      target: () => ({ ...this.box }),
      hitBoxes: () => [{ name: "target", ...this.box }],
      counts: () => ({ floaters: this.floaters.count, particles: this.particles.count }),
      fastForward: (seconds, tick) => this.fastForward(seconds, tick),
    });
    this.app.ticker.add(this.frame);
  }

  destroy(): void {
    this.destroyed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.button.remove();
    if (!this.ready) return;
    this.ready = false;
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onRelease);
    window.removeEventListener("pointercancel", this.onRelease);
    window.removeEventListener("pointerdown", this.onAnyPress, { capture: true });
    this.app.ticker.remove(this.frame);
    this.app.destroy(true, { children: true });
  }

  // --- input ---------------------------------------------------------------------------------

  /** The first touch anywhere starts the sound (iOS needs a gesture). */
  private readonly onAnyPress = (): void => {
    sound.unlock();
  };

  private local(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = this.host.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private readonly onPress = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    sound.unlock();
    const { x, y } = this.local(event);
    this.button.setPointerCapture?.(event.pointerId);
    this.held = { x, y, startX: x, startY: y, since: wall.nowMs(), counted: 0, still: true };
    this.tapAt(1, x, y);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") {
      this.parallaxTarget = (event.clientX / Math.max(1, this.viewW) - 0.5) * 2;
    }
    const held = this.held;
    if (!held) return;
    const { x, y } = this.local(event);
    held.x = x;
    held.y = y;
    if (Math.hypot(x - held.startX, y - held.startY) > HOLD_SLOP) held.still = false;
  };

  private readonly onRelease = (): void => {
    this.held = null;
  };

  /** Space or Enter taps; holding Space works like holding a finger on it. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (event.repeat) return;
    sound.unlock();
    const x = this.box.x + this.box.width / 2;
    const y = this.box.y + this.box.height / 2;
    this.tapAt(1, x, y);
    if (event.key === " ")
      this.held = { x, y, startX: x, startY: y, since: wall.nowMs(), counted: 0, still: true };
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === " ") this.held = null;
  };

  private tapAt(count: number, x: number, y: number): void {
    useWorld.getState().tap(count, x, y);
  }

  /** Hold to work: a press held still on the target counts 4 taps a second after a moment. */
  private holdTaps(): void {
    const held = this.held;
    if (!held?.still) return;
    const { holdAfterSeconds, holdTapsPerSecond } = content.tap;
    const due = heldTaps(wall.nowMs() - held.since, holdAfterSeconds * 1000, holdTapsPerSecond);
    if (due > held.counted) {
      this.tapAt(due - held.counted, held.x, held.y);
      held.counted = due;
    }
  }

  // --- camera --------------------------------------------------------------------------------

  /**
   * Phones keep at least MIN_VISIBLE_W across with the ground line at about half the height,
   * so the target stands at about 40% (N27); wide screens fill the height with more sky.
   */
  private layout(): void {
    const vw = this.app.screen.width;
    const vh = this.app.screen.height;
    if (vw === this.viewW && vh === this.viewH) return;
    this.viewW = vw;
    this.viewH = vh;
    this.scale = Math.min(vh / (H - 100), vw / MIN_VISIBLE_W);
    const visibleW = vw / this.scale;
    const visibleH = vh / this.scale;
    this.centerX = visibleW >= W ? W / 2 : clamp(FOCUS_X, visibleW / 2, W - visibleW / 2);
    const aspect = vw / vh;
    const groundFraction = aspect < 1 ? PHONE_GROUND : lerp(0.68, 0.74, clamp(aspect - 1, 0, 1));
    this.top = clamp(GROUND - groundFraction * visibleH, -EXTEND + 40, H + EXTEND - visibleH - 40);
    this.world.scale.set(this.scale);
    this.ambient.clear().rect(0, 0, vw, vh).fill(0xffffff);
    this.weather.resize(vw, vh);
  }

  /** The world point under a screen point (CSS px). */
  private toWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.world.position.x) / this.scale,
      y: (y - this.world.position.y) / this.scale,
    };
  }

  /** The tap box: the target's drawn bounds on screen, padded, never under the minimum. */
  private placeButton(): void {
    const b = this.target.bounds;
    const ox = this.world.position.x + this.target.container.x * this.scale;
    const oy = this.world.position.y + this.target.container.y * this.scale;
    const left = ox + b.x * this.scale - HIT_PAD;
    const top = oy + b.y * this.scale - HIT_PAD;
    const drawnW = b.width * this.scale + HIT_PAD * 2;
    const drawnH = b.height * this.scale + HIT_PAD * 2;
    const width = Math.max(HIT_MIN.width, drawnW);
    const height = Math.max(HIT_MIN.height, drawnH);
    const box = {
      x: Math.round(left - (width - drawnW) / 2),
      y: Math.round(top - (height - drawnH) / 2),
      width: Math.round(width),
      height: Math.round(height),
    };
    const key = `${box.x},${box.y},${box.width},${box.height}`;
    this.box = box;
    if (key === this.boxKey) return;
    this.boxKey = key;
    const style = this.button.style;
    style.left = `${box.x}px`;
    style.top = `${box.y}px`;
    style.width = `${box.width}px`;
    style.height = `${box.height}px`;
    // The tap hint sits just under the box.
    document.documentElement.style.setProperty("--target-bottom", `${box.y + box.height}px`);
  }

  // --- the frame -----------------------------------------------------------------------------

  private readonly frame = (): void => {
    countFrame();
    const nowMs = wall.nowMs();
    const dt = Math.min(0.05, Math.max(0, (nowMs - this.lastMs) / 1000));
    this.lastMs = nowMs;
    if (isFrozen()) return;
    this.time += dt;
    this.step(dt, nowMs);
  };

  /**
   * Shots: plays `seconds` in 60 fps steps now, and leaves the wall clock at the end. `tick`
   * moves the game clock along with each step (the demo's, paused for a shot).
   */
  private fastForward(seconds: number, tick?: (dt: number) => void): void {
    const from = wall.nowMs();
    const steps = Math.round(seconds * 60);
    for (let k = 1; k <= steps; k++) {
      tick?.(1 / 60);
      this.time += 1 / 60;
      this.step(1 / 60, from + (k * 1000) / 60);
    }
    wall.set((from + seconds * 1000) / 1000);
    this.lastMs = wall.nowMs();
  }

  private step(dt: number, nowMs: number): void {
    this.layout();
    this.holdTaps();
    const store = useWorld.getState();
    store.tick();
    const base = store.base;
    const now = gameSeconds();
    if (base) this.follow(base, store.patches, nowMs);

    const second = Math.floor(now);
    const fraction = islandHour(content, second) / 24;
    const sky = weatherAt(content, second);
    // A jump of the clock (a demo jump, a shot, a tab back after hours) shows its weather at once.
    this.weather.set(sky, Math.abs(now - this.lastNow) > 60);
    this.lastNow = now;
    const { rain, fog } = this.weather.amount;
    const palette = gloom(paletteAt(fraction), rain * 0.85 + fog * 0.6);
    const darkness = clamp(1 - palette.light, 0, 1);
    this.wind = 1 + Math.sin(this.time * 0.23) * 0.8 + rain * 1.5;
    this.parallax += (this.parallaxTarget - this.parallax) * Math.min(1, dt * 3);

    const visibleW = this.viewW / this.scale;
    const left = this.centerX - visibleW / 2;
    this.world.position.set(-left * this.scale - this.parallax * 6, -this.top * this.scale);
    this.floaters.setCamera(this.world.position.x, this.world.position.y, this.scale);
    this.lights.position.copyFrom(this.world.position);
    this.lights.scale.copyFrom(this.world.scale);

    this.sky.update(dt, fraction, palette, this.wind, 0);
    this.terrain.update(dt, palette, this.wind, this.parallax);
    this.house.update(dt, darkness);
    this.target.update(dt, this.wind, darkness, fog);
    this.hands.setNight(darkness > 0.6);
    this.hands.update(dt, this.wind);
    this.particles.update(dt, this.wind);
    this.weather.update(dt, this.wind, darkness);
    this.ambient.tint = palette.ambient;
    if (base) {
      this.lines.update(base, now, nowMs, dt, darkness);
      this.lines.syncLights();
      this.lines.place(base, this.world.position.x, this.world.position.y, this.scale);
      this.drawHustle(base, now);
    }
    this.placeButton();
    this.drawHoldRing(nowMs);
    this.floaters.update(nowMs);
  }

  /** Follows the run: era (target and house), hands, wear, milestones. */
  private follow(base: BaseState, patches: number, nowMs: number): void {
    const previous = this.seen;
    const fresh =
      !previous || previous.run.n !== base.run.n || previous.run.createdAt !== base.run.createdAt;
    this.seen = base;
    const era = base.run.era;
    if (era !== this.era) {
      const animate = !fresh && this.era !== null;
      this.target.set(targetOf(era), animate);
      this.house.setTier(era, animate);
      this.era = era;
      this.button.setAttribute(
        "aria-label",
        t("scene.tap_target", { target: t(`target.${targetOf(era)}.name`) }),
      );
      if (animate) haptics.buzz([...BUZZ.era]);
    }
    const fell = content.targets.find((target) => target.era === era)?.fellTaps ?? 40;
    this.target.setProgress(base.run.target.taps / fell);

    // Hands: one per manned line, at their line's work point.
    const posts = new Map<string, { hand: string; post: Post }>();
    for (const id of base.run.hands) {
      const line = lineOf(content, id);
      const point = this.lines.workPoint(id);
      const spot = LAYOUT[id];
      if (line && point && spot)
        posts.set(id, { hand: line.hand, post: { ...point, faceX: spot.x } });
    }
    const door = { x: HOUSE.x, y: HOUSE.y + 2, scale: HOUSE.scale, faceX: HOUSE.x };
    const walking = this.hands.sync(posts, door, !fresh);
    for (const id of walking) {
      const line = lineOf(content, id);
      if (!line) continue;
      this.floaters.add(
        "event",
        door.x,
        door.y - 70,
        t("scene.hired", { name: crewName(line.hand) }),
        nowMs,
        {
          size: this.floatSize(),
          color: 0xffffff,
        },
      );
    }

    // A demo patch rewrites the run: nothing it put there is celebrated.
    const patched = patches !== this.patches;
    this.patches = patches;
    if (!fresh && !patched && previous) {
      // Milestones crossed by purchases since the last frame; two at most at once.
      let shown = 0;
      for (const line of [...content.lines].reverse()) {
        const before = previous.run.lines[line.id] ?? 0;
        const after = base.run.lines[line.id] ?? 0;
        const milestone = milestoneCrossed(content, before, after);
        if (milestone && shown < 2) {
          shown += 1;
          const top = this.lines.topOf(line.id);
          const key = milestone.speed ? "scene.milestone_speed" : "scene.milestone";
          if (top) {
            this.floaters.add(
              "event",
              top.x,
              top.y - 10,
              t(key, { line: lineName(line.id), factor: milestone.factor }),
              nowMs,
              {
                size: this.floatSize(1.05),
                color: 0xffd25a,
              },
            );
          }
          sound.play("milestone");
          haptics.buzz([...BUZZ.milestone]);
        }
      }
      if (base.run.roster > this.roster) {
        const tier = content.milestones.roster[base.run.roster - 1];
        const point = this.target.floatPoint;
        if (tier) {
          this.floaters.add(
            "event",
            point.x,
            point.y - 40,
            t("scene.roster", { factor: tier.payout }),
            nowMs,
            {
              size: this.floatSize(1.1),
              color: 0xffd25a,
            },
          );
        }
        sound.play("milestone");
      }
    }
    this.roster = base.run.roster;
  }

  private drawHustle(base: BaseState, now: number): void {
    const second = Math.floor(now);
    const cache = this.hustle;
    if (cache.base !== base || cache.second !== second) {
      const parts = tapParts(content, base, second);
      cache.base = base;
      cache.second = second;
      cache.hold = parts.hold;
      cache.drain = parts.drain;
      cache.cap = parts.hustleCap;
      cache.peak = parts.hustlePeak;
    }
    const idle = Math.max(0, now - base.run.hustle.at - cache.hold);
    const h = Math.max(0, base.run.hustle.value - cache.drain * idle);
    const factor = hustleFactor(h, cache.cap, cache.peak);
    this.target.drawHustle(this.box, h / cache.cap, `×${Math.round(factor * 10) / 10}`);
  }

  /** The ring round a held finger: it closes as the hold starts, then pulses with each tap. */
  private drawHoldRing(nowMs: number): void {
    const ring = this.holdRing;
    ring.clear();
    const held = this.held;
    if (!held?.still) return;
    const after = content.tap.holdAfterSeconds * 1000;
    const elapsed = nowMs - held.since;
    if (elapsed < 120) return;
    const r = 30;
    ring.circle(held.x, held.y, r).stroke({ width: 3, color: 0x1b1a18, alpha: 0.35 });
    if (elapsed < after) {
      const fill = elapsed / after;
      ring
        .arc(held.x, held.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill)
        .stroke({ width: 3, color: 0xffffff, alpha: 0.9, cap: "round" });
      return;
    }
    const beat = ((elapsed - after) / (1000 / content.tap.holdTapsPerSecond)) % 1;
    ring
      .circle(held.x, held.y, r + beat * 6)
      .stroke({ width: 3, color: 0xffffff, alpha: 0.9 - beat * 0.5 });
  }

  /** Floating text size in CSS pixels: 22 on phones and laptops, up to 28 on big screens. */
  private floatSize(multiplier = 1): number {
    return Math.round(clamp(22 * this.scale, 22, 28) * multiplier);
  }

  /** A line's floater: its product's icon and the amount, flying into the counter. */
  private lineFloater(product: string, x: number, y: number, amount: number): void {
    const counter = document.querySelector(".topbar .counter .tile");
    const host = this.host.getBoundingClientRect();
    const rect = counter?.getBoundingClientRect();
    const fly = rect
      ? {
          x: rect.left + rect.width / 2 - host.left,
          y: rect.top + rect.height / 2 - host.top,
          arrive: () => this.bumpCounter(),
        }
      : undefined;
    this.floaters.add("line", x, y, `+${fmt(amount, "cost")}`, wall.nowMs(), {
      size: this.floatSize(0.82),
      icon: product,
      iconColor: color(resourceColor(product)),
      ...(fly ? { fly } : {}),
    });
  }

  /** The counter bumps (scale 1.04) when a line floater lands, at most four times a second. */
  private bumpCounter(): void {
    const nowMs = wall.nowMs();
    if (nowMs - this.lastBumpMs < BUMP_EVERY_MS) return;
    this.lastBumpMs = nowMs;
    const counter = document.querySelector<HTMLElement>(".topbar .counter");
    if (!counter) return;
    counter.classList.remove("bump");
    void counter.offsetWidth;
    counter.classList.add("bump");
  }

  private handle(event: GameEvent): void {
    const nowMs = wall.nowMs();
    switch (event.type) {
      case "tap_at": {
        const at = this.toWorld(event.x, event.y);
        this.target.hit(at.x, at.y);
        const point = this.target.floatPoint;
        if (event.gain > 0)
          this.floaters.tap(point.x, point.y, event.gain, nowMs, this.floatSize());
        const base = useWorld.getState().base;
        const fill = base ? clamp(base.run.hustle.value / content.tap.hustle.cap, 0, 1) : 0;
        sound.play("tap", { target: this.target.current ?? "tree", hustle: fill });
        break;
      }
      case "felled": {
        this.target.fell();
        const point = this.target.floatPoint;
        const cry = t(`target.${event.target}.cry`);
        this.floaters.add(
          "event",
          point.x,
          point.y - 34,
          `${cry} +${fmt(event.value, "cost")}`,
          nowMs,
          {
            size: this.floatSize(1.15),
            color: 0xffd25a,
          },
        );
        sound.play("fell", { target: event.target });
        haptics.buzz(BUZZ.fell);
        break;
      }
      case "bought": {
        sound.play("buy", { bulk: event.count > 1 });
        break;
      }
      case "upgraded": {
        sound.play("buy");
        break;
      }
      case "era_reached": {
        const point = this.target.floatPoint;
        const era = content.eras.find((row) => row.id === event.era);
        const factor = era?.effects.find((effect) => effect.stat === "output")?.value ?? 2;
        this.floaters.add(
          "event",
          point.x,
          point.y - 70,
          t("scene.era", { era: t(`base_tier.${event.era}.name`), factor }),
          nowMs,
          {
            size: this.floatSize(1.15),
            color: 0xffd25a,
          },
        );
        sound.play("milestone");
        break;
      }
      case "refused": {
        sound.play("refuse");
        break;
      }
      // Hires show as the hand walking out (`follow`); flotsam arrives with S4.
    }
  }
}
