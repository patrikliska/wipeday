/**
 * The yard: where everything outside stands, how deep the ground runs and how the camera frames
 * it (D246, the owner's pick of P3's "Terrace"). R2's front row is kept on the ground's front
 * edge; two raised steps behind it (a low riser under each) carry the later eras, with props in
 * the gaps, and the camera looks down on it: about a third of a desktop is ground.
 *
 * Coordinates are art pixels: x across the stage's 320, y the feet line (the front edge at
 * `FRONT`, which is the stage's ground line 560).
 */

/** The front edge's feet line (art px): the stage's ground line. */
export const FRONT = 112;

/** A place in the yard: centre x and feet line y (art px). */
export interface YardSpot {
  x: number;
  y: number;
}

/** What the camera must always show (art px). */
export interface View {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface YardProp {
  /** The prop's art (`prop/<id>`). */
  id: string;
  x: number;
  y: number;
  mirror?: boolean;
  /** A lamp's bulb (art px from the feet: right, up): it glows at night on the `lights` layer. */
  light?: { x: number; y: number };
}

export interface Yard {
  /** The ground's far edge (art px): where the skyline's nearest layer meets it. */
  back: number;
  /** Terrace risers (art px): the feet line of the band each step raises, back to front. */
  steps: readonly number[];
  view: View;
  /** Armored's wider view (the Crashed Plane and the Scrapyard need it). */
  wide: View;
  /**
   * Where the camera puts the yard: on a desktop the front edge at `desktop` of the height; on
   * a phone the front edge `phone` art px above the drawer's top, so only a strip of ground
   * shows under the front row (the owner, P4).
   */
  camera: { desktop: number; phone: number };
  target: YardSpot;
  stockpile: YardSpot;
  house: YardSpot;
  /** Each outside line's spot. */
  spots: Readonly<Record<string, YardSpot>>;
  /** Armored's camp in the wider view: x overrides (the plane is 60 px wide). */
  wideX: Readonly<Record<string, number>>;
  /** Props standing in the yard's gaps, smaller ones toward the back. */
  props: readonly YardProp[];
  /** Where an airdrop hangs at its float's end (x, art px; y follows `back`). */
  dropX: number;
}

const VIEW_W = { left: 101, right: 257 } as const;
const WIDE_W = { left: 83, right: 277 } as const;

export const yard: Yard = {
  back: 62,
  steps: [93, 75],
  // 156 wide: a 390 px phone at DPR 2 shows it at exactly 5 device px per art pixel.
  view: { ...VIEW_W, top: 30, bottom: 124 },
  // 194 wide: the 390 px phone shows it at 4 device px per art pixel.
  wide: { ...WIDE_W, top: 30, bottom: 124 },
  camera: { desktop: 0.85, phone: 10 },
  target: { x: 166, y: 112 },
  stockpile: { x: 190, y: 112 },
  house: { x: 238, y: 112 },
  spots: {
    beachcomber: { x: 112, y: 112 },
    campfire: { x: 134, y: 112 },
    garden: { x: 211, y: 112 },
    dock: { x: 118, y: 93 },
    kiln: { x: 144, y: 93 },
    generator: { x: 204, y: 93 },
    radio_mast: { x: 228, y: 93 },
    shipbreaker: { x: 114, y: 75 },
    reactor: { x: 252, y: 75 },
  },
  wideX: {
    beachcomber: 100,
    campfire: 123,
    garden: 222,
    dock: 108,
    kiln: 150,
    generator: 206,
    radio_mast: 232,
    shipbreaker: 128,
    house: 254,
    stockpile: 203,
  },
  props: [
    { id: "car", x: 172, y: 75 },
    { id: "barrel", x: 178, y: 93 },
    { id: "rock", x: 214, y: 75, mirror: true },
    { id: "lamp", x: 255, y: 93, light: { x: 2, y: 25 } },
  ],
  dropX: 128,
};
