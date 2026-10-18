/**
 * The terraced island (owner, 2026-10-18; D203, D206): a side view of Saltmarsh rising from the
 * beach in terraces. The Twig lines stand on the beach around the target with the sea lines in
 * the shallows; the yard above holds the kiln and the house; the hill on top the Sheet Metal and
 * Armored structures. The crafting lines (loom, workbench, furnace, tannery, press) work inside
 * the house, in its room (`ROOM`), which opens when the house is tapped. Everything owned is on
 * screen on the island or one tap away in the house (CLAUDE.md 6.2).
 *
 * Coordinates are art pixels (1 art px = `ART` stage units): x across the stage's 320, y the
 * feet line of a row (the beach at 112, the stage's ground line 560). The sea is on the left.
 */
import { ART } from "./pixel";

/** The feet line of each row, top of its surface (art px). */
export const ROWS = { beach: 112, yard: 94, hill: 76 } as const;
export type Row = keyof typeof ROWS;

/** The terraces above the beach: their surface row and their extent (art px, left to right). */
export const TERRACES: readonly { row: Row; left: number; right: number }[] = [
  // The hill runs on past the right edge of every screen; the left ends step back from the sea.
  { row: "yard", left: 110, right: 480 },
  { row: "hill", left: 120, right: 480 },
];

/** Where the beach meets the water at the feet line (art px). */
export const SHORE = 118;

/** What the camera must always show, phone to desktop (art px): the island and its sky. */
// 156 wide: a 390 px phone at DPR 2 shows it at exactly 5 device px per art pixel.
export const VIEW = { left: 101, right: 257, top: 30, bottom: 140 } as const;

/** Each outside line's spot: centre x and row (art px). */
export const SPOTS: Readonly<Record<string, { x: number; row: Row }>> = {
  // The beach: the sea lines in the shallows, the Twig lines either side of the target.
  shipbreaker: { x: 112, row: "beach" },
  dock: { x: 132, row: "beach" },
  beachcomber: { x: 150, row: "beach" },
  campfire: { x: 205, row: "beach" },
  garden: { x: 226, row: "beach" },
  // The yard: the kiln smokes outside, left of the target's column; the house is on the right.
  kiln: { x: 132, row: "yard" },
  // The hill: Sheet Metal and Armored.
  generator: { x: 136, row: "hill" },
  radio_mast: { x: 210, row: "hill" },
  reactor: { x: 234, row: "hill" },
};

/** The target stands on the beach in the middle; the house at the right of the yard. */
export const TARGET_SPOT = { x: 178, row: "beach" as Row };
export const HOUSE_SPOT = { x: 230, row: "yard" as Row };

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

/** A spot in stage units: x, and y as an offset from the ground line (the beach). */
export function stageSpot(spot: { x: number; row: Row }): { x: number; y: number } {
  return { x: spot.x * ART, y: (ROWS[spot.row] - ROWS.beach) * ART };
}
