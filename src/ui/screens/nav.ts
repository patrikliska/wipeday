/** Back and Home for ephemeral sub-screens (rule 2: never a dead end). */
import type { TextContext } from "../amounts";
import { encodeCustomId, type Route } from "../customId";
import type { Button } from "../screen";

type NavScreen = "tools" | "build" | "furnace" | "craft" | "inventory" | "node" | "tasks";

export function navButtons(ctx: TextContext, screen: NavScreen, backPrimary = false): Button[] {
  const id = (action: "back" | "home") =>
    encodeCustomId({ owner: null, route: { screen, action } as Route });
  return [
    {
      customId: id("back"),
      label: ctx.locale.t("nav.back"),
      style: backPrimary ? "primary" : "secondary",
      nav: "back",
    },
    { customId: id("home"), label: ctx.locale.t("nav.home"), style: "secondary", nav: "home" },
  ];
}
