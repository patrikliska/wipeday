/** Daily tasks overview. Spec: `docs/screens/tasks.md`. Ephemeral. */
import { nextTaskResetAt, taskOf } from "../../domain/active";
import type { BaseState } from "../../domain/base";
import { amountsText, type TextContext } from "../amounts";
import { relativeTimestamp } from "../format";
import type { Screen } from "../screen";
import { navButtons } from "./nav";

const BAR_WIDTH = 5;

export function progressBar(progress: number, target: number): string {
  const filled = target > 0 ? Math.floor((Math.min(progress, target) / target) * BAR_WIDTH) : 0;
  return "▰".repeat(filled) + "▱".repeat(BAR_WIDTH - filled);
}

export function tasksScreen(ctx: TextContext, state: BaseState, now: number): Screen {
  const { locale, content } = ctx;
  const { tasks } = state;
  const lines = tasks.ids.flatMap((id) => {
    const task = taskOf(content, id);
    if (!task) return [];
    const done = tasks.done.includes(id);
    const progress = tasks.progress[id] ?? 0;
    return [
      locale.t("screen.tasks.line", {
        check: done ? "✅" : "⬜",
        task: locale.t(`task.${id}.name`),
        bar: progressBar(progress, task.target),
        progress: Math.min(progress, task.target),
        target: task.target,
        reward: amountsText(ctx, task.reward, "delta"),
      }),
    ];
  });
  const doneCount = tasks.done.length;
  const when = relativeTimestamp(nextTaskResetAt(now));
  return {
    id: "tasks",
    kind: "sub",
    tone: doneCount === tasks.ids.length && tasks.ids.length > 0 ? "success" : "accent",
    title: locale.t("screen.tasks.title"),
    status:
      doneCount === tasks.ids.length && tasks.ids.length > 0
        ? locale.t("screen.tasks.status_all", { when })
        : locale.t("screen.tasks.status", { done: doneCount, total: tasks.ids.length, when }),
    details: lines,
    rows: [{ kind: "buttons", buttons: navButtons(ctx, "tasks", true) }],
  };
}
