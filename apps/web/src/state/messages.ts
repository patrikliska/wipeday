/**
 * Words for what the domain reports: why a command was refused (one sentence, with what is
 * missing: CLAUDE.md 6.3 rule 5). Every string comes from the locale.
 */
import type { Gate, Refusal } from "@wipe-day/domain/commands";
import { fmt, lineName, t, tierName, upgradeName } from "./world";

function gateMessage(gate: Gate): string {
  switch (gate.kind) {
    case "era":
      return t("refusal.locked", { era: tierName(gate.value) });
    case "owned":
      return t("refusal.locked_owned", {
        need: gate.value,
        line: lineName(gate.line),
        have: gate.have,
      });
    case "previous":
      return t("refusal.locked_previous", { name: upgradeName(gate.value) });
    case "wipe_day":
      return t("refusal.locked_wipe_day", { count: gate.value });
  }
}

export function refusalMessage(refusal: Refusal): string {
  switch (refusal.reason) {
    case "unknown":
      return t("refusal.unknown");
    case "locked":
      return gateMessage(refusal.gate);
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
    case "owned":
      return t("refusal.owned");
    case "not_next":
      return t("refusal.not_next", { era: tierName(refusal.era) });
  }
}
