/**
 * Onboarding hints (CLAUDE.md 4.3 rule 6): one line under the card, shown
 * when a mechanic first becomes relevant, gone for good once the player has
 * used it twice. The hint always explains the advisor's primary action.
 */
import type { Content } from "../content/schema";
import { accrued, type BaseState, furnaceOf, nextTier, nextTool, total } from "../domain/base";
import type { Advice } from "./advisor";
import type { Locale } from "./locale";

/** Uses after which a hint is never shown again. */
export const HINT_RETIRE_AFTER = 2;

export function hintFor(
  content: Content,
  locale: Locale,
  state: BaseState,
  advice: Advice,
  uses: Record<string, number>,
  now: number,
): string | undefined {
  if ((uses[advice] ?? 0) >= HINT_RETIRE_AFTER) return undefined;
  switch (advice) {
    case "gather":
      return locale.t("hint.gather");
    case "tools": {
      const tool = nextTool(content, state);
      return tool ? locale.t("hint.tools", { tool: locale.t(`tool.${tool.id}.name`) }) : undefined;
    }
    case "build": {
      const tier = nextTier(state.tier);
      return tier
        ? locale.t("hint.build", { tier: locale.t(`base_tier.${tier}.name`) })
        : undefined;
    }
    case "furnace":
      return locale.t(furnaceOf(content, state) ? "hint.furnace_use" : "hint.furnace");
    case "barrel":
      return locale.t("hint.barrel");
    case "craft":
      return locale.t("hint.craft");
    case "collect":
      return total(accrued(content, state, now)) > 0 ? locale.t("hint.collect") : undefined;
  }
}
