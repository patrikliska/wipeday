/**
 * Shared building blocks for every card. Colours come from `ui/theme`; a card
 * file should never contain a hex or re-implement one of these.
 *
 * satori rule to remember: any element with more than one child needs an
 * explicit `display: flex`. `Row` and `Col` exist so that is never forgotten.
 */
import type { Folder } from "../assets/spec";
import { color, FONT_FAMILY, layout, type Tier, tierColor, withAlpha } from "../ui/theme";
import type { Child, Style } from "./jsx-runtime";
import { useRender } from "./renderer";

interface BoxProps {
  style?: Style;
  children?: Child;
}

export function Row({ style, children }: BoxProps) {
  return <div style={{ display: "flex", flexDirection: "row", ...style }}>{children}</div>;
}

export function Col({ style, children }: BoxProps) {
  return <div style={{ display: "flex", flexDirection: "column", ...style }}>{children}</div>;
}

/** Card background, top accent strip, padding and font defaults. */
export function CardFrame({ children }: { children?: Child }) {
  return (
    <Col
      style={{
        width: layout.cardWidth,
        backgroundColor: color.bg,
        color: color.text,
        fontFamily: FONT_FAMILY,
        fontSize: layout.minFont,
      }}
    >
      <div style={{ display: "flex", height: 6, backgroundColor: color.accent }} />
      <Col style={{ padding: `26px ${layout.pad}px ${layout.pad}px` }}>{children}</Col>
    </Col>
  );
}

/** Text that truncates with an ellipsis instead of wrapping or overflowing. */
export function Fit({ style, children }: BoxProps) {
  return (
    <div
      style={{
        display: "block",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Small caps section label. */
export function Label({ children, tone }: { children?: Child; tone?: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: layout.minFont,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: tone ?? color.muted,
      }}
    >
      {children}
    </div>
  );
}

export function Divider() {
  return <div style={{ display: "flex", height: 1, backgroundColor: color.border }} />;
}

/**
 * Progress bar. `fraction` is 0..1. A non-zero value always shows at least a
 * round cap so "almost empty" never reads as "empty".
 */
export function Bar({
  fraction,
  tone,
  height,
}: {
  fraction: number;
  tone: string;
  height: number;
}) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <div
      style={{
        display: "flex",
        height,
        borderRadius: height / 2,
        backgroundColor: color.panel,
        border: `1px solid ${color.border}`,
      }}
    >
      {clamped > 0 ? (
        <div
          style={{
            display: "flex",
            width: `${clamped * 100}%`,
            minWidth: height,
            borderRadius: height / 2,
            backgroundColor: tone,
          }}
        />
      ) : null}
    </div>
  );
}

/** Up to two uppercase initials from a snake_case id: `sulfur_ore` -> `SO`, `wood` -> `WO`. */
export function initials(id: string): string {
  const [first = "", second] = id.split("_").filter(Boolean);
  return (second ? `${first[0] ?? ""}${second[0] ?? ""}` : first.slice(0, 2)).toUpperCase();
}

/**
 * A picture from the asset registry, or, while the owner has not supplied it,
 * a tier-tinted rounded tile with the entity's initials.
 */
export function Icon(props: {
  folder: Folder;
  name: string;
  size: number;
  tier?: Tier;
  dim?: boolean;
}) {
  const { folder, name, size, tier, dim } = props;
  const uri = useRender().assets.imageUri(folder, name);
  const opacity = dim ? 0.45 : 1;
  if (uri) {
    return <img src={uri} width={size} height={size} style={{ opacity, flexShrink: 0 }} />;
  }
  const tint = tier ? tierColor[tier] : color.muted;
  // Prefixed names (`tier_wood`, `perk_medic`) take their initials from the entity id.
  const label = initials(name.replace(/^(tier|perk)_/, ""));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        opacity,
        borderRadius: size * 0.16,
        backgroundColor: withAlpha(tint, 0.16),
        border: `${Math.max(1.5, size * 0.03)}px solid ${withAlpha(tint, 0.55)}`,
        color: tint,
        fontSize: size * 0.36,
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}
