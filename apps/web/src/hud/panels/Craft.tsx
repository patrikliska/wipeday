import { type CraftOption, craftOptions } from "@wipe-day/domain/craft";
import { useWorld } from "../../state/store";
import { content, duration, itemName, missingLabel, t } from "../../state/world";
import { Cost } from "../Cost";
import { ItemIcon } from "../Icon";
import { tierVar, vars } from "../util";

/** Craftable first, then what only lacks resources, then what is locked or owned. */
const RANK: Record<CraftOption["status"]["code"], number> = {
  ok: 0,
  unaffordable: 1,
  queue_full: 2,
  box_slots: 3,
  workbench: 4,
  owned: 5,
  unknown: 6,
};

function label(option: CraftOption): string {
  const { status } = option;
  switch (status.code) {
    case "ok":
      return option.recipe.craftMinutes > 0
        ? t("craft.queue", { time: duration(option.recipe.craftMinutes * 60) })
        : t("craft.make");
    case "unaffordable":
      return t("craft.need", { need: missingLabel(status.missing) ?? "" });
    case "workbench":
      return t("craft.needs_bench", { level: status.needed });
    case "owned":
      return t("craft.owned");
    case "box_slots":
      return t("craft.no_slots", { slots: status.slots });
    case "queue_full":
      return t("craft.queue_full");
    case "unknown":
      return t("refusal.unknown");
  }
}

export function CraftPanel() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now));
  const craft = useWorld((state) => state.craft);
  const options = craftOptions(content, base).sort(
    (a, b) => RANK[a.status.code] - RANK[b.status.code],
  );
  const primary = options.find((option) => option.status.code === "ok")?.item.id;
  const hasBench = options.some(
    (o) => o.item.category === "workbench" && (base.items[o.item.id] ?? 0) > 0,
  );

  return (
    <>
      {!hasBench ? <p className="hint">{t("craft.hint_bench")}</p> : null}
      {base.craftQueue.map((job, index) => {
        const recipe = content.recipes.find((candidate) => candidate.item === job.item);
        const length = (recipe?.craftMinutes ?? 0) * 60;
        const left = Math.max(0, job.endsAt - now);
        const progress = index === 0 && length > 0 ? 1 - left / length : 0;
        return (
          <div key={`${job.item}-${job.endsAt}`} className="card">
            <ItemIcon id={job.item} />
            <div className="main">
              <div className="title">
                <b>{itemName(job.item)}</b>
                <span className="lvl">{index === 0 ? t("craft.making") : t("craft.waiting")}</span>
              </div>
              <div className="progress">
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div className="desc">{t("craft.ready_in", { time: duration(left) })}</div>
            </div>
          </div>
        );
      })}
      {options.map((option) => {
        const { item, recipe, status } = option;
        const owned = base.items[item.id] ?? 0;
        const locked = status.code === "workbench" || status.code === "owned";
        return (
          <div
            key={item.id}
            className={`card${locked ? " locked" : ""}`}
            style={vars({ "--tier-color": tierVar(item.tier) })}
          >
            <ItemIcon id={item.id} />
            <div className="main">
              <div className="title">
                <b>{itemName(item.id)}</b>
                <span className="lvl">
                  {owned > 0
                    ? t("craft.owned_count", { count: owned })
                    : t(`category.${item.category}`)}
                </span>
              </div>
              <div className="desc">
                {t(`item.${item.id}.effect`, { capacity: item.capacity ?? 0 })}
              </div>
              {status.code !== "owned" ? <Cost cost={recipe.cost} stock={base.stock} /> : null}
              <button
                type="button"
                className={`btn${item.id === primary ? " primary" : ""}`}
                disabled={status.code !== "ok"}
                onClick={() => craft(item.id)}
              >
                {label(option)}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
