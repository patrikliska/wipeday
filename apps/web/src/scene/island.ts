/**
 * The wasteland (owner, 2026-10-18; D203, D206, D209): a side view of one flat stretch of ground
 * under a ruined skyline, no sea. The front row stands on the ground's front edge: the target in
 * the middle, the Twig lines either side, the house on the right. The back row stands a few
 * pixels behind and up: the kiln and the Sheet Metal and Armored structures. The crafting lines
 * (loom, workbench, furnace, tannery, press) work inside the house, in its room (`ROOM`), which
 * opens when the house is tapped. Everything owned is on screen or one tap away (CLAUDE.md 6.2).
 *
 * Coordinates are art pixels (1 art px = `ART` stage units): x across the stage's 320, y the
 * feet line of a row (the front at 112, the stage's ground line 560).
 */
import { ART } from "./pixel";

/** The feet line of each row (art px): the ground's front edge, and a row behind it. */
export const ROWS = { front: 112, back: 103 } as const;
export type Row = keyof typeof ROWS;

/** The ground's far edge (art px): where the skyline's nearest layer meets it. */
export const GROUND_BACK = 99;

/** What the camera must always show, phone to desktop (art px): the ground, the rows, the sky. */
// 156 wide: a 390 px phone at DPR 2 shows it at exactly 5 device px per art pixel.
export const VIEW = { left: 101, right: 257, top: 40, bottom: 124 } as const;

/** Each outside line's spot: centre x and row (art px). */
export const SPOTS: Readonly<Record<string, { x: number; row: Row }>> = {
  // The front row: the Twig lines either side of the target.
  beachcomber: { x: 120, row: "front" },
  campfire: { x: 142, row: "front" },
  garden: { x: 200, row: "front" },
  // The back row, in the gaps of the front: the kiln, then Sheet Metal and Armored.
  shipbreaker: { x: 108, row: "back" },
  dock: { x: 131, row: "back" },
  kiln: { x: 150, row: "back" },
  generator: { x: 196, row: "back" },
  radio_mast: { x: 214, row: "back" },
  reactor: { x: 249, row: "back" },
};

/** The target in the middle of the front row; the house at its right end. */
export const TARGET_SPOT = { x: 172, row: "front" as Row };
export const HOUSE_SPOT = { x: 232, row: "front" as Row };

/**
 * The house's room (art px): the cut-away interior drawn when the house is open, its floor line
 * at `floor`, the door hands come in by at `door`, and a slot on the floor for each crafting
 * line, in the order their eras open.
 */
export const ROOM = {
  width: 132,
  height: 72,
  floor: 64,
  door: 8,
  slots: {
    loom: 24,
    workbench: 48,
    furnace: 74,
    tannery: 98,
    press: 120,
  } as Readonly<Record<string, number>>,
} as const;

/** The lines that work inside the house (D206). */
export const INSIDE: ReadonlySet<string> = new Set(Object.keys(ROOM.slots));

/** A spot in stage units: x, and y as an offset from the ground line (the front row). */
export function stageSpot(spot: { x: number; row: Row }): { x: number; y: number } {
  return { x: spot.x * ART, y: (ROWS[spot.row] - ROWS.front) * ART };
}
