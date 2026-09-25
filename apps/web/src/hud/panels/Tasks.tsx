import { useWorld } from "../../state/store";
import { abbrev, type ResourceId } from "../../state/world";
import { ResourceIcon } from "../Icon";
import { vars } from "../util";

export function TasksPanel() {
  const tasks = useWorld((state) => state.tasks);
  return (
    <>
      <p className="hint">
        Three small goals a day. Rewards land in storage the moment a task completes. New set at
        midnight.
      </p>
      {tasks.map((task) => {
        const fill = Math.min(1, task.progress / task.target);
        return (
          <div key={task.id} className={`task${task.done ? " done" : ""}`}>
            <div className="row">
              <b className="grow">{task.name}</b>
              <span className="num">
                {task.done ? "Done ✓" : `${abbrev(task.progress)} / ${abbrev(task.target)}`}
              </span>
            </div>
            <div
              className="progress"
              style={vars({ "--bar-color": task.done ? "var(--success)" : "var(--accent)" })}
            >
              <i style={{ width: `${Math.round(fill * 100)}%` }} />
            </div>
            <div className="reward row">
              Reward
              {Object.entries(task.reward).map(([id, amount]) => (
                <span key={id} className="row">
                  <ResourceIcon id={id as ResourceId} className="mini" /> {abbrev(amount ?? 0)}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
