/**
 * The Kettle (docs/redesign/03-the-big-red.md 3-4; D270): the homemade rocket on the back
 * terrace, growing through its stages (`prop/kettle_<stage>`: the pad, the frame, the warhead,
 * fuel and steam) as the press comes closer, with the Big Red's drum at its right foot: a faded
 * blue drum, a red dome under a hinged toilet-seat lid, taped shut while there is nothing to
 * launch, open and rattling when the advisor says now. The firebox, an amber beacon and the
 * dome's pilot light glow on the `lights` layer (D47), so it reads at night and in fog. Steam
 * puffs from the chimney when fuelled, greyer in rain. One DOM button over it all (D48) opens
 * the Big Red's card. The cinematic moves the container along the flight; `endFlight` puts it
 * back on its pad for the next run.
 *
 * Stages come from the domain (`kettleStage`); the scene passes them in once a second.
 */
import type { KettleStage } from "@wipe-day/domain/prestige";
import { Container, Graphics } from "pixi.js";
import { t } from "../state/world";
import { Glow, type Particles } from "./effects";
import {
  BEACON,
  BIG_RED,
  BIG_RED_DARK,
  BIG_RED_LIGHT,
  CONE,
  DIRT,
  DRUM,
  FIREBOX,
  HAZARD,
  HAZARD_DARK,
  KETTLE_RUST,
  KETTLE_RUST_DARK,
  LID,
  PILOT,
  REFLECTIVE,
  STEEL,
  STEEL_DARK,
  STUMP_FACE,
  TREE_TRUNK,
} from "./palette";
import { ART, artSprite } from "./pixel";
import { squashStep } from "./target";
import { clamp, lerpColor, reducedMotion } from "./util";

/** The tap area on screen (CSS px), at least this (03 3.1 asks 56). */
const HIT = 56;
/** The drum stands this far right of the Kettle's feet (art px). */
const DRUM_X = 17;
/** A stage pops for this long (ms). */
const POP_MS = 420;
/** Steam: a puff every 0.4 s when fuelled. */
const STEAM_EVERY = 0.4;
/** The lid rattles 2° every 3 s when crowned. */
const RATTLE_EVERY = 3;

export type ShownStage = Exclude<KettleStage, "hidden">;

/** What the drum shows: taped shut, open (a press is possible), or crowned (rattling). */
export interface Mood {
  crowned: boolean;
  pressable: boolean;
  rain: number;
}

/** A rect of art pixels, `y` rows up from the feet. */
function px(g: Graphics, x: number, y: number, w: number, h: number, color: number): Graphics {
  return g.rect(x * ART, -(y + h) * ART, w * ART, h * ART).fill(color);
}

/** The pad: two pallets, a cracked slab, hazard tape, a ladder (03 3.3), until the art lands. */
function drawPad(g: Graphics): void {
  for (const row of [0, 2]) {
    px(g, -13, row, 26, 1, TREE_TRUNK);
    px(g, -13, row + 1, 26, 1, DIRT);
  }
  px(g, -12, 4, 24, 2, STEEL_DARK);
  px(g, -12, 5, 24, 1, STEEL);
  for (let i = -12; i < 12; i += 4) {
    px(g, i, 4, 2, 1, HAZARD);
    px(g, i + 2, 4, 2, 1, HAZARD_DARK);
  }
  px(g, -14, 0, 1, 9, TREE_TRUNK);
  px(g, -12, 0, 1, 9, TREE_TRUNK);
  for (let y = 1; y < 9; y += 2) px(g, -14, y, 3, 1, STUMP_FACE);
}

/** The frame: four splayed stilts and the boiler with its gauge and chimney. */
function drawFrame(g: Graphics): void {
  drawPad(g);
  for (const [x, lean] of [
    [-9, -1],
    [-5, 0],
    [4, 0],
    [8, 1],
  ] as const) {
    for (let y = 6; y < 16; y++) px(g, x + Math.round((lean * (y - 6)) / 5), y, 1, 1, STEEL_DARK);
  }
  px(g, -7, 10, 14, 1, STEEL);
  px(g, -6, 16, 12, 20, KETTLE_RUST);
  px(g, 2, 16, 4, 20, KETTLE_RUST_DARK);
  px(g, -5, 36, 10, 1, KETTLE_RUST);
  for (const y of [20, 30]) for (let x = -5; x < 6; x += 3) px(g, x, y, 1, 1, KETTLE_RUST_DARK);
  px(g, -3, 24, 4, 4, REFLECTIVE);
  px(g, -2, 25, 1, 2, BIG_RED);
  px(g, 3, 36, 2, 5, STEEL_DARK);
}

/** The warhead: the painted crate, the cone and the fins on top of the frame. */
function drawWarhead(g: Graphics): void {
  drawFrame(g);
  px(g, -5, 37, 10, 8, DIRT);
  px(g, -5, 40, 10, 1, STEEL);
  px(g, -3, 41, 1, 2, HAZARD_DARK);
  px(g, 2, 41, 1, 2, HAZARD_DARK);
  px(g, -2, 39, 4, 1, HAZARD_DARK);
  for (let y = 0; y < 6; y++)
    px(g, -3 + Math.floor(y / 2), 45 + y, 6 - 2 * Math.floor(y / 2), 1, CONE);
  px(g, -2, 47, 4, 1, REFLECTIVE);
  px(g, -8, 16, 2, 7, STEEL);
  px(g, 6, 16, 2, 7, STEEL);
}

/** Fuel and steam: jerrycans and a hose at the foot. */
function drawFuel(g: Graphics): void {
  drawWarhead(g);
  for (const x of [-16, -19, 13]) {
    px(g, x, 0, 3, 4, 0x55684a);
    px(g, x + 1, 4, 1, 1, 0x55684a);
  }
  px(g, -13, 1, 7, 1, HAZARD_DARK);
}

const DRAW: Record<ShownStage, (g: Graphics) => void> = {
  pad: drawPad,
  frame: drawFrame,
  warhead: drawWarhead,
  fuel: drawFuel,
};

export class Kettle {
  /** In the world, feet at its origin: the scene sorts it with the props. */
  readonly container = new Container();
  /** On the lights layer: the firebox, the beacon, the dome's pilot light. */
  readonly light = new Container();
  readonly button: HTMLButtonElement;
  private body: Container | null = null;
  private readonly drum = new Graphics();
  private readonly lid = new Graphics();
  private readonly gull = new Graphics();
  private readonly firebox = new Glow(FIREBOX, 24 * ART, 0.9);
  private readonly beacon = new Glow(BEACON, 10 * ART, 1);
  private readonly pilot = new Glow(PILOT, 9 * ART, 1);
  private stage: KettleStage = "hidden";
  private lidState: "taped" | "open" | "crowned" | null = null;
  private poppedAt = Number.NEGATIVE_INFINITY;
  private time = 0;
  private steamAt = 0;
  private rest = { x: 0, y: 0 };
  private flying = false;
  private box = { x: 0, y: 0, width: 0, height: 0 };
  private key = "";
  /** The body's drawn height (stage units), for the steam and the label. */
  private height = 0;

  constructor(
    private readonly particles: Particles,
    private readonly on: { open: () => void },
  ) {
    this.container.addChild(this.drum, this.lid, this.gull);
    this.container.visible = false;
    this.drum.position.set(DRUM_X * ART, 0);
    this.lid.position.set(DRUM_X * ART, 0);
    this.light.addChild(this.firebox.sprite, this.beacon.sprite, this.pilot.sprite);
    this.light.visible = false;
    this.drawDrum();
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "kettle-hit";
    this.button.hidden = true;
    this.button.addEventListener("click", () => this.on.open());
  }

  /** The tap area on screen (the shots' 44 px audit). */
  get hitBox(): { x: number; y: number; width: number; height: number } | null {
    return this.button.hidden ? null : { ...this.box };
  }

  get shown(): boolean {
    return this.stage !== "hidden";
  }

  /** The feet's rest position (stage units, on the grid); the drum is DRUM_X art px right of it. */
  place(x: number, y: number): void {
    this.rest = { x: Math.round(x / ART) * ART, y: Math.round(y / ART) * ART };
    if (!this.flying) {
      this.container.position.set(this.rest.x, this.rest.y);
      this.container.zIndex = this.rest.y + 1;
    }
    this.placeLights();
  }

  /** The feet's rest point (stage units): the cinematic's pad. */
  get pad(): { x: number; y: number } {
    return { ...this.rest };
  }

  /** Where the smoke rises from: the chimney, right of the top. */
  private chimney(): { x: number; y: number } {
    return { x: this.rest.x + 3 * ART, y: this.rest.y - this.height + 2 * ART };
  }

  private placeLights(): void {
    const { x, y } = this.rest;
    this.firebox.sprite.position.set(x, y - 10 * ART);
    this.beacon.sprite.position.set(x - 8 * ART, y - this.height - 2 * ART);
    this.pilot.sprite.position.set(x + (DRUM_X + 1) * ART, y - 11 * ART);
  }

  /** The drum (03 4.1): faded blue, two ribs, rust, a plate and the dome. */
  private drawDrum(): void {
    const g = this.drum;
    g.clear();
    px(g, -4, 0, 8, 10, DRUM);
    px(g, 2, 0, 2, 10, 0x2c3a4a);
    for (const y of [3, 7]) px(g, -4, y, 8, 1, 0x2c3a4a);
    px(g, -3, 1, 1, 5, 0x8a4a2a);
    px(g, -4, 10, 8, 1, STEEL);
    px(g, -2, 11, 4, 2, BIG_RED);
    px(g, -2, 12, 2, 1, BIG_RED_LIGHT);
    px(g, -2, 11, 4, 1, BIG_RED_DARK);
  }

  /** The lid: taped flat over the dome, standing open behind it, or rattling. */
  private drawLid(state: "taped" | "open" | "crowned"): void {
    const g = this.lid;
    g.clear();
    if (state === "taped") {
      px(g, -3, 13, 6, 1, LID);
      px(g, -3, 11, 1, 3, HAZARD);
      px(g, 2, 11, 1, 3, HAZARD);
      px(g, -1, 12, 1, 1, HAZARD_DARK);
      px(g, 0, 12, 1, 1, HAZARD_DARK);
      return;
    }
    // Open: the seat stands up behind the dome, its tape hanging off one side.
    px(g, 2, 11, 1, 6, LID);
    px(g, 2, 14, 1, 1, HAZARD);
    px(g, 3, 9, 1, 3, HAZARD);
    px(g, -1, 16, 3, 1, 0xffd25a);
  }

  /** The gull on the cone when fuelled: three dark pixels. */
  private drawGull(): void {
    const g = this.gull;
    g.clear();
    px(g, -1, 0, 3, 1, 0x2f1822);
    px(g, 0, 1, 1, 1, 0x2f1822);
    px(g, 1, 1, 1, 1, 0x6f5a66);
  }

  /**
   * The stage shown. With `animate`, the new stage pops in (squash and dust). Returns whether
   * it changed, so the scene can sound it.
   */
  setStage(stage: KettleStage, animate: boolean): boolean {
    if (stage === this.stage) return false;
    this.stage = stage;
    this.body?.destroy({ children: true });
    this.body = null;
    this.container.visible = stage !== "hidden";
    this.light.visible = stage !== "hidden";
    if (stage === "hidden") return true;
    const art = artSprite(`prop/kettle_${stage}`);
    const body = art ?? new Graphics();
    if (!art) DRAW[stage](body as Graphics);
    this.container.addChildAt(body, 0);
    this.body = body;
    const b = body.getLocalBounds();
    this.height = Math.max(ART * 8, -b.y);
    this.placeLights();
    this.drawGull();
    this.gull.position.set(-ART, -this.height);
    if (animate && !reducedMotion()) {
      this.poppedAt = this.time * 1000;
      this.particles.spawn("dust", this.rest.x, this.rest.y, 10);
    }
    return true;
  }

  /** The cinematic moves the Kettle: its feet at (x, y), leaning by `rotation`. */
  setFlight(x: number, y: number, rotation: number): void {
    this.flying = true;
    // The drum stays on the ground (the island goes with it at the impact).
    this.drum.visible = false;
    this.lid.visible = false;
    this.container.position.set(x, y);
    this.container.rotation = rotation;
    this.container.zIndex = 10_000;
  }

  /** The flight is over: back on the pad (the next run shows it fresh). */
  endFlight(): void {
    this.flying = false;
    this.drum.visible = true;
    this.lid.visible = true;
    this.container.rotation = 0;
    this.container.scale.set(1);
    this.container.position.set(this.rest.x, this.rest.y);
    this.container.zIndex = this.rest.y + 1;
  }

  /** Hides the Kettle (the crater after the blast) or shows it (the next run's pad). */
  setVisible(visible: boolean): void {
    this.container.visible = visible && this.stage !== "hidden";
    this.light.visible = this.container.visible;
    if (!visible) this.button.hidden = true;
  }

  /**
   * Once a frame: the lights with the darkness, the steam, the pop, the lid's rattle; the
   * button over the drawing (hidden while the room is open or the film runs).
   */
  update(
    dt: number,
    darkness: number,
    mood: Mood,
    screen: { x: number; y: number; scale: number },
    hidden: boolean,
  ): void {
    this.time += dt;
    const shown = this.stage !== "hidden" && this.container.visible;
    if (!shown) {
      this.button.hidden = true;
      return;
    }
    const lidState = mood.crowned ? "crowned" : mood.pressable ? "open" : "taped";
    if (lidState !== this.lidState) {
      this.lidState = lidState;
      this.drawLid(lidState);
    }
    // The pop: a squash over 420 ms (the target's), none under reduced motion.
    const sincePop = this.time * 1000 - this.poppedAt;
    if (this.body) {
      if (sincePop < POP_MS && !reducedMotion()) {
        const [sx, sy] = squashStep(sincePop / POP_MS);
        this.body.scale.set(sx, sy);
      } else this.body.scale.set(1);
    }
    // The lid rattles 2° every 3 s when crowned (static under reduced motion).
    const rattle =
      lidState === "crowned" && !reducedMotion() && this.time % RATTLE_EVERY < 0.25
        ? Math.sin((this.time % RATTLE_EVERY) * 60) * 0.035
        : 0;
    this.lid.rotation = rattle;
    this.gull.visible = this.stage === "fuel";
    if (this.gull.visible) this.gull.y = -this.height - (Math.floor(this.time / 7) % 2) * ART;
    // Lights: the firebox from the warhead on, the beacon blinking once a second when fuelled,
    // the pilot light pulsing at 1 Hz when ready and steady bright when crowned.
    const fuelled = this.stage === "fuel";
    const hot = this.stage === "warhead" || fuelled;
    this.firebox.update(
      hot ? Math.max(0.35, darkness) : 0,
      hot ? Math.sin(this.time * 9) * 0.05 : 0,
    );
    const blink = fuelled && this.time % 1 < 0.5 ? 1 : 0;
    this.beacon.update(blink * Math.max(0.5, darkness));
    const pilot = mood.crowned
      ? 0.7
      : mood.pressable
        ? 0.4 * (0.5 + 0.5 * Math.sin(this.time * Math.PI * 2))
        : 0;
    this.pilot.update(pilot);
    // Steam from the chimney when fuelled; greyer and shorter in rain.
    if (fuelled && !this.flying) {
      this.steamAt += dt;
      if (this.steamAt >= STEAM_EVERY) {
        this.steamAt = 0;
        const at = this.chimney();
        this.particles.spawn(
          "smoke",
          at.x,
          at.y,
          1,
          lerpColor(0xf4f1e8, 0x9a9a9a, clamp(mood.rain, 0, 1)),
        );
      }
    }
    this.button.hidden = hidden || this.flying;
    if (!this.button.hidden) this.placeButton(screen);
  }

  private placeButton(screen: { x: number; y: number; scale: number }): void {
    const b = this.container.getLocalBounds();
    const left = screen.x + (this.rest.x + b.x) * screen.scale;
    const top = screen.y + (this.rest.y + b.y) * screen.scale;
    const drawnW = b.width * screen.scale;
    const drawnH = b.height * screen.scale;
    const width = Math.max(HIT, Math.round(drawnW + 8));
    const height = Math.max(HIT, Math.round(drawnH + 8));
    const box = {
      x: Math.round(left - (width - drawnW) / 2),
      y: Math.round(top - (height - drawnH) / 2),
      width,
      height,
    };
    this.box = box;
    const label = t("scene.kettle_label", { stage: t(`scene.kettle_${this.stage}`) });
    const key = `${box.x},${box.y},${width},${height},${label}`;
    if (key === this.key) return;
    this.key = key;
    Object.assign(this.button.style, {
      left: `${box.x}px`,
      top: `${box.y}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    this.button.setAttribute("aria-label", label);
  }

  /** The exhaust glow under the flying Kettle (the cinematic sets it). */
  setExhaust(amount: number, x: number, y: number): void {
    this.firebox.sprite.position.set(x, y);
    this.firebox.update(clamp(amount, 0, 1));
    this.beacon.update(0);
    this.pilot.update(0);
  }

  /** Lights back on their rest points after the flight. */
  resetLights(): void {
    this.placeLights();
  }
}
