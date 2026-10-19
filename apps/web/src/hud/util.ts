import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { Tier } from "../state/world";

/** CSS custom properties as inline style, typed. */
export const vars = (values: Record<`--${string}`, string>): CSSProperties =>
  values as CSSProperties;

export const tierVar = (tier: Tier): string => `var(--tier-${tier})`;

/**
 * How many times `value` has risen since the component mounted (0 at first): a new count
 * restarts a flash or a pop keyed on it, and a component that mounts with its value shows none.
 */
export function useRise(value: number): number {
  const last = useRef(value);
  const [rises, setRises] = useState(0);
  useEffect(() => {
    if (value > last.current) setRises((n) => n + 1);
    last.current = value;
  }, [value]);
  return rises;
}
