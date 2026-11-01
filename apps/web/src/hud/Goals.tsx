import type { IconKind } from "@wipe-day/content/icons";
import type { Pay } from "@wipe-day/content/schema";
import type { Command } from "@wipe-day/domain/commands";
import { dropsOnWay, nextDropAt } from "@wipe-day/domain/drops";
import type { BaseState } from "@wipe-day/domain/state";
import { duration } from "@wipe-day/domain/words";
import { useWorld } from "../state/store";
import { content, fmt, t } from "../state/world";
import { rarityName, rarityStyle } from "./cards";
import { Icon, ResourceIcon } from "./Icon";

/**
 * A goal on a list (R3 S2; D256, D257): a Work Order or a daily quest, as the orders sheet, the
 * orders card and the Logbook's "Today" draw it. Claimed: paid. Ready: met, its reward waits for
 * the tap. Open: still counting.
 */
export type GoalState = "claimed" | "ready" | "open";

export interface Goal {
  key: string;
  icon: { kind: IconKind; id: string };
  name: string;
  /** How far it has come, or null for a one-off condition (an era reached). */
  progress: { value: number; goal: number } | null;
  pays: readonly Pay[];
  state: GoalState;
  /** The claim, while it is ready. */
  claim: Command | null;
}

export const send = (command: Command | null): void => {
  if (command) useWorld.getState().send(command);
};

/**
 * What a goal pays, as chips: a locker for a Supply Drop, the scrap nut for scrap, the shard in
 * its rarity's colour for gear shards (D266).
 */
export function RewardChips({ pays, state }: { pays: readonly Pay[]; state: GoalState }) {
  return (
    <span className={`rewards ${state}`}>
      {pays.map((pay) =>
        "drop" in pay ? (
          <span key={`drop-${pay.drop}`} className="reward">
            <Icon kind="flotsam" id="sealed_locker" size={16} />
            <span>{t(`drop.tier_${pay.drop}`)}</span>
          </span>
        ) : "shards" in pay ? (
          <span
            key={`shards-${pay.shards.rarity}`}
            className="reward reward-shards"
            style={rarityStyle(pay.shards.rarity)}
            title={t("goals.shards", { n: pay.shards.n, rarity: rarityName(pay.shards.rarity) })}
          >
            <Icon kind="ui" id="shard" size={16} />
            <span className="num">+{pay.shards.n}</span>
            <span className="sr-only">
              {t("goals.shards", { n: pay.shards.n, rarity: rarityName(pay.shards.rarity) })}
            </span>
          </span>
        ) : (
          <span key="scrap" className="reward">
            <ResourceIcon id="scrap" size={16} />
            <span className="num">+{pay.scrap}</span>
          </span>
        ),
      )}
      {state === "claimed" ? (
        <span className="reward-tick" role="img" aria-label={t("goals.done")}>
          ✓
        </span>
      ) : null}
    </span>
  );
}

/** "a Supply Drop I and +2 scrap": a list of pays in words (the quests' set, the orders' set). */
export function payWords(pays: readonly Pay[]): string {
  const parts = pays.map((pay) =>
    "drop" in pay
      ? t("quests.a_drop", { drop: t(`drop.tier_${pay.drop}`) })
      : "shards" in pay
        ? t("goals.shards", { n: pay.shards.n, rarity: rarityName(pay.shards.rarity) })
        : t("quests.scrap", { n: pay.scrap }),
  );
  return parts.join(t("quests.and"));
}

/**
 * Drops promised and not yet paid by the hourly gate (a quest set's, an order set's, a badge's;
 * D266): "1 on its way · next in 42 min", or nothing. Honest about the wait, so a claim never
 * looks like it paid nothing.
 */
export function OnWay({ base, className = "" }: { base: BaseState; className?: string }) {
  const second = useWorld((state) => state.second);
  const n = dropsOnWay(content, base);
  if (n === 0) return null;
  const now = Math.max(second, base.run.settledAt);
  const left = nextDropAt(content, base.meta.drops) - now;
  return (
    <span className={`on-way ${className}`.trim()}>
      <Icon kind="flotsam" id="sealed_locker" size={14} />
      <span>
        {left > 0 ? t("album.on_way", { n, time: duration(left) }) : t("album.on_way_now", { n })}
      </span>
    </span>
  );
}

/**
 * One row: the icon, the name (two lines at most), the bar and its figures (or Ready, Done),
 * the reward chips; a ready row carries its own Claim, so a quest in the Logbook is never a dead
 * end (6.3 rule 2). The sheet's primary claims every ready row at once.
 */
export function GoalRow({ goal }: { goal: Goal }) {
  const progress = goal.progress;
  const fill = progress ? Math.min(1, progress.value / Math.max(1, progress.goal)) : 0;
  return (
    <li className={`goal ${goal.state}`} data-key={goal.key}>
      <span className="goal-icon">
        <Icon kind={goal.icon.kind} id={goal.icon.id} size={26} />
      </span>
      <span className="goal-text">
        <span className="goal-name">{goal.name}</span>
        <span className="goal-progress">
          {progress && goal.state === "open" ? (
            <span className="goal-bar" aria-hidden="true">
              <i className="fill" style={{ transform: `scaleX(${fill})` }} />
            </span>
          ) : null}
          <span className="num goal-figure">
            {goal.state === "ready"
              ? t("goals.ready")
              : goal.state === "claimed"
                ? t("goals.done")
                : progress
                  ? t("goals.progress", {
                      value: fmt(Math.min(progress.value, progress.goal), "held"),
                      goal: fmt(progress.goal, "cost"),
                    })
                  : t("goals.open")}
          </span>
        </span>
      </span>
      {goal.state === "ready" && goal.claim ? (
        <button type="button" className="btn goal-claim" onClick={() => send(goal.claim)}>
          <span className="buy-top claim-word">{t("goals.claim")}</span>
          <RewardChips pays={goal.pays} state={goal.state} />
        </button>
      ) : (
        <RewardChips pays={goal.pays} state={goal.state} />
      )}
    </li>
  );
}

const STEP_KEYS = ["one", "two", "three", "four", "five", "six", "seven", "eight"];

/** The steps to the set: one segment per order it needs, lit as they are claimed. */
export function Steps({ done, of, small = false }: { done: number; of: number; small?: boolean }) {
  return (
    <span className={`steps${small ? " small" : ""}`} aria-hidden="true">
      {STEP_KEYS.slice(0, of).map((key, i) => (
        <i key={key} className={i < done ? "step on" : "step"} />
      ))}
    </span>
  );
}

/** The primary's label for a list with `ready` claims waiting: "Claim 2 rewards", or Done. */
export function claimLabel(ready: number): string {
  if (ready <= 0) return t("settings.done");
  return ready === 1 ? t("goals.claim_one") : t("goals.claim_many", { count: ready });
}
