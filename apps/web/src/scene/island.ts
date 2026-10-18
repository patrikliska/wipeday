/**
 * The terraced island (owner, 2026-10-18; D203): a side view of Saltmarsh rising from the beach
 * in terraces, one per era. The Twig lines stand on the beach around the target; each later era
 * builds on the terrace above, so the island grows upward as the run climbs, and every line
 * owned is on screen at once (CLAUDE.md 6.2, "the island tells the story").
 *
 * Coordinates are art pixels (1 art px = `ART` stage units): x across the stage's 320, y the
 * feet line of a row (the beach at 112, the stage's ground line 560). The sea is on the left.
 */
import { ART } from "./pixel";

/** The feet line of each row, top of its surface (art px). */
export const ROWS = { beach: 112, timber: 94, stone: 76, metal: 58 } as const;
export type Row = keyof typeof ROWS;

/** The terraces above the beach: their surface row and their extent (art px, left to right). */
export const TERRACES: readonly { row: Row; left: number; right: number }[] = [
  // The hill runs on past the right edge of every screen; the left ends step back from the sea.
  { row: "timber", left: 110, right: 480 },
  { row: "stone", left: 118, right: 480 },
  { row: "metal", left: 128, right: 480 },
];

/** Where the beach meets the water at the feet line (art px). */
export const SHORE = 118;

/** What the camera must always show, phone to desktop (art px): the island and its sky. */
// 156 wide: a 390 px phone at DPR 2 shows it at exactly 5 device px per art pixel.
export const VIEW = { left: 101, right: 257, top: 14, bottom: 140 } as const;

/** Each line's spot: centre x and row (art px). */
export const SPOTS: Readonly<Record<string, { x: number; row: Row }>> = {
  // The beach: the sea lines in the shallows, the Twig lines either side of the target.
  shipbreaker: { x: 112, row: "beach" },
  dock: { x: 132, row: "beach" },
  beachcomber: { x: 150, row: "beach" },
  campfire: { x: 205, row: "beach" },
  garden: { x: 226, row: "beach" },
  // Timber, the first terrace, with the house at its right end.
  loom: { x: 124, row: "timber" },
  workbench: { x: 146, row: "timber" },
  kiln: { x: 208, row: "timber" },
  // Stone.
  furnace: { x: 128, row: "stone" },
  tannery: { x: 150, row: "stone" },
  press: { x: 222, row: "stone" },
  // Sheet Metal and Armored, the top terrace.
  generator: { x: 138, row: "metal" },
  radio_mast: { x: 214, row: "metal" },
  reactor: { x: 238, row: "metal" },
};

/** The target stands on the beach in the middle; the house at the right end of the first terrace. */
export const TARGET_SPOT = { x: 178, row: "beach" as Row };
export const HOUSE_SPOT = { x: 238, row: "timber" as Row };

/** A spot in stage units: x, and y as an offset from the ground line (the beach). */
export function stageSpot(spot: { x: number; row: Row }): { x: number; y: number } {
  return { x: spot.x * ART, y: (ROWS[spot.row] - ROWS.beach) * ART };
}
