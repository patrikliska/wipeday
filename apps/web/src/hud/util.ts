import type { CSSProperties } from "react";
import type { Tier } from "../state/world";

/** CSS custom properties as inline style, typed. */
export const vars = (values: Record<`--${string}`, string>): CSSProperties =>
  values as CSSProperties;

export const tierVar = (tier: Tier): string => `var(--tier-${tier})`;

/** Two letters for a placeholder tile: "Storage Crate" -> "SC". */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words[1]?.[0] ?? words[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
}
