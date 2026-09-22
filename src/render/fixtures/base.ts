/**
 * Sample data for `pnpm preview` and snapshot tests. Deliberately includes the
 * worst cases a layout must survive: the longest player name Discord allows
 * (32 chars), zero of everything, everything capped, 7-digit amounts.
 */
import type { BaseCardProps } from "../cards/base";

/** One named state of a card: becomes `{card}__{state}.png`. */
export interface Fixture<Props> {
  state: "empty" | "normal" | "full" | "locked";
  props: Props;
}

/** Display order of `data/resources.json5`, minus scrap (shown in the header). */
export const RESOURCE_ORDER = [
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

function cells(amounts: number[]): BaseCardProps["resources"] {
  return amounts.map((amount, index) => ({ id: RESOURCE_ORDER[index] ?? "wood", amount }));
}

export const baseFixtures: Fixture<BaseCardProps>[] = [
  {
    state: "empty",
    props: {
      playerName: "Nakeds",
      tier: "twig",
      seasonDay: 1,
      scrap: 0,
      cap: 1_500,
      storage: { resource: "wood", value: 0 },
      // A fresh base has only ever seen wood and stone.
      resources: cells([0, 0]),
      tool: { id: "rock", tier: "twig" },
    },
  },
  {
    state: "normal",
    props: {
      playerName: "Soboj",
      tier: "twig",
      seasonDay: 3,
      scrap: 0,
      cap: 1_500,
      storage: { resource: "wood", value: 964 },
      resources: cells([964, 512, 118, 0, 48]),
      tool: { id: "stone_tools", tier: "wood" },
    },
  },
  {
    state: "full",
    props: {
      playerName: LONGEST_PLAYER_NAME,
      tier: "hqm",
      seasonDay: 31,
      scrap: 9_999_999,
      cap: 300_000,
      storage: { resource: "wood", value: 300_000 },
      resources: cells(RESOURCE_ORDER.map(() => 300_000)),
      tool: { id: "power_tools", tier: "hqm" },
    },
  },
];
