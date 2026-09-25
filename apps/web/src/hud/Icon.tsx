import { type ItemId, itemById, type ResourceId, resourceById } from "../state/world";
import { initials, tierVar, vars } from "./util";

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
  const resource = resourceById.get(id);
  return (
    <Tile
      color={resource?.color ?? "#a49e93"}
      label={resource?.initials ?? "??"}
      title={resource?.name}
      className={className}
    />
  );
}

export function ItemIcon({ id, className }: { id: ItemId; className?: string | undefined }) {
  const item = itemById.get(id);
  return (
    <Tile
      color={item ? tierVar(item.tier) : "#a49e93"}
      label={item ? initials(item.name) : "??"}
      title={item?.name}
      className={className}
    />
  );
}
