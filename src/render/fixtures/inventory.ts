/** Inventory card fixtures: nothing, a young base, and a hoarder's worst case. */

import type { Tier } from "../../ui/theme";
import type { InventoryCardProps } from "../cards/inventory";
import type { Fixture } from "./base";

const item = (id: string, count: number, tier: Tier) => ({ id, count, tier });

export const inventoryFixtures: Fixture<InventoryCardProps>[] = [
  { state: "empty", props: { items: [], workbenchLevel: 0, boxesUsed: 0, boxSlots: 2 } },
  {
    state: "normal",
    props: {
      items: [
        item("wood_box", 2, "wood"),
        item("workbench_1", 1, "wood"),
        item("bandage", 6, "twig"),
        item("bow", 1, "twig"),
        item("hide_poncho", 1, "twig"),
      ],
      workbenchLevel: 1,
      boxesUsed: 2,
      boxSlots: 4,
    },
  },
  {
    state: "full",
    props: {
      items: [
        item("wood_box", 4, "wood"),
        item("large_box", 12, "stone"),
        item("workbench_3", 1, "hqm"),
        item("medkit", 1234, "metal"),
        item("syringe", 9999, "stone"),
        item("ak47", 2048, "hqm"),
        item("bolt_rifle", 512, "hqm"),
        item("semi_rifle", 64, "metal"),
        item("thompson", 32, "metal"),
        item("double_barrel", 16, "stone"),
        item("metal_chestplate", 8, "hqm"),
        item("metal_facemask", 8, "hqm"),
        item("roadsign_jacket", 4, "metal"),
        item("coffee_can_helmet", 4, "metal"),
        item("c4", 1000, "hqm"),
        item("rocket", 2500, "hqm"),
        item("satchel_charge", 300, "stone"),
        item("auto_turret", 12, "hqm"),
        item("flame_turret", 6, "metal"),
        item("keycard_red", 3, "hqm"),
        item("targeting_computer", 77, "hqm"),
        item("tech_trash", 1500, "metal"),
        item("rifle_body", 45, "hqm"),
        item("gears", 9999, "stone"),
      ],
      workbenchLevel: 3,
      boxesUsed: 16,
      boxSlots: 16,
    },
  },
];
