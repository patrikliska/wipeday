/**
 * Sample data for `pnpm preview` and snapshot tests. Deliberately includes the
 * worst cases a layout must survive: the longest player name Discord allows
 * (32 chars), zero of everything, everything capped, 7-digit amounts.
 */
import type { DemoCardProps, ResourceCell } from "../cards/demo";

/** One named state of a card: becomes `{card}__{state}.png`. */
export interface Fixture<Props> {
  state: "empty" | "normal" | "full" | "locked";
  props: Props;
}

/** Display order of `data/resources.json5`, minus scrap (shown in the header). */
const RESOURCES = [
  "wood",
  "stone",
  "metal_ore",
  "metal_fragments",
  "sulfur_ore",
  "sulfur",
  "hqm_ore",
  "hqm",
  "cloth",
  "leather",
  "low_grade_fuel",
] as const;

/** Longest name Discord permits. */
export const LONGEST_PLAYER_NAME = "MaximilianTheRoofCamper_Official";

const HOUR = 3_600;

function cells(amounts: Array<[amount: number, perHour: number]>): ResourceCell[] {
  return amounts.map(([amount, perHour], index) => ({
    id: RESOURCES[index] ?? "wood",
    amount,
    perHour,
  }));
}

export const demoFixtures: Fixture<DemoCardProps>[] = [
  {
    state: "empty",
    props: {
      playerName: "Nakeds",
      tier: "twig",
      seasonDay: 1,
      scrap: 0,
      storage: { value: 0, max: 1_000 },
      upkeep: null,
      // A fresh base has only ever seen wood and stone.
      resources: cells([
        [0, 0],
        [0, 0],
      ]),
      tool: { id: "rock", tier: "twig" },
    },
  },
  {
    state: "normal",
    props: {
      playerName: "Soboj",
      tier: "stone",
      seasonDay: 12,
      scrap: 1_284,
      storage: { value: 12_449, max: 20_000 },
      upkeep: { value: 18 * HOUR + 40 * 60, max: 72 * HOUR },
      resources: cells([
        [4_210, 620],
        [3_875, 540],
        [1_480, 210],
        [964, 0],
        [820, 95],
        [312, 0],
        [41, 6],
        [0, 0],
        [530, 48],
        [117, 12],
        [100, 9],
      ]),
      tool: { id: "metal_tools", tier: "stone" },
    },
  },
  {
    state: "full",
    props: {
      playerName: LONGEST_PLAYER_NAME,
      tier: "hqm",
      seasonDay: 31,
      scrap: 9_999_999,
      storage: { value: 9_999_999, max: 9_999_999 },
      upkeep: { value: 0, max: 72 * HOUR },
      resources: cells(RESOURCES.map(() => [9_999_999, 1_234_567])),
      tool: { id: "salvaged_tools", tier: "metal" },
    },
  },
];
