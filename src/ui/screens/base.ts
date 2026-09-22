/**
 * The home screen. Spec: `docs/screens/base.md`.
 *
 * Pure: takes state, the rendered card and what the last click did, returns
 * a `Screen`. The interaction layer decides how it is sent.
 */
import type { Amounts } from "../../content/schema";
import {
  accrued,
  type BaseState,
  furnaceOf,
  furnaceReady,
  gatherReadyAt,
  isDecaying,
  isEmpty,
  isStorageFull,
  jobEndsAt,
  type SettleEvent,
  storageCap,
  storageFill,
  tierOf,
  toolOf,
  total,
  upkeepCoverHours,
} from "../../domain/base";
import type { BaseCardProps } from "../../render/cards/base";
import { advise, revealed } from "../advisor";
import { amountsText, type TextContext } from "../amounts";
import { type BASE_ACTIONS, encodeCustomId } from "../customId";
import { duration, relativeTimestamp } from "../format";
import { hintFor } from "../hints";
import { cardSafeName } from "../names";
import type { Button, Screen } from "../screen";
import { type Tier, toneForFill } from "../theme";

type BaseAction = (typeof BASE_ACTIONS)[number];

export type LastAction =
  | { kind: "collect"; gained: Amounts }
  | { kind: "gather"; gained: Amounts; bonus: Amounts }
  | { kind: "cooldown"; readyAt: number }
  | { kind: "upgrade"; toolId: string }
  | { kind: "build_started"; tier: Tier; endsAt: number }
  | { kind: "built"; tier: Tier }
  | { kind: "decayed"; tier: Tier };

export interface BaseScreenInput {
  /** Discord user id: only this user may click. */
  ownerId: string;
  playerName: string;
  state: BaseState;
  seasonStartedAt: number;
  now: number;
  hintUses: Record<string, number>;
  card: Buffer;
  last?: LastAction;
  /** What settling to `now` did, shown as lines so nothing happens silently. */
  settled?: SettleEvent[];
}

export function seasonDay(seasonStartedAt: number, now: number): number {
  return Math.max(1, Math.floor((now - seasonStartedAt) / 86_400) + 1);
}

/** The card's view model from state: what the player *has*. */
export function baseCardProps(
  ctx: TextContext,
  playerName: string,
  state: BaseState,
  seasonStartedAt: number,
  now: number,
): BaseCardProps {
  const tool = toolOf(ctx.content, state);
  const fill = storageFill(ctx.content, state, now);
  return {
    playerName: cardSafeName(playerName, ctx.locale),
    tier: state.tier,
    seasonDay: seasonDay(seasonStartedAt, now),
    scrap: state.stock.scrap ?? 0,
    cap: storageCap(ctx.content, state),
    storage: { resource: fill.resource, value: state.stock[fill.resource] ?? 0 },
    resources: ctx.content.resources
      .filter((resource) => resource.kind !== "currency" && state.stock[resource.id] !== undefined)
      .map((resource) => ({ id: resource.id, amount: state.stock[resource.id] ?? 0 })),
    tool: { id: tool.id, tier: tool.tier },
  };
}

function tierName(ctx: TextContext, tier: Tier): string {
  return ctx.locale.t(`base_tier.${tier}.name`);
}

function lastActionLine(ctx: TextContext, last: LastAction): string {
  const { locale } = ctx;
  switch (last.kind) {
    case "collect":
      return total(last.gained) > 0
        ? locale.t("screen.base.collected", { amounts: amountsText(ctx, last.gained, "delta") })
        : locale.t("screen.base.collected_nothing");
    case "gather":
      return total(last.gained) > 0
        ? locale.t("screen.base.gathered_with", {
            bonus: amountsText(ctx, last.bonus, "delta"),
            amounts: amountsText(ctx, last.gained, "delta"),
          })
        : locale.t("screen.base.gathered", { bonus: amountsText(ctx, last.bonus, "delta") });
    case "cooldown":
      return locale.t("screen.base.cooldown_hit", { when: relativeTimestamp(last.readyAt) });
    case "upgrade":
      return locale.t("screen.base.upgraded", { tool: locale.t(`tool.${last.toolId}.name`) });
    case "build_started":
      return locale.t("screen.base.build_started", {
        tier: tierName(ctx, last.tier),
        when: relativeTimestamp(last.endsAt),
      });
    case "built":
      return locale.t("screen.base.built", { tier: tierName(ctx, last.tier) });
    case "decayed":
      return locale.t("screen.base.decayed", { tier: tierName(ctx, last.tier) });
  }
}

/** Settle events worth a line: a landed build, a lost tier. Upkeep payments stay quiet. */
export function settledLines(ctx: TextContext, events: SettleEvent[]): string[] {
  const lines: string[] = [];
  for (const event of events) {
    if (event.type === "build_done") {
      lines.push(lastActionLine(ctx, { kind: "built", tier: event.tier }));
    }
    if (event.type === "decayed") {
      lines.push(lastActionLine(ctx, { kind: "decayed", tier: event.to }));
    }
  }
  return lines;
}

export function baseScreen(ctx: TextContext, input: BaseScreenInput): Screen {
  const { locale, content } = ctx;
  const { state, now } = input;
  const waiting = accrued(content, state, now);
  const full = isStorageFull(content, state, now);
  const fill = storageFill(content, state, now);
  const resourceName = locale.t(`resource.${fill.resource}.name`);
  const readyAt = gatherReadyAt(content, state);
  const decaying = isDecaying(content, state, now);
  const advice = advise(content, state, now);
  const show = revealed(content, state);

  const id = (action: BaseAction) =>
    encodeCustomId({ owner: input.ownerId, route: { screen: "base", action } });
  const button = (action: BaseAction, labelKey: string): Button => ({
    customId: id(action),
    label: locale.t(labelKey),
    style: advice === action ? "primary" : "secondary",
  });

  const gatherButton: Button =
    readyAt <= now
      ? button("gather", "screen.base.gather")
      : {
          customId: id("gather"),
          label: locale.t("screen.base.gather_locked"),
          style: "secondary",
          disabled: true,
        };

  // --- text ------------------------------------------------------------------
  const details: string[] = [...settledLines(ctx, input.settled ?? [])];
  if (input.last) details.push(lastActionLine(ctx, input.last));
  if (readyAt > now) {
    details.push(locale.t("screen.base.cooldown", { when: relativeTimestamp(readyAt) }));
  }
  const upkeep = tierOf(content, state.tier).upkeep;
  if (!isEmpty(upkeep)) {
    details.push(
      decaying
        ? locale.t("screen.base.upkeep_decaying", {
            when: relativeTimestamp(
              state.upkeepPaidUntil + content.baseRules.tierLossAfterHours * 3600,
            ),
          })
        : locale.t("screen.base.upkeep", {
            rates: amountsText(ctx, upkeep, "rate").replaceAll("+", "-"),
            time: duration(upkeepCoverHours(content, state) * 3600),
          }),
    );
  }
  const furnace = furnaceOf(content, state);
  if (furnace) {
    const ready = furnaceReady(content, state, now);
    if (!isEmpty(ready)) {
      details.push(locale.t("screen.base.furnace_ready", { amounts: amountsText(ctx, ready) }));
    } else if (state.furnaceJobs.length > 0) {
      const next = Math.min(...state.furnaceJobs.map((job) => jobEndsAt(furnace, job)));
      details.push(
        locale.t("screen.base.furnace_busy", {
          count: state.furnaceJobs.length,
          when: relativeTimestamp(next),
        }),
      );
    }
  }

  const pct = Math.min(100, Math.floor(fill.fraction * 100));
  let status: string;
  if (state.build) {
    status = locale.t("screen.base.status_building", {
      tier: tierName(ctx, state.build.tier),
      when: relativeTimestamp(state.build.endsAt),
    });
  } else if (full) {
    status = locale.t("screen.base.status_full", { resource: resourceName });
  } else if (total(waiting) > 0) {
    status = locale.t("screen.base.status", {
      pct,
      resource: resourceName,
      waiting: amountsText(ctx, waiting, "delta"),
    });
  } else {
    status = locale.t("screen.base.status_nothing", { pct, resource: resourceName });
  }

  const hint = hintFor(content, locale, state, advice, input.hintUses, now);
  const rowOne: Button[] = [
    button("collect", "screen.base.collect"),
    gatherButton,
    button("tools", "screen.base.tools"),
    button("build", "screen.base.build"),
    { customId: id("refresh"), label: locale.t("screen.base.refresh"), style: "secondary" },
  ];
  const rowTwo: Button[] = [];
  if (show.furnace) rowTwo.push(button("furnace", "screen.base.furnace"));
  if (show.craft) rowTwo.push(button("craft", "screen.base.craft"));
  if (show.inventory) rowTwo.push(button("inventory", "screen.base.inventory"));

  let tone: Screen["tone"] = "accent";
  if (decaying || full) tone = "danger";
  else if (toneForFill(fill.fraction) === "warning") tone = "warning";

  return {
    id: "base",
    kind: "root",
    tone,
    title: locale.t(input.playerName.endsWith("s") ? "screen.base.title_s" : "screen.base.title", {
      name: input.playerName,
    }),
    status,
    card: { fileName: "base.png", png: input.card },
    details,
    ...(hint ? { hint } : {}),
    rows: [
      { kind: "buttons", buttons: rowOne },
      ...(rowTwo.length > 0 ? [{ kind: "buttons" as const, buttons: rowTwo }] : []),
    ],
  };
}
