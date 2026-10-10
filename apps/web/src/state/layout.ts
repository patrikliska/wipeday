/**
 * Where the HUD sits over the scene, so the camera frames the free area (08-screens.md 1.1,
 * 1.7): on wide screens the shop is a column on the right and the island recentres in what is
 * left. The HUD measures itself and writes here; the scene reads it every frame.
 */
import { useSyncExternalStore } from "react";

/**
 * The column layout: wide screens (1024 px and wider, at least 6:5), and landscape phones
 * (520 px tall or less) with a narrower column. Tablets in portrait keep the drawer.
 */
export const COLUMN_QUERY =
  "(min-width: 1024px) and (min-aspect-ratio: 6/5), (orientation: landscape) and (max-height: 520px)";

/** CSS px the HUD covers: the column on the right. */
export const insets = { right: 0 };

const query =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(COLUMN_QUERY)
    : null;

const subscribe = (notify: () => void): (() => void) => {
  query?.addEventListener("change", notify);
  return () => query?.removeEventListener("change", notify);
};

/** Whether the shop is the desktop column (no collapsed mode) rather than the phone drawer. */
export function useColumn(): boolean {
  return useSyncExternalStore(subscribe, () => query?.matches === true);
}
