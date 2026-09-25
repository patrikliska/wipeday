import { useWorld } from "../state/store";
import { abbrev, type ResourceId, resourceById } from "../state/world";
import { ResourceIcon } from "./Icon";

/** What accrued while the player was gone, and one button to bank it. */
export function AwayModal() {
  const show = useWorld((state) => state.showAway);
  const pending = useWorld((state) => (state.showAway ? state.pending : null));
  const dismiss = useWorld((state) => state.dismissAway);
  const collect = useWorld((state) => state.collect);
  if (!show) return null;

  const entries = Object.entries(pending ?? {})
    .map(([id, amount]) => [id as ResourceId, Math.floor(amount ?? 0)] as const)
    .filter(([, amount]) => amount >= 1)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="modal-backdrop">
      <div className="glass modal" role="dialog" aria-labelledby="away-title">
        <h2 id="away-title">Welcome back</h2>
        <p>Your survivors kept gathering while you were away. Storage is filling up.</p>
        <div className="gains">
          {entries.map(([id, amount]) => (
            <span key={id}>
              <ResourceIcon id={id} /> +{abbrev(amount)} {resourceById.get(id)?.name ?? id}
            </span>
          ))}
        </div>
        <div className="row">
          <button
            type="button"
            className="btn primary grow"
            onClick={() => {
              collect();
              dismiss();
            }}
          >
            Collect everything
          </button>
          <button type="button" className="btn" onClick={dismiss}>
            Leave it
          </button>
        </div>
      </div>
    </div>
  );
}
