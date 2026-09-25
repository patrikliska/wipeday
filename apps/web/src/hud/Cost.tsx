import { abbrev, type ResourceId, resourceById, shortfall } from "../state/world";
import { ResourceIcon } from "./Icon";

type Amounts = Partial<Record<ResourceId, number>>;

/** Cost chips; anything the player cannot cover is red. */
export function Cost({ cost, stock }: { cost: Amounts; stock: Amounts }) {
  const entries = Object.entries(cost) as Array<[ResourceId, number | undefined]>;
  if (entries.length === 0) {
    return (
      <div className="cost">
        <span>Free</span>
      </div>
    );
  }
  return (
    <div className="cost">
      {entries.map(([id, amount]) => {
        const need = amount ?? 0;
        const short = (stock[id] ?? 0) < need;
        return (
          <span key={id} className={short ? "short" : undefined} title={resourceById.get(id)?.name}>
            <ResourceIcon id={id} /> {abbrev(need)}
          </span>
        );
      })}
    </div>
  );
}

/** "need 2.1k stone" for the first missing resource, or null when affordable. */
export function needLabel(cost: Amounts, stock: Amounts): string | null {
  const first = Object.entries(shortfall(cost, stock))[0];
  if (!first) return null;
  const [id, amount] = first;
  const name = resourceById.get(id as ResourceId)?.name.toLowerCase() ?? id;
  return `need ${abbrev(amount ?? 0)} ${name}`;
}
