import { storageCap, total } from "@wipe-day/domain/base";
import { salvageValue } from "@wipe-day/domain/craft";
import { useShallow } from "zustand/shallow";
import { useWorld } from "../../state/store";
import {
  abbrev,
  content,
  gainLines,
  itemName,
  resourceColor,
  resourceName,
  t,
} from "../../state/world";
import { knownParts, knownResources, pendingOf } from "../derived";
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
  const parts = useWorld(useShallow((state) => knownParts(state.base)));
  const partStock = useWorld(
    useShallow((state) => parts.map((id) => Math.floor(state.base.stock[id] ?? 0))),
  );
  const items = useWorld((state) => state.base.items);
  const cap = useWorld((state) => storageCap(content, state.base));
  const collect = useWorld((state) => state.collect);
  const openRecipe = useWorld((state) => state.openRecipe);
  const salvage = useWorld((state) => state.salvage);
  const serve = useWorld((state) => state.serve);
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

      {parts.length > 0 ? (
        <>
          <h3 className="section">{t("inventory.parts")}</h3>
          <div className="grid">
            {parts.map((id, index) => (
              <button
                key={id}
                type="button"
                className="slot"
                style={vars({ "--tier-color": resourceColor(id) })}
                onClick={() => openRecipe(id)}
                title={t("craft.details", { item: resourceName(id) })}
              >
                <ResourceIcon id={id} />
                <b className="num">{abbrev(partStock[index] ?? 0)}</b>
                <span>{resourceName(id)}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <h3 className="section">
        {owned.length > 0 ? t("inventory.items") : t("inventory.no_items")}
      </h3>
      {owned.map((item) => {
        const count = items[item.id] ?? 0;
        const meal = item.category === "meal";
        const back = gainLines(salvageValue(content, item.id, 1), 3).join(", ");
        return (
          <div key={item.id} className="card" style={vars({ "--tier-color": tierVar(item.tier) })}>
            <ItemIcon id={item.id} />
            <div className="main">
              <div className="title">
                <b>{itemName(item.id)}</b>
                <span className="lvl">×{count}</span>
              </div>
              <div className="desc">
                {meal
                  ? t("inventory.serve_gives", {
                      percent: item.boostPercent ?? 0,
                      hours: item.hours ?? 0,
                    })
                  : t(`item.${item.id}.effect`, { capacity: item.capacity ?? 0 })}
              </div>
              <div className="row">
                {meal ? (
                  <button type="button" className="btn grow" onClick={() => serve(item.id)}>
                    {t("inventory.serve")}
                  </button>
                ) : null}
                {back && !meal ? (
                  <button type="button" className="btn grow" onClick={() => salvage(item.id, 1)}>
                    {t("inventory.salvage_gives", { gains: back })}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
