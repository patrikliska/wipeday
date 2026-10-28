/**
 * Words for what the domain reports: why a command was refused (one sentence, with what is
 * missing: CLAUDE.md 6.3 rule 5). Every string comes from the locale.
 */
import type { Gate, Refusal } from "@wipe-day/domain/commands";
import { duration, fmt, lineName, t, tierName, upgradeName } from "./world";

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
    case "opens":
      return t("refusal.locked_opens");
  }
}

/** `now`: the game clock's second, for a boost's time left. */
export function refusalMessage(refusal: Refusal, now = 0): string {
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
    case "gone":
      return t("refusal.gone");
    case "claimed":
      return t("refusal.claimed");
    case "stale_run":
      return t("refusal.stale_run");
    case "no_drop":
      return t("refusal.no_drop");
    case "shards":
      return t("refusal.shards", { need: refusal.need, have: refusal.have });
    case "max_stars":
      return t("refusal.max_stars");
    case "not_ready":
      return t("refusal.not_ready", { need: fmt(refusal.need, "cost") });
    case "glass":
      return t("refusal.glass", {
        need: fmt(refusal.need, "cost"),
        have: fmt(refusal.have, "held"),
      });
    case "hidden":
      return t("refusal.hidden");
    case "no_parent":
      return t("refusal.no_parent");
    case "not_owned":
      return t("refusal.not_owned");
    case "stale":
      return t("refusal.stale");
    case "scrap":
      return t("refusal.scrap", { need: refusal.need, have: refusal.have });
    case "unmet":
      return refusal.goal === null
        ? t("refusal.unmet_once")
        : t("refusal.unmet", {
            value: fmt(refusal.value ?? 0, "held"),
            goal: fmt(refusal.goal, "cost"),
          });
    case "running":
      return t("refusal.running", { time: duration(Math.max(0, refusal.until - now)) });
  }
}
