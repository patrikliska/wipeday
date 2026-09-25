import { useWorld } from "../../state/store";
import { canAfford, ITEMS, type Item, TIERS, tierById } from "../../state/world";
import { Cost, needLabel } from "../Cost";
import { ItemIcon } from "../Icon";
import { tierVar, vars } from "../util";

const CATEGORY: Record<Item["category"], string> = {
  storage: "Storage",
  station: "Station",
  med: "Medical",
  weapon: "Weapon",
  armor: "Armour",
  utility: "Utility",
};

export function CraftPanel() {
  const tier = useWorld((state) => state.tier);
  const stock = useWorld((state) => state.stock);
  const items = useWorld((state) => state.items);
  const craft = useWorld((state) => state.craft);
  const hasWorkbench = (items.workbench ?? 0) > 0;
  const current = TIERS.indexOf(tier);

  const rank = (item: Item): number => {
    if (TIERS.indexOf(item.tier) > current) return 3;
    if ((item.category === "station" || item.category === "utility") && (items[item.id] ?? 0) > 0)
      return 2;
    return canAfford(item.cost, stock) ? 0 : 1;
  };
  const sorted = [...ITEMS].sort((a, b) => rank(a) - rank(b));
  let primaryGiven = false;

  return (
    <>
      {!hasWorkbench ? (
        <p className="hint">Build a Workbench first: it unlocks everything below.</p>
      ) : null}
      {sorted.map((item) => {
        const locked = TIERS.indexOf(item.tier) > current;
        const affordable = canAfford(item.cost, stock);
        const needsBench = !hasWorkbench && item.id !== "workbench";
        const owned = items[item.id] ?? 0;
        const unique = item.category === "station" || item.category === "utility";
        const built = unique && owned > 0;
        const can = !locked && affordable && !needsBench && !built;
        const primary = can && !primaryGiven;
        if (primary) primaryGiven = true;
        let label = "Craft";
        if (built) label = "Built";
        else if (locked) label = `Needs ${tierById.get(item.tier)?.name ?? item.tier} base`;
        else if (needsBench) label = "Needs Workbench";
        else if (!affordable) label = `Craft · ${needLabel(item.cost, stock) ?? ""}`;
        return (
          <div
            key={item.id}
            className={`card${locked ? " locked" : ""}`}
            style={vars({ "--tier-color": tierVar(item.tier) })}
          >
            <ItemIcon id={item.id} />
            <div className="main">
              <div className="title">
                <b>{item.name}</b>
                <span className="lvl">
                  {owned > 0 ? `owned ${owned}` : CATEGORY[item.category]}
                </span>
              </div>
              <div className="desc">{item.effect}</div>
              <Cost cost={item.cost} stock={stock} />
              <button
                type="button"
                className={`btn${primary ? " primary" : ""}`}
                disabled={!can}
                onClick={() => craft(item.id)}
              >
                {label}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
