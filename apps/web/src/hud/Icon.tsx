import { resourceColor, resourceInitials, resourceName } from "../state/world";
import { vars } from "./util";

interface TileProps {
  color: string;
  label: string;
  title?: string | undefined;
  className?: string | undefined;
}

/** Placeholder icon: a tinted rounded square with initials. The owner's icons drop in here (D141). */
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

/** A currency or a product, by id. */
export function ResourceIcon({ id, className }: { id: string; className?: string | undefined }) {
  return (
    <Tile
      color={resourceColor(id)}
      label={resourceInitials(id)}
      title={resourceName(id)}
      className={className}
    />
  );
}
