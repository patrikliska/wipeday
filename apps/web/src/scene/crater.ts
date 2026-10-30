/**
 * The crater remembers (docs/redesign/03-the-big-red.md 10.3; D270): a bowl under the camp's
 * centre, 6 × √N stage units deep (N counted Wipe Days, drawn up to N = 100), cut into the
 * ground with a glassy rim whose glints sparkle on `lights` at night; the "WIPE DAY #N" sign on
 * its left rim, a world shape whose board grows up through the styles (a nailed plank, a
 * painted board, metal, lit with bulbs) while its lettering is drawn in screen space by the
 * scene (D46). During the film the sign drops in (`setDrop`); a small blast deepens nothing.
 */
import type { SignStyle } from "@wipe-day/content/schema";
import { Container, Graphics, Sprite } from "pixi.js";
import { BEACON, GLASS, GLASS_RIM, STEEL, STEEL_DARK, STUMP_FACE, TREE_TRUNK } from "./palette";
import { ART } from "./pixel";
import { glowTexture } from "./textures";
import { clamp, easeOutBack, hash } from "./util";

/** The bowl's half width (stage units) and the deepest it draws. */
const HALF = 120;
const MAX_N = 100;
/** The sign's post stands this far left of the centre (art px): on the bowl's left rim. */
const SIGN_X = -22;
/** Glints along the rim. */
const GLINTS = 6;

/** A rect of art pixels, `y` rows up from the ground line. */
function px(g: Graphics, x: number, y: number, w: number, h: number, color: number): Graphics {
  return g.rect(x * ART, -(y + h) * ART, w * ART, h * ART).fill(color);
}

/** Depth in stage units for N counted Wipe Days. */
export const craterDepth = (n: number): number => 6 * Math.sqrt(Math.min(MAX_N, Math.max(0, n)));

/** The sign's board (art px) per style: wider and taller as it grows. */
const BOARD: Record<SignStyle, { w: number; h: number; post: number }> = {
  plank: { w: 16, h: 5, post: 9 },
  painted: { w: 18, h: 7, post: 10 },
  metal: { w: 20, h: 7, post: 11 },
  lit: { w: 22, h: 8, post: 12 },
};

export class Crater {
  /** In the ground layer, over the painted ground and under everything that stands. */
  readonly container = new Container();
  /** The rim's glints and the lit sign's bulbs. */
  readonly light = new Container();
  private readonly bowl = new Graphics();
  private readonly sign = new Graphics();
  private readonly glints: Sprite[] = [];
  private readonly bulbs: Sprite[] = [];
  private n = -1;
  private style: SignStyle = "plank";
  private centreX = 0;
  private groundY = 0;
  private drop = 1;
  private time = 0;

  constructor() {
    this.container.addChild(this.bowl, this.sign);
    for (let i = 0; i < GLINTS; i++) {
      const glint = new Sprite(glowTexture());
      glint.anchor.set(0.5);
      glint.blendMode = "add";
      glint.tint = GLASS;
      glint.width = 7 * ART;
      glint.height = 7 * ART;
      glint.alpha = 0;
      this.light.addChild(glint);
      this.glints.push(glint);
    }
    for (let i = 0; i < 4; i++) {
      const bulb = new Sprite(glowTexture());
      bulb.anchor.set(0.5);
      bulb.blendMode = "add";
      bulb.tint = BEACON;
      bulb.width = 5 * ART;
      bulb.height = 5 * ART;
      bulb.alpha = 0;
      this.light.addChild(bulb);
      this.bulbs.push(bulb);
    }
  }

  /** Whether a crater shows at all. */
  get shown(): boolean {
    return this.n > 0;
  }

  /** The sign has landed (its lettering may show). */
  get landed(): boolean {
    return this.drop >= 1;
  }

  /** The board's width in stage units (the scene picks the long or the short label by it). */
  get boardWidth(): number {
    return BOARD[this.style].w * ART;
  }

  /** Where the label sits (world units): the board's centre, following the drop. */
  get labelAnchor(): { x: number; y: number } {
    const board = BOARD[this.style];
    return {
      x: this.centreX + (SIGN_X + board.w / 2) * ART,
      y: this.groundY - (board.post + board.h / 2) * ART + this.sign.y,
    };
  }

  /** Redraws for N Wipe Days in `style`, centred on `centreX` at the ground line `groundY`. */
  set(n: number, style: SignStyle, centreX: number, groundY: number): void {
    if (
      n === this.n &&
      style === this.style &&
      centreX === this.centreX &&
      groundY === this.groundY
    )
      return;
    this.n = n;
    this.style = style;
    this.centreX = centreX;
    this.groundY = groundY;
    this.draw();
  }

  /** The sign's fall during the film: 0 above the frame, 1 landed (with a bounce). */
  setDrop(progress: number): void {
    this.drop = clamp(progress, 0, 1);
    const eased = easeOutBack(this.drop);
    this.sign.y = Math.round(((1 - eased) * -140) / ART) * ART;
    this.sign.visible = this.drop > 0 && this.n > 0;
    this.sign.rotation = (1 - eased) * -0.2;
  }

  private draw(): void {
    const g = this.bowl;
    g.clear();
    const depth = craterDepth(this.n);
    const rows = Math.round(depth / ART);
    this.container.visible = this.n > 0;
    this.container.position.set(this.centreX, this.groundY);
    if (this.n <= 0) return;
    // The bowl, seen from above (the camera looks down on the yard): an ellipse round the
    // target's feet, half on the walkable surface and half in front of it, dark earth stepping
    // in, the glass sheen on its near side, the glassy rim along its far edge.
    const rx = HALF / ART;
    const ry = 2 + rows;
    const row = (dy: number, w: number, color: number) =>
      g.rect(-w * ART, dy * ART, 2 * w * ART, ART).fill(color);
    for (let dy = -ry; dy < ry; dy++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - ((dy + 0.5) / ry) ** 2)));
      if (w <= 0) continue;
      const color =
        dy < -ry + 1 ? GLASS_RIM : dy >= ry - 2 ? 0x3d7a6a : dy > 0 ? 0x2f1822 : 0x502f30;
      row(dy, w, color);
    }
    for (let x = -rx + 2; x < rx - 2; x += 5)
      if (hash(x * 3.1 + this.n) < 0.45) g.rect(x * ART, -ry * ART, 2 * ART, ART).fill(GLASS);
    // The glints along the rim, seeded.
    for (const [i, glint] of this.glints.entries()) {
      const x = (hash(i * 7.3 + 1) * 2 - 1) * (HALF - 10);
      glint.position.set(this.centreX + x, this.groundY - ART);
    }
    this.drawSign();
    this.setDrop(this.drop);
  }

  private drawSign(): void {
    const g = this.sign;
    g.clear();
    const board = BOARD[this.style];
    const x = SIGN_X;
    px(g, x + 1, 0, 2, board.post, TREE_TRUNK);
    const top = board.post;
    if (this.style === "plank") {
      px(g, x, top, board.w, board.h, STUMP_FACE);
      px(g, x, top, board.w, 1, TREE_TRUNK);
      px(g, x + 2, top + 1, 1, 1, STEEL_DARK);
      px(g, x + board.w - 3, top + 1, 1, 1, STEEL_DARK);
    } else if (this.style === "painted") {
      px(g, x, top, board.w, board.h, 0xe9e4d6);
      px(g, x, top, board.w, 1, 0xd8262b);
      px(g, x, top + board.h - 1, board.w, 1, 0xd8262b);
    } else {
      px(g, x, top, board.w, board.h, STEEL);
      px(g, x, top, board.w, 1, STEEL_DARK);
      px(g, x + 1, top + 1, 1, 1, STEEL_DARK);
      px(g, x + board.w - 2, top + 1, 1, 1, STEEL_DARK);
      px(g, x + 1, top + board.h - 2, 1, 1, STEEL_DARK);
      px(g, x + board.w - 2, top + board.h - 2, 1, 1, STEEL_DARK);
    }
    for (const [i, bulb] of this.bulbs.entries()) {
      bulb.visible = this.style === "lit";
      bulb.position.set(
        this.centreX + (x + 3 + i * ((board.w - 6) / 3)) * ART,
        this.groundY - (top + board.h + 1) * ART,
      );
      if (this.style === "lit")
        px(g, x + 3 + Math.round(i * ((board.w - 6) / 3)), top + board.h, 1, 1, BEACON);
    }
  }

  /** Once a frame: the glints at 0.3 × darkness, twinkling; the lit sign's bulbs blinking. */
  update(dt: number, darkness: number): void {
    this.time += dt;
    const shown = this.n > 0;
    for (const [i, glint] of this.glints.entries()) {
      const twinkle = 0.6 + 0.4 * Math.sin(this.time * (1.2 + i * 0.3) + i);
      glint.alpha = shown ? 0.3 * darkness * twinkle + 0.05 * twinkle : 0;
    }
    for (const [i, bulb] of this.bulbs.entries()) {
      const on = Math.floor(this.time * 2 + i) % 4 !== 0;
      bulb.alpha = shown && this.style === "lit" && this.drop >= 1 ? (on ? 0.8 : 0.2) : 0;
    }
  }
}
