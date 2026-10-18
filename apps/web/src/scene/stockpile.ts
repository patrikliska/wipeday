/**
 * The stockpile (docs/redesign/12-feel.md 3.1, D217): every tap chips a piece off the target, a
 * log, a stone, a nugget, a lump of sulfur, a hull plate, that arcs onto a pallet at the
 * target's foot and stays there. The counter has already credited it; the pile is the picture
 * of it. A full pile sells its top piece for each new one (it hops and turns into coins), and a
 * pile left alone is carted off a piece at a time, so tapping is what keeps it high.
 *
 * Everything sits on the art grid (D188): the pallet and the pieces are pixel sprites at the
 * grid's scale, the slots are whole art pixels, and a piece in flight is snapped to the grid
 * each frame. Reduced motion: pieces appear in their slot and leave without the hop.
 */
import { Container, type Sprite, type Texture } from "pixi.js";
import type { Particles } from "./effects";
import { ART, art, artSprite } from "./pixel";
import { clamp, hash, reducedMotion } from "./util";

/** A slot on the pallet: the piece's bottom centre, in art px from the pallet's left foot. */
export interface Slot {
  x: number;
  y: number;
}

/** The pallet is 15 × 5 art px; pieces stand on its deck (5 px up). */
const PALLET_W = 15;
const DECK = 5;
/** Rows of the pyramid, bottom first: the centres across, and how far each row climbs. */
const ROWS: readonly (readonly number[])[] = [
  [1, 5, 9, 13],
  [3, 7, 11],
  [5, 9],
];
const ROW_STEP = 3;

/**
 * The pile's slots in filling order (bottom row left to right, then up), each nudged a pixel
 * across and, above the bottom row, a pixel down by a fixed hash, so the heap is tumbled, not
 * a brick pyramid. Whole art pixels.
 */
export function pileSlots(): Slot[] {
  const slots: Slot[] = [];
  ROWS.forEach((row, r) => {
    row.forEach((x, i) => {
      const across = Math.round((hash(r * 5 + i * 11 + 1) - 0.5) * 2.4);
      const down = r > 0 && hash(r * 7 + i * 3) < 0.45 ? 1 : 0;
      slots.push({ x: x + across - Math.floor(PALLET_W / 2), y: -DECK - r * ROW_STEP + down });
    });
  });
  return slots;
}

const SLOTS = pileSlots();
export const PILE_CAP = SLOTS.length;

/** Seconds a chip takes from the target to the pile; the arc's height (art px). */
const FLIGHT = 0.36;
const ARC = 12;
/** A pile left alone this long starts to be carted off, a piece every `CART_EVERY` s. */
const IDLE_BEFORE_CART = 6;
const CART_EVERY = 2.5;
/** A sold piece hops this high (art px) over this long, then vanishes in a few coins. */
const SOLD = 0.28;
const HOP = 3;
/** At most this many pieces in the air; more land at once (an autoclicker's flood). */
const MAX_FLYING = 14;

interface Flying {
  sprite: Sprite;
  fromX: number;
  fromY: number;
  age: number;
  /** The slot it lands in, or -1: the pile was full, it sells on landing. */
  slot: number;
}

interface Leaving {
  sprite: Sprite;
  x: number;
  y: number;
  age: number;
}

const snap = (value: number): number => Math.round(value / ART) * ART;

export class Stockpile {
  /** In the world, in front of the target (the scene sorts it with the props). */
  readonly container = new Container();
  private readonly pieces = new Container();
  private readonly pile: Sprite[] = [];
  private readonly flying: Flying[] = [];
  private readonly leaving: Leaving[] = [];
  private texture: Texture | null = null;
  private time = 0;
  private lastLanded = -Infinity;
  private lastCarted = 0;
  /** Slots promised to pieces still in the air. */
  private reserved = 0;

  /** The pallet: laid down by the run's first chip, so the first screen is only the target. */
  private pallet: Sprite | null = null;

  constructor(private readonly particles: Particles) {
    this.container.addChild(this.pieces);
  }

  /** A new run: no pile and no pallet until the first chip. */
  reset(): void {
    this.clear();
    if (this.pallet) this.pallet.visible = false;
  }

  private layPallet(): void {
    if (!this.pallet) {
      this.pallet = artSprite("prop/pallet");
      if (this.pallet) this.container.addChildAt(this.pallet, 0);
    }
    if (this.pallet) this.pallet.visible = true;
  }

  /** The pile's foot (stage units, on the grid). */
  place(x: number, y: number): void {
    this.container.position.set(snap(x), snap(y));
    this.container.zIndex = y + 1;
  }

  /** Pieces from now on are chips of `kind`; with `animate`, the old pile is sold off at once. */
  setKind(kind: string, animate: boolean): void {
    const texture = art(`chip/${kind}`);
    if (texture === this.texture) return;
    this.texture = texture;
    this.clear(animate);
  }

  /** Empties the pile: with `animate` every piece hops off as coins, else they just go. */
  clear(animate = false): void {
    for (const f of this.flying) f.sprite.destroy();
    this.flying.length = 0;
    this.reserved = 0;
    while (this.pile.length > 0) this.sell(animate);
  }

  get count(): number {
    return this.pile.length;
  }

  /** `count` taps landed: each chips a piece off at world (x, y) toward the pile. */
  chip(x: number, y: number, count = 1): void {
    if (!this.texture) return;
    this.layPallet();
    for (let i = 0; i < count; i++) {
      const sprite = this.pieceSprite(this.pile.length + this.reserved + i);
      if (!sprite) return;
      const free = this.pile.length + this.reserved < PILE_CAP;
      const slot = free ? this.pile.length + this.reserved : -1;
      if (free) this.reserved += 1;
      const flight: Flying = { sprite, fromX: x, fromY: y, age: 0, slot };
      if (reducedMotion() || this.flying.length >= MAX_FLYING) this.land(flight);
      else {
        this.pieces.addChild(sprite);
        this.flying.push(flight);
        this.fly(flight);
      }
    }
  }

  private pieceSprite(n: number): Sprite | null {
    if (!this.texture) return null;
    const sprite = artSprite("", this.texture);
    if (!sprite) return null;
    // Pieces lie either way round (a log's cut end left or right), fixed per slot.
    if (hash(n * 3.7 + 2) < 0.5) sprite.scale.x = -ART;
    return sprite;
  }

  /** Where slot `n` is, in the pile's own units. */
  private slotPoint(n: number): { x: number; y: number } {
    const slot = SLOTS[clamp(n, 0, PILE_CAP - 1)] ?? { x: 0, y: -DECK };
    return { x: slot.x * ART, y: slot.y * ART };
  }

  private fly(f: Flying): void {
    const t = clamp(f.age / FLIGHT, 0, 1);
    const to = this.slotPoint(f.slot < 0 ? PILE_CAP - 1 : f.slot);
    const fromX = f.fromX - this.container.x;
    const fromY = f.fromY - this.container.y;
    const x = fromX + (to.x - fromX) * t;
    const lift = ARC * ART + Math.max(0, fromY - to.y) * 0.25;
    const y = fromY + (to.y - fromY) * t - Math.sin(t * Math.PI) * lift;
    f.sprite.position.set(snap(x), snap(y));
    // A tumble on the grid: the piece flips as it turns over, no rotation off the grid.
    f.sprite.scale.y = Math.floor(f.age / 0.09) % 2 === 1 ? -ART : ART;
    f.sprite.anchor.y = f.sprite.scale.y < 0 ? 0 : 1;
  }

  private land(f: Flying): void {
    f.sprite.scale.y = ART;
    f.sprite.anchor.y = 1;
    this.lastLanded = this.time;
    if (f.slot < 0) {
      // A full pile: the piece lands on top and sells straight away.
      const top = this.slotPoint(PILE_CAP - 1);
      f.sprite.position.set(top.x, top.y - 2 * ART);
      this.pieces.addChild(f.sprite);
      this.depart(f.sprite, true);
      return;
    }
    this.reserved = Math.max(0, this.reserved - 1);
    const point = this.slotPoint(this.pile.length);
    f.sprite.position.set(point.x, point.y);
    this.pieces.addChild(f.sprite);
    this.pile.push(f.sprite);
  }

  /** The top piece goes: a hop and a couple of coins ("sold"), or straight off. */
  private sell(animate: boolean): void {
    const sprite = this.pile.pop();
    if (!sprite) return;
    this.depart(sprite, animate);
  }

  private depart(sprite: Sprite, animate: boolean): void {
    if (!animate || reducedMotion()) {
      sprite.destroy();
      return;
    }
    this.leaving.push({ sprite, x: sprite.x, y: sprite.y, age: 0 });
  }

  update(dt: number): void {
    this.time += dt;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      if (!f) continue;
      f.age += dt;
      if (f.age >= FLIGHT) {
        this.flying.splice(i, 1);
        this.land(f);
      } else this.fly(f);
    }
    // Left alone, the pile is carted off a piece at a time.
    const idle = this.time - this.lastLanded;
    if (
      this.pile.length > 0 &&
      idle > IDLE_BEFORE_CART &&
      this.time - this.lastCarted > CART_EVERY
    ) {
      this.lastCarted = this.time;
      this.sell(true);
    }
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const l = this.leaving[i];
      if (!l) continue;
      l.age += dt;
      const t = l.age / SOLD;
      l.sprite.y = l.y - Math.round(Math.sin(Math.min(1, t) * Math.PI * 0.5) * HOP) * ART;
      if (t >= 1) {
        this.particles.spawn(
          "coins",
          this.container.x + l.x,
          this.container.y + l.sprite.y - 2 * ART,
          2,
        );
        l.sprite.destroy();
        this.leaving.splice(i, 1);
      }
    }
  }
}
