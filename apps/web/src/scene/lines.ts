/**
 * The 14 lines on the island (docs/redesign/02-the-run.md 1.2, 2.3; 09-architecture.md 10.3).
 * Each owned line stands at its spot, drawn anew at 1, 25 and 100 owned, with a count badge
 * and a cycle bar in screen space (D46). A line whose era is open but which is not owned yet is
 * a staked plot with a price sign, so the island shows what comes next. Every completed cycle
 * pops the line's product onto its pile (the same icon as the shop row and the floater); the
 * four biggest earners send a floater to the counter at most every 2 s, cycles merged.
 *
 * A manned line cycles continuously while the Night Shift runs; an unmanned one shows a cycle
 * only while one is in flight (`readyAt`, busy-until) and pays when it ends.
 */
import type { LineDef } from "@wipe-day/content/schema";
import { cycleOf } from "@wipe-day/domain/effects";
import { costFactor } from "@wipe-day/domain/lines";
import { cyclePayout, windowEnd } from "@wipe-day/domain/settle";
import type { BaseState } from "@wipe-day/domain/state";
import { BitmapText, Container, Graphics, Sprite } from "pixi.js";
import { content, fmt, fmtCount, resourceColor } from "../state/world";
import { drawLine, type Station } from "./buildings";
import type { Particles } from "./effects";
import { productTexture } from "./icons";
import { SPOTS, stageSpot, TARGET_SPOT } from "./island";
import { ART, artSprite } from "./pixel";
import { plotShown } from "./reveal";
import { clamp, easeOutBack } from "./util";

/** Where a line stands: world x, y below (+) or above (−) the ground line, and its scale. */
export interface Spot {
  x: number;
  y: number;
  scale: number;
}

/**
 * The scale each line's stand-in drawing is shown at (the procedural buildings, until a line has
 * its pixel art); a line with art is drawn at the grid's scale whatever this says.
 */
const FALLBACK_SCALE: Record<string, number> = {
  dock: 0.5,
  shipbreaker: 0.4,
  beachcomber: 0.5,
  campfire: 0.5,
  kiln: 0.45,
  furnace: 0.4,
  tannery: 0.45,
  garden: 0.5,
  workbench: 0.45,
  loom: 0.45,
  press: 0.4,
  radio_mast: 0.45,
  generator: 0.4,
  reactor: 0.36,
};

/** The island's layout (`island.ts`, D203) in world units. */
export const LAYOUT: Record<string, Spot> = Object.fromEntries(
  Object.entries(SPOTS).map(([id, spot]) => [
    id,
    { ...stageSpot(spot), scale: FALLBACK_SCALE[id] ?? 0.45 },
  ]),
);

/** The target's x (stage units): hands work on the far side of their line from it. */
const TARGET_X = stageSpot(TARGET_SPOT).x;

/**
 * A line's pixel art at `stage` (`line/<id>_<stage>`), as a station; null without art. Its
 * hand works at its outer edge, away from the target, so no hand stands on the target.
 */
function artStation(id: string, stage: number, unit: number, x: number): Station | null {
  const sprite = artSprite(`line/${id}_${stage}`);
  if (!sprite) return null;
  // The container is scaled by the spot's fallback scale: undo it, so one art px is ART units.
  sprite.scale.set(ART / unit);
  const container = new Container();
  container.addChild(sprite);
  const half = (sprite.texture.frame.width * ART) / unit / 2;
  const side = x < TARGET_X ? -1 : 1;
  return {
    id,
    container,
    pile: { x: -side * (half + (3 * ART) / unit), y: 0 },
    work: side * (half - (2 * ART) / unit),
  };
}

/** The plot's width (world units at the spot's scale 1): a stage-1 drawing's footprint. */
const PLOT_WIDTH: Record<string, number> = {
  dock: 110,
  beachcomber: 80,
  shipbreaker: 100,
  campfire: 64,
  garden: 70,
  workbench: 96,
  kiln: 64,
  furnace: 76,
  tannery: 60,
  loom: 60,
  press: 66,
  generator: 64,
  radio_mast: 44,
  reactor: 100,
};

/** Product sprites on a pile, per stack; a second stack from 10 owned. */
const PER_STACK = 3;
const PILE_ICON = 34;
/** At most this many product sprites across the island (09-architecture.md 10.5). */
const PRODUCT_CAP = 40;
/** A pile pops at most twice a second, however fast the line runs. */
const POP_EVERY = 0.5;
const FLOAT_EVERY_MS = 2000;
const FLOATING_LINES = 4;

interface View {
  def: LineDef;
  spot: Spot;
  container: Container;
  light: Container;
  station: Station | null;
  stage: number;
  owned: number;
  plot: Graphics | null;
  pile: Sprite[];
  /** Screen space: the count badge and cycle bar, or the plot's price sign. */
  badge: Container;
  badgeBg: Graphics;
  badgeText: BitmapText;
  /** The badge's width and the stage it was drawn for. */
  badgeW: number;
  badgeStage: number;
  bar: Graphics;
  /** Top of the drawing (local units), for placing the badge. */
  top: number;
  /** Manned: the game second of the next visible cycle. */
  nextPop: number | null;
  /** Unmanned: the readyAt already popped for. */
  popped: number;
  lastPopAt: number;
  /** Payout gathered for the next floater, and when the last one went. */
  pending: number;
  lastFloatMs: number;
  /** 0..1 after a purchase: the building pops. */
  bump: number;
  /** 0..1 after a redraw: the new stage springs up. */
  grow: number;
  time: number;
}

export interface LineEvents {
  /** A line's floater is due: `amount` gathered since its last one, from world (x, y). */
  float: (line: LineDef, x: number, y: number, amount: number) => void;
}

const BADGE_FONT = "wipeday-floater";
/** The count badge's height (CSS px); its cycle bar sits under it. */
const BADGE_H = 15;

export class Lines {
  /** World: every line, sorted back to front with the house and the target. */
  readonly layer: Container;
  /** Glows and fires above the night tint (D47). */
  readonly lights = new Container();
  /** Screen space: badges, bars and price signs. */
  readonly overlay = new Container();
  private readonly views = new Map<string, View>();
  private readonly ground: number;
  private products = 0;
  private time = 0;
  /** The four biggest earners, refreshed once a second. */
  private floating = new Set<string>();
  private rankedAt = -1;

  constructor(
    layer: Container,
    ground: number,
    private readonly particles: Particles,
    private readonly events: LineEvents,
  ) {
    this.layer = layer;
    this.ground = ground;
    for (const def of content.lines) {
      const spot = LAYOUT[def.id];
      if (!spot) continue;
      const container = new Container();
      container.position.set(spot.x, ground + spot.y);
      container.scale.set(spot.scale);
      container.zIndex = ground + spot.y;
      container.visible = false;
      layer.addChild(container);
      const light = new Container();
      light.position.copyFrom(container.position);
      light.scale.copyFrom(container.scale);
      this.lights.addChild(light);
      const badge = new Container();
      const badgeBg = new Graphics();
      const badgeText = new BitmapText({
        text: "",
        style: { fontFamily: BADGE_FONT, fontSize: 11 },
      });
      badgeText.anchor.set(0.5, 0.5);
      const bar = new Graphics();
      badge.addChild(badgeBg, badgeText, bar);
      badge.visible = false;
      this.overlay.addChild(badge);
      this.views.set(def.id, {
        def,
        spot,
        container,
        light,
        station: null,
        stage: -1,
        owned: 0,
        plot: null,
        pile: [],
        badge,
        badgeBg,
        badgeText,
        badgeW: 18,
        badgeStage: -2,
        bar,
        top: -60,
        nextPop: null,
        popped: 0,
        lastPopAt: -1,
        pending: 0,
        lastFloatMs: 0,
        bump: 1,
        grow: 1,
        time: Math.random() * 10,
      });
    }
  }

  /** Where `line`'s hand stands to work (world units), and the scale they are drawn at. */
  workPoint(line: string): { x: number; y: number; scale: number } | null {
    const view = this.views.get(line);
    if (!view) return null;
    const work = view.station?.work ?? -30;
    return {
      x: view.spot.x + work * view.spot.scale,
      y: this.ground + view.spot.y + 4,
      scale: view.spot.scale,
    };
  }

  /** The top centre of a line's drawing (world units): where its milestone floater rises. */
  topOf(line: string): { x: number; y: number } | null {
    const view = this.views.get(line);
    if (!view) return null;
    return { x: view.spot.x, y: this.ground + view.spot.y + view.top * view.spot.scale };
  }

  /**
   * Follows the run: redraws stages, shows plots, pops products and sends floaters. `now` is
   * the game clock (fractional seconds), `nowMs` the wall clock.
   */
  update(state: BaseState, now: number, nowMs: number, dt: number, darkness: number): void {
    this.time += dt;
    const second = Math.floor(now);
    if (second !== this.rankedAt) {
      this.rankedAt = second;
      this.rank(state, second);
    }
    const nightShiftEnd = windowEnd(content, state);
    for (const view of this.views.values()) {
      const owned = state.run.lines[view.def.id] ?? 0;
      const plot = plotShown(content, state, view.def);
      const stage = owned >= 100 ? 3 : owned >= 25 ? 2 : owned >= 1 ? 1 : plot ? 0 : -1;
      if (stage !== view.stage) this.restage(view, stage, view.stage >= 0 && stage > view.stage);
      if (owned > view.owned && view.owned > 0) {
        view.bump = 0;
        this.particles.spawn("dust", view.spot.x, this.ground + view.spot.y, 8, 0xc9b78a);
      }
      view.owned = owned;
      view.time += dt;
      // A purchase pops the building; a new stage or a fresh plot springs up out of the ground.
      view.bump = Math.min(1, view.bump + dt / 0.35);
      view.grow = Math.min(1, view.grow + dt / 0.45);
      const pop = 1 + Math.sin(view.bump * Math.PI) * 0.08;
      const rise = view.grow < 1 ? easeOutBack(view.grow) : 1;
      view.container.scale.set(view.spot.scale * pop, view.spot.scale * pop * rise);
      if (view.station) {
        view.station.animate?.(view.time);
        view.station.glow?.update(darkness, Math.sin(view.time * 13) * 0.06);
        if (view.def.id === "campfire")
          view.station.glow?.update(0.15 + darkness * 0.85, Math.sin(view.time * 13) * 0.08);
        if (view.def.id === "furnace")
          view.station.glow?.update(0.3 + darkness * 0.4, Math.sin(view.time * 17) * 0.06);
        for (const glow of view.station.glows ?? [])
          glow.update(darkness, Math.sin(view.time * 5) * 0.03);
        this.smoke(view, dt);
      }
      if (owned > 0) this.cycle(view, state, now, nowMs, nightShiftEnd);
    }
  }

  /** Redraws a line at a new stage (−1 hidden, 0 the plot, 1-3 the building). */
  private restage(view: View, stage: number, grew: boolean): void {
    view.stage = stage;
    view.station?.container.destroy({ children: true });
    for (const child of view.light.removeChildren()) child.destroy({ children: true });
    view.station = null;
    view.plot?.destroy();
    view.plot = null;
    for (const sprite of view.pile) sprite.destroy();
    this.products -= view.pile.length;
    view.pile = [];
    view.container.visible = stage >= 0;
    if (stage < 0) return;
    if (stage === 0) {
      view.plot = drawPlot(PLOT_WIDTH[view.def.id] ?? 70);
      view.container.addChild(view.plot);
      view.top = -40;
      view.grow = 0;
      return;
    }
    const station =
      artStation(view.def.id, stage, view.spot.scale, view.spot.x) ?? drawLine(view.def.id, stage);
    if (!station) return;
    view.station = station;
    view.container.addChild(station.container);
    // Fire and glows go to the light layer, at the same transform (D47).
    const emissive = [
      station.fire,
      station.glow?.sprite,
      ...(station.glows ?? []).map((glow) => glow.sprite),
    ].filter((item) => item !== undefined);
    if (emissive.length > 0) view.light.addChild(...emissive);
    view.top = station.container.getLocalBounds().y;
    view.grow = 0;
    if (grew) this.particles.spawn("dust", view.spot.x, this.ground + view.spot.y, 16, 0xc9b78a);
  }

  private smoke(view: View, dt: number): void {
    const chimney = view.station?.chimney;
    if (!chimney || Math.random() > dt * 3) return;
    const x = view.spot.x + chimney.x * view.spot.scale;
    const y = this.ground + view.spot.y + chimney.y * view.spot.scale;
    this.particles.spawn("smoke", x, y, 1, view.def.id === "reactor" ? 0xe8ecef : 0x9a9a9a);
  }

  /** The four lines with the biggest payout per cycle send floaters (08-screens.md 4.2). */
  private rank(state: BaseState, now: number): void {
    const payouts: [string, number][] = [];
    for (const def of content.lines) {
      if ((state.run.lines[def.id] ?? 0) > 0)
        payouts.push([def.id, cyclePayout(content, state, def.id, now)]);
    }
    payouts.sort((a, b) => b[1] - a[1]);
    this.floating = new Set(payouts.slice(0, FLOATING_LINES).map(([id]) => id));
  }

  /** Cycles: the bar, product pops and floaters. */
  private cycle(
    view: View,
    state: BaseState,
    now: number,
    nowMs: number,
    nightShiftEnd: number,
  ): void {
    const id = view.def.id;
    const length = cycleOf(content, state, view.def, Math.floor(now));
    const manned = state.run.hands.includes(id);
    let fill = 0;
    if (manned) {
      const running = now < nightShiftEnd;
      if (view.nextPop === null || !running) view.nextPop = running ? now + length : null;
      if (view.nextPop !== null) {
        if (now - view.nextPop > length * 3) view.nextPop = now + length;
        if (now >= view.nextPop) {
          // Fast lines: pay every cycle, pop at most twice a second.
          const cycles = Math.max(1, Math.floor((now - view.nextPop) / length) + 1);
          view.nextPop += cycles * length;
          this.completed(view, state, now, nowMs, cycles);
        }
        fill = 1 - clamp((view.nextPop - now) / length, 0, 1);
      }
    } else {
      view.nextPop = null;
      const ready = state.run.readyAt[id] ?? 0;
      if (ready > now) fill = 1 - clamp((ready - now) / length, 0, 1);
      else if (ready > view.popped && ready > 0) {
        view.popped = ready;
        this.completed(view, state, now, nowMs, 1);
      }
    }
    this.drawBar(view, fill, manned, length);
  }

  private completed(
    view: View,
    state: BaseState,
    now: number,
    nowMs: number,
    cycles: number,
  ): void {
    const payout = cyclePayout(content, state, view.def.id, Math.floor(now)) * cycles;
    view.pending += payout;
    if (now - view.lastPopAt >= POP_EVERY) {
      view.lastPopAt = now;
      this.pop(view);
    }
    if (this.floating.has(view.def.id) && nowMs - view.lastFloatMs >= FLOAT_EVERY_MS) {
      const top = this.topOf(view.def.id);
      if (top) this.events.float(view.def, top.x, top.y, view.pending);
      view.pending = 0;
      view.lastFloatMs = nowMs;
    }
  }

  /** One product onto the pile; a full pile is carted off (it fades, the stack starts again). */
  private pop(view: View): void {
    const station = view.station;
    if (!station?.pile) return;
    const stacks = view.owned >= 10 ? 2 : 1;
    if (view.pile.length >= PER_STACK * stacks) {
      for (const sprite of view.pile) sprite.destroy();
      this.products -= view.pile.length;
      view.pile = [];
      const x = view.spot.x + station.pile.x * view.spot.scale;
      this.particles.spawn("dust", x, this.ground + view.spot.y, 3, 0xc9b78a);
      return;
    }
    if (this.products >= PRODUCT_CAP) return;
    const texture = productTexture(view.def.product);
    const sprite = texture ? new Sprite(texture) : new Sprite();
    sprite.anchor.set(0.5, 1);
    const size = PILE_ICON;
    sprite.width = size;
    sprite.height = size;
    sprite.tint = Number.parseInt(resourceColor(view.def.product).slice(1), 16);
    const n = view.pile.length;
    const stack = Math.floor(n / PER_STACK);
    const level = n % PER_STACK;
    sprite.position.set(station.pile.x + stack * (size * 0.9), station.pile.y - level * size * 0.5);
    view.container.addChild(sprite);
    view.pile.push(sprite);
    this.products += 1;
  }

  /** The cycle bar under the badge: a manned line's under a second shows steady and full. */
  private drawBar(view: View, fill: number, manned: boolean, length: number): void {
    view.bar.clear();
    const w = Math.max(16, view.badgeW - 6);
    const y = BADGE_H / 2 + 2;
    view.bar.roundRect(-w / 2, y, w, 3, 1.5).fill({ color: 0x1b1a18, alpha: 0.7 });
    const shown = manned && length < 1 ? 1 : fill;
    if (shown > 0)
      view.bar.roundRect(-w / 2, y, w * shown, 3, 1.5).fill(manned ? 0xe8d9a8 : 0xffffff);
  }

  /**
   * Places the screen-space badges over their buildings; called after the camera moves, with its
   * transform. A badge that would cover one already placed (front rows first) moves up a step.
   */
  place(state: BaseState, cameraX: number, cameraY: number, scale: number): void {
    const placed: { x: number; y: number; w: number }[] = [];
    const order = [...this.views.values()]
      .filter((view) => view.stage >= 0)
      .sort((a, b) => b.spot.y - a.spot.y || a.spot.x - b.spot.x);
    for (const view of this.views.values()) view.badge.visible = view.stage >= 0;
    for (const view of order) {
      const label =
        view.stage === 0
          ? fmt(view.def.cost * costFactor(content, state, view.def), "cost")
          : fmtCount(view.owned);
      if (view.badgeText.text !== label || view.badgeStage !== view.stage)
        this.drawBadge(view, label);
      const x = Math.round(cameraX + view.spot.x * scale);
      let y = Math.round(
        cameraY + (this.ground + view.spot.y + view.top * view.spot.scale) * scale - 12,
      );
      for (let step = 0; step < 4; step++) {
        const hit = placed.find(
          (other) =>
            Math.abs(other.x - x) < (other.w + view.badgeW) / 2 + 2 &&
            Math.abs(other.y - y) < BADGE_H + 2,
        );
        if (!hit) break;
        y = hit.y - BADGE_H - 3;
      }
      placed.push({ x, y, w: view.badgeW });
      view.badge.position.set(x, y);
      view.bar.visible = view.stage > 0;
    }
  }

  private drawBadge(view: View, label: string): void {
    view.badgeText.text = label;
    view.badgeStage = view.stage;
    const w = Math.max(18, Math.ceil(view.badgeText.width) + 10);
    view.badgeW = w;
    const h = BADGE_H;
    view.badgeBg.clear();
    if (view.stage === 0) {
      // The price sign: a dark board on a post, the price in pale paint.
      view.badgeBg.rect(-1.5, h / 2 - 2, 3, 10).fill(0x5a3d26);
      view.badgeBg
        .roundRect(-w / 2, -h / 2, w, h, 3)
        .fill(0x3f2a16)
        .stroke({ width: 1.5, color: 0xc9a36b });
      view.badgeText.tint = 0xffe7b0;
    } else {
      view.badgeBg.roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: 0x1b1a18, alpha: 0.78 });
      view.badgeText.tint = 0xffffff;
    }
  }

  /** Lights follow their lines (bumps scale them). */
  syncLights(): void {
    for (const view of this.views.values()) {
      view.light.position.copyFrom(view.container.position);
      view.light.scale.copyFrom(view.container.scale);
      view.light.visible = view.container.visible;
    }
  }
}

/** A staked plot: four stakes and a string between them, waiting for its first unit. */
function drawPlot(width: number): Graphics {
  const g = new Graphics();
  const half = width / 2;
  const depth = 10;
  g.ellipse(0, 0, half + 4, depth / 2 + 2).fill({ color: 0x6f5638, alpha: 0.35 });
  const corners: [number, number][] = [
    [-half, -depth / 2],
    [half, -depth / 2],
    [half, depth / 2],
    [-half, depth / 2],
  ];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i] ?? [0, 0];
    const [bx, by] = corners[(i + 1) % 4] ?? [0, 0];
    g.moveTo(ax, ay - 9).lineTo(bx, by - 9);
  }
  g.stroke({ width: 1.5, color: 0xece2c8, alpha: 0.9 });
  for (const [x, y] of corners) g.rect(x - 2, y - 14, 4, 16).fill(0x8a6a3a);
  return g;
}
