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
  gatherReadyAt,
  isStorageFull,
  storageCap,
  toolOf,
  total,
} from "../../domain/base";
import type { BaseCardProps } from "../../render/cards/base";
import { advise } from "../advisor";
import { amountsText, type TextContext } from "../amounts";
import { encodeCustomId } from "../customId";
import { relativeTimestamp } from "../format";
import { hintFor } from "../hints";
import { cardSafeName } from "../names";
import type { Button, Screen } from "../screen";
import { toneForFill } from "../theme";

export type LastAction =
  | { kind: "collect"; gained: Amounts }
  | { kind: "gather"; gained: Amounts; bonus: Amounts }
  | { kind: "cooldown"; readyAt: number }
  | { kind: "upgrade"; toolId: string };

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
  return {
    playerName: cardSafeName(playerName, ctx.locale),
    tier: state.tier,
    seasonDay: seasonDay(seasonStartedAt, now),
    scrap: state.stock.scrap ?? 0,
    storage: { value: total(state.stock), max: storageCap(ctx.content, state) },
    resources: ctx.content.resources
      .filter((resource) => resource.kind !== "currency" && state.stock[resource.id] !== undefined)
      .map((resource) => ({ id: resource.id, amount: state.stock[resource.id] ?? 0 })),
    tool: { id: tool.id, tier: tool.tier },
  };
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
  }
}

export function baseScreen(ctx: TextContext, input: BaseScreenInput): Screen {
  const { locale, content } = ctx;
  const { state, now } = input;
  const waiting = accrued(content, state, now);
  const full = isStorageFull(content, state, now);
  const fill = (total(state.stock) + total(waiting)) / storageCap(content, state);
  const readyAt = gatherReadyAt(content, state);
  const advice = advise(content, state, now);

  const id = (action: "collect" | "gather" | "tools" | "refresh") =>
    encodeCustomId({ owner: input.ownerId, route: { screen: "base", action } });
  const primary = (button: Button, when: boolean): Button =>
    when ? { ...button, style: "primary" } : button;

  const gatherButton: Button =
    readyAt <= now
      ? { customId: id("gather"), label: locale.t("screen.base.gather"), style: "secondary" }
      : {
          customId: id("gather"),
          label: locale.t("screen.base.gather_locked"),
          style: "secondary",
          disabled: true,
        };

  const details: string[] = [];
  if (input.last) details.push(lastActionLine(ctx, input.last));
  if (readyAt > now)
    details.push(locale.t("screen.base.cooldown", { when: relativeTimestamp(readyAt) }));

  const pct = Math.min(100, Math.floor(fill * 100));
  const status = full
    ? locale.t("screen.base.status_full")
    : total(waiting) > 0
      ? locale.t("screen.base.status", { pct, waiting: amountsText(ctx, waiting, "delta") })
      : locale.t("screen.base.status_nothing", { pct });

  const hint = hintFor(content, locale, state, advice, input.hintUses, now);
  return {
    id: "base",
    kind: "root",
    tone: full ? "danger" : toneForFill(fill) === "warning" ? "warning" : "accent",
    title: locale.t(input.playerName.endsWith("s") ? "screen.base.title_s" : "screen.base.title", {
      name: input.playerName,
    }),
    status,
    card: { fileName: "base.png", png: input.card },
    details,
    ...(hint ? { hint } : {}),
    rows: [
      {
        kind: "buttons",
        buttons: [
          primary(
            { customId: id("collect"), label: locale.t("screen.base.collect"), style: "secondary" },
            advice === "collect",
          ),
          primary(gatherButton, advice === "gather"),
          primary(
            { customId: id("tools"), label: locale.t("screen.base.tools"), style: "secondary" },
            advice === "tools",
          ),
          { customId: id("refresh"), label: locale.t("screen.base.refresh"), style: "secondary" },
        ],
      },
    ],
  };
}
