/**
 * Supply Drops waiting to be opened (12-feel.md 7.1; D261): crates by the house, one sprite per
 * tier (`prop/drop_<tier>`), the highest tier in front, at most three drawn and a count on the
 * button when more wait. They stand in the world, on the ground between the stockpile and the
 * house; the tap area is a DOM button kept over them at a fixed screen size (D48), and the count
 * is DOM text (D46). A crate that lands drops in and bounces; an opened one lifts off and fades.
 *
 * What stands there is the state's `meta.drops.held`, never the page's: a reload or a second
 * tab shows the same crates. A tap opens the top tier through `open`, which sends `open_drop`.
 *
 * The hint ("A Supply Drop! Tap the crate to open it.") shows until two drops were ever opened,
 * and waits while the airdrop's hint is up (one hint at a time, D254).
 */
import type { DropTier } from "@wipe-day/content/cards";
import { heldDrops, topTier } from "@wipe-day/domain/cards";
import type { BaseState } from "@wipe-day/domain/state";
import { Container, Graphics, type Sprite } from "pixi.js";
import { t } from "../state/world";
import { DIRT, STUMP_FACE, TREE_TRUNK } from "./palette";
import { ART, artSprite } from "./pixel";
import { clamp, easeOutBack, easeOutCubic, lerp, reducedMotion } from "./util";

/** On screen (CSS px): the tap area, at least the 44 px floor with air round the crates. */
const HIT = 64;
/** The hint retires after this many drops opened. */
const HINT_OPENS = 2;
/** A landing crate's fall (ms), and an opened one's lift. */
const LAND_MS = 520;
const LIFT_MS = 420;
/** Where the second and third crates stand behind the front one (art px). */
const STACK: readonly { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: -4, y: -3 },
  { x: 5, y: -5 },
];
/** The placeholder crate's size (art px) until the art is installed. */
const PLACEHOLDER = { w: 12, h: 10 };

export class Crates {
  /** In the world, on the ground: the scene sorts it with the props. */
  readonly container = new Container();
  /** The tap area over the stack, with the count when more than one waits. */
  readonly button: HTMLButtonElement;
  readonly hint: HTMLDivElement;
  private readonly count: HTMLSpanElement;
  private readonly stack = new Container();
  private sprites: Container[] = [];
  private ghost: Container | null = null;
  private held: Record<DropTier, number> = { 1: 0, 2: 0, 3: 0 };
  private total = -1;
  private landedAt = -Infinity;
  private liftedAt = -Infinity;
  private nowMs = 0;
  private box = { x: 0, y: 0, width: 0, height: 0 };
  private key = "";

  constructor(
    private readonly on: {
      /** The player tapped the crates: open one of `tier`. */
      open: (tier: DropTier) => void;
      /** Another hint is up (the airdrop's): this one waits. */
      quiet?: () => boolean;
    },
  ) {
    this.container.addChild(this.stack);
    this.container.visible = false;

    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "crate-hit";
    this.button.hidden = true;
    this.count = document.createElement("span");
    this.count.className = "crate-count num";
    this.count.hidden = true;
    this.button.appendChild(this.count);
    this.button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();
      event.stopPropagation();
      this.open();
    });
    this.button.addEventListener("click", (event) => {
      if (event.detail === 0) this.open();
    });
    this.button.addEventListener("contextmenu", (event) => event.preventDefault());

    this.hint = document.createElement("div");
    this.hint.className = "plate crate-hint";
    this.hint.setAttribute("role", "status");
    this.hint.hidden = true;
  }

  /** The tap area on screen while a crate waits (the shots' 44 px audit). */
  get hitBox(): { x: number; y: number; width: number; height: number } | null {
    return this.button.hidden ? null : { ...this.box };
  }

  /** The stack's foot (stage units, on the grid). */
  place(x: number, y: number): void {
    this.container.position.set(Math.round(x / ART) * ART, Math.round(y / ART) * ART);
    this.container.zIndex = y + 2;
  }

  private open(): void {
    const tier = topTier({ held: this.held } as BaseState["meta"]["drops"]);
    if (tier !== null) this.on.open(tier);
  }

  /** A crate of `tier`: its art, or a plank box in the palette until the art is installed. */
  private crate(tier: DropTier): Container {
    const sprite = artSprite(`prop/drop_${tier}`);
    if (sprite) return sprite;
    const g = new Graphics();
    const { w, h } = PLACEHOLDER;
    const x0 = -Math.floor(w / 2) * ART;
    g.rect(x0, -h * ART, w * ART, h * ART).fill(DIRT);
    for (let row = 1; row < h; row += 3) g.rect(x0, (row - h) * ART, w * ART, ART).fill(TREE_TRUNK);
    g.rect(x0, -h * ART, ART, h * ART).fill(TREE_TRUNK);
    g.rect(x0 + (w - 1) * ART, -h * ART, ART, h * ART).fill(TREE_TRUNK);
    // A pale strap: one for I, two for II, three for III.
    for (let i = 0; i < tier; i++)
      g.rect(x0 + (3 + i * 3) * ART, -h * ART, ART, h * ART).fill(STUMP_FACE);
    return g;
  }

  /** Rebuilds the stack for what is held: the top tiers first, at most three. */
  private rebuild(): void {
    for (const sprite of this.sprites) sprite.destroy();
    this.sprites = [];
    this.stack.removeChildren();
    const tiers: DropTier[] = [];
    for (const tier of [3, 2, 1] as const)
      for (let i = 0; i < this.held[tier] && tiers.length < STACK.length; i++) tiers.push(tier);
    // Behind first, so the front (top tier) draws last.
    for (let i = tiers.length - 1; i >= 0; i--) {
      const tier = tiers[i];
      const spot = STACK[i];
      if (tier === undefined || !spot) continue;
      const sprite = this.crate(tier);
      sprite.position.set(spot.x * ART, spot.y * ART);
      this.stack.addChild(sprite);
      this.sprites.unshift(sprite);
    }
  }

  /**
   * Once a frame. `screen` is the scene's camera (the world's origin and scale on screen), so the
   * button and the hint follow the stack; `hidden` while the house's room is open.
   */
  update(
    base: BaseState,
    nowMs: number,
    screen: { x: number; y: number; scale: number },
    freeWidth: number,
    hidden: boolean,
  ): void {
    this.nowMs = nowMs;
    const held = base.meta.drops.held;
    const total = heldDrops(base.meta.drops);
    if (total !== this.total) {
      const was = this.total;
      this.held = { ...held };
      if (was >= 0 && total > was) this.landedAt = nowMs;
      if (was > total && this.sprites[0]) this.lift(this.sprites[0]);
      this.total = total;
      this.rebuild();
    }
    this.animate(nowMs);
    const shown = total > 0 && !hidden;
    this.container.visible = shown || this.ghost !== null;
    this.stack.visible = shown;
    this.button.hidden = !shown;
    if (!shown) {
      this.hint.hidden = true;
      return;
    }
    this.placeButton(base, screen, freeWidth, total);
  }

  /** The front crate rises and fades: a drop was opened. */
  private lift(sprite: Container): void {
    if (this.ghost) this.ghost.destroy();
    const ghost = this.crate(topTier({ held: this.held } as BaseState["meta"]["drops"]) ?? 1);
    ghost.position.copyFrom(sprite.position);
    this.container.addChild(ghost);
    this.ghost = ghost;
    this.liftedAt = this.nowMs;
  }

  private animate(nowMs: number): void {
    const reduced = reducedMotion();
    const front = this.sprites[0];
    if (front) {
      const p = clamp((nowMs - this.landedAt) / LAND_MS, 0, 1);
      // Drops in from above and settles with a small bounce.
      const fall = reduced || p >= 1 ? 0 : (1 - easeOutBack(p)) * -36 * ART;
      front.position.y = (STACK[0]?.y ?? 0) * ART + Math.round(fall / ART) * ART;
    }
    if (this.ghost) {
      const p = clamp((nowMs - this.liftedAt) / LIFT_MS, 0, 1);
      if (p >= 1 || reduced) {
        this.ghost.destroy();
        this.ghost = null;
      } else {
        this.ghost.position.y = -Math.round(easeOutCubic(p) * 10) * ART;
        this.ghost.alpha = lerp(1, 0, p);
      }
    }
  }

  /** The button over the stack, the count, and the hint above it while the player is new. */
  private placeButton(
    base: BaseState,
    screen: { x: number; y: number; scale: number },
    freeWidth: number,
    total: number,
  ): void {
    const b = this.stack.getBounds();
    const width = Math.max(HIT, Math.round(b.width + 12));
    const height = Math.max(HIT, Math.round(b.height + 12));
    const box = {
      x: Math.round(b.x + b.width / 2 - width / 2),
      y: Math.round(b.y + b.height - height + 4),
      width,
      height,
    };
    this.box = box;
    const tier = topTier(base.meta.drops);
    const label = tier ? t("sea.crate", { tier: t(`drop.tier_${tier}`) }) : "";
    const hint = base.meta.stats.drops < HINT_OPENS && !this.on.quiet?.();
    const key = `${box.x},${box.y},${width},${height},${total},${label},${hint},${screen.scale}`;
    if (key === this.key) return;
    this.key = key;
    Object.assign(this.button.style, {
      left: `${box.x}px`,
      top: `${box.y}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    this.button.setAttribute("aria-label", label);
    this.count.hidden = total < 2;
    this.count.textContent = `×${total}`;
    this.hint.hidden = !hint;
    if (hint) {
      this.hint.textContent = t("sea.crate_hint");
      const half = this.hint.offsetWidth / 2 || 110;
      const centre = clamp(box.x + box.width / 2, half + 8, freeWidth - half - 8);
      this.hint.style.left = `${Math.round(centre)}px`;
      this.hint.style.top = `${box.y}px`;
    }
  }
}

export type { Sprite };
