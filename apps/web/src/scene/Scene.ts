/**
 * Owns the Pixi application and the camera, stacks the layers, and turns store state and events
 * into motion. Game state only ever changes through store actions; the scene reads it once per
 * frame (docs/redesign/09-architecture.md 10.3).
 *
 * The island (D203): a pixel-art side view on one grid (D188), the sea on the left, the era's
 * target on the beach in the middle, the Twig lines beside it and each later era's lines on the
 * terrace above, the house at the end of the first terrace, every hand at their line. The camera
 * keeps a whole number of device pixels per art pixel. Taps go through a DOM button held over the
 * target at a fixed screen size (D48, N27), so keyboards and screen readers reach it too; a
 * press held still for a moment counts 4 taps a second (hold to work). Flotsam drifts in on
 * the waterline and is caught through a button of its own (`flotsam.ts`). Animation runs on the
 * `wall` clock, never the game clock, so a demo jump moves no animation (rule 6.3.9).
 */
import { crateMinutes } from "@wipe-day/domain/flotsam";
import { lineOf } from "@wipe-day/domain/lines";
import type { BaseState } from "@wipe-day/domain/state";
import { hustleFactor, tapParts } from "@wipe-day/domain/taps";
import { islandHour, weatherAt } from "@wipe-day/domain/weather";
import { Application, Container, Graphics } from "pixi.js";
import { countFrame, isFrozen, registerScene } from "../debug";
import { BUZZ, haptics, sound } from "../sound/audio";
import { useAdvisor } from "../state/advisor";
import { wall } from "../state/clocks";
import { type GameEvent, on } from "../state/events";
import { insets } from "../state/layout";
import { gameSeconds, useWorld } from "../state/store";
import { heldTaps } from "../state/taps";
import { closeAll, useUi } from "../state/ui";
import {
  buffName,
  content,
  crewName,
  duration,
  fmt,
  fmtFactor,
  lineName,
  resourceColor,
  type Tier,
  t,
} from "../state/world";
import { Hands, type Post } from "./actors";
import { House } from "./base";
import { Floaters, Particles, Weather } from "./effects";
import { Flotsam } from "./flotsam";
import { loadProductIcons } from "./icons";
import { HOUSE_SPOT, INSIDE, ROOM, stageSpot, TARGET_SPOT, VIEW } from "./island";
import { Landscape } from "./landscape";
import { LAYOUT, Lines, ROOM_LAYOUT } from "./lines";
import { gloom, paletteAt } from "./palette";
import { ART, loadArt } from "./pixel";
import { milestoneCrossed } from "./reveal";
import { Room } from "./room";
import { Sky } from "./sky";
import { Target, type TargetKind } from "./target";
import { clamp, lerp } from "./util";

/** Design space: a 16:9 stage, the ground line a little below centre. */
const W = 1600;
const H = 900;
const HORIZON = 520;
const GROUND = 560;
/** Sky and ground continue this far past the stage so no screen shape shows an edge. */
const EXTEND = 800;
/** Every screen shows at least the island (`VIEW`, art px), centred on it. */
const VIEW_W = (VIEW.right - VIEW.left) * ART;
const VIEW_H = (VIEW.bottom - VIEW.top) * ART;
const FOCUS_X = ((VIEW.left + VIEW.right) / 2) * ART;
/** Art px of sea a wide screen keeps left of the island (flotsam floats in it). */
const SEA_STRIP = 30;
/** The most CSS px per art pixel: big screens show more sky and sea, not bigger pixels. */
const MAX_ZOOM = 7;
const TARGET = { x: stageSpot(TARGET_SPOT).x, y: GROUND + stageSpot(TARGET_SPOT).y };
const HOUSE = { x: stageSpot(HOUSE_SPOT).x, y: GROUND + stageSpot(HOUSE_SPOT).y, scale: 1 };
/** Phones: the ground line at this fraction of the height. */
const PHONE_GROUND = 0.53;
/** The tap box: the drawn target padded by this, never smaller than the minimum (CSS px). */
const HIT_PAD = 12;
const HIT_MIN = { width: 140, height: 160 };
/** A press that moves further than this is not a hold (CSS px). */
const HOLD_SLOP = 12;
/** The counter bumps at most this often when line floaters land (ms). */
const BUMP_EVERY_MS = 250;

/** The house's hint ("Tap the cabin to go inside") retires after this many openings. */
const HOUSE_HINT_OPENS = 2;

function readHint(): string | null {
  try {
    return window.localStorage.getItem("wipeday.hint.house");
  } catch {
    return null;
  }
}

function writeHint(value: string): void {
  try {
    window.localStorage.setItem("wipeday.hint.house", value);
  } catch {
    // Private mode: the hint shows again next time.
  }
}

/** Whether the run's era has reached `era`. */
function eraReached(base: BaseState, era: Tier): boolean {
  const order = content.eras.map((row) => row.id);
  return order.indexOf(era) <= order.indexOf(base.run.era);
}

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
  private readonly terrain = new Landscape({ width: W, height: H, extend: EXTEND });
  private readonly target = new Target(this.particles);
  private readonly flotsam = new Flotsam({
    claim: (run, k) => useWorld.getState().send({ type: "claim_flotsam", run, k }),
    arrived: () => sound.play("flotsam_in"),
    sank: (x, y, firstRun, nowMs) => this.sank(x, y, firstRun, nowMs),
  });
  private readonly house = new House(this.particles);
  private readonly lines: Lines;
  private readonly hands: Hands;
  /** The house's room (D206): the crafting lines and their hands, shown when it is open. */
  private readonly room = new Room();
  private readonly roomLines: Lines;
  private readonly roomHands: Hands;
  /** Dims the island while the room is open; a tap on it closes the room. Screen space. */
  private readonly dim = new Graphics();
  /** The house is a button too: it opens the room once any crafting line's era has opened. */
  private readonly houseButton: HTMLButtonElement;
  private readonly houseHint: HTMLDivElement;
  private roomOpen = false;
  private houseKey = "";
  /** The tap area: a transparent button over the target, sized on screen. */
  private readonly button: HTMLButtonElement;
  /** Hold to work: a ring round the finger while a held press counts taps (screen space). */
  private readonly holdRing = new Graphics();
  private unsubscribe: (() => void) | null = null;
  private destroyed = false;
  private ready = false;
  private viewW = 0;
  private viewH = 0;
  /** CSS px the HUD covers on the right (the desktop column). */
  private insetRight = 0;
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
    this.roomLines = new Lines(
      this.room.props,
      ROOM.floor * ART,
      this.room.particles,
      { float: (line, x, y, amount) => this.roomFloater(line.product, x, y, amount) },
      ROOM_LAYOUT,
      (ROOM.width * ART) / 2,
    );
    this.roomHands = new Hands(this.room.props);
    this.room.lights.addChild(this.roomLines.lights);
    this.dim.eventMode = "static";
    this.dim.on("pointertap", () => useUi.getState().openHouse(false));
    this.houseButton = document.createElement("button");
    this.houseButton.type = "button";
    this.houseButton.className = "house-hit";
    this.houseButton.hidden = true;
    this.houseButton.addEventListener("click", () => this.openHouse());
    this.houseHint = document.createElement("div");
    this.houseHint.className = "glass house-hint";
    this.houseHint.setAttribute("role", "status");
    this.houseHint.hidden = true;
    this.target.container.position.set(TARGET.x, TARGET.y);
    this.target.container.zIndex = TARGET.y;
    this.house.container.position.set(HOUSE.x, HOUSE.y);
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
    await Promise.all([loadProductIcons(), loadArt()]);
    this.terrain.build();
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.ready = true;
    this.host.appendChild(this.app.canvas);
    this.host.appendChild(this.button);
    this.host.appendChild(this.flotsam.button);
    this.host.appendChild(this.flotsam.hint);
    this.host.appendChild(this.houseButton);
    this.host.appendChild(this.houseHint);
    this.app.stage.addChild(
      this.world,
      this.ambient,
      this.lights,
      this.weather.container,
      this.dim,
      this.room.container,
      this.lines.overlay,
      this.roomLines.overlay,
      this.flotsam.overlay,
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
      hitBoxes: () => {
        const flotsam = this.flotsam.hitBox;
        const boxes = [{ name: "target", ...this.box }];
        return flotsam ? [...boxes, { name: "flotsam", ...flotsam }] : boxes;
      },
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
    this.houseButton.remove();
    this.houseHint.remove();
    this.flotsam.button.remove();
    this.flotsam.hint.remove();
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
   * The zoom is the largest whole number of device pixels per art pixel that still shows the
   * whole island (`VIEW`), at most MAX_ZOOM CSS px: a phone sees the island edge to edge, a
   * desktop more sky and sea around it. The ground line sits at about half the height on a
   * phone and lower on wide screens.
   */
  private layout(): void {
    const vw = this.app.screen.width;
    const vh = this.app.screen.height;
    // The desktop column covers the right: the island centres in what is left (1.7).
    const right = Math.min(insets.right, vw * 0.5);
    if (vw === this.viewW && vh === this.viewH && right === this.insetRight) return;
    this.viewW = vw;
    this.viewH = vh;
    this.insetRight = right;
    const freeW = vw - right;
    const res = this.app.renderer.resolution;
    const fit = Math.min((freeW * res * ART) / VIEW_W, (vh * res * ART) / VIEW_H);
    const zoom = clamp(Math.floor(fit), 1, Math.round(MAX_ZOOM * res));
    this.scale = zoom / (res * ART);
    const visibleW = freeW / this.scale;
    const visibleH = vh / this.scale;
    // Centred on the island; on wide screens the view keeps only a strip of sea on the left
    // (where flotsam drifts in) and gives the rest of the width to the hill on the right.
    const left = Math.max(FOCUS_X - visibleW / 2, (VIEW.left - SEA_STRIP) * ART);
    this.centerX = left + visibleW / 2;
    const aspect = freeW / vh;
    const groundFraction = aspect < 1 ? PHONE_GROUND : lerp(0.68, 0.74, clamp(aspect - 1, 0, 1));
    this.top = clamp(GROUND - groundFraction * visibleH, -EXTEND + 40, H + EXTEND - visibleH - 40);
    this.world.scale.set(this.scale);
    this.ambient.clear().rect(0, 0, vw, vh).fill(0xffffff);
    this.dim.clear().rect(0, 0, vw, vh).fill({ color: 0x0b0a0d, alpha: 0.62 });
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
    document.documentElement.style.setProperty(
      "--target-x",
      `${Math.round(box.x + box.width / 2)}px`,
    );
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
    const jump = Math.abs(now - this.lastNow);
    this.weather.set(sky, jump > 60);
    this.lastNow = now;
    const { rain, fog } = this.weather.amount;
    const palette = gloom(paletteAt(fraction), rain * 0.85 + fog * 0.6);
    const darkness = clamp(1 - palette.light, 0, 1);
    this.wind = 1 + Math.sin(this.time * 0.23) * 0.8 + rain * 1.5;
    this.parallax += (this.parallaxTarget - this.parallax) * Math.min(1, dt * 3);

    const visibleW = (this.viewW - this.insetRight) / this.scale;
    const left = this.centerX - visibleW / 2;
    // Whole device pixels only, so the art grid stays sharp (D188).
    const res = this.app.renderer.resolution;
    const px = (value: number) => Math.round(value * res) / res;
    this.world.position.set(px(-left * this.scale - this.parallax * 6), px(-this.top * this.scale));
    this.floaters.setCamera(
      this.world.position.x,
      this.world.position.y,
      this.scale,
      this.viewW - this.insetRight,
    );
    this.lights.position.copyFrom(this.world.position);
    this.lights.scale.copyFrom(this.world.scale);

    this.sky.update(dt, fraction, palette, this.wind, 0);
    this.terrain.update(dt, palette, this.wind, this.parallax);
    this.house.update(dt, darkness);
    this.target.crowned = useAdvisor.getState().view?.pick.kind === "tap";
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
      this.flotsam.update(base, now, nowMs, dt, this.camera(), Math.max(darkness, fog), jump > 5);
      this.updateRoom(base, now, nowMs, dt);
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

    // Hands: one per manned line, at their line's work point; the crafting lines' hands work
    // inside the house, in its room.
    const posts = new Map<string, { hand: string; post: Post }>();
    const inside = new Map<string, { hand: string; post: Post }>();
    for (const id of base.run.hands) {
      const line = lineOf(content, id);
      const indoors = INSIDE.has(id);
      const point = (indoors ? this.roomLines : this.lines).workPoint(id);
      const spot = (indoors ? ROOM_LAYOUT : LAYOUT)[id];
      if (line && point && spot)
        (indoors ? inside : posts).set(id, { hand: line.hand, post: { ...point, faceX: spot.x } });
    }
    const door = { x: HOUSE.x, y: HOUSE.y + 2, scale: HOUSE.scale, faceX: HOUSE.x };
    const roomDoor = { x: ROOM.door * ART, y: ROOM.floor * ART + 2, scale: 1, faceX: 0 };
    const walking = [
      ...this.hands.sync(posts, door, !fresh),
      ...this.roomHands.sync(inside, roomDoor, !fresh),
    ];
    // A hire is one hand at a time; several at once are a load or a demo patch (D161).
    for (const id of walking.length === 1 ? walking : []) {
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
          // A crafting line's milestone rises from the house.
          const top =
            this.lines.topOf(line.id) ??
            (INSIDE.has(line.id) ? { x: HOUSE.x, y: HOUSE.y - 40 * ART } : null);
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

  // --- the house's room (D206) -----------------------------------------------------------------

  /** Whether the house has a room to open: some crafting line's era has opened. */
  private houseOpens(base: BaseState): boolean {
    for (const id of INSIDE) {
      const line = lineOf(content, id);
      if (line && eraReached(base, line.era)) return true;
    }
    return false;
  }

  private openHouse(): void {
    sound.play("ui_open");
    useUi.getState().openHouse(true);
    const seen = Number(readHint() ?? 0);
    writeHint(String(seen + 1));
  }

  /**
   * The room, the house button and its hint, each frame. Open, the room sits over the dimmed
   * island at the island's zoom, its floor on the island's ground line; the target, flotsam and
   * the island's badges step back until it closes.
   */
  private updateRoom(base: BaseState, now: number, nowMs: number, dt: number): void {
    const opens = this.houseOpens(base);
    const open = opens && useUi.getState().house;
    if (!opens && useUi.getState().house) useUi.setState({ house: false });
    this.roomOpen = open;
    this.room.setTier(base.run.era);
    this.room.container.visible = open;
    this.dim.visible = open;
    this.lines.overlay.visible = !open;
    this.roomLines.overlay.visible = open;
    this.target.overlay.visible = !open;
    this.flotsam.overlay.visible = !open;
    this.button.style.visibility = open ? "hidden" : "";
    this.flotsam.button.style.visibility = open ? "hidden" : "";
    const res = this.app.renderer.resolution;
    const px = (value: number) => Math.round(value * res) / res;
    const size = this.room.size(this.scale);
    const freeW = this.viewW - this.insetRight;
    const groundY = this.world.position.y + GROUND * this.scale;
    const x = px((freeW - size.width) / 2);
    const y = px(Math.max(8, groundY - ROOM.floor * ART * this.scale));
    this.room.place(x, y, this.scale);
    this.room.update(dt, this.wind);
    this.roomLines.update(base, now, nowMs, dt, 0);
    this.roomLines.syncLights();
    this.roomLines.place(base, x, y, this.scale);
    this.roomHands.update(dt, this.wind);
    this.placeHouse(base, opens && !open);
  }

  /** The house button over the house's drawing, and its one-line hint until opened twice. */
  private placeHouse(base: BaseState, shown: boolean): void {
    this.houseButton.hidden = !shown;
    const name = t(`house.${base.run.era}`);
    this.houseButton.setAttribute("aria-label", t("house.open", { house: name }));
    const hint = shown && Number(readHint() ?? 0) < HOUSE_HINT_OPENS;
    this.houseHint.hidden = !hint;
    if (!shown) return;
    const b = this.house.container.getBounds();
    const pad = 6;
    const width = Math.max(48, b.width + pad * 2);
    const height = Math.max(48, b.height + pad * 2);
    const box = {
      x: Math.round(b.x + b.width / 2 - width / 2),
      y: Math.round(b.y + b.height / 2 - height / 2),
      width: Math.round(width),
      height: Math.round(height),
    };
    const key = `${box.x},${box.y},${box.width},${box.height},${name},${hint}`;
    if (key === this.houseKey) return;
    this.houseKey = key;
    Object.assign(this.houseButton.style, {
      left: `${box.x}px`,
      top: `${box.y}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    });
    if (hint) {
      // Centred over the house, but never past the edge of the island's part of the screen.
      this.houseHint.textContent = t("house.hint", { house: name });
      const half = this.houseHint.offsetWidth / 2 || 90;
      const freeW = this.viewW - this.insetRight;
      const centre = clamp(box.x + box.width / 2, half + 8, freeW - half - 8);
      this.houseHint.style.left = `${Math.round(centre)}px`;
      this.houseHint.style.top = `${box.y - 6}px`;
    }
  }

  /** A crafting line's floater: from its station while the room is open, from the house if not. */
  private roomFloater(product: string, x: number, y: number, amount: number): void {
    if (!this.roomOpen) {
      this.lineFloater(product, HOUSE.x, HOUSE.y - 24 * ART, amount);
      return;
    }
    const screenX = this.room.container.x + x * this.scale;
    const screenY = this.room.container.y + y * this.scale;
    const at = this.toWorld(screenX, screenY);
    this.lineFloater(product, at.x, at.y, amount);
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
        .moveTo(held.x, held.y - r)
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
    const counter = document.querySelector(".topbar .counter .counter-icon");
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

  /** The world's transform on screen. */
  private camera(): { x: number; y: number; scale: number } {
    return { x: this.world.position.x, y: this.world.position.y, scale: this.scale };
  }

  /** The counter's icon on screen (CSS px, relative to the scene), where gains fly to. */
  private counterPoint(): { x: number; y: number } | null {
    const counter = document.querySelector(".topbar .counter .counter-icon");
    const rect = counter?.getBoundingClientRect();
    if (!rect) return null;
    const host = this.host.getBoundingClientRect();
    return { x: rect.left + rect.width / 2 - host.left, y: rect.top + rect.height / 2 - host.top };
  }

  /** Flotsam caught (predicted): it pops, coins and a splash, and says what it gave. */
  private flotsamCaught(kind: string, k: number, value: number, nowMs: number): void {
    this.flotsam.restPoint(this.camera());
    const screen = this.flotsam.screenPoint;
    this.flotsam.caught(k);
    const at = this.toWorld(screen.x, screen.y);
    this.particles.spawn("splash", at.x, at.y + 6, 10);
    this.particles.spawn("coins", at.x, at.y - 10, 16);
    sound.play("flotsam_claim");
    haptics.buzz(BUZZ.flotsam);
    const row = content.flotsam.kinds.find((item) => item.id === kind);
    if (!row) return;
    const effect = row.effect;
    if ("lump" in effect) {
      const base = useWorld.getState().base;
      const minutes = base ? crateMinutes(content, base, value, Math.floor(gameSeconds())) : 0;
      this.floaters.add(
        "event",
        at.x,
        at.y - 70,
        t("sea.crate_paid", { minutes: Number(minutes.toPrecision(2)) }),
        nowMs,
        { size: this.floatSize(1.05), color: 0xffd25a, holdMs: 1500 },
      );
      const counter = this.counterPoint();
      this.floaters.add("flotsam", at.x, at.y - 30, `+${fmt(value, "cost")}`, nowMs, {
        size: this.floatSize(1.1),
        ...(counter ? { fly: { ...counter, arrive: () => this.bumpCounter() } } : {}),
      });
      return;
    }
    let factor = 1;
    for (const item of effect.effects) if (item.op === "more") factor *= item.value;
    const output = effect.effects.some((item) => item.stat === "output");
    if (output) sound.play("rally");
    this.floaters.add(
      "event",
      at.x,
      at.y - 60,
      t(output ? "sea.buff_output" : "sea.buff_tap", {
        name: buffName(effect.buff),
        factor: fmtFactor(factor),
        time: duration(effect.seconds),
      }),
      nowMs,
      { size: this.floatSize(1.05), color: 0xffd25a, holdMs: 1600 },
    );
  }

  /** It sank uncaught while the page was showing: one quiet line where it went down. */
  private sank(x: number, y: number, firstRun: boolean, nowMs: number): void {
    const at = this.toWorld(x, y);
    this.floaters.add(
      "event",
      at.x,
      at.y - 50,
      t(firstRun ? "sea.sank_first" : "sea.sank"),
      nowMs,
      { size: this.floatSize(0.78), color: 0xffffff, holdMs: 2600 },
    );
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
      case "flotsam_claimed": {
        this.flotsamCaught(event.kind, event.k, event.value, nowMs);
        break;
      }
      case "flotsam_lost": {
        this.flotsam.restPoint(this.camera());
        const screen = this.flotsam.screenPoint;
        this.flotsam.lost(event.k);
        const at = this.toWorld(screen.x, screen.y);
        this.floaters.add("event", at.x, at.y - 50, t("sea.drifted"), nowMs, {
          size: this.floatSize(0.85),
          color: 0xffffff,
          holdMs: 1400,
        });
        break;
      }
      case "collected": {
        // Welcome back: the gain flies from the house into the counter.
        if (event.gain <= 0) break;
        const counter = this.counterPoint();
        this.floaters.add("event", HOUSE.x, HOUSE.y - 90, `+${fmt(event.gain, "cost")}`, nowMs, {
          size: this.floatSize(1.25),
          color: 0xffd25a,
          ...(counter ? { fly: { ...counter, arrive: () => this.bumpCounter() } } : {}),
        });
        sound.play("milestone");
        break;
      }
      case "go_tap": {
        // A refusal's button: back to the island, the target blinks and takes the focus.
        closeAll();
        this.target.pulse();
        this.button.focus({ preventScroll: true });
        break;
      }
      // Hires show as the hand walking out (`follow`).
    }
  }
}
