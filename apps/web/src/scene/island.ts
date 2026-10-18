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

/**
 * The feet line of each row (art px): the ground's front edge, and a row far enough behind it
 * that the front row's lines (at most 24 px tall) never cover the back row's (S3): only the
 * target and the house are tall enough to reach it, and the back row's spots keep clear of them.
 */
export const ROWS = { front: 112, back: 90 } as const;
export type Row = keyof typeof ROWS;

/** The ground's far edge (art px): where the skyline's nearest layer meets it. */
export const GROUND_BACK = 86;

/** What the camera must always show, phone to desktop (art px): the ground, the rows, the sky. */
// 156 wide: a 390 px phone at DPR 2 shows it at exactly 5 device px per art pixel.
export const VIEW = { left: 101, right: 257, top: 40, bottom: 124 } as const;
/**
 * Armored's camp is wider (the Scrapyard on the left, the reactor on the right): the camera
 * pulls back to this. 194 wide: the 390 px phone shows it at 4 device px per art pixel.
 */
export const VIEW_WIDE = { left: 83, right: 277, top: 40, bottom: 124 } as const;
export type View = typeof VIEW | typeof VIEW_WIDE;

/** The view an era needs: everything the camp can own then is on screen (CLAUDE.md 6.2). */
export const viewFor = (era: string): View => (era === "hqm" ? VIEW_WIDE : VIEW);

/** Each outside line's spot: centre x and row (art px). */
export const SPOTS: Readonly<Record<string, { x: number; row: Row }>> = {
  // The front row: the Twig lines either side of the target and its stockpile (D217).
  beachcomber: { x: 112, row: "front" },
  campfire: { x: 134, row: "front" },
  garden: { x: 211, row: "front" },
  // The back row, left to right, clear of the target's and the house's tops: the Scrapyard and
  // the Rain Catcher left (the Scrapyard only in Armored's wider view), the kiln just left of
  // the target, then the generator, the radio mast (tall: it shows over the house) and the reactor.
  shipbreaker: { x: 107, row: "back" },
  dock: { x: 128, row: "back" },
  kiln: { x: 153, row: "back" },
  generator: { x: 206, row: "back" },
  radio_mast: { x: 230, row: "back" },
  reactor: { x: 256, row: "back" },
};

/**
 * The target a little left of the middle of the front row, its stockpile at its right foot
 * (D217), the house at the row's right end.
 */
export const TARGET_SPOT = { x: 166, row: "front" as Row };
export const STOCKPILE_SPOT = { x: 190, row: "front" as Row };
export const HOUSE_SPOT = { x: 238, row: "front" as Row };

/**
 * Armored's camp in its wider view (S3): the front row spreads round the Crashed Plane (60 px,
 * the widest target) with the stockpile clear of its tail, the bunker moves right, the kiln
 * stands behind the plane's low middle and the generator clear of its tail.
 */
const WIDE_SPOTS: Readonly<Record<string, number>> = {
  beachcomber: 100,
  campfire: 123,
  dock: 133,
  garden: 222,
  kiln: 166,
  generator: 210,
};
const WIDE_HOUSE = 254;
const WIDE_STOCKPILE = 203;

/** Each outside line's spot in `era`. */
export function spotsFor(era: string): Record<string, { x: number; row: Row }> {
  const wide = viewFor(era) === VIEW_WIDE;
  return Object.fromEntries(
    Object.entries(SPOTS).map(([id, spot]) => [
      id,
      { x: (wide ? WIDE_SPOTS[id] : undefined) ?? spot.x, row: spot.row },
    ]),
  );
}

/** The stockpile's spot in `era`: clear of the Crashed Plane's tail in Armored's wider camp. */
export function stockpileSpotFor(era: string): { x: number; row: Row } {
  return viewFor(era) === VIEW_WIDE ? { ...STOCKPILE_SPOT, x: WIDE_STOCKPILE } : STOCKPILE_SPOT;
}

/** The house's spot in `era`. */
export function houseSpotFor(era: string): { x: number; row: Row } {
  return viewFor(era) === VIEW_WIDE ? { ...HOUSE_SPOT, x: WIDE_HOUSE } : HOUSE_SPOT;
}

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
