import type { Amounts } from "@wipe-day/content/schema";
import { shortfall } from "@wipe-day/domain/base";
import { abbrev, missingLabel, resourceName, t } from "../state/world";
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

/** "need 2.1k stone" for the first missing resource, or null when affordable. */
export function needLabel(cost: Amounts, stock: Amounts): string | null {
  return missingLabel(shortfall(cost, stock));
}
