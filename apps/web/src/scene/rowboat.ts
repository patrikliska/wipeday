/**
 * The rowboat on blocks (docs/redesign/03-the-big-red.md 7.1, 9.2; D270): the escape plan,
 * visible all along at the camp's left edge (`prop/rowboat`, or a plank hull until the art
 * lands). The crew scramble into it for the launch, and after the blast it "paddles" back in
 * across the dry ground with the new run's hands aboard: the wasteland's standing joke. The
 * cinematic and the landing move it with `setMotion`; `endMotion` puts it back on its blocks.
 */
import { Container, Graphics } from "pixi.js";
import { DIRT, STUMP_FACE, TREE_TRUNK } from "./palette";
import { ART, artSprite } from "./pixel";

/** A rect of art pixels, `y` rows up from the feet. */
function px(g: Graphics, x: number, y: number, w: number, h: number, color: number): Graphics {
  return g.rect(x * ART, -(y + h) * ART, w * ART, h * ART).fill(color);
}

export class Rowboat {
  readonly container = new Container();
  private rest = { x: 0, y: 0 };
  private moving = false;

  constructor() {
    const art = artSprite("prop/rowboat");
    if (art) this.container.addChild(art);
    else {
      const g = new Graphics();
      px(g, -7, 0, 2, 2, TREE_TRUNK);
      px(g, 5, 0, 2, 2, TREE_TRUNK);
      px(g, -8, 2, 16, 3, DIRT);
      px(g, -7, 5, 14, 1, STUMP_FACE);
      px(g, -8, 2, 1, 3, 0x6b8fb0);
      px(g, 7, 2, 1, 3, 0x6b8fb0);
      px(g, -4, 6, 9, 1, TREE_TRUNK);
      this.container.addChild(g);
    }
  }

  /** Its blocks (stage units, on the grid). */
  place(x: number, y: number): void {
    this.rest = { x: Math.round(x / ART) * ART, y: Math.round(y / ART) * ART };
    if (!this.moving) {
      this.container.position.set(this.rest.x, this.rest.y);
      this.container.zIndex = this.rest.y;
    }
  }

  get spot(): { x: number; y: number } {
    return { ...this.rest };
  }

  /** The boat somewhere else: the landing's paddle-in, the scramble's rocking. */
  setMotion(x: number, y: number, rotation = 0): void {
    this.moving = true;
    this.container.position.set(Math.round(x / ART) * ART, Math.round(y / ART) * ART);
    this.container.rotation = rotation;
  }

  endMotion(): void {
    this.moving = false;
    this.container.rotation = 0;
    this.container.position.set(this.rest.x, this.rest.y);
    this.container.zIndex = this.rest.y;
  }
}
