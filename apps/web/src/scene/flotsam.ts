/**
 * Flotsam as an airdrop (docs/redesign/02-the-run.md 8; 08-screens.md 1.3; D209): the wasteland
 * has no sea, so the arrival comes down from the sky under a parachute, falling fast into view,
 * then sinking slowly over the island's left side while a ring drains its float, and drifts off
 * if nobody catches it. It is drawn in screen space at a fixed size above the night tint, so it glows in
 * the dark and in fog, and it is caught through a 64 px button kept over it (D48), like the
 * target. What is afloat is the domain's `afloat()` of the base: the schedule is the state's,
 * never the page's, so a reload or a second tab shows the same crate.
 *
 * It glows but never takes the crown (02 11.1). Its hint ("Something's drifting in...") sits
 * beside it until the player has caught two (02 11.2, hint 10).
 */
import { type Afloat, afloat } from "@wipe-day/domain/flotsam";
import type { BaseState } from "@wipe-day/domain/state";
import { Container, Graphics, Sprite } from "pixi.js";
import { content, t } from "../state/world";
import { flotsamTexture } from "./icons";
import { FLOTSAM_GLOW, FLOTSAM_TINT } from "./palette";
import { glowTexture } from "./textures";
import { clamp, easeOutCubic, lerp, reducedMotion } from "./util";

/** Where it hangs at its float's end: over the left of the island, above the rows (world units). */
export const REST = { x: 128 * 5, y: 66 * 5 };
/** Where its slow descent starts once it has dropped into view (world units, above REST). */
const DROP_TOP = 34 * 5;
/** Seconds it takes to fall from above the screen to the start of its slow descent. */
const DRIFT_S = 2.5;
/** Seconds it takes to drift off and fade once its float is over (it can still be caught). */
const SINK_S = 1.2;
/** On screen (CSS px): the button, the icon, the ring. */
const HIT = 64;
const ICON = 50;
const RING_R = 33;
/** The hint retires after this many catches (02-the-run.md 11.2). */
const HINT_CATCHES = 2;
/** A caught one pops for this long (ms). */
const POP_MS = 380;
/** The parachute's chunky pixel (CSS px) and its colours (the palette's). */
const CANOPY_PX = 4;
const CANOPY = { light: 0xd6a26a, dark: 0xa35f4d, hem: 0x502f30, cord: 0x2f1822 };

export interface FlotsamCamera {
  x: number;
  y: number;
  scale: number;
}

type Leaving = { kind: "caught" | "sank"; x: number; y: number; since: number; tint: number };

export class Flotsam {
  /** Screen space, above the night tint: the glow, the icon, the ring. */
  readonly overlay = new Container();
  /** The tap area: a round button over the icon. */
  readonly button: HTMLButtonElement;
  /** "Something's drifting in. Tap it before it floats off." */
  readonly hint: HTMLDivElement;
  private readonly halo = new Sprite(glowTexture());
  private readonly icon = new Sprite();
  private readonly ring = new Graphics();
  /** The parachute over it, drawn in chunky screen pixels like the scene's art. */
  private readonly canopy = new Graphics();
  private readonly ghost = new Sprite();
  /** The arrival on screen, and where it was drawn last (CSS px). */
  private shown: Afloat | null = null;
  private shownRun = 0;
  private point = { x: 0, y: 0 };
  private leaving: Leaving | null = null;
  /** An arrival the server said drifted off: it never shows again. */
  private gone = -1;
  private time = 0;
  /** The wall clock at the last frame (ms). */
  private nowMs = 0;
  private cache: { base: BaseState | null; tenth: number; value: Afloat | null } = {
    base: null,
    tenth: -1,
    value: null,
  };
  private box = { x: 0, y: 0, width: 0, height: 0 };
  private boxKey = "";
  private hintShown = false;

  constructor(
    private readonly on: {
      /** The player tapped arrival `k` of run `run`. */
      claim: (run: number, k: number) => void;
      /** A new arrival came into view (the bell). */
      arrived: () => void;
      /** The shown one sank uncaught while the page was visible, at screen point `x, y`. */
      sank: (x: number, y: number, firstRun: boolean, nowMs: number) => void;
    },
  ) {
    this.halo.anchor.set(0.5);
    this.halo.tint = FLOTSAM_GLOW;
    this.halo.blendMode = "add";
    this.icon.anchor.set(0.5);
    this.ghost.anchor.set(0.5);
    this.overlay.addChild(this.halo, this.canopy, this.ring, this.icon, this.ghost);
    this.overlay.visible = false;
    this.ghost.visible = false;

    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "flotsam-hit";
    this.button.hidden = true;
    this.button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();
      event.stopPropagation();
      this.claim();
    });
    // Enter and Space arrive as a click with no pointer behind it.
    this.button.addEventListener("click", (event) => {
      if (event.detail === 0) this.claim();
    });
    this.button.addEventListener("contextmenu", (event) => event.preventDefault());

    this.hint = document.createElement("div");
    this.hint.className = "plate flotsam-hint";
    this.hint.setAttribute("role", "status");
    this.hint.hidden = true;
  }

  /** The tap area on screen while something can be caught (the shots' 44 px audit). */
  get hitBox(): { x: number; y: number; width: number; height: number } | null {
    return this.button.hidden ? null : { ...this.box };
  }

  /** The screen point it was last drawn at (CSS px): where its floaters start. */
  get screenPoint(): { x: number; y: number } {
    return { ...this.point };
  }

  /** Before the first frame draws it: its resting point (CSS px). */
  restPoint(camera: FlotsamCamera): void {
    if (this.point.x !== 0 || this.point.y !== 0) return;
    this.point = { x: camera.x + REST.x * camera.scale, y: camera.y + REST.y * camera.scale };
  }

  private claim(): void {
    const shown = this.shown;
    if (!shown || this.leaving) return;
    this.on.claim(this.shownRun, shown.k);
  }

  /** Arrival `k` was caught (predicted): it pops where it floats. */
  caught(k: number): void {
    if (this.shown?.k !== k) return;
    this.leave("caught");
  }

  /** A claim on `k` came too late: it sinks where it floats, and stays gone. */
  lost(k: number): void {
    this.gone = k;
    if (this.shown?.k !== k || this.leaving) return;
    this.leave("sank");
  }

  private leave(kind: Leaving["kind"]): void {
    const shown = this.shown;
    if (!shown) return;
    this.leaving = {
      kind,
      x: this.point.x,
      y: this.point.y,
      since: this.nowMs,
      tint: FLOTSAM_TINT[shown.kind.id] ?? 0xffffff,
    };
    this.ghost.texture = this.icon.texture;
    this.ghost.visible = true;
    this.ghost.tint = this.leaving.tint;
    this.shown = null;
  }

  private afloatAt(base: BaseState, now: number): Afloat | null {
    const tenth = Math.floor(now * 10);
    const cache = this.cache;
    if (cache.base !== base || cache.tenth !== tenth) {
      cache.base = base;
      cache.tenth = tenth;
      cache.value = afloat(content, base, now);
    }
    return cache.value;
  }

  /**
   * Once a frame. `now`: game seconds (fractional); `jumped`: the clock moved by more than a
   * moment (a demo jump, a tab back after a while), so nothing that ended meanwhile is told.
   */
  update(
    base: BaseState,
    now: number,
    nowMs: number,
    dt: number,
    camera: FlotsamCamera,
    glow: number,
    jumped: boolean,
  ): void {
    this.time += dt;
    this.nowMs = nowMs;
    const found = this.afloatAt(base, now);
    const current = found && found.k !== this.gone ? found : null;
    const shown = this.shown;
    if (shown && current?.k !== shown.k) {
      // Gone without a catch this page saw: it sank (or a claim elsewhere took it).
      const caughtElsewhere = base.run.flotsam.last === shown.k;
      const end = shown.at + shown.float + SINK_S;
      if (!caughtElsewhere && !jumped && !document.hidden && now >= end) {
        const firstRun = base.run.n === 1 && base.run.flotsam.caught === 0;
        this.on.sank(this.point.x, this.point.y, firstRun, nowMs);
      }
      if (caughtElsewhere) this.leave("caught");
      this.shown = null;
    }
    const age = current ? now - current.at : 0;
    // On screen from its arrival until it has sunk; the grace after that is the network's.
    if (current && current.k !== this.shown?.k && age < current.float + SINK_S) {
      this.shown = current;
      this.shownRun = base.run.n;
      if (age < DRIFT_S + 1 && !jumped && !document.hidden) this.on.arrived();
    }
    this.draw(now, nowMs, camera, glow, base);
  }

  private draw(
    now: number,
    nowMs: number,
    camera: FlotsamCamera,
    glow: number,
    base: BaseState,
  ): void {
    const reduced = reducedMotion();
    const shown = this.shown;
    const restX = camera.x + REST.x * camera.scale;
    const restY = camera.y + REST.y * camera.scale;
    let visible = false;
    if (shown) {
      const age = now - shown.at;
      if (age >= 0 && age < shown.float + SINK_S) {
        visible = true;
        // It falls into view, then sinks slowly under its canopy until its float runs out,
        // swaying; once it is over the wind takes it off to the right, fading.
        const topY = camera.y + DROP_TOP * camera.scale;
        const fall = reduced ? 1 : easeOutCubic(clamp(age / DRIFT_S, 0, 1));
        const descend = clamp((age - DRIFT_S) / Math.max(1, shown.float - DRIFT_S), 0, 1);
        const sink = clamp((age - shown.float) / SINK_S, 0, 1);
        const sway = reduced ? 0 : Math.sin(this.time * 1.3) * 6;
        const x = Math.round(restX + sway + sink * 40);
        const y = Math.round(
          age < DRIFT_S ? lerp(-ICON * 2, topY, fall) : lerp(topY, restY, descend) - sink * 20,
        );
        this.point = { x, y };
        const texture = flotsamTexture(shown.kind.id);
        this.icon.visible = texture !== null;
        if (texture) this.icon.texture = texture;
        this.icon.tint = FLOTSAM_TINT[shown.kind.id] ?? 0xffffff;
        this.icon.width = ICON;
        this.icon.height = ICON;
        this.icon.position.set(x, y);
        this.icon.rotation = reduced ? 0 : Math.sin(this.time * 1.4) * 0.07;
        this.icon.alpha = 1 - sink;
        const pulse = reduced ? 1 : 1 + Math.sin(this.time * 3) * 0.06;
        this.halo.position.set(x, y);
        this.halo.width = ICON * 2.4 * pulse;
        this.halo.height = ICON * 2.4 * pulse;
        this.halo.alpha = (0.25 + glow * 0.3) * (1 - sink);
        this.drawRing(x, y, sink > 0 ? 0 : 1 - clamp(age / shown.float, 0, 1), 1 - sink);
        this.drawCanopy(x, y, 1 - sink, reduced);
        this.place(x, y, base);
      }
    }
    this.icon.visible &&= visible;
    this.halo.visible = visible;
    this.ring.visible = visible;
    this.canopy.visible = visible;
    if (!visible) {
      this.button.hidden = true;
      this.hint.hidden = true;
      this.hintShown = false;
    }
    this.drawLeaving(nowMs, reduced);
    this.overlay.visible = visible || this.ghost.visible;
  }

  /**
   * The parachute: a stepped dome of canvas stripes on chunky pixels (CANOPY_PX CSS px each),
   * with its cords down to the drop, tilting a little with the sway.
   */
  private drawCanopy(x: number, y: number, alpha: number, reduced: boolean): void {
    const g = this.canopy;
    g.clear();
    const px = CANOPY_PX;
    const top = y - RING_R - 30;
    const lean = reduced ? 0 : Math.round(Math.sin(this.time * 1.3) * 1.5);
    // Half-widths of the dome's rows, top to bottom, in canopy pixels.
    const rows = [3, 5, 6, 7, 7];
    for (const [i, half] of rows.entries()) {
      for (let c = -half; c < half; c++) {
        const stripe = Math.floor((c + 7) / 2) % 2 === 0;
        const colour = i === rows.length - 1 ? CANOPY.hem : stripe ? CANOPY.light : CANOPY.dark;
        g.rect(x + (c + lean) * px, top + i * px, px, px).fill({ color: colour, alpha });
      }
    }
    const hemY = top + rows.length * px;
    for (const end of [-6.5, 0, 6.5]) {
      g.moveTo(x + (end + lean) * px, hemY)
        .lineTo(x, y - ICON / 2 + 4)
        .stroke({ width: 2, color: CANOPY.cord, alpha: alpha * 0.9 });
    }
  }

  /** The pie ring: a dark track and the time left in white, warm in its last 4 s. */
  private drawRing(x: number, y: number, left: number, alpha: number): void {
    const ring = this.ring;
    ring.clear();
    ring.circle(x, y, RING_R).stroke({ width: 4, color: 0x1b1a18, alpha: 0.4 * alpha });
    if (left <= 0) return;
    const shown = this.shown;
    const seconds = shown ? left * shown.float : 0;
    const color = seconds < 4 ? 0xffb070 : 0xffffff;
    ring
      .moveTo(x, y - RING_R)
      .arc(x, y, RING_R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left)
      .stroke({ width: 4, color, alpha: 0.95 * alpha, cap: "round" });
  }

  /** The button over it, and the hint beside it while the player is new to flotsam. */
  private place(x: number, y: number, base: BaseState): void {
    const box = { x: x - HIT / 2, y: y - HIT / 2, width: HIT, height: HIT };
    this.box = box;
    this.button.hidden = false;
    const key = `${box.x},${box.y}`;
    if (key !== this.boxKey) {
      this.boxKey = key;
      this.button.style.left = `${box.x}px`;
      this.button.style.top = `${box.y}px`;
      // Beside it in the sky (right of it, level with it), clear of its parachute and of
      // every line below.
      this.hint.style.left = `${box.x + box.width + 8}px`;
      this.hint.style.top = `${box.y + box.height / 2}px`;
      this.hint.style.transform = "translateY(-50%)";
    }
    const name = this.shown ? t(`flotsam.${this.shown.kind.id}.name`) : "";
    const label = t("sea.catch", { name });
    if (this.button.getAttribute("aria-label") !== label)
      this.button.setAttribute("aria-label", label);
    const hint = base.meta.stats.flotsam < HINT_CATCHES;
    this.hint.hidden = !hint;
    if (hint && !this.hintShown) {
      this.hint.textContent = t("sea.hint");
      this.hintShown = true;
    }
  }

  /** A caught one pops and fades; a lost one sinks. */
  private drawLeaving(nowMs: number, reduced: boolean): void {
    const leaving = this.leaving;
    if (!leaving) {
      this.ghost.visible = false;
      return;
    }
    const p = clamp((nowMs - leaving.since) / (leaving.kind === "caught" ? POP_MS : 900), 0, 1);
    if (p >= 1) {
      this.leaving = null;
      this.ghost.visible = false;
      return;
    }
    const size =
      leaving.kind === "caught" && !reduced ? ICON * lerp(1, 1.4, easeOutCubic(p)) : ICON;
    this.ghost.width = size;
    this.ghost.height = size;
    this.ghost.alpha = 1 - p;
    // A missed one drifts off up and to the right on the wind.
    const off = leaving.kind === "sank" ? p : 0;
    this.ghost.position.set(leaving.x + off * 30, leaving.y - off * 18);
  }
}
