import { nextTaskResetAt, taskOf } from "@wipe-day/domain/active";
import { haulLeft } from "@wipe-day/domain/nodes";
import { useWorld } from "../../state/store";
import { abbrev, content, duration, t, taskName } from "../../state/world";
import { ResourceIcon } from "../Icon";
import { vars } from "../util";

export function TasksPanel() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now / 60) * 60);
  const player = useWorld((state) => state.player);
  const mode = useWorld((state) => state.mode);
  const logout = useWorld((state) => state.logout);
  const haul = haulLeft(content, base, now);
  const haulUsed = haul.of - haul.minutes;

  return (
    <>
      <p className="hint">{t("tasks.hint", { time: duration(nextTaskResetAt(now) - now) })}</p>
      {base.tasks.ids.map((id) => {
        const task = taskOf(content, id);
        if (!task) return null;
        const progress = base.tasks.progress[id] ?? 0;
        const done = base.tasks.done.includes(id);
        const fill = Math.min(1, progress / task.target);
        return (
          <div key={id} className={`task${done ? " done" : ""}`}>
            <div className="row">
              <b className="grow">{taskName(id)}</b>
              <span className="num">
                {done
                  ? t("tasks.done")
                  : t("tasks.progress", {
                      progress: abbrev(progress),
                      target: abbrev(task.target),
                    })}
              </span>
            </div>
            <div
              className="progress"
              style={vars({ "--bar-color": done ? "var(--success)" : "var(--accent)" })}
            >
              <i style={{ width: `${Math.round(fill * 100)}%` }} />
            </div>
            <div className="reward row">
              {t("tasks.reward")}
              {Object.entries(task.reward).map(([resource, amount]) => (
                <span key={resource} className="row">
                  <ResourceIcon id={resource} className="mini" /> {abbrev(amount)}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      <div className="task">
        <div className="row">
          <b className="grow">{t("tasks.haul")}</b>
          <span className="num">
            {t("tasks.haul_amount", {
              used: duration(haulUsed * 60),
              of: duration(haul.of * 60),
            })}
          </span>
        </div>
        <div className="progress" style={vars({ "--bar-color": "var(--success)" })}>
          <i style={{ width: `${Math.round((haulUsed / haul.of) * 100)}%` }} />
        </div>
        <div className="reward">{t("tasks.haul_hint")}</div>
      </div>
      {mode === "server" && player ? (
        <div className="row">
          <span className="hint grow">{t("tasks.logged_in", { name: player.name })}</span>
          <button type="button" className="btn small" onClick={() => void logout()}>
            {t("tasks.logout")}
          </button>
        </div>
      ) : null}
    </>
  );
}
