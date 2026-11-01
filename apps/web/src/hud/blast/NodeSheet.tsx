import { nodeOf } from "@wipe-day/content/blastmap";
import type { NodeDef } from "@wipe-day/content/schema";
import {
  affordablePrefix,
  type NodeState,
  pathCost,
  pathTo,
  shippedNodes,
} from "@wipe-day/domain/blastmap";
import { type NodeEffectLine, nodeGlance } from "@wipe-day/domain/glance";
import { useRef } from "react";
import { useMap } from "../../state/map";
import {
  content,
  duration,
  fmt,
  fmtFactor,
  fmtRate,
  nodeBlurb,
  nodeName,
  nodeTypeName,
  sectorName,
  t,
} from "../../state/world";
import { Icon, ResourceIcon } from "../Icon";
import { buyPath, type MapView, nodeLetters, stateWords } from "./shared";

/**
 * A node's sheet (docs/redesign/08-screens.md 2.11; 04-blast-map.md 8.2-8.3): the name, type
 * and place, the blurb, what it does in the player's own numbers, the cost and what is left
 * after, then one primary: Buy, "Buy path · 4 nodes · 1,240 glass" for a far node, "Buy the
 * first 2 · 300 glass" when only part is affordable, or the reason it waits (the ring's gate,
 * a parent, the glass: shown, disabled, in words, 6.3 rule 3). Lit nodes say so.
 */
export function NodeSheet({ view, now }: { view: MapView; now: number }) {
  const id = useMap((state) => state.node);
  const openNode = useMap((state) => state.openNode);
  const chip = useRef<HTMLSpanElement>(null);
  const node = id ? nodeOf(content, id) : undefined;
  if (!node) return null;
  const { base, states } = view;
  const state = states.get(node.id) ?? { kind: "hidden" as const };
  const held = base.meta.glass.held;
  const path = pathTo(content, base.meta, node.id);
  const far = path.length > 1;
  const cost = far ? pathCost(path) : node.cost;
  const prefix = far ? affordablePrefix(path, held) : [];
  const partial = far && prefix.length > 0 && prefix.length < path.length;
  const lines = nodeGlance(content, base, node, now);
  const children = shippedNodes(content).filter((other) => other.requires.includes(node.id));
  const close = () => openNode(null);
  const action = actionFor(state, path, prefix, cost, held);
  const buy = () => {
    if (action.kind !== "buy" || !action.enabled) return;
    buyPath(partial ? prefix : far ? path : [node], chip.current);
    close();
  };

  return (
    <section
      className="node-sheet plate"
      role="dialog"
      aria-modal="false"
      aria-label={nodeName(node.id)}
    >
      <span className="sheet-handle" aria-hidden="true" />
      <header className="node-sheet-head">
        <span
          className={`node-frame small type-${node.type} ${state.kind === "owned" ? "owned" : ""}`}
        >
          <span className="node-letters">{nodeLetters(node.id)}</span>
        </span>
        <div className="node-sheet-title">
          <h3>{nodeName(node.id)}</h3>
          <p className="sub">
            {t("map.node_place", {
              type: nodeTypeName(node.type),
              sector: node.sector ? sectorName(node.sector) : "",
              ring: node.ring,
            })}
          </p>
        </div>
        <button
          type="button"
          className="btn icon-btn"
          onClick={close}
          aria-label={t("settings.close")}
        >
          <Icon kind="ui" id="close" size={18} />
        </button>
      </header>
      <div className="node-sheet-body">
        {nodeBlurb(node.id) ? <p className="node-blurb">{nodeBlurb(node.id)}</p> : null}
        <ul className="node-lines">
          {lines.map((line) => (
            <li key={lineKey(line)} className="node-line">
              {effectWords(line)}
            </li>
          ))}
        </ul>
        {children.length > 0 ? (
          <p className="node-leads">
            {t("map.leads_to", { names: children.map((child) => nodeName(child.id)).join(", ") })}
          </p>
        ) : null}
        <p className="node-cost-line">
          <span className="map-glass-chip" ref={chip}>
            <ResourceIcon id="glass" size={18} />
            <span className="num">{fmt(cost, "cost")}</span>
          </span>
          <span className="node-cost-words">{costWords(state, cost, held, far, path.length)}</span>
        </p>
      </div>
      <footer className="node-sheet-foot">
        {action.kind === "none" ? (
          <p className="node-reason">{action.text}</p>
        ) : (
          <button
            type="button"
            className={`btn grow${action.enabled ? " primary" : ""}`}
            disabled={!action.enabled}
            onClick={buy}
          >
            {action.text}
          </button>
        )}
      </footer>
    </section>
  );
}

/** One key per kind of line: a stat's by its stat, an income's by its condition. */
const lineKey = (line: NodeEffectLine): string =>
  line.kind === "stat"
    ? `stat-${line.stat}`
    : line.kind === "income"
      ? `income-${line.when ?? ""}`
      : line.kind;

type Action = { kind: "buy"; text: string; enabled: boolean } | { kind: "none"; text: string };

/** The primary's words, or the reason there is none (locked reasons in order, 04 8.2). */
function actionFor(
  state: NodeState,
  path: NodeDef[],
  prefix: NodeDef[],
  cost: number,
  held: number,
): Action {
  switch (state.kind) {
    case "owned":
      return { kind: "none", text: t("map.owned_note") };
    case "hidden":
      return { kind: "none", text: t("refusal.hidden") };
    case "ring_gate":
      return { kind: "none", text: stateWords(state) };
    case "node_gate":
      return { kind: "none", text: stateWords(state) };
    case "no_parent": {
      if (path.length === 0) return { kind: "none", text: t("map.state_no_parent") };
      if (cost <= held)
        return {
          kind: "buy",
          text: t("map.buy_path", { n: path.length, cost: fmt(cost, "cost") }),
          enabled: true,
        };
      if (prefix.length > 0)
        return {
          kind: "buy",
          text: t("map.buy_first", { n: prefix.length, cost: fmt(pathCost(prefix), "cost") }),
          enabled: true,
        };
      return {
        kind: "buy",
        text: t("map.need_more", { need: fmt(cost - held, "cost") }),
        enabled: false,
      };
    }
    case "glass":
      return {
        kind: "buy",
        text: t("map.need_more", { need: fmt(state.need - state.have, "cost") }),
        enabled: false,
      };
    case "affordable":
      return { kind: "buy", text: t("map.buy", { cost: fmt(cost, "cost") }), enabled: true };
  }
}

function costWords(state: NodeState, cost: number, held: number, far: boolean, n: number): string {
  if (state.kind === "owned") return t("map.cost_lit");
  const whole = far ? t("map.cost_path", { n }) : "";
  if (cost <= held) return `${whole}${t("map.left_after", { left: fmt(held - cost, "held") })}`;
  return `${whole}${t("map.have_glass", { have: fmt(held, "held") })}`;
}

/** A line of the sheet in the player's own numbers (04 8.2). */
function effectWords(line: NodeEffectLine): string {
  switch (line.kind) {
    case "income": {
      const pct = line.before > 0 ? Math.round((line.after / line.before - 1) * 100) : 0;
      const args = {
        before: fmtRate(line.before),
        after: fmtRate(line.after),
        pct: `${pct >= 0 ? "+" : ""}${pct}%`,
      };
      return line.when
        ? t("map.now_income_when", { ...args, when: t(`map.when_${line.when}`) })
        : t("map.now_income", args);
    }
    case "tap":
      return t("map.now_tap", { before: fmt(line.before, "cost"), after: fmt(line.after, "cost") });
    case "night_shift":
      return t("map.now_night", { before: duration(line.before), after: duration(line.after) });
    case "glass":
      return t("map.now_glass", {
        before: fmt(line.before, "cost"),
        after: fmt(line.after, "cost"),
      });
    case "glow":
      return t("map.now_glow", { before: fmtFactor(line.before), after: fmtFactor(line.after) });
    case "feature":
      return t("map.now_feature");
    case "stat":
      return t("map.now_stat", {
        stat: t(`stat.${line.stat}`),
        before: statValue(line.stat, line.before, line.additive),
        after: statValue(line.stat, line.after, line.additive),
      });
  }
}

const SECONDS = new Set(["hustle_hold", "afterglow_half", "flotsam_float"]);
const PERCENT = new Set([
  "crit_chance",
  "tap_share",
  "flotsam_effect",
  "hustle_max",
  "hustle_gain",
]);

function statValue(stat: string, value: number, additive: boolean): string {
  if (SECONDS.has(stat)) return duration(Math.round(value));
  if (PERCENT.has(stat)) return `${Number((value * 100).toPrecision(3))}%`;
  if (!additive) return `×${fmtFactor(value)}`;
  return fmtFactor(value);
}
