/** The base upgrade screen. Spec: `docs/screens/build.md`. Ephemeral. */
import type { Amounts } from "../../content/schema";
import { type BaseState, isEmpty, nextTier, shortfall, tierOf } from "../../domain/base";
import { amountsLabel, amountsText, type TextContext } from "../amounts";
import { encodeCustomId } from "../customId";
import { abbrev, duration, relativeTimestamp } from "../format";
import type { Button, Screen } from "../screen";
import type { Tier } from "../theme";
import { navButtons } from "./nav";

export type BuildLast =
  | { kind: "started"; tier: Tier; endsAt: number; paid: Amounts }
  | { kind: "done_now"; tier: Tier; paid: Amounts };

export function buildScreen(ctx: TextContext, state: BaseState, last?: BuildLast): Screen {
  const { locale, content } = ctx;
  const name = (tier: Tier) => locale.t(`base_tier.${tier}.name`);
  const base = { id: "build", kind: "sub" as const, details: [] as string[] };

  if (last) {
    const paid = amountsText(ctx, last.paid) || "0";
    return {
      ...base,
      tone: "success",
      title:
        last.kind === "started"
          ? locale.t("screen.build.done_title", { tier: name(last.tier) })
          : locale.t("screen.build.done_now_title", { tier: name(last.tier) }),
      status:
        last.kind === "started"
          ? locale.t("screen.build.done_status", { when: relativeTimestamp(last.endsAt), paid })
          : locale.t("screen.build.done_now_status", { paid }),
      rows: [{ kind: "buttons", buttons: navButtons(ctx, "build", true).reverse() }],
    };
  }

  if (state.build) {
    return {
      ...base,
      tone: "accent",
      title: locale.t("screen.build.title_building", { tier: name(state.build.tier) }),
      status: locale.t("screen.build.status_building", {
        when: relativeTimestamp(state.build.endsAt),
      }),
      rows: [{ kind: "buttons", buttons: navButtons(ctx, "build", true) }],
    };
  }

  const target = nextTier(state.tier);
  if (!target) {
    return {
      ...base,
      tone: "neutral",
      title: locale.t("screen.build.title_maxed"),
      status: locale.t("screen.build.status_maxed", { tier: name(state.tier) }),
      rows: [{ kind: "buttons", buttons: navButtons(ctx, "build", true) }],
    };
  }

  const tier = tierOf(content, target);
  const missing = shortfall(tier.cost, state.stock);
  const affordable = Object.keys(missing).length === 0;
  const have: Amounts = {};
  for (const resource of Object.keys(tier.cost)) have[resource] = state.stock[resource] ?? 0;
  const left: Amounts = {};
  for (const [resource, cost] of Object.entries(tier.cost)) {
    left[resource] = (state.stock[resource] ?? 0) - cost;
  }

  const details = [
    tier.buildMinutes === 0
      ? locale.t("screen.build.duration_instant")
      : locale.t("screen.build.duration", { time: duration(tier.buildMinutes * 60) }),
    locale.t("screen.build.unlocks", {
      cap: abbrev(tier.storageCap),
      boxes: tier.boxSlots,
      furnaces: tier.furnaceSlots,
      workbench: tier.workbenchLevel,
    }),
    isEmpty(tier.upkeep)
      ? locale.t("screen.build.upkeep_none")
      : locale.t("screen.build.upkeep", {
          rates: amountsText(ctx, tier.upkeep, "rate").replaceAll("+", "-"),
        }),
    affordable
      ? locale.t("screen.build.after", { stock: amountsText(ctx, left) || "0" })
      : locale.t("screen.build.missing", { missing: amountsText(ctx, missing) }),
  ];

  const build: Button = affordable
    ? {
        customId: encodeCustomId({ owner: null, route: { screen: "build", action: "start" } }),
        label: locale.t("screen.build.build"),
        style: "primary",
      }
    : {
        customId: encodeCustomId({ owner: null, route: { screen: "build", action: "start" } }),
        label: locale.t("screen.build.build_locked", { missing: amountsLabel(ctx, missing) }),
        style: "secondary",
        disabled: true,
      };

  return {
    ...base,
    tone: affordable ? "accent" : "neutral",
    title: locale.t("screen.build.title", { tier: name(target) }),
    status: locale.t("screen.build.status", {
      cost: amountsText(ctx, tier.cost),
      have: amountsText(ctx, have) || "0",
    }),
    details,
    rows: [{ kind: "buttons", buttons: [build, ...navButtons(ctx, "build", !affordable)] }],
  };
}
