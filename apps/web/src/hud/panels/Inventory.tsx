import { useShallow } from "zustand/shallow";
import { storageCap, useWorld } from "../../state/store";
import { abbrev, ITEMS, RESOURCES } from "../../state/world";
import { ItemIcon, ResourceIcon } from "../Icon";
import { tierVar, vars } from "../util";

export function InventoryPanel() {
  const stock = useWorld(
    useShallow((state) => RESOURCES.map((resource) => Math.floor(state.stock[resource.id] ?? 0))),
  );
  const pending = useWorld(
    useShallow((state) => RESOURCES.map((resource) => Math.floor(state.pending[resource.id] ?? 0))),
  );
  const items = useWorld((state) => state.items);
  const cap = useWorld((state) => storageCap(state));
  const collect = useWorld((state) => state.collect);
  const pendingTotal = pending.reduce((sum, amount) => sum + amount, 0);
  const owned = ITEMS.filter((item) => (items[item.id] ?? 0) > 0);

  return (
    <>
      <div className="row">
        <span className="hint grow">Storage cap {abbrev(cap)} per resource</span>
        <button
          type="button"
          className={`btn small${pendingTotal > 0 ? " primary" : ""}`}
          disabled={pendingTotal <= 0}
          onClick={collect}
        >
          {pendingTotal > 0 ? `Collect +${abbrev(pendingTotal)}` : "Nothing to collect"}
        </button>
      </div>
      <div className="grid">
        {RESOURCES.map((resource, index) => {
          const amount = stock[index] ?? 0;
          const extra = pending[index] ?? 0;
          const fill = Math.min(1, (amount + extra) / cap);
          return (
            <div
              key={resource.id}
              className="slot"
              style={vars({ "--tier-color": resource.color })}
            >
              <ResourceIcon id={resource.id} />
              <b className="num">{abbrev(amount)}</b>
              <span>
                {resource.name}
                {extra > 0 ? ` · +${abbrev(extra)}` : ""}
              </span>
              <span
                className="bar"
                style={vars({ "--bar-color": fill >= 0.98 ? "var(--warning)" : "var(--success)" })}
              >
                <i style={{ width: `${Math.round(fill * 100)}%` }} />
              </span>
            </div>
          );
        })}
      </div>
      <p className="hint">Items</p>
      <div className="grid">
        {owned.map((item) => (
          <div key={item.id} className="slot" style={vars({ "--tier-color": tierVar(item.tier) })}>
            <ItemIcon id={item.id} />
            <b className="num">{items[item.id] ?? 0}</b>
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </>
  );
}
