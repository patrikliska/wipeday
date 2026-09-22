/**
 * The gathering-tool upgrade screen and its result. Spec: `docs/screens/tools.md`.
 * Ephemeral, so customIds carry no owner.
 */
import type { Amounts, Tool } from "../../content/schema";
import { type BaseState, nextTool, shortfall, toolOf } from "../../domain/base";
import { amountsLabel, amountsText, type TextContext } from "../amounts";
import { encodeCustomId } from "../customId";
import { perHour } from "../format";
import type { Button, Screen } from "../screen";

const id = (action: "upgrade" | "back" | "home") =>
  encodeCustomId({ owner: null, route: { screen: "tools", action } });

function navButtons(ctx: TextContext, backPrimary: boolean): Button[] {
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

/** Rate lines for every resource the new tool gathers, current tool for comparison. */
function rateLines(ctx: TextContext, from: Amounts, to: Tool): string[] {
  const lines: string[] = [];
  for (const resource of ctx.content.resources) {
    const after = to.rates[resource.id];
    if (after === undefined) continue;
    const before = from[resource.id];
    const label = `${ctx.emojis.text("resource", resource)} ${ctx.locale.t(`resource.${resource.id}.name`)}`;
    lines.push(
      before === undefined
        ? ctx.locale.t("screen.tools.rate_new", { resource: label, after: perHour(after) })
        : ctx.locale.t("screen.tools.rate_line", {
            resource: label,
            before: perHour(before),
            after: perHour(after),
          }),
    );
  }
  return lines;
}

export function toolsScreen(ctx: TextContext, state: BaseState): Screen {
  const { locale } = ctx;
  const current = toolOf(ctx.content, state);
  const next = nextTool(ctx.content, state);

  if (!next) {
    return {
      id: "tools",
      kind: "sub",
      tone: "neutral",
      title: locale.t("screen.tools.title_maxed"),
      status: locale.t("screen.tools.status_maxed", { tool: locale.t(`tool.${current.id}.name`) }),
      details: [],
      rows: [{ kind: "buttons", buttons: navButtons(ctx, true) }],
    };
  }

  const missing = shortfall(next.cost, state.stock);
  const affordable = Object.keys(missing).length === 0;
  const have: Amounts = {};
  for (const resource of Object.keys(next.cost)) have[resource] = state.stock[resource] ?? 0;
  const left: Amounts = {};
  for (const [resource, cost] of Object.entries(next.cost))
    left[resource] = (state.stock[resource] ?? 0) - cost;

  const upgrade: Button = affordable
    ? { customId: id("upgrade"), label: locale.t("screen.tools.upgrade"), style: "primary" }
    : {
        customId: id("upgrade"),
        label: locale.t("screen.tools.upgrade_locked", { missing: amountsLabel(ctx, missing) }),
        style: "secondary",
        disabled: true,
      };

  const details = [locale.t("screen.tools.rates"), ...rateLines(ctx, current.rates, next)];
  details.push(
    affordable
      ? locale.t("screen.tools.after", { stock: amountsText(ctx, left) || "0" })
      : locale.t("screen.tools.missing", { missing: amountsText(ctx, missing) }),
  );

  return {
    id: "tools",
    kind: "sub",
    tone: affordable ? "accent" : "neutral",
    title: locale.t("screen.tools.title", { tool: locale.t(`tool.${next.id}.name`) }),
    status: locale.t("screen.tools.status", {
      cost: amountsText(ctx, next.cost),
      have: amountsText(ctx, have) || "0",
    }),
    details,
    rows: [{ kind: "buttons", buttons: [upgrade, ...navButtons(ctx, !affordable)] }],
  };
}

/** After a successful upgrade: what was paid, what changes, and the way back. */
export function toolsDoneScreen(ctx: TextContext, tool: Tool, paid: Amounts): Screen {
  const { locale } = ctx;
  return {
    id: "tools_done",
    kind: "sub",
    tone: "success",
    title: locale.t("screen.tools.done_title", { tool: locale.t(`tool.${tool.id}.name`) }),
    status: locale.t("screen.tools.done_status", { paid: amountsText(ctx, paid) || "0" }),
    details: [
      locale.t("screen.tools.done_detail", { rates: amountsText(ctx, tool.rates, "rate") }),
    ],
    rows: [
      {
        kind: "buttons",
        buttons: [
          { customId: id("home"), label: locale.t("nav.home"), style: "primary", nav: "home" },
          { customId: id("back"), label: locale.t("nav.back"), style: "secondary", nav: "back" },
        ],
      },
    ],
  };
}
