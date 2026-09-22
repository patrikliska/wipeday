/** Storage and furnaces. Spec: `docs/screens/furnace.md`. Ephemeral. */
import type { Amounts } from "../../content/schema";
import {
  type BaseState,
  fuelFor,
  furnaceOf,
  furnaceReady,
  furnaceSlots,
  isEmpty,
  jobEndsAt,
  jobProgress,
  nextFurnace,
  shortfall,
  smeltable,
} from "../../domain/base";
import { amountsLabel, amountsText, type TextContext } from "../amounts";
import { encodeCustomId } from "../customId";
import { abbrev, duration, relativeTimestamp } from "../format";
import type { Button, Screen, SelectOption } from "../screen";
import { navButtons } from "./nav";

export type FurnaceLast =
  | { kind: "collected"; gained: Amounts }
  | { kind: "started"; ore: string; amount: number; fuel: number; endsAt: number }
  | { kind: "bought"; furnaceId: string; paid: Amounts };

const id = (action: "smelt" | "collect" | "buy") =>
  encodeCustomId({ owner: null, route: { screen: "furnace", action } });

export function furnaceScreen(
  ctx: TextContext,
  state: BaseState,
  now: number,
  last?: FurnaceLast,
): Screen {
  const { locale, content } = ctx;
  const resourceName = (resource: string) => locale.t(`resource.${resource}.name`);
  const furnaceName = (furnaceId: string) => locale.t(`furnace.${furnaceId}.name`);
  const furnace = furnaceOf(content, state);
  const next = nextFurnace(content, state);
  const details: string[] = [];

  if (last?.kind === "collected") {
    details.push(
      isEmpty(last.gained)
        ? locale.t("screen.furnace.collected_none")
        : locale.t("screen.furnace.collected_title", {
            amounts: amountsText(ctx, last.gained, "delta"),
          }),
    );
  } else if (last?.kind === "started") {
    details.push(
      `${locale.t("screen.furnace.started_title", { amount: abbrev(last.amount), ore: resourceName(last.ore) })} · ${locale.t("screen.furnace.started_status", { when: relativeTimestamp(last.endsAt), fuel: abbrev(last.fuel) })}`,
    );
  } else if (last?.kind === "bought") {
    const bought = content.furnaces.find((candidate) => candidate.id === last.furnaceId);
    details.push(
      `${locale.t("screen.furnace.bought_title", { furnace: furnaceName(last.furnaceId) })} · ${locale.t("screen.furnace.bought_status", { paid: amountsText(ctx, last.paid) || "0", rate: bought?.orePerHour ?? 0 })}`,
    );
  }

  // Buy / upgrade button, shared by both states.
  const buyButton = (): Button | null => {
    if (!next) return null;
    const missing = shortfall(next.cost, state.stock);
    const affordable = Object.keys(missing).length === 0;
    const key = furnace ? "upgrade" : "buy";
    return affordable
      ? {
          customId: id("buy"),
          label: locale.t(`screen.furnace.${key}`, { furnace: furnaceName(next.id) }),
          style: "secondary",
        }
      : {
          customId: id("buy"),
          label: locale.t(`screen.furnace.${key}_locked`, {
            furnace: furnaceName(next.id),
            missing: amountsLabel(ctx, missing),
          }),
          style: "secondary",
          disabled: true,
        };
  };

  if (!furnace) {
    const first = next;
    const buy = buyButton();
    const affordable = buy !== null && !buy.disabled;
    return {
      id: "furnace",
      kind: "sub",
      tone: affordable ? "accent" : "neutral",
      title: locale.t("screen.furnace.title_none"),
      status: first
        ? locale.t("screen.furnace.status_none", {
            furnace: furnaceName(first.id),
            cost: amountsText(ctx, first.cost),
          })
        : locale.t("screen.furnace.title_none"),
      details,
      rows: [
        {
          kind: "buttons",
          buttons: [
            ...(buy ? [affordable ? { ...buy, style: "primary" as const } : buy] : []),
            ...navButtons(ctx, "furnace", !affordable),
          ],
        },
      ],
    };
  }

  const slots = furnaceSlots(content, state);
  for (let index = 0; index < slots; index++) {
    const job = state.furnaceJobs[index];
    if (!job) {
      details.push(locale.t("screen.furnace.slot_empty", { n: index + 1 }));
      continue;
    }
    const ready = jobProgress(furnace, job, now) - job.collected;
    const done = jobProgress(furnace, job, now) >= job.amount;
    details.push(
      done
        ? locale.t("screen.furnace.slot_done", {
            n: index + 1,
            ready: abbrev(ready),
            output: resourceName(job.output),
          })
        : locale.t("screen.furnace.slot_busy", {
            n: index + 1,
            amount: abbrev(job.amount),
            ore: resourceName(job.input),
            output: resourceName(job.output),
            when: relativeTimestamp(jobEndsAt(furnace, job)),
          }),
    );
  }
  const ready = furnaceReady(content, state, now);
  if (!isEmpty(ready))
    details.push(locale.t("screen.furnace.ready", { amounts: amountsText(ctx, ready) }));

  const options: SelectOption[] = [];
  if (state.furnaceJobs.length < slots) {
    for (const resource of content.resources) {
      if (!resource.smeltsInto || (state.stock[resource.id] ?? 0) <= 0) continue;
      const amount = smeltable(content, state, resource.id);
      const output = content.resources.find((candidate) => candidate.id === resource.smeltsInto);
      if (!output) continue;
      options.push({
        value: resource.id,
        label: locale.t("screen.furnace.option_label", {
          amount: abbrev(amount),
          ore: resourceName(resource.id),
        }),
        description:
          amount > 0
            ? locale.t("screen.furnace.option_desc", {
                amount: abbrev(amount),
                output: resourceName(output.id),
                fuel: abbrev(fuelFor(furnace, amount)),
                time: duration(Math.ceil((amount * 3600) / furnace.orePerHour)),
              })
            : locale.t("screen.furnace.option_no_fuel"),
        emoji: ctx.emojis.component("resource", resource),
      });
    }
  }

  const collect: Button = {
    customId: id("collect"),
    label: locale.t("screen.furnace.collect"),
    style: isEmpty(ready) ? "secondary" : "primary",
    ...(isEmpty(ready) ? { disabled: true } : {}),
  };
  const buy = buyButton();
  const primaryTaken = !isEmpty(ready);
  const buttons: Button[] = [
    collect,
    ...(buy ? [buy] : []),
    ...navButtons(ctx, "furnace", !primaryTaken && options.length === 0),
  ];
  // A disabled Take out must not be primary; when the select is the action, Back leads.
  if (collect.disabled) collect.label = locale.t("screen.furnace.collect");

  return {
    id: "furnace",
    kind: "sub",
    tone: primaryTaken ? "success" : "accent",
    title: locale.t("screen.furnace.title"),
    status: locale.t("screen.furnace.status", {
      furnace: furnaceName(furnace.id),
      busy: state.furnaceJobs.length,
      slots,
    }),
    details,
    rows: [
      ...(options.length > 0
        ? [
            {
              kind: "select" as const,
              select: {
                customId: id("smelt"),
                placeholder: locale.t("screen.furnace.select"),
                options,
              },
            },
          ]
        : []),
      {
        kind: "buttons",
        buttons:
          primaryTaken || options.length === 0
            ? buttons
            : buttons.map((b) => (b.nav === "back" ? { ...b, style: "primary" as const } : b)),
      },
    ],
  };
}
