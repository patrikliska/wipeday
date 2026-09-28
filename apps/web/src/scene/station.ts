/** One thing standing around the base: its drawing, lights and moving parts. */
import type { Container } from "pixi.js";
import type { Glow } from "./effects";

export interface Station {
  id: string;
  container: Container;
  glow?: Glow;
  /** More lights than one (lamp posts, a boathouse with two windows). */
  glows?: Glow[];
  /** Per-frame animation (flames, a blinking mast light). */
  animate?: (t: number) => void;
  /** Where smoke and sparks come from, relative to the station. */
  chimney?: { x: number; y: number };
  /** Shown only while the station is working (the furnace's lit interior and flames). */
  fire?: Container;
  /** The station's fire and glows, moved to the light layer when the station is placed. */
  light?: Container;
}
