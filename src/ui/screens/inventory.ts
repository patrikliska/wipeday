/** The inventory screen. Spec: `docs/screens/inventory.md`. Ephemeral. */
import { type BaseState, boxesInUse, tierOf, workbenchLevel } from "../../domain/base";
import type { InventoryCardProps } from "../../render/cards/inventory";
import type { TextContext } from "../amounts";
import { encodeCustomId } from "../customId";
import type { Screen } from "../screen";
import { navButtons } from "./nav";

/** Category display order: what helps the base first, then gear. */
const CATEGORY_ORDER = [
  "storage",
  "workbench",
  "med",
  "weapon",
  "armor",
  "explosive",
  "defense",
  "keycard",
  "component",
];

export function inventoryCardProps(ctx: TextContext, state: BaseState): InventoryCardProps {
  const items = ctx.content.items
    .filter((item) => (state.items[item.id] ?? 0) > 0)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
    .map((item) => ({ id: item.id, count: state.items[item.id] ?? 0, tier: item.tier }));
  return {
    items,
    workbenchLevel: workbenchLevel(ctx.content, state),
    boxesUsed: boxesInUse(ctx.content, state),
    boxSlots: tierOf(ctx.content, state.tier).boxSlots,
  };
}

export function inventoryScreen(ctx: TextContext, state: BaseState, card: Buffer): Screen {
  const { locale } = ctx;
  const props = inventoryCardProps(ctx, state);
  const count = props.items.reduce((sum, item) => sum + item.count, 0);
  const canCraft = workbenchLevel(ctx.content, state) > 0;
  return {
    id: "inventory",
    kind: "sub",
    tone: "accent",
    title: locale.t("screen.inventory.title"),
    status:
      count === 0
        ? locale.t("screen.inventory.status_empty")
        : locale.t("screen.inventory.status", {
            count,
            used: props.boxesUsed,
            slots: props.boxSlots,
          }),
    card: { fileName: "inventory.png", png: card },
    details: [],
    rows: [
      {
        kind: "buttons",
        buttons: [
          {
            customId: encodeCustomId({
              owner: null,
              route: { screen: "inventory", action: "craft" },
            }),
            label: locale.t("screen.inventory.craft"),
            style: canCraft ? "primary" : "secondary",
          },
          ...navButtons(ctx, "inventory", !canCraft),
        ],
      },
    ],
  };
}
