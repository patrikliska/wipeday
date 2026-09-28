import type { Amounts } from "@wipe-day/content/schema";
import { shortfall } from "@wipe-day/domain/base";
import { useWorld } from "../state/store";
import { abbrev, content, missingLabel, outputName, resourceName, t } from "../state/world";
import { ResourceIcon } from "./Icon";

/** Cost chips; anything the player cannot cover is red. */
export function Cost({ cost, stock }: { cost: Amounts; stock: Amounts }) {
  const entries = Object.entries(cost);
  if (entries.length === 0) {
    return (
      <div className="cost">
        <span>{t("hud.free")}</span>
      </div>
    );
  }
  return (
    <div className="cost">
      {entries.map(([id, need]) => (
        <span
          key={id}
          className={(stock[id] ?? 0) < need ? "short" : undefined}
          title={resourceName(id)}
        >
          <ResourceIcon id={id} /> {abbrev(need)}
        </span>
      ))}
    </div>
  );
}

/**
 * "Make planks" buttons for the parts a cost is short of (at most two): the
 * way to where the missing thing comes from, right next to the locked button.
 */
export function MakeParts({ cost, stock }: { cost: Amounts; stock: Amounts }) {
  const openRecipe = useWorld((state) => state.openRecipe);
  const missing = Object.keys(shortfall(cost, stock)).filter((id) =>
    content.recipes.some((recipe) => recipe.output === id),
  );
  if (missing.length === 0) return null;
  return (
    <div className="row">
      {missing.slice(0, 2).map((id) => (
        <button key={id} type="button" className="btn small" onClick={() => openRecipe(id)}>
          {t("craft.make_named", { item: outputName(id) })}
        </button>
      ))}
    </div>
  );
}

/** "need 2.1k stone" for the first missing resource, or null when affordable. */
export function needLabel(cost: Amounts, stock: Amounts): string | null {
  return missingLabel(shortfall(cost, stock));
}
