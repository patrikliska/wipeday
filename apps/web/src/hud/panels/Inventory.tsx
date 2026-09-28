import { storageCap, total } from "@wipe-day/domain/base";
import { useShallow } from "zustand/shallow";
import { useWorld } from "../../state/store";
import { abbrev, content, itemName, resourceColor, resourceName, t } from "../../state/world";
import { knownResources, pendingOf } from "../derived";
import { ItemIcon, ResourceIcon } from "../Icon";
import { tierVar, vars } from "../util";

export function InventoryPanel() {
  const ids = useWorld(useShallow((state) => knownResources(state.base)));
  const stock = useWorld(
    useShallow((state) => ids.map((id) => Math.floor(state.base.stock[id] ?? 0))),
  );
  const pending = useWorld(
    useShallow((state) => ids.map((id) => Math.floor(pendingOf(state)[id] ?? 0))),
  );
  const items = useWorld((state) => state.base.items);
  const cap = useWorld((state) => storageCap(content, state.base));
  const collect = useWorld((state) => state.collect);
  const pendingTotal = total(Object.fromEntries(pending.map((amount, index) => [index, amount])));
  const owned = content.items.filter((item) => (items[item.id] ?? 0) > 0);

  return (
    <>
      <div className="row">
        <span className="hint grow">{t("inventory.cap", { cap: abbrev(cap) })}</span>
        <button
          type="button"
          className={`btn small${pendingTotal > 0 ? " primary" : ""}`}
          disabled={pendingTotal <= 0}
          onClick={collect}
        >
          {pendingTotal > 0
            ? t("inventory.collect", { amount: abbrev(pendingTotal) })
            : t("inventory.nothing")}
        </button>
      </div>
      <div className="grid">
        {ids.map((id, index) => {
          const amount = stock[index] ?? 0;
          const extra = pending[index] ?? 0;
          const fill = Math.min(1, (amount + extra) / cap);
          return (
            <div key={id} className="slot" style={vars({ "--tier-color": resourceColor(id) })}>
              <ResourceIcon id={id} />
              <b className="num">{abbrev(amount)}</b>
              <span>
                {resourceName(id)}
                {extra > 0 ? ` · +${abbrev(extra)}` : ""}
              </span>
              <span
                className="bar"
                style={vars({ "--bar-color": fill >= 1 ? "var(--warning)" : "var(--success)" })}
              >
                <i style={{ width: `${Math.round(fill * 100)}%` }} />
              </span>
            </div>
          );
        })}
      </div>
      <p className="hint">{owned.length > 0 ? t("inventory.items") : t("inventory.no_items")}</p>
      <div className="grid">
        {owned.map((item) => (
          <div key={item.id} className="slot" style={vars({ "--tier-color": tierVar(item.tier) })}>
            <ItemIcon id={item.id} />
            <b className="num">{items[item.id] ?? 0}</b>
            <span>{itemName(item.id)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
