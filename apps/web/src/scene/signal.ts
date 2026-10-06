/**
 * The Signal in the scene (W7): the island's shared tower, raised on the slope behind the
 * holdfast as the season's last week fills it. Each stage shows: a stone footing, the
 * lattice, the lamp house, and, lit, a turning beam on the lights layer (D47). It appears
 * once the Signal opens; tapping it opens the Signal panel.
 */
import { Container, Graphics, Sprite } from "pixi.js";
import { glowTexture } from "./textures";
import { clamp } from "./util";

const STONE = 0x7d8288;
const STEEL = 0x9aa0a6;
const STEEL_DARK = 0x5d6064;
const LAMP = 0xffe08a;

/** `stage`: stages filled (0 = an empty plot with a flag). */
function drawTower(stage: number): Graphics {
  const g = new Graphics();
  g.ellipse(0, 2, 46, 6).fill({ color: 0x000000, alpha: 0.2 });
  if (stage === 0) {
    // A staked plot and a flag: the Signal goes here.
    g.rect(-30, -4, 60, 4).fill(0x5a3d26);
    g.rect(-1, -70, 3, 70).fill(0x5a3d26).poly([2, -70, 26, -63, 2, -56]).fill(0xffd25a);
    return g;
  }
  // The footing.
  g.moveTo(-40, 0).lineTo(-32, -34).lineTo(32, -34).lineTo(40, 0).closePath().fill(STONE);
  for (let y = -28; y < 0; y += 9) g.rect(-38, y, 76, 2).fill({ color: 0x5d6064, alpha: 0.6 });
  if (stage >= 2) {
    // The lattice, tapering to the lamp deck.
    const top = -230;
    g.moveTo(-26, -34)
      .lineTo(-8, top)
      .lineTo(8, top)
      .lineTo(26, -34)
      .stroke({ width: 4, color: STEEL });
    for (let y = -34; y > top + 10; y -= 26) {
      const k = (y - top) / (-34 - top);
      const next = (y - 26 - top) / (-34 - top);
      g.moveTo(-8 - 18 * k, y)
        .lineTo(8 + 18 * next, y - 26)
        .moveTo(8 + 18 * k, y)
        .lineTo(-8 - 18 * next, y - 26);
    }
    g.stroke({ width: 1.6, color: STEEL_DARK });
    g.rect(-16, top - 4, 32, 5).fill(STEEL_DARK);
  }
  if (stage >= 3) {
    // The lamp house.
    g.roundRect(-11, -262, 22, 28, 4).fill(0x2a3440).stroke({ width: 2, color: STEEL });
    g.moveTo(-14, -262).lineTo(0, -278).lineTo(14, -262).closePath().fill(STEEL_DARK);
    g.rect(-7, -256, 14, 16).fill(stage >= 4 ? LAMP : 0x46505a);
  }
  return g;
}

export class SignalTower {
  readonly container = new Container();
  /** The lamp and its beam: add to the lights layer at the same position. */
  readonly light = new Container();
  private readonly glow: Sprite;
  private readonly beam = new Graphics();
  private drawn: Graphics | null = null;
  private stage = -1;
  private lit = false;
  private shown = false;
  private time = 0;

  constructor(x: number, y: number, onTap: () => void) {
    this.container.position.set(x, y);
    this.container.eventMode = "static";
    this.container.cursor = "pointer";
    this.container.hitArea = {
      contains: (px: number, py: number) => Math.abs(px) < 60 && py < 10 && py > -290,
    };
    this.container.on("pointertap", onTap);
    this.glow = new Sprite(glowTexture());
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.glow.tint = LAMP;
    this.glow.width = 220;
    this.glow.height = 220;
    this.glow.position.set(0, -248);
    this.light.addChild(this.beam, this.glow);
    this.light.position.set(x, y);
    this.container.visible = false;
    this.light.visible = false;
  }

  /** `stage`: stages filled; `lit`: the last one is; `shown`: the Signal is open or begun. */
  set(stage: number, lit: boolean, shown: boolean): void {
    this.shown = shown;
    this.lit = lit;
    const draw = lit ? 4 : Math.min(stage, 3);
    if (draw === this.stage) return;
    this.stage = draw;
    this.drawn?.destroy();
    this.drawn = drawTower(draw);
    this.container.addChild(this.drawn);
  }

  update(dt: number, darkness: number): void {
    this.time += dt;
    this.container.visible = this.shown;
    this.light.visible = this.shown && this.lit;
    if (!this.shown || !this.lit) return;
    this.glow.alpha = clamp(0.45 + darkness * 0.55, 0, 1) * (0.9 + 0.1 * Math.sin(this.time * 4));
    // A sweeping beam out over the sea.
    const angle = Math.sin(this.time * 0.6) * 0.5 - Math.PI * 0.95;
    const reach = 520;
    this.beam.clear();
    this.beam
      .moveTo(0, -248)
      .lineTo(Math.cos(angle - 0.06) * reach, -248 + Math.sin(angle - 0.06) * reach)
      .lineTo(Math.cos(angle + 0.06) * reach, -248 + Math.sin(angle + 0.06) * reach)
      .closePath()
      .fill({ color: LAMP, alpha: 0.08 + darkness * 0.18 });
  }
}
