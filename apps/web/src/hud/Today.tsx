import type { QuestDef } from "@wipe-day/content/schema";
import {
  nextQuestRoll,
  questClaimed,
  questMet,
  questProgress,
  questsOf,
} from "@wipe-day/domain/quests";
import type { BaseState } from "@wipe-day/domain/state";
import { useWorld } from "../state/store";
import { content, duration, t } from "../state/world";
import { type Goal, GoalRow } from "./Goals";
import { Icon, ResourceIcon } from "./Icon";

/*
 * The day's quests (12-feel.md 9.2; D248, D257): three a day on the island's clock, the same for
 * every friend, under "Today" in the orders sheet and at the top of the Logbook. Each pays its
 * scrap when claimed; all three pay the set's drop and scrap. Unclaimed ones are paid at the
 * roll, so a missed tap costs nothing (the Ready rows say so with their own Claim).
 */

/** A quest's icon: what its counter counts. */
function questIcon(quest: QuestDef, base: BaseState): Goal["icon"] {
  switch (quest.stat) {
    case "taps":
      return { kind: "ui", id: "finger" };
    case "hands":
      return { kind: "ui", id: "hand" };
    case "flotsam":
      return { kind: "flotsam", id: "crate" };
    case "drops":
      return { kind: "flotsam", id: "sealed_locker" };
    case "felled":
      return {
        kind: "target",
        id: content.targets.find((target) => target.era === base.run.era)?.id ?? "tree",
      };
    case "frenzies":
      return { kind: "ui", id: "frenzy" };
    case "gulls":
      return { kind: "ui", id: "gull" };
    case "units":
      return { kind: "ui", id: "buy_max" };
    case "research":
      return { kind: "nav", id: "workshop" };
    default:
      return { kind: "ui", id: "rank" };
  }
}

export interface QuestsView {
  goals: Goal[];
  done: number;
  ready: number;
  /** The day's set is claimed in full (its bonus paid). */
  setDone: boolean;
}

/** The day's quests as goals, in the pool's order. */
export function questsView(base: BaseState): QuestsView {
  const goals = questsOf(content, base).map((quest): Goal => {
    const claimed = questClaimed(base, quest.id);
    const met = !claimed && questMet(base, quest);
    return {
      key: `quest:${quest.id}`,
      icon: questIcon(quest, base),
      name: t(`quest.${quest.id}.name`),
      progress: questProgress(base, quest),
      pays: content.quests.pays.each,
      state: claimed ? "claimed" : met ? "ready" : "open",
      claim: met ? { type: "claim_quest", day: base.meta.quests.day, id: quest.id } : null,
    };
  });
  return {
    goals,
    done: goals.filter((goal) => goal.state === "claimed").length,
    ready: goals.filter((goal) => goal.state === "ready").length,
    setDone: base.meta.quests.setPaid,
  };
}

/** "a Supply Drop I and +2 scrap": what the set pays, in words. */
function setWords(): string {
  const parts = content.quests.pays.set.map((pay) =>
    "drop" in pay
      ? t("quests.a_drop", { drop: t(`drop.tier_${pay.drop}`) })
      : t("quests.scrap", { n: pay.scrap }),
  );
  return parts.join(t("quests.and"));
}

/**
 * The "Today" section: the count and when the day rolls over, the three rows, and what the
 * whole set pays. `inSheet`: under the orders (a sub-title), else a Logbook chapter.
 */
export function TodayQuests({ base, inSheet = false }: { base: BaseState; inSheet?: boolean }) {
  const second = useWorld((state) => state.second);
  const view = questsView(base);
  if (view.goals.length === 0) return null;
  const now = Math.max(second, base.run.settledAt);
  const left = Math.max(0, nextQuestRoll(content, now) - now);
  const count = t("quests.count", { done: view.done, of: view.goals.length, time: duration(left) });
  return (
    <section className={`today${inSheet ? " in-sheet" : " logbook-chapter"}`}>
      <h3 className={inSheet ? "sub-title" : ""}>
        <span>{t("quests.title")}</span>
        <span className={inSheet ? "num sub-count" : "num count"}>{count}</span>
      </h3>
      <ul className="goals compact">
        {view.goals.map((goal) => (
          <GoalRow key={goal.key} goal={goal} />
        ))}
      </ul>
      <p className={`goal-note${view.setDone ? " done" : ""}`}>
        <span className="goal-note-icon">
          {view.setDone ? (
            <ResourceIcon id="scrap" size={16} />
          ) : (
            <Icon kind="flotsam" id="sealed_locker" size={16} />
          )}
        </span>
        <span>
          {view.setDone
            ? t("quests.set_paid", { rewards: setWords() })
            : t("quests.note", { rewards: setWords() })}
        </span>
      </p>
    </section>
  );
}
