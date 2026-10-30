/**
 * The wasteland (owner, 2026-10-18; D203, D206, D209, D246): a yard seen from above under a
 * ruined skyline, no sea. The front row stands on the ground's front edge: the target in the
 * middle, the Twig lines either side, the house on the right. Two raised steps behind carry the
 * later eras: the kiln and the Sheet Metal and Armored structures. The crafting lines
 * (loom, workbench, furnace, tannery, press) work inside the house, in its room (`ROOM`), which
 * opens when the house is tapped. Everything owned is on screen or one tap away (CLAUDE.md 6.2).
 *
 * Coordinates are art pixels (1 art px = `ART` stage units): x across the stage's 320, y the
 * feet line (the front edge at 112, the stage's ground line 560). Where things stand comes from
 * the yard (`yards.ts`).
 */
import { ART } from "./pixel";
import { FRONT, type View, type YardSpot, yard } from "./yards";

export type { View } from "./yards";

/** The ground's far edge (art px): where the skyline's nearest layer meets it. */
export const GROUND_BACK = yard.back;

/** The view an era needs: everything the camp can own then is on screen (CLAUDE.md 6.2). */
export const viewFor = (era: string): View => (era === "hqm" ? yard.wide : yard.view);

/** The view before any era is known. */
export const VIEW: View = yard.view;

/**
 * The target a little left of the middle of the front edge, its stockpile at its right foot
 * (D217); the house at the camp's right.
 */
export const TARGET_SPOT: YardSpot = yard.target;
export const STOCKPILE_SPOT: YardSpot = yard.stockpile;
export const HOUSE_SPOT: YardSpot = yard.house;

/** `spot` in `era`: Armored's wider camp moves some things round the Crashed Plane (S3). */
function inEra(id: string, spot: YardSpot, era: string): YardSpot {
  const wide = viewFor(era) === yard.wide;
  const x = wide ? yard.wideX[id] : undefined;
  const y = wide ? yard.wideY[id] : undefined;
  return { x: x ?? spot.x, y: y ?? spot.y };
}

/** The Kettle's spot in `era` (R4): the back terrace, pushed left by Armored's shipbreaker. */
export function kettleSpotFor(era: string): YardSpot {
  return inEra("kettle", yard.kettle, era);
}

/** The rowboat's spot in `era` (R4). */
export function rowboatSpotFor(era: string): YardSpot {
  return inEra("rowboat", yard.rowboat, era);
}

/** Each outside line's spot in `era`. */
export function spotsFor(era: string): Record<string, YardSpot> {
  return Object.fromEntries(
    Object.entries(yard.spots).map(([id, spot]) => [id, inEra(id, spot, era)]),
  );
}

/** The stockpile's spot in `era`: clear of the Crashed Plane's tail in Armored's wider camp. */
export function stockpileSpotFor(era: string): YardSpot {
  return inEra("stockpile", STOCKPILE_SPOT, era);
}

/** The house's spot in `era`. */
export function houseSpotFor(era: string): YardSpot {
  return inEra("house", HOUSE_SPOT, era);
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

/** A spot in stage units: x, and y as an offset from the ground line (the front edge). */
export function stageSpot(spot: YardSpot): { x: number; y: number } {
  return { x: spot.x * ART, y: (spot.y - FRONT) * ART };
}
