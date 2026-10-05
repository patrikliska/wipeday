/**
 * The Den's skiff (W5): once the smugglers deal with the holdfast, their boat is
 * pulled up on the beach, below where the barrels wash in. Tapping it opens the Den
 * (on phones it is the way in, with the map's marker). A lantern on its post lights
 * the night (drawn on the lights layer, D47), and it glows like the barrel when the
 * Den has a contract the base can fill. Origin at the keel on the sand; it lies bow to the
 * sea, beside the barrel, high enough on the beach to clear the desktop dock.
 */
import { Container, Graphics, Sprite } from "pixi.js";
import { SAND } from "./palette";
import { glowTexture } from "./textures";
import { clamp, shade } from "./util";

const HULL = 0x3e4a4f;
const HULL_TRIM = 0x8a5a34;
const CANVAS = 0xcfc3a3;
const PENNANT = 0xc0607f;
const LANTERN = 0xffc45a;
/** Smallest tap target on screen, in CSS px (D48). */
const MIN_TAP = 64;

/** Drawn a quarter bigger than the barrel's scale, so it reads at phone size. */
const SCALE = 1.25;

function drawSkiff(): Container {
  const root = new Container();
  const g = new Graphics();
  // Shadow, then the hull: a low, beamy boat seen side-on, bow to the right, stern square.
  g.ellipse(4, 2, 72, 7).fill({ color: 0x000000, alpha: 0.22 });
  g.moveTo(-62, -34)
    .lineTo(52, -34)
    .quadraticCurveTo(72, -34, 78, -50)
    .lineTo(72, -28)
    .quadraticCurveTo(58, -2, 30, 0)
    .lineTo(-50, 0)
    .quadraticCurveTo(-60, -2, -62, -12)
    .closePath()
    .fill(HULL);
  // A lighter strake under the gunwale and the planking lines: it reads as wood, not a slab.
  g.moveTo(-62, -34)
    .lineTo(52, -34)
    .quadraticCurveTo(72, -34, 78, -50)
    .lineTo(76, -42)
    .quadraticCurveTo(66, -27, 50, -26)
    .lineTo(-62, -26)
    .closePath()
    .fill(shade(HULL, 0.22));
  g.moveTo(-60, -16)
    .quadraticCurveTo(10, -12, 60, -18)
    .stroke({ width: 1.4, color: shade(HULL, -0.35) });
  g.moveTo(-62, -34)
    .lineTo(52, -34)
    .quadraticCurveTo(72, -34, 78, -50)
    .stroke({ width: 3.5, color: HULL_TRIM });
  g.rect(-62, -34, 5, 26).fill(shade(HULL, -0.3));
  // The mast is unstepped on the beach: it lies along the thwarts with the sail furled on it.
  g.roundRect(-46, -44, 104, 6, 3).fill(shade(HULL_TRIM, -0.15));
  g.roundRect(-36, -50, 70, 10, 5).fill(CANVAS);
  for (const x of [-26, -10, 6, 22]) g.rect(x, -51, 2.5, 12).fill(shade(CANVAS, -0.35));
  // A crate with the Den's mark, and a coil of rope in the bow.
  g.rect(36, -56, 24, 20).fill(0x9a7448).stroke({ width: 1.4, color: 0x5a3d26 });
  g.circle(48, -46, 4.5).stroke({ width: 2, color: PENNANT });
  // The lantern post just inside the stern, flying the Den's pennant; the light is on the
  // lights layer.
  g.rect(-44, -96, 3.5, 62).fill(shade(HULL_TRIM, -0.3));
  g.rect(-49, -82, 12, 3).fill(shade(HULL_TRIM, -0.3));
  g.roundRect(-47, -79, 8, 11, 2).fill(0x2a2d31);
  g.rect(-45, -77, 4, 7).fill(LANTERN);
  g.poly([-41, -96, -14, -90, -41, -83]).fill(PENNANT);
  g.poly([-41, -90, -26, -90, -41, -83]).fill(shade(PENNANT, -0.35));
  // Sand drifted up the lee of the hull.
  g.moveTo(-72, 3)
    .quadraticCurveTo(-30, -8, 20, -5)
    .quadraticCurveTo(52, -4, 74, 3)
    .quadraticCurveTo(0, 7, -72, 3)
    .closePath()
    .fill(SAND);
  root.addChild(g);
  // Drawn bow-right; it lies bow to the sea, so the lantern and pennant face the holdfast.
  root.scale.set(-SCALE, SCALE);
  return root;
}

export class Skiff {
  readonly container = new Container();
  /** The lantern's light: add to the scene's lights layer at the same position. */
  readonly light = new Container();
  private readonly glow: Sprite;
  private readonly lantern: Sprite;
  private time = 0;
  private appear = 0;
  private target = 0;
  private calling = false;
  private tap = 60;

  constructor(x: number, y: number, onTap: () => void) {
    this.glow = new Sprite(glowTexture());
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.glow.tint = 0xffd25a;
    this.glow.width = 220;
    this.glow.height = 160;
    this.glow.y = -40;
    this.glow.alpha = 0;
    this.container.addChild(this.glow, drawSkiff());
    this.container.position.set(x, y);
    this.container.eventMode = "static";
    this.container.cursor = "pointer";
    this.container.hitArea = {
      contains: (px: number, py: number) =>
        Math.abs(px) < Math.max(90, this.tap) && py < 10 && py > -Math.max(120, this.tap * 2),
    };
    this.container.on("pointertap", onTap);
    this.container.visible = false;

    this.lantern = new Sprite(glowTexture());
    this.lantern.anchor.set(0.5);
    this.lantern.blendMode = "add";
    this.lantern.tint = LANTERN;
    this.lantern.width = 150;
    this.lantern.height = 150;
    this.lantern.position.set(43 * SCALE, -73 * SCALE);
    this.light.addChild(this.lantern);
    this.light.position.set(x, y);
  }

  /** `open`: the Den deals with the base. `calling`: a contract is ready to fill. */
  set(open: boolean, calling: boolean): void {
    this.target = open ? 1 : 0;
    this.calling = calling;
  }

  /** `scale`: world-to-screen, so the tap target never shrinks below `MIN_TAP` px. */
  update(dt: number, darkness: number, scale: number): void {
    this.time += dt;
    // It is either moored or not: a short fade, never a ghost on a slow frame.
    this.appear += (this.target - this.appear) * Math.min(1, dt * 8);
    const shown = this.appear > 0.02;
    this.container.visible = shown;
    this.light.visible = shown;
    if (!shown) return;
    this.tap = MIN_TAP / 2 / Math.max(0.1, scale);
    this.container.alpha = clamp(this.appear, 0, 1);
    this.glow.alpha = this.calling ? 0.18 + 0.12 * Math.sin(this.time * 3) : 0;
    // The lantern flickers a little and only matters once the light goes.
    this.lantern.alpha =
      clamp(darkness * 1.6 - 0.15, 0, 1) * (0.85 + 0.15 * Math.sin(this.time * 7.3)) * this.appear;
  }
}
