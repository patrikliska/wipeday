import type { CSSProperties } from "react";
import type { Tier } from "../state/world";

/** CSS custom properties as inline style, typed. */
export const vars = (values: Record<`--${string}`, string>): CSSProperties =>
  values as CSSProperties;

export const tierVar = (tier: Tier): string => `var(--tier-${tier})`;
