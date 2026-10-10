import type { IconKind } from "@wipe-day/content/icons";
import { resourceColor, resourceInitials, resourceName } from "../state/world";
import { vars } from "./util";

/**
 * The content icons (D141): `packages/content/icons/<kind>/<id>.svg`, bundled as text and drawn
 * inline in `currentColor`, so one file serves the scene, the panels and the bot. A missing file
 * falls back to the lettered tile.
 */
const sources = import.meta.glob<string>("../../../../packages/content/icons/*/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

const ICONS = new Map<string, string>();
for (const [path, svg] of Object.entries(sources)) {
  const parts = path.split("/");
  const id = parts.at(-1)?.slice(0, -".svg".length) ?? "";
  const kind = parts.at(-2) ?? "";
  // Decorative: the label sits beside it.
  ICONS.set(`${kind}/${id}`, svg.replace("<svg ", '<svg aria-hidden="true" focusable="false" '));
}

export const hasIcon = (kind: IconKind, id: string): boolean => ICONS.has(`${kind}/${id}`);

interface TileProps {
  color: string;
  label: string;
  title?: string | undefined;
  className?: string | undefined;
  size?: number | undefined;
}

/** Placeholder icon: a tinted rounded square with initials, for an id without a file. */
export function Tile({ color, label, title, className, size }: TileProps) {
  const sized = size ? { width: size, height: size, fontSize: Math.round(size * 0.36) } : {};
  return (
    <span
      className={className ? `tile ${className}` : "tile"}
      style={{ ...vars({ "--tile-color": color }), ...sized }}
      title={title}
    >
      {label}
    </span>
  );
}

interface IconProps {
  kind: IconKind;
  id: string;
  /** CSS px: 16 inline, 20 chips and badges, 24 nav, 48 rows (08-screens.md 3.6). */
  size?: number;
  /** Tints the drawing (`currentColor`); the text colour otherwise. */
  color?: string | undefined;
  className?: string | undefined;
  /** The tile's letters when the file is missing. */
  fallback?: string | undefined;
}

/** One icon per thing, used identically everywhere (CLAUDE.md 6.2). */
export function Icon({ kind, id, size = 20, color, className, fallback }: IconProps) {
  const svg = ICONS.get(`${kind}/${id}`);
  const style = { width: size, height: size, ...(color ? { color } : {}) };
  if (!svg) {
    return (
      <Tile
        color={color ?? "var(--muted)"}
        label={fallback ?? id.slice(0, 2).toUpperCase()}
        className={className ? `icon ${className}` : "icon"}
        size={size}
      />
    );
  }
  return (
    <span
      className={className ? `icon ${className}` : "icon"}
      style={style}
      // The files are our own, linted by `pnpm icons` (no scripts, no references).
      // biome-ignore lint/security/noDangerouslySetInnerHtml: bundled, linted SVG
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** A currency or a product, by id, in its colour. */
export function ResourceIcon({
  id,
  size = 20,
  className,
}: {
  id: string;
  size?: number;
  className?: string | undefined;
}) {
  const kind: IconKind =
    id === "supplies" || id === "glass" || id === "scrap" ? "currency" : "product";
  return (
    <Icon
      kind={kind}
      id={id}
      size={size}
      color={resourceColor(id)}
      className={className}
      fallback={resourceInitials(id)}
    />
  );
}

export { resourceName };
