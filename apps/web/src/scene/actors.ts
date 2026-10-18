/**
 * The hands (docs/redesign/02-the-run.md 9.1). A hand hired onto a line walks
 * from the house door to the line's plot in about 2 s (real time), a pop rises over them, and
 * from then on they work there: arms busy, facing their building. Hands already hired when the
 * island loads stand at work. Reduced motion: they fade in at the plot. Simple figures with a
 * hat colour each; a portrait pipeline can replace them without touching the behaviour.
 */
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { type SurvivorLook, survivorLook } from "../state/world";
import { CLOTHES, SKIN } from "./palette";
import { ART, frames } from "./pixel";
import { easeInOutSine, hash, reducedMotion, shade } from "./util";

interface Figure {
  container: Container;
  legs: [Graphics, Graphics];
  /** Back arm, front arm; they hang from the shoulder. */
  arms: [Graphics, Graphics];
  body: Container;
}

const TROUSERS = [0x3b3f45, 0x4a4035, 0x36403a, 0x44394a];
const HAIR = [0x2a1e14, 0x5a3a22, 0x8a6a3a, 0x1b1a18, 0x6e2e1e];
const BOOT = 0x2a211a;
const LEATHER = 0x6b4423;

/** A leg hanging from the hip (its origin): trouser, then a boot with the toe forward. */
function drawLeg(trousers: number, back: boolean): Graphics {
  const leg = new Graphics();
  const tone = back ? shade(trousers, -0.25) : trousers;
  leg.roundRect(-3.5, -1, 7, 17, 3).fill(tone);
  leg.roundRect(-3.5, 14, 11, 8, 3).fill(back ? shade(BOOT, -0.2) : BOOT);
  leg.rect(-3.5, 14, 7, 2).fill({ color: 0x000000, alpha: 0.25 });
  return leg;
}

/** An arm hanging from the shoulder (its origin): sleeve, cuff, hand. */
function drawArm(clothes: number, back: boolean, armband: boolean): Graphics {
  const arm = new Graphics();
  const tone = back ? shade(clothes, -0.28) : clothes;
  arm.roundRect(-3, -2, 6.5, 19, 3).fill(tone);
  arm.rect(-3, 13, 6.5, 3).fill(shade(tone, -0.2));
  arm.circle(0.3, 19, 3.2).fill(back ? shade(SKIN, -0.2) : SKIN);
  if (armband) {
    arm.rect(-3, 3, 6.5, 5).fill(0xf2efe8);
    arm.rect(-0.5, 3.6, 1.6, 3.8).fill(0xd23a2a).rect(-1.6, 4.7, 3.8, 1.6).fill(0xd23a2a);
  }
  return arm;
}

function drawHat(g: Graphics, style: number, color: number): void {
  const band = shade(color, -0.3);
  if (style === 0) {
    // Cap with the peak forward.
    g.moveTo(-9, -66)
      .quadraticCurveTo(-8, -77, 1, -77)
      .quadraticCurveTo(10, -76, 10, -66)
      .fill(color);
    g.roundRect(6, -68, 10, 3, 1.5).fill(band);
  } else if (style === 1) {
    // Beanie with a folded rim and a bobble.
    g.moveTo(-9, -65)
      .quadraticCurveTo(-8, -79, 1, -79)
      .quadraticCurveTo(10, -78, 10, -65)
      .fill(color);
    g.roundRect(-10, -68, 21, 5, 2).fill(band);
    g.circle(1, -80, 2.6).fill(shade(color, 0.25));
  } else {
    // Wide brim bush hat.
    g.moveTo(-7, -67)
      .quadraticCurveTo(-6, -78, 1, -78)
      .quadraticCurveTo(8, -78, 9, -67)
      .fill(color);
    g.rect(-7, -70, 16, 3).fill(band);
    g.roundRect(-14, -68, 30, 3.5, 1.75).fill(shade(color, -0.12));
  }
}

/** A Figure shell around a pixel hand's container (its limbs are never moved). */
function stubFigure(container: Container): Figure {
  const limb = () => new Graphics();
  return { container, legs: [limb(), limb()], arms: [limb(), limb()], body: new Container() };
}

function drawFigure(survivor: SurvivorLook): Figure {
  const container = new Container();
  const index = survivor.style;
  const clothes = CLOTHES[index % CLOTHES.length] ?? 0x4a5d6e;
  const trousers = TROUSERS[index % TROUSERS.length] ?? 0x3b3f45;
  const hair = HAIR[Math.floor(hash(index * 7.3) * HAIR.length)] ?? 0x2a1e14;
  const hatColor = Number.parseInt(survivor.hat.slice(1), 16);
  const has = (trait: string) => survivor.traits.includes(trait);

  const shadow = new Graphics().ellipse(1, 0, 15, 4).fill({ color: 0x000000, alpha: 0.28 });
  // Legs hang from the hip (their origin), so walking swings the feet, not the hips.
  const legBack = drawLeg(trousers, true);
  legBack.position.set(-2, -22);
  const legFront = drawLeg(trousers, false);
  legFront.position.set(3, -22);

  const body = new Container();
  const armBack = drawArm(clothes, true, false);
  armBack.position.set(-6, -47);
  const armFront = drawArm(clothes, false, has("medic"));
  armFront.position.set(6, -47);

  const pack = new Graphics();
  if (has("scavenger") || has("mule")) {
    const big = has("mule");
    pack.roundRect(big ? -21 : -18, big ? -54 : -49, big ? 13 : 10, big ? 30 : 22, 3).fill(LEATHER);
    pack.rect(big ? -21 : -18, big ? -46 : -42, big ? 13 : 10, 2.5).fill(shade(LEATHER, -0.3));
    if (big) pack.roundRect(-20, -60, 11, 7, 2).fill(0x8a7a5a);
  } else if (has("marksman")) {
    pack.moveTo(-15, -26).lineTo(-3, -62).stroke({ width: 3, color: 0x3a3530 });
    pack.moveTo(-14, -28).lineTo(-10, -40).stroke({ width: 4, color: LEATHER });
  }

  const torso = new Graphics();
  // Hips and jacket, lit from the left like the rest of the scene.
  torso.roundRect(-9, -26, 18, 7, 3).fill(trousers);
  torso
    .moveTo(-10, -46)
    .quadraticCurveTo(-10, -52, -4, -52)
    .lineTo(5, -52)
    .quadraticCurveTo(11, -52, 11, -46)
    .lineTo(10, -22)
    .lineTo(-10, -22)
    .closePath()
    .fill(clothes);
  torso
    .moveTo(5, -52)
    .quadraticCurveTo(11, -52, 11, -46)
    .lineTo(10, -22)
    .lineTo(5, -22)
    .closePath();
  torso.fill({ color: 0x000000, alpha: 0.16 });
  torso.moveTo(-3, -52).lineTo(1, -45).lineTo(5, -52).closePath().fill(shade(clothes, 0.18));
  torso.rect(1, -44, 1.2, 18).fill({ color: 0x000000, alpha: 0.2 });
  torso.roundRect(3, -38, 5, 5, 1).fill({ color: 0x000000, alpha: 0.12 });
  if (has("demolition")) {
    torso.rect(-10, -40, 20.5, 3).fill(0xe8a23a).rect(-10, -33, 20.2, 3).fill(0xe8a23a);
  }
  if (has("scavenger") || has("mule") || has("marksman")) {
    torso
      .moveTo(-8, -51)
      .lineTo(8, -25)
      .stroke({ width: 2.5, color: shade(LEATHER, -0.15) });
  }
  torso.rect(-10, -26, 20, 3.5).fill(0x2e2419);
  torso.rect(2, -26.5, 4, 4.5).fill(0xb8a15a);

  const head = new Graphics();
  head.rect(-2.5, -55, 6, 5).fill(shade(SKIN, -0.15));
  head.circle(1, -62, 9).fill(SKIN);
  // Hair stays inside the head's outline: the back of the head and a sideburn, under the hat.
  head
    .moveTo(-6.5, -56)
    .quadraticCurveTo(-8.6, -60, -7.6, -66)
    .quadraticCurveTo(-4, -71, 4, -70)
    .quadraticCurveTo(-1, -67, -2, -63)
    .quadraticCurveTo(-2.5, -58, -6.5, -56)
    .closePath()
    .fill(hair);
  head.circle(-3, -62, 2.2).fill(shade(SKIN, -0.12));
  head.circle(9.6, -60.5, 1.8).fill(shade(SKIN, -0.08));
  head.circle(5.2, -63, 1.3).fill(0x2a1e14);
  head.rect(3.6, -66.2, 3.5, 1.1).fill(shade(hair, -0.1));
  head.circle(6.5, -58.5, 1.7).fill({ color: 0xd8826a, alpha: 0.35 });
  drawHat(head, index % 3, hatColor);

  body.addChild(armBack, pack, torso, head, armFront);
  container.addChild(shadow, legBack, legFront, body);
  return { container, legs: [legBack, legFront], arms: [armBack, armFront], body };
}

/** Seconds a new hand takes from the door to the plot. */
const WALK_SECONDS = 2;
/** Figures are drawn about 80 units tall; a hand stands at their line's scale, a little smaller. */
const FIGURE_SCALE = 0.9;

export interface Post {
  x: number;
  y: number;
  scale: number;
  /** The building's centre: the hand faces it. */
  faceX: number;
}

/** A hand in pixel art: one sprite whose frame steps through the idle or walk cycle. */
interface PixelFigure {
  sprite: Sprite;
  idle: Texture[];
  walk: Texture[];
}

/** Frames a second of the pixel cycles (8 frames each: idle over 1.6 s, a walk over 0.9 s). */
const IDLE_FPS = 5;
const WALK_FPS = 9;

/** The survivor sheets (`hand/survivor_idle`, `hand/survivor_walk`, 4 × 2 cells), once loaded. */
function pixelFigure(): { container: Container; pixel: PixelFigure } | null {
  const idle = frames("hand/survivor_idle", 4, 2);
  const walk = frames("hand/survivor_walk", 4, 2);
  const first = idle[0];
  if (!first || walk.length === 0) return null;
  const sprite = new Sprite(first);
  const w = first.frame.width;
  sprite.anchor.set(Math.floor(w / 2) / w, 1);
  sprite.scale.set(ART);
  const container = new Container();
  container.addChild(sprite);
  return { container, pixel: { sprite, idle, walk } };
}

interface Hand {
  line: string;
  figure: Figure;
  /** Set when the hand is drawn in pixel art; `figure` then holds only its container. */
  pixel: PixelFigure | null;
  from: Post;
  to: Post;
  /** 0..1 along the walk; 1 at work. */
  walk: number;
  fade: number;
  phase: number;
}

export class Hands {
  private readonly hands = new Map<string, Hand>();
  private time = 0;

  /** `layer` is the island's sorted layer: hands stand in front of their buildings. */
  // The sky's birds are the crows you can catch (`gulls.ts`, D238): no decorative ones.
  constructor(private readonly layer: Container) {}

  /**
   * The hands on the island now: `posts` maps each manned line to where its hand works. New
   * ones walk out from `door` when `animate`; gone ones (a new run) leave at once. Returns the
   * lines whose hand just started walking.
   */
  sync(
    posts: ReadonlyMap<string, { hand: string; post: Post }>,
    door: Post,
    animate: boolean,
  ): string[] {
    const started: string[] = [];
    for (const [line, hand] of this.hands) {
      if (posts.has(line)) continue;
      hand.figure.container.destroy({ children: true });
      this.hands.delete(line);
    }
    for (const [line, { hand: crew, post }] of posts) {
      const existing = this.hands.get(line);
      if (existing) {
        existing.to = post;
        continue;
      }
      const art = pixelFigure();
      const figure = art ? stubFigure(art.container) : drawFigure(survivorLook(crew));
      this.layer.addChild(figure.container);
      const walking = animate && !reducedMotion();
      this.hands.set(line, {
        line,
        figure,
        pixel: art?.pixel ?? null,
        from: walking ? door : post,
        to: post,
        walk: walking ? 0 : 1,
        fade: animate && !walking ? 0 : 1,
        phase: hash(line.length * 3.7 + crew.length) * 6,
      });
      if (animate) started.push(line);
    }
    return started;
  }

  /** Where a hand is now (world units), for the pop over their head. */
  headOf(line: string): { x: number; y: number } | null {
    const hand = this.hands.get(line);
    if (!hand) return null;
    const c = hand.figure.container;
    // A pixel hand is about 24 art px tall; the stand-in figure 90 units at its scale.
    return { x: c.x, y: c.y - (hand.pixel ? 26 * ART : 90 * c.scale.y) };
  }

  update(dt: number): void {
    this.time += dt;
    for (const hand of this.hands.values()) {
      const { figure } = hand;
      hand.walk = Math.min(1, hand.walk + dt / WALK_SECONDS);
      hand.fade = Math.min(1, hand.fade + dt / 0.4);
      const t = easeInOutSine(hand.walk);
      const x = hand.from.x + (hand.to.x - hand.from.x) * t;
      const y = hand.from.y + (hand.to.y - hand.from.y) * t;
      const scale = (hand.from.scale + (hand.to.scale - hand.from.scale) * t) * FIGURE_SCALE;
      const walking = hand.walk < 1;
      const facing = walking
        ? hand.to.x >= hand.from.x
          ? 1
          : -1
        : hand.to.faceX >= hand.to.x
          ? 1
          : -1;
      figure.container.zIndex = y + 0.5;
      figure.container.alpha = hand.fade;
      if (hand.pixel) {
        // On the grid: whole art pixels, never scaled, mirrored to face the work.
        figure.container.position.set(Math.round(x / ART) * ART, Math.round(y / ART) * ART);
        figure.container.scale.set(facing, 1);
        const cycle = walking ? hand.pixel.walk : hand.pixel.idle;
        const fps = walking ? WALK_FPS : IDLE_FPS;
        const frame = cycle[Math.floor((this.time + hand.phase) * fps) % cycle.length];
        if (frame) hand.pixel.sprite.texture = frame;
        continue;
      }
      figure.container.position.set(x, y);
      figure.container.scale.set(scale * facing, scale);
      const clock = this.time * 11 + hand.phase;
      if (walking) {
        const step = Math.sin(clock);
        figure.legs[0].rotation = step * 0.5;
        figure.legs[1].rotation = -step * 0.5;
        figure.arms[0].rotation = -step * 0.45;
        figure.arms[1].rotation = step * 0.45;
        figure.body.y = Math.abs(Math.cos(clock)) * -2;
        figure.body.rotation = 0;
      } else {
        // At work: a steady two-handed rhythm.
        const beat = this.time * 7 + hand.phase;
        figure.legs[0].rotation = 0;
        figure.legs[1].rotation = 0;
        figure.body.rotation = Math.sin(beat) * 0.08;
        figure.arms[1].rotation = -1.3 + Math.sin(beat) * 0.7;
        figure.arms[0].rotation = -0.5 + Math.sin(beat) * 0.3;
        figure.body.y = 0;
      }
    }
  }
}
