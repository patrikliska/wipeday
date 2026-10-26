import type { OrderDef } from "@wipe-day/content/schema";
import { TIERS } from "@wipe-day/content/tiers";
import { fuelled, orderClaimed, orderMet, orderProgress, ordersOf } from "@wipe-day/domain/orders";
import type { BaseState } from "@wipe-day/domain/state";
import { useEffect } from "react";
import { useAdvisor } from "../state/advisor";
import { useColumn } from "../state/layout";
import { useUi } from "../state/ui";
import { content, fmt, t } from "../state/world";
import { claimLabel, type Goal, GoalRow, Steps, send } from "./Goals";
import { Icon } from "./Icon";
import { SheetFrame } from "./Sheet";
import { questsView, TodayQuests } from "./Today";
import { useRise } from "./util";

/*
 * Work Orders (13-adventure.md 3; D255, D256): the run's checklist. A card at the top of the
 * shop's lines, never reordered (D186), with the running order and the steps to the set; a sheet
 * with the eight orders and the day's quests under "Today". Any five claimed complete the set;
 * R4 lights the Kettle and crowns the Big Red from it. Until R4 the set stands on its own
 * (D140: nothing here names what is not built).
 */

/** An order's icon: what it counts (D141: one icon per thing, the same everywhere). */
function orderIcon(order: OrderDef, base: BaseState): Goal["icon"] {
  const when = order.when;
  if (when.kind !== "state") return { kind: "ui", id: "rank" };
  switch (when.state) {
    case "era":
      return { kind: "tier", id: TIERS[when.gte ?? 0] ?? order.era };
    case "hands_working":
      return { kind: "ui", id: "hand" };
    case "line_owned":
      return { kind: "line", id: when.line ?? "beachcomber" };
    case "lines_min_owned":
    case "line_max_owned":
      return { kind: "ui", id: "roster" };
    case "run_taps":
      return { kind: "ui", id: "finger" };
    case "run_felled":
      return {
        kind: "target",
        id: content.targets.find((target) => target.era === base.run.era)?.id ?? "tree",
      };
    case "run_flotsam":
      return { kind: "flotsam", id: "crate" };
    case "run_gulls":
      return { kind: "ui", id: "gull" };
    case "run_frenzies":
      return { kind: "ui", id: "frenzy" };
    case "run_made":
      return { kind: "currency", id: "supplies" };
    default:
      return { kind: "ui", id: "rank" };
  }
}

export interface OrdersView {
  goals: Goal[];
  /** Claimed so far, and ready to claim now. */
  done: number;
  ready: number;
  /** `fuel` claimed: the set is complete. */
  complete: boolean;
  fuel: number;
}

/** The run's orders as goals, in their fixed order. */
export function ordersView(base: BaseState): OrdersView {
  const goals = ordersOf(content, base).map((order): Goal => {
    const claimed = orderClaimed(base, order.id);
    const met = !claimed && orderMet(content, base, order);
    return {
      key: `order:${order.id}`,
      icon: orderIcon(order, base),
      name: t(`order.${order.id}.name`),
      progress: orderProgress(content, base, order),
      pays: order.pays,
      state: claimed ? "claimed" : met ? "ready" : "open",
      claim: met ? { type: "claim_order", run: base.run.n, id: order.id } : null,
    };
  });
  return {
    goals,
    done: goals.filter((goal) => goal.state === "claimed").length,
    ready: goals.filter((goal) => goal.state === "ready").length,
    complete: fuelled(content, base),
    fuel: content.orders.fuel,
  };
}

/** The settled base the HUD reads each second, once the run owns a line (onboarding is over). */
function useOrdersBase(): BaseState | null {
  const base = useAdvisor((state) => state.view?.base ?? null);
  return base && Object.values(base.run.lines).some((n) => n > 0) ? base : null;
}

/**
 * The card at the top of the shop's lines: the next order and its progress (or "ready"), the
 * steps to the set, and one button: Claim when something is ready, Open otherwise. Never
 * orange: the shop's crown stays with the lines (D244). A claim flashes the card and pops the
 * steps (3.2); the complete set lights it gold.
 */
export function OrdersCard() {
  const base = useOrdersBase();
  const column = useColumn();
  const openSheet = useUi((state) => state.openSheet);
  const view = base ? ordersView(base) : null;
  const rose = useRise(view?.done ?? 0);
  if (!base || !view) return null;
  const next =
    view.goals.find((goal) => goal.state === "ready") ??
    view.goals.find((goal) => goal.state === "open");
  const sub = view.complete
    ? t("orders.complete_sub", { done: view.done, of: view.goals.length })
    : next
      ? next.state === "ready"
        ? t("orders.next_ready", { name: next.name })
        : next.progress
          ? t("orders.next_progress", {
              name: next.name,
              value: fmt(Math.min(next.progress.value, next.progress.goal), "held"),
              goal: fmt(next.progress.goal, "cost"),
            })
          : next.name
      : "";
  const claimAll = () => {
    for (const goal of view.goals) if (goal.state === "ready") send(goal.claim);
  };
  return (
    <div
      className={`card kind-orders orders-card${view.complete ? " complete" : ""}`}
      data-key="orders"
    >
      {rose > 0 ? <span key={`flash-${rose}`} className="card-flash" aria-hidden="true" /> : null}
      <div className="thumb">
        <Icon kind="ui" id="rank" size={column ? 44 : 38} className="thumb-icon" />
        {view.ready > 0 ? (
          <span key={`ready-${view.ready}`} className="ready-mark num pop">
            <span aria-hidden="true">✓</span>
            {view.ready > 1 ? view.ready : null}
          </span>
        ) : null}
      </div>
      <div className="mid">
        <div className="name">{t("orders.title")}</div>
        <div className="sub">{sub}</div>
        <Steps done={Math.min(view.done, view.fuel)} of={view.fuel} />
      </div>
      <button
        type="button"
        className="btn buy"
        aria-label={
          view.ready > 0
            ? t("orders.claim_label", { count: view.ready })
            : t("orders.open_label", { done: view.done, of: view.fuel })
        }
        onClick={() => (view.ready > 0 ? claimAll() : openSheet("orders"))}
      >
        <span className="buy-top">{view.ready > 0 ? t("goals.claim") : t("orders.open")}</span>
        <span className="buy-cost num">
          {t("orders.steps", { done: Math.min(view.done, view.fuel), of: view.fuel })}
        </span>
      </button>
    </div>
  );
}

/**
 * The orders sheet: the steps and the run in the head, the set's rule above the list (it is the
 * point), the eight orders, then "Today" with the day's quests. One primary: Claim every ready
 * reward, or Done.
 */
export function OrdersSheet() {
  const sheet = useUi((state) => state.sheet);
  const openSheet = useUi((state) => state.openSheet);
  const base = useOrdersBase();
  const open = sheet === "orders";
  useEffect(() => {
    if (open && !base) openSheet(null);
  }, [open, base, openSheet]);
  if (!open || !base) return null;
  const view = ordersView(base);
  const quests = questsView(base);
  const ready = view.ready + quests.ready;
  const close = () => openSheet(null);
  const claimAll = () => {
    for (const goal of [...view.goals, ...quests.goals])
      if (goal.state === "ready") send(goal.claim);
    if (ready === 0) close();
  };
  const spare = view.goals.length - view.fuel;
  return (
    <SheetFrame
      id="orders"
      className="orders-sheet"
      title={t("orders.title")}
      head={
        <p className="sub orders-head">
          <Steps done={Math.min(view.done, view.fuel)} of={view.fuel} small />
          <span>
            {view.complete
              ? t("orders.head_complete", { of: view.fuel })
              : t("orders.head", { done: view.done, of: view.fuel, run: base.run.n })}
          </span>
        </p>
      }
      primary={claimLabel(ready)}
      onPrimary={claimAll}
      onClose={close}
    >
      <div className={`set-box${view.complete ? " lit" : ""}`}>
        <Icon kind="ui" id="rank" size={28} />
        <span>
          {view.complete
            ? t("orders.set_complete", { spare })
            : t("orders.set_rule", { fuel: view.fuel, count: view.goals.length, spare })}
        </span>
      </div>
      <ul className="goals">
        {view.goals.map((goal) => (
          <GoalRow key={goal.key} goal={goal} />
        ))}
      </ul>
      <TodayQuests base={base} inSheet />
    </SheetFrame>
  );
}
