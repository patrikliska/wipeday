/**
 * `/idle-debug card`: proves the render pipeline end to end inside Discord and
 * lets the owner flip through the base card's fixture states on a real phone.
 * Spec: `docs/screens/debug_card.md`.
 */
import type { Rendered } from "../../render/renderer";
import { type DebugState, encodeCustomId } from "../customId";
import type { Locale } from "../locale";
import type { Button, Screen } from "../screen";

export interface DebugCardInput {
  state: DebugState;
  rendered: Rendered;
  /** `[supplied, planned]` from the asset registry. */
  assets: [number, number];
}

export function debugCardScreen(locale: Locale, input: DebugCardInput): Screen {
  const { state, rendered } = input;
  const assets = locale.t("screen.debug_card.assets", {
    present: input.assets[0],
    planned: input.assets[1],
  });

  // Ephemeral, so no owner in the ids.
  const button = (target: DebugState, labelKey: string): Button => ({
    customId: encodeCustomId({
      owner: null,
      route: { screen: "debug", action: "card", state: target },
    }),
    label: locale.t(labelKey),
    style: "secondary",
  });
  const rerender = button(state, "screen.debug_card.rerender");
  const full = button("full", "screen.debug_card.full");
  const empty = button("empty", "screen.debug_card.empty");
  const normal = button("normal", "screen.debug_card.normal");

  // The primary action is always a state the viewer has not just seen;
  // re-rendering what is on screen is only interesting once, to watch the cache hit.
  const order: Record<DebugState, Button[]> = {
    normal: [full, empty, rerender],
    full: [empty, normal, rerender],
    empty: [normal, full, rerender],
  };
  const buttons = order[state].map((entry, index) =>
    index === 0 ? { ...entry, style: "primary" as const } : entry,
  );

  return {
    id: "debug_card",
    kind: "root",
    tone: "accent",
    title: locale.t("screen.debug_card.title"),
    status: locale.t(
      rendered.cached ? "screen.debug_card.status_cached" : "screen.debug_card.status",
      { ms: Math.round(rendered.ms), assets },
    ),
    card: { fileName: `base_${state}.png`, png: rendered.png },
    details: [locale.t("screen.debug_card.detail")],
    rows: [{ kind: "buttons", buttons }],
  };
}
