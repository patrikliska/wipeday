/**
 * The house's room (owner, 2026-10-18; D206): tapping the house opens a cut-away of its inside,
 * where the crafting lines (loom, workbench, furnace, tannery, press) work with their hands. It
 * is drawn in screen space at the island's zoom, so its art pixels match the island's, and sits
 * over the dimmed island until the player goes back (the back button, Escape, a tap outside).
 *
 * The room's art is `room/<tier>` (the cabin's inside, the stone workshop's...); until a tier
 * has it, a plank room in the palette's colours stands in, as the island's stand-ins do.
 */
import { Container, Graphics } from "pixi.js";
import type { Tier } from "../state/world";
import { Particles } from "./effects";
import { ROOM } from "./island";
import { ART, artSprite } from "./pixel";

/** The stand-in room's colours (packages/content/art/palette.json). */
const WOOD = { wall: 0x6e5640, seam: 0x502f30, dark: 0x40372f, floor: 0x513e2f, edge: 0x2f1822 };
const GLASS = 0x1d565e;
const LAMP = 0xf5cf81;

function block(g: Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.rect(x * ART, y * ART, w * ART, h * ART).fill(color);
}

/** The stand-in: plank walls and floor, a window and a lamp, a dark frame (the cut-away's edge). */
function drawStandIn(): Graphics {
  const g = new Graphics();
  const { width: w, height: h, floor } = ROOM;
  block(g, 0, 0, w, h, WOOD.edge);
  block(g, 2, 2, w - 4, floor - 2, WOOD.wall);
  for (let y = 8; y < floor; y += 7) block(g, 2, y, w - 4, 1, WOOD.seam);
  for (let x = 14; x < w - 2; x += 23) block(g, x, 2, 1, floor - 2, WOOD.dark);
  block(g, 2, floor, w - 4, h - floor - 2, WOOD.floor);
  block(g, 2, floor, w - 4, 1, WOOD.edge);
  // A window with the sea in it, and a lamp hanging from the beam.
  block(g, 58, 12, 16, 12, WOOD.edge);
  block(g, 59, 13, 14, 10, GLASS);
  block(g, 65, 13, 1, 10, WOOD.edge);
  block(g, 92, 2, 1, 10, WOOD.edge);
  block(g, 90, 12, 5, 4, LAMP);
  return g;
}

export class Room {
  /** Screen space: the scene places and scales it (`place`). */
  readonly container = new Container();
  /** The room's things, sorted back to front: the lines and their hands. */
  readonly props = new Container();
  /** Glows above the room (the lines' fires). */
  readonly lights = new Container();
  readonly particles = new Particles();
  private readonly backdrop = new Container();
  private tier: Tier | null = null;

  constructor() {
    this.props.sortableChildren = true;
    this.container.addChild(this.backdrop, this.props, this.particles.container, this.lights);
    this.container.visible = false;
  }

  /** The room for the house's tier: its art, or the stand-in. */
  setTier(tier: Tier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    for (const child of this.backdrop.removeChildren()) child.destroy({ children: true });
    const sprite = artSprite(`room/${tier}`);
    if (sprite) {
      // The cut-away's edge: a dark frame two art pixels round the room's art.
      const frame = new Graphics();
      block(frame, -2, -2, ROOM.width + 4, ROOM.height + 4, WOOD.edge);
      sprite.anchor.set(0, 0);
      this.backdrop.addChild(frame, sprite);
    } else this.backdrop.addChild(drawStandIn());
  }

  /** Its size on screen at `scale` (CSS px per stage unit). */
  size(scale: number): { width: number; height: number } {
    return { width: ROOM.width * ART * scale, height: ROOM.height * ART * scale };
  }

  /** Puts the room's top-left at (x, y) on screen at the island's zoom. */
  place(x: number, y: number, scale: number): void {
    this.container.position.set(x, y);
    this.container.scale.set(scale);
  }

  update(dt: number, wind: number): void {
    this.particles.update(dt, wind);
  }
}
