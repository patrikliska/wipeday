/** The node mini-game. Spec: `docs/screens/node.md`. Ephemeral. */
import { nodeRunAlive } from "../../domain/active";
import type { BaseState } from "../../domain/base";
import { amountsText, type TextContext } from "../amounts";
import { encodeCustomId } from "../customId";
import { relativeTimestamp } from "../format";
import type { Button, Screen } from "../screen";
import { navButtons } from "./nav";

export function nodeScreen(ctx: TextContext, state: BaseState, now: number): Screen {
  const { locale, content } = ctx;
  const { node } = content.active;
  const run = state.nodeRun;
  const alive = nodeRunAlive(content, state, now);
  const hits = run?.hits ?? 0;
  const bankedText =
    run && Object.keys(run.banked).length > 0
      ? locale.t("screen.node.banked", { banked: amountsText(ctx, run.banked, "delta") })
      : locale.t("screen.node.banked_none");

  let status: string;
  if (alive && run) {
    status = locale.t("screen.node.status", {
      hits,
      max: node.maxHits,
      when: relativeTimestamp(run.lastHitAt + node.hitWindowSeconds),
    });
  } else if (run?.ended === "perfect") {
    status = locale.t("screen.node.status_perfect", { hits, max: node.maxHits });
  } else if (run?.ended === "missed") {
    status = locale.t("screen.node.status_missed", { hits, max: node.maxHits });
  } else {
    status = locale.t("screen.node.status_faded", { hits, max: node.maxHits });
  }

  const positions: Button[] = Array.from({ length: node.positions }, (_, index) => ({
    customId: encodeCustomId({
      owner: null,
      route: { screen: "node", action: "hit", position: index },
    }),
    label: locale.t("screen.node.position", { n: index + 1 }),
    style: alive && run?.marker === index ? "primary" : "secondary",
    ...(alive ? {} : { disabled: true }),
  }));
  const nav = navButtons(ctx, "node", false).map((button) =>
    button.nav === "home" && !alive ? { ...button, style: "primary" as const } : button,
  );

  return {
    id: "node",
    kind: "sub",
    tone: alive ? "accent" : run?.ended === "perfect" ? "success" : "neutral",
    title: locale.t("screen.node.title"),
    status,
    details: [bankedText],
    ...(alive && run
      ? { hint: locale.t("screen.node.hint", { perHit: amountsText(ctx, run.perHit, "delta") }) }
      : {}),
    rows: [
      { kind: "buttons", buttons: positions },
      { kind: "buttons", buttons: nav },
    ],
  };
}
