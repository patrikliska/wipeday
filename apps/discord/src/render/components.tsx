/**
 * Shared building blocks for every card. Colours come from `ui/theme`; a card
 * file should never contain a hex or re-implement one of these.
 *
 * satori rule to remember: any element with more than one child needs an
 * explicit `display: flex`. `Row` and `Col` exist so that is never forgotten.
 */
import { color, FONT_FAMILY, layout, withAlpha } from "../ui/theme";
import type { Child, Style } from "./jsx-runtime";

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

/** Card background, top accent strip (the tier's colour on the base card), padding, fonts. */
export function CardFrame({ children, accent }: { children?: Child; accent?: string }) {
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
      <div style={{ display: "flex", height: 6, backgroundColor: accent ?? color.accent }} />
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

/**
 * A placeholder icon: the tinted rounded tile with two letters the web shows for the same
 * thing (`@wipe-day/content/look`), until real art arrives.
 */
export function Tile(props: { color: string; label: string; size: number; dim?: boolean }) {
  const { color: tint, label, size, dim } = props;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        opacity: dim ? 0.45 : 1,
        borderRadius: size * 0.22,
        backgroundColor: withAlpha(tint, 0.16),
        border: `${Math.max(1.5, size * 0.04)}px solid ${withAlpha(tint, 0.55)}`,
        color: tint,
        fontSize: size * 0.4,
        fontWeight: 700,
        letterSpacing: size * 0.008,
      }}
    >
      {label}
    </div>
  );
}
