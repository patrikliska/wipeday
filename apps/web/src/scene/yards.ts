/**
 * The yard: where everything outside stands, how deep the ground runs and how the camera frames
 * it (P3). `flat` is the camp as R2 Feel shipped it (one ground, a front and a back row, D209);
 * `terrace` and `camp` are the "deep yard" mocks for the owner to pick from: the camera looks
 * down more, the ground fills a third (terrace) or half (camp) of a desktop screen, and the lines
 * spread over three or four depth bands, with the unused props in the gaps. In dev, `?yard=`
 * picks one (`?zoom=` lifts the zoom cap for the 2k question); the build always shows `flat`.
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
}

export interface Yard {
  id: YardId;
  /** The ground's far edge (art px): where the skyline's nearest layer meets it. */
  back: number;
  /** Terrace risers (art px): the feet line of the band each step raises, back to front. */
  steps: readonly number[];
  view: View;
  /** Armored's wider view (the Crashed Plane and the Scrapyard need it). */
  wide: View;
  /**
   * Where the camera puts the yard: null keeps R2's rule (the front edge at 0.80-0.84 of a
   * desktop, 0.53 of a phone); otherwise the front edge at `desktop` of a desktop's height and
   * the target's middle at `phone` of a phone's.
   */
  camera: { desktop: number; phone: number } | null;
  target: YardSpot;
  stockpile: YardSpot;
  house: YardSpot;
  /** Each outside line's spot. */
  spots: Readonly<Record<string, YardSpot>>;
  /** Armored's camp in the wider view: x overrides (the plane is 60 px wide). */
  wideX: Readonly<Record<string, number>>;
  /** Unused props standing in the yard's gaps, smaller ones toward the back. */
  props: readonly YardProp[];
  /** Where an airdrop hangs at its float's end (x, art px; y follows `back`). */
  dropX: number;
}

export type YardId = "flat" | "terrace" | "camp";

const VIEW_W = { left: 101, right: 257 } as const;
const WIDE_W = { left: 83, right: 277 } as const;

/** R2 Feel's camp (D209, D214): the front row and the back row on one shallow ground. */
const flat: Yard = {
  id: "flat",
  back: 86,
  steps: [],
  // 156 wide: a 390 px phone at DPR 2 shows it at exactly 5 device px per art pixel.
  view: { ...VIEW_W, top: 40, bottom: 124 },
  // 194 wide: the 390 px phone shows it at 4 device px per art pixel.
  wide: { ...WIDE_W, top: 40, bottom: 124 },
  camera: null,
  target: { x: 166, y: 112 },
  stockpile: { x: 190, y: 112 },
  house: { x: 238, y: 112 },
  spots: {
    beachcomber: { x: 112, y: 112 },
    campfire: { x: 134, y: 112 },
    garden: { x: 211, y: 112 },
    shipbreaker: { x: 107, y: 90 },
    dock: { x: 128, y: 90 },
    kiln: { x: 153, y: 90 },
    generator: { x: 206, y: 90 },
    radio_mast: { x: 230, y: 90 },
    reactor: { x: 256, y: 90 },
  },
  wideX: {
    beachcomber: 100,
    campfire: 123,
    dock: 133,
    garden: 222,
    kiln: 166,
    generator: 210,
    house: 254,
    stockpile: 203,
  },
  props: [],
  dropX: 128,
};

/**
 * A "Terrace": R2's front row kept, two raised steps behind it (a low riser under each), the
 * later eras on the steps and props on the top one. About a third of a desktop is ground.
 */
const terrace: Yard = {
  id: "terrace",
  back: 62,
  steps: [93, 75],
  view: { ...VIEW_W, top: 30, bottom: 124 },
  wide: { ...WIDE_W, top: 30, bottom: 124 },
  camera: { desktop: 0.85, phone: 0.35 },
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
    { id: "lamp", x: 255, y: 93 },
  ],
  dropX: 128,
};

/**
 * B "Camp": one open yard in four bands, the camp spread in depth round the target. Twig's
 * three lines and the house frame the target in the first two bands; each later era fills the
 * bands behind; props stand in the gaps. About half of a desktop is ground.
 */
const camp: Yard = {
  id: "camp",
  back: 46,
  steps: [],
  view: { ...VIEW_W, top: 14, bottom: 124 },
  wide: { ...WIDE_W, top: 14, bottom: 124 },
  camera: { desktop: 0.85, phone: 0.35 },
  target: { x: 166, y: 112 },
  stockpile: { x: 190, y: 112 },
  house: { x: 236, y: 97 },
  spots: {
    beachcomber: { x: 132, y: 112 },
    garden: { x: 212, y: 112 },
    campfire: { x: 116, y: 97 },
    shipbreaker: { x: 122, y: 82 },
    kiln: { x: 146, y: 82 },
    generator: { x: 196, y: 82 },
    dock: { x: 112, y: 66 },
    radio_mast: { x: 224, y: 66 },
    reactor: { x: 254, y: 66 },
  },
  wideX: {
    beachcomber: 118,
    garden: 222,
    campfire: 100,
    shipbreaker: 120,
    kiln: 150,
    dock: 96,
    house: 248,
    stockpile: 203,
  },
  props: [
    { id: "barrel", x: 148, y: 97 },
    { id: "lamp", x: 158, y: 66 },
    { id: "car", x: 186, y: 66 },
    { id: "rock", x: 132, y: 54, mirror: true },
  ],
  dropX: 128,
};

export const YARDS: Readonly<Record<YardId, Yard>> = { flat, terrace, camp };

/** The dev switch: `?yard=terrace|camp`, read once at load; the build always shows `flat`. */
function pick(): Yard {
  if (!import.meta.env?.DEV || typeof window === "undefined") return flat;
  const id = new URLSearchParams(window.location.search).get("yard");
  return id && id in YARDS ? YARDS[id as YardId] : flat;
}

/** The yard on screen. */
export const yard: Yard = pick();

/** The dev zoom cap (`?zoom=10`), for the 2k question; null keeps the scene's own. */
export function devMaxZoom(): number | null {
  if (!import.meta.env?.DEV || typeof window === "undefined") return null;
  const zoom = Number(new URLSearchParams(window.location.search).get("zoom"));
  return Number.isFinite(zoom) && zoom >= 1 ? zoom : null;
}
