import {
  type ItemId,
  initials,
  itemById,
  itemName,
  type ResourceId,
  resourceColor,
  resourceInitials,
  resourceName,
} from "../state/world";
import { tierVar, vars } from "./util";

interface TileProps {
  color: string;
  label: string;
  title?: string | undefined;
  className?: string | undefined;
}

/** Placeholder icon: a tinted rounded square with initials. Real art drops in here later. */
export function Tile({ color, label, title, className }: TileProps) {
  return (
    <span
      className={className ? `tile ${className}` : "tile"}
      style={vars({ "--tile-color": color })}
      title={title}
    >
      {label}
    </span>
  );
}

export function ResourceIcon({
  id,
  className,
}: {
  id: ResourceId;
  className?: string | undefined;
}) {
  const name = resourceName(id);
  return (
    <Tile
      color={resourceColor(id)}
      label={resourceInitials(id)}
      title={name}
      className={className}
    />
  );
}

export function ItemIcon({ id, className }: { id: ItemId; className?: string | undefined }) {
  const item = itemById.get(id);
  const name = itemName(id);
  return (
    <Tile
      color={item ? tierVar(item.tier) : "#a49e93"}
      label={initials(name)}
      title={name}
      className={className}
    />
  );
}
