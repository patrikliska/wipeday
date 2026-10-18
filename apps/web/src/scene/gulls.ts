/**
 * Crows (id `gull`; 12-feel.md 9.3; D197, D238): flotsam's skill-based sibling. One crosses the
 * sky every two to four minutes while the page is open; a tap catches it for seconds of output,
 * and one in twenty is a Magpie, black and white with a glint, faster and worth six times as
 * much. What crosses is the domain's `gullAt()` of the base, so a reload or a second tab shows
 * the same bird.
 *
 * Drawn like the airdrop's parachute: chunky screen pixels (CROW_PX CSS px each) above the night
 * tint, with a soft glow so it reads at night and in fog, and caught through a 64 px button
 * that flies with it (D48). It never takes the crown. A hint line under the top bar says what to
 * do until the player has caught two.
 */
import { type Crossing, gullAt } from "@wipe-day/domain/gulls";
import type { BaseState } from "@wipe-day/domain/state";
import { Container, Graphics, Sprite } from "pixi.js";
import { content, t } from "../state/world";
import { CROW, CROW_GLOW } from "./palette";
import { glowTexture } from "./textures";
import { clamp, easeOutCubic, lerp, reducedMotion } from "./util";

/** One crow pixel on screen (CSS px). */
const CROW_PX = 5;
/** The button (CSS px). */
const HIT = 64;
/** The hint retires after this many catches (12-feel.md 3.2's hints rule). */
const HINT_CATCHES = 2;
/** A caught one bursts for this long (ms). */
const POP_MS = 420;
/** Wingbeats a second (a Magpie beats faster). */
const FLAPS = 5;

/**
 * The flap, three frames of a 15 × 8 bird seen from below: wings up, level, down. `#` is the
 * body, `w` a Magpie's white wing patch (a crow's lighter edge), `.` sky.
 */
const FRAMES: readonly string[][] = [
  [
    "#.............#",
    "##...........##",
    ".##w.......w##.",
    "..##w.###.w##..",
    "...#########...",
    ".....#####.....",
    "......###......",
    ".....#.#.#.....",
  ],
  [
    "...............",
    "......###......",
    "##w...###...w##",
    ".####w###w####.",
    "....#######....",
    ".....#####.....",
    "......###......",
    ".....#.#.#.....",
  ],
  [
    "...............",
    "......###......",
    "....#######....",
    "..###w###w###..",
    ".##w..###..w##.",
    "##.....#.....##",
    "#.....###.....#",
    ".....#.#.#.....",
  ],
];
const COLS = 15;
const ROWS = 8;

export interface GullCamera {
  x: number;
  y: number;
  scale: number;
}

type Leaving = { x: number; y: number; since: number; elite: boolean };

export class Gulls {
  /** Screen space, above the night tint: the glow and the bird. */
  readonly overlay = new Container();
  /** The tap area, flying with the bird. */
  readonly button: HTMLButtonElement;
  /** "A crow! Tap it before it's gone." */
  readonly hint: HTMLDivElement;
  private readonly halo = new Sprite(glowTexture());
  private readonly bird = new Graphics();
  private readonly ghost = new Graphics();
  private shown: Crossing | null = null;
  private shownRun = 0;
  private point = { x: 0, y: 0 };
  private leaving: Leaving | null = null;
  /** A crossing the server said was gone: it never shows again. */
  private gone = -1;
  private nowMs = 0;
  private cache: { base: BaseState | null; tenth: number; value: Crossing | null } = {
    base: null,
    tenth: -1,
    value: null,
  };
  private box = { x: 0, y: 0, width: 0, height: 0 };
  private boxKey = "";

  constructor(
    private readonly on: {
      /** The player tapped crow `k` of run `run`. */
      claim: (run: number, k: number) => void;
      /** A crow came into view (its caw). */
      arrived: (elite: boolean) => void;
    },
  ) {
    this.halo.anchor.set(0.5);
    this.halo.blendMode = "add";
    this.overlay.addChild(this.halo, this.bird, this.ghost);
    this.overlay.visible = false;

    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "gull-hit";
    this.button.hidden = true;
    this.button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();
      event.stopPropagation();
      this.claim();
    });
    this.button.addEventListener("click", (event) => {
      if (event.detail === 0) this.claim();
    });
    this.button.addEventListener("contextmenu", (event) => event.preventDefault());

    this.hint = document.createElement("div");
    this.hint.className = "plate gull-hint";
    this.hint.setAttribute("role", "status");
    this.hint.hidden = true;
  }

  /** The tap area on screen while a crow can be caught (the shots' 44 px audit). */
  get hitBox(): { x: number; y: number; width: number; height: number } | null {
    return this.button.hidden ? null : { ...this.box };
  }

  /** Where the bird was last drawn (CSS px): its floaters start here. */
  get screenPoint(): { x: number; y: number } {
    return { ...this.point };
  }

  private claim(): void {
    const shown = this.shown;
    if (!shown || this.leaving) return;
    this.on.claim(this.shownRun, shown.k);
  }

  /** Crow `k` was caught (predicted): it bursts into feathers where it flies. */
  caught(k: number): void {
    const shown = this.shown;
    if (shown?.k !== k) return;
    this.leaving = { x: this.point.x, y: this.point.y, since: this.nowMs, elite: shown.elite };
    this.shown = null;
  }

  /** A claim on `k` came too late: it flies on and stays gone. */
  lost(k: number): void {
    this.gone = k;
  }

  private crossingAt(base: BaseState, now: number): Crossing | null {
    const tenth = Math.floor(now * 10);
    const cache = this.cache;
    if (cache.base !== base || cache.tenth !== tenth) {
      cache.base = base;
      cache.tenth = tenth;
      cache.value = gullAt(content, base, now);
    }
    return cache.value;
  }

  /**
   * Once a frame. `now`: game seconds (fractional); `width`: the scene's free width (CSS px);
   * `glow`: how dark it is (0 noon, 1 night or fog); `jumped`: the clock leapt.
   */
  update(
    base: BaseState,
    now: number,
    nowMs: number,
    width: number,
    camera: GullCamera,
    glow: number,
    jumped: boolean,
  ): void {
    this.nowMs = nowMs;
    const found = this.crossingAt(base, now);
    const current = found && found.k !== this.gone && now - found.at < found.cross ? found : null;
    if (this.shown && current?.k !== this.shown.k) this.shown = null;
    if (current && current.k !== this.shown?.k) {
      this.shown = current;
      this.shownRun = base.run.n;
      if (now - current.at < 1 && !jumped && !document.hidden) this.on.arrived(current.elite);
    }
    this.draw(now, width, camera, glow, base);
  }

  private draw(now: number, width: number, camera: GullCamera, glow: number, base: BaseState) {
    const reduced = reducedMotion();
    const shown = this.shown;
    let visible = false;
    if (shown) {
      const p = clamp((now - shown.at) / shown.cross, 0, 1);
      // Every other crow flies the other way; each at its own height in the upper sky.
      const rightward = shown.k % 2 === 0;
      const span = COLS * CROW_PX;
      const x0 = rightward ? -span : width + span;
      const x1 = rightward ? width + span : -span;
      const lane = ((shown.k * 37) % 5) / 4;
      const skyY = camera.y + lerp(150, 290, lane) * camera.scale;
      const bob = reduced ? 0 : Math.sin(now * (shown.elite ? 9 : 6)) * 5;
      const x = Math.round(lerp(x0, x1, p));
      const y = Math.round(Math.max(96, skyY) + bob);
      this.point = { x, y };
      const beat = shown.elite ? FLAPS * 1.6 : FLAPS;
      const frame = reduced ? 1 : Math.floor(now * beat * FRAMES.length) % FRAMES.length;
      this.paint(this.bird, x, y, frame, shown.elite, 1, !rightward);
      // A glow that reads on any sky: added light in the dark, a warm wash by day. A Magpie's
      // is gold and pulses.
      const dark = glow > 0.45;
      this.halo.blendMode = dark ? "add" : "normal";
      this.halo.tint = shown.elite ? 0xffd25a : CROW_GLOW;
      this.halo.position.set(x, y);
      const size = COLS * CROW_PX * (shown.elite ? 2.4 : 1.9);
      this.halo.width = size;
      this.halo.height = size * 0.75;
      const pulse = shown.elite && !reduced ? 0.08 * Math.sin(now * 8) : 0;
      this.halo.alpha = dark
        ? (shown.elite ? 0.5 : 0.22) + pulse
        : (shown.elite ? 0.85 : 0.22) + pulse;
      visible = true;
      this.place(x, y, base, width);
    }
    this.bird.visible = visible;
    this.halo.visible = visible;
    if (!visible) {
      this.button.hidden = true;
      this.hint.hidden = true;
    }
    this.drawLeaving(reduced);
    this.overlay.visible = visible || this.ghost.visible;
  }

  /** One frame of the bird at (x, y), centred, on whole CSS px. */
  private paint(
    g: Graphics,
    x: number,
    y: number,
    frame: number,
    elite: boolean,
    alpha: number,
    flip: boolean,
  ): void {
    g.clear();
    const rows = FRAMES[frame] ?? FRAMES[1] ?? [];
    const left = x - (COLS * CROW_PX) / 2;
    const top = y - (ROWS * CROW_PX) / 2;
    for (let r = 0; r < ROWS; r++) {
      const row = rows[r] ?? "";
      for (let c = 0; c < COLS; c++) {
        const cell = row[flip ? COLS - 1 - c : c];
        if (cell !== "#" && cell !== "w") continue;
        const colour = cell === "w" ? (elite ? CROW.white : CROW.rim) : CROW.body;
        g.rect(left + c * CROW_PX, top + r * CROW_PX, CROW_PX, CROW_PX).fill({
          color: colour,
          alpha,
        });
      }
    }
    // A Magpie's white belly and its glint: a gold pixel at the breast.
    if (elite) {
      g.rect(left + 6 * CROW_PX, top + 4 * CROW_PX, CROW_PX * 3, CROW_PX).fill({
        color: CROW.white,
        alpha,
      });
      g.rect(left + 7 * CROW_PX, top + 3 * CROW_PX, CROW_PX, CROW_PX).fill({
        color: CROW.glint,
        alpha,
      });
    }
  }

  /** The button over the bird, and the hint under the top bar while the player is new to crows. */
  private place(x: number, y: number, base: BaseState, width: number): void {
    const box = { x: x - HIT / 2, y: y - HIT / 2, width: HIT, height: HIT };
    this.box = box;
    // Only while it is on screen: a button off the edge is no target.
    this.button.hidden = x < -HIT / 2 || x > width + HIT / 2;
    const key = `${box.x},${box.y}`;
    if (key !== this.boxKey) {
      this.boxKey = key;
      this.button.style.left = `${box.x}px`;
      this.button.style.top = `${box.y}px`;
    }
    const name = t(this.shown?.elite ? "gull.elite" : "gull.name");
    const label = t("gull.catch", { name });
    if (this.button.getAttribute("aria-label") !== label)
      this.button.setAttribute("aria-label", label);
    const hint = base.meta.stats.gulls < HINT_CATCHES;
    this.hint.hidden = !hint;
    if (hint) {
      const text = t(this.shown?.elite ? "gull.hint_elite" : "gull.hint");
      if (this.hint.textContent !== text) this.hint.textContent = text;
      this.hint.style.left = `${Math.round(width / 2)}px`;
    }
  }

  /** A caught one bursts: the bird pops up and fades, a ring of feathers flies out. */
  private drawLeaving(reduced: boolean): void {
    const leaving = this.leaving;
    const g = this.ghost;
    if (!leaving) {
      g.visible = false;
      return;
    }
    const p = clamp((this.nowMs - leaving.since) / POP_MS, 0, 1);
    if (p >= 1) {
      this.leaving = null;
      g.visible = false;
      return;
    }
    g.visible = true;
    const rise = reduced ? 0 : easeOutCubic(p) * 14;
    this.paint(g, leaving.x, Math.round(leaving.y - rise), 0, leaving.elite, 1 - p, false);
    if (reduced) return;
    // Feathers: eight chunky pixels thrown outward.
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.3;
      const reach = 10 + easeOutCubic(p) * 34;
      const fx = Math.round(leaving.x + Math.cos(angle) * reach);
      const fy = Math.round(leaving.y + Math.sin(angle) * reach + p * 12);
      const colour = leaving.elite && i % 2 === 0 ? CROW.white : CROW.rim;
      g.rect(fx, fy, CROW_PX, CROW_PX).fill({ color: colour, alpha: 1 - p });
    }
  }
}
