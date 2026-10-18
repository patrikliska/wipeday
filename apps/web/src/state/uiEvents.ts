/**
 * The panels' comings and goings as bus events (D224): a sheet, a panel, the expanded drawer,
 * the house's room or the welcome card opening or closing is an `ui` open or close; a new tab,
 * bulk size, number format or motion setting is a switch. Read from the stores, so every way a
 * layer closes (its button, Escape, back, a click outside, the dock) sounds the same, and no
 * component plays a sound.
 */
import { uiEvent } from "./events";
import { useWorld } from "./store";
import { type UiState, useUi } from "./ui";

/** The layers that open over the island, top first. */
const LAYERS = [
  "sheet",
  "panel",
  "expanded",
  "house",
] as const satisfies readonly (keyof UiState)[];
/** Settings whose change is a switch. */
const SWITCHES = [
  "tab",
  "bulk",
  "scientific",
  "motion",
] as const satisfies readonly (keyof UiState)[];

export function startUiEvents(): () => void {
  const offUi = useUi.subscribe((state, previous) => {
    let opened = false;
    let closed = false;
    for (const layer of LAYERS) {
      const now = Boolean(state[layer]);
      const was = Boolean(previous[layer]);
      if (now && (!was || state[layer] !== previous[layer])) opened = true;
      else if (!now && was) closed = true;
    }
    if (opened) uiEvent("open");
    else if (closed) uiEvent("close");
    else if (SWITCHES.some((key) => state[key] !== previous[key])) uiEvent("switch");
  });
  const offWorld = useWorld.subscribe((state, previous) => {
    if (state.welcome && !previous.welcome) uiEvent("open");
  });
  return () => {
    offUi();
    offWorld();
  };
}
