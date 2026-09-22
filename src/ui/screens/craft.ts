/** Workbench and crafting. Spec: `docs/screens/craft.md`. Ephemeral. */
import type { Amounts, Item, Recipe } from "../../content/schema";
import { type BaseState, craftable, tierOf, workbenchLevel } from "../../domain/base";
import { amountsText, type TextContext } from "../amounts";
import { encodeCustomId } from "../customId";
import type { Button, Screen, SelectOption } from "../screen";
import { navButtons } from "./nav";

export interface CraftLast {
  itemId: string;
  paid: Amounts;
}

const MAX_OPTIONS = 25;

function effect(ctx: TextContext, item: Item): string | null {
  if (item.capacity !== undefined)
    return ctx.locale.t("screen.craft.effect_storage", { capacity: item.capacity });
  if (item.workbenchLevel !== undefined)
    return ctx.locale.t("screen.craft.effect_workbench", { level: item.workbenchLevel });
  return null;
}

export function craftScreen(ctx: TextContext, state: BaseState, last?: CraftLast): Screen {
  const { locale, content } = ctx;
  const level = workbenchLevel(content, state);
  const itemOf = (recipe: Recipe) => content.items.find((item) => item.id === recipe.item);
  const itemName = (itemId: string) => locale.t(`item.${itemId}.name`);

  const all = craftable(content, state);
  const unlocked = all.filter((entry) => entry.unlocked);
  // Rule 11: affordable first, then cheapest workbench level, then file order.
  const sorted = [...unlocked].sort(
    (a, b) =>
      Number(Object.keys(a.missing).length > 0) - Number(Object.keys(b.missing).length > 0) ||
      a.recipe.workbench - b.recipe.workbench,
  );
  const options: SelectOption[] = sorted.slice(0, MAX_OPTIONS).flatMap((entry) => {
    const item = itemOf(entry.recipe);
    if (!item) return [];
    const affordable = Object.keys(entry.missing).length === 0;
    const parts = [amountsText(ctx, entry.recipe.cost) || "free"];
    const what = effect(ctx, item);
    if (what) parts.push(what);
    if (!affordable)
      parts.push(
        locale.t("screen.craft.option_locked", { missing: amountsText(ctx, entry.missing) }),
      );
    return [
      {
        value: item.id,
        label: `${affordable ? "" : "🔒 "}${itemName(item.id)}`,
        description: parts.join(" · ").slice(0, 100),
        emoji: ctx.emojis.component("item", item),
      },
    ];
  });

  const details: string[] = [];
  if (last) {
    details.push(
      `${locale.t("screen.craft.done_title", { item: itemName(last.itemId) })} · ${locale.t("screen.craft.done_status", { paid: amountsText(ctx, last.paid) || "0" })}`,
    );
  }
  const tierLevel = tierOf(content, state.tier).workbenchLevel;
  for (let next = level + 1; next <= 3; next++) {
    const names = content.recipes
      .filter((recipe) => recipe.workbench === next)
      .map((recipe) => itemName(recipe.item));
    if (names.length === 0) continue;
    const line = locale.t("screen.craft.locked_line", {
      level: next,
      items: names.slice(0, 6).join(", ") + (names.length > 6 ? "…" : ""),
    });
    details.push(next > tierLevel ? `${line} (needs a bigger base)` : line);
  }

  const again: Button | null = last
    ? {
        customId: encodeCustomId({
          owner: null,
          route: { screen: "craft", action: "again", item: last.itemId },
        }),
        label: locale.t("screen.craft.again"),
        style: "primary",
      }
    : null;
  const inventory: Button = {
    customId: encodeCustomId({ owner: null, route: { screen: "craft", action: "inventory" } }),
    label: locale.t("screen.craft.inventory"),
    style: "secondary",
  };

  return {
    id: "craft",
    kind: "sub",
    tone: last ? "success" : "accent",
    title: locale.t("screen.craft.title"),
    status:
      level === 0
        ? locale.t("screen.craft.status_none")
        : locale.t("screen.craft.status", { level, count: unlocked.length }),
    details,
    rows: [
      ...(options.length > 0
        ? [
            {
              kind: "select" as const,
              select: {
                customId: encodeCustomId({
                  owner: null,
                  route: { screen: "craft", action: "pick" },
                }),
                placeholder: locale.t("screen.craft.select"),
                options,
              },
            },
          ]
        : []),
      {
        kind: "buttons",
        buttons: [...(again ? [again] : []), inventory, ...navButtons(ctx, "craft", !again)],
      },
    ],
  };
}
