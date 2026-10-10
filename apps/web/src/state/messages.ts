/**
 * Words for what the domain reports: why a command was refused (one sentence, with what is
 * missing: CLAUDE.md 6.3 rule 5). Every string comes from the locale.
 */
import type { Refusal } from "@wipe-day/domain/commands";
import { fmt, t, tierName } from "./world";

export function refusalMessage(refusal: Refusal): string {
  switch (refusal.reason) {
    case "unknown":
      return t("refusal.unknown");
    case "locked":
      return t("refusal.locked", { era: tierName(refusal.gate.value) });
    case "supplies":
      return t("refusal.supplies", {
        need: fmt(refusal.need, "cost"),
        have: fmt(refusal.have, "held"),
      });
    case "max_owned":
      return t("refusal.max_owned", { have: refusal.have });
    case "no_units":
      return t("refusal.no_units");
    case "hired":
      return t("refusal.hired");
  }
}
