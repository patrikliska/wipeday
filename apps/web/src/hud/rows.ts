/**
 * The drawer's rows as plain data (docs/redesign/08-screens.md 1.4, 2.1, 2.2): what each row
 * says, what its button sends and whether it wears the crown. Pure, so the collapsed drawer, the
 * expanded tabs and the desktop column share it, and a test can read it without a browser.
 *
 * Words come from the locale, numbers from the one formatter, rules from the domain: a row's
 * reason and the server's refusal never disagree (both read `shelf.ts`).
 */
import type { IconKind } from "@wipe-day/content/icons";
import type { LineDef, UpgradeDef } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import { byScore, type Choice, sameRow } from "@wipe-day/domain/advisor";
import type { Command } from "@wipe-day/domain/commands";
import { cycleOf, unitRate } from "@wipe-day/domain/effects";
import {
  costFactor,
  costOf,
  eraOpen,
  handPriceOf,
  lineOf,
  maxAffordable,
} from "@wipe-day/domain/lines";
import {
  bought,
  eraCost,
  eraGate,
  nextEra,
  upgradeCost,
  upgradeGate,
} from "@wipe-day/domain/shelf";
import type { BaseState } from "@wipe-day/domain/state";
import type { AdvisorView } from "../state/advisor";
import type { Bulk } from "../state/ui";
import {
  content,
  crewName,
  duration,
  fmt,
  fmtCount,
  fmtFactor,
  fmtRate,
  lineName,
  t,
  tierName,
  upgradeName,
} from "../state/world";

export type RowKind = "line" | "hand" | "era" | "upgrade";

export interface Row {
  /** Stable across renders: `line:loom`, `hand:loom`, `era:stone`, `upgrade:loom_mk2`. */
  key: string;
  kind: RowKind;
  /** What the button sends; null while locked. */
  command: Command | null;
  icon: { kind: IconKind; id: string };
  /** The era colour the row wears (bars, frames). */
  tier: Tier;
  /** A line's owned count, as a pill on its icon. */
  owned?: number;
  /** A line row: its hand's id when manned, null when not (the finger glyph). */
  hand?: string | null;
  /** A Line Mk row: II or III, a chevron on the line's icon. */
  mk?: number;
  name: string;
  /** Line 2 of a line row: its product badge, cycle bar and rate. */
  product?: string;
  bar?: Bar;
  rate?: string;
  /** Line 2 of the other rows. */
  sub?: string;
  /** Line 3: the next milestone, a hint or the real reason it is locked. */
  note?: string;
  /** The era row: how far the supplies are toward its price (0..1). */
  progress?: number;
  button: { top: string; cost: string; enabled: boolean; label: string };
  locked: boolean;
  crowned: boolean;
  /** The advisor's score (lower is better), for the collapsed drawer's order. */
  score: number;
}

/** A cycle bar: a manned one loops; an unmanned one plays its cycle in flight, or sits empty. */
export interface Bar {
  seconds: number;
  manned: boolean;
  /** An unmanned cycle in flight: seconds already run of it. */
  elapsed?: number;
  /** Its end (game seconds), so a new cycle restarts the animation. */
  until?: number;
}

const ONLINE = { online: true } as const;

function lineOrThrow(id: string): LineDef {
  const line = lineOf(content, id);
  if (!line) throw new Error(`unknown line ${id}`);
  return line;
}

/** "in 42s", or "tap to earn" when nothing comes in. */
export function affordIn(cost: number, view: AdvisorView): string {
  const missing = cost - view.base.run.supplies;
  if (missing <= 0) return "";
  if (view.income <= 0) return t("row.tap_to_earn");
  return t("row.in", { time: duration(Math.ceil(missing / view.income)) });
}

/** The next milestone of a line owning `n` (02-the-run.md 4.1), in words. */
export function milestoneNote(line: LineDef, n: number): string {
  if (n >= line.maxOwned) return t("row.maxed", { owned: fmtCount(n) });
  for (const step of content.milestones.line) {
    if (step.at <= n) continue;
    if (step.speed !== undefined && step.speed > 1)
      return t("row.milestone_speed", {
        owned: fmtCount(n),
        at: fmtCount(step.at),
        factor: step.speed,
      });
    return t("row.milestone_payout", {
      owned: fmtCount(n),
      at: fmtCount(step.at),
      factor: step.payout ?? 1,
    });
  }
  const { from, step, payout, special } = content.milestones.lineEvery;
  const next = n < from ? from : from + (Math.floor((n - from) / step) + 1) * step;
  const odd = special.find((row) => row.at === next);
  if (odd)
    return t("row.milestone_payout", {
      owned: fmtCount(n),
      at: fmtCount(next),
      factor: odd.payout,
    });
  return t("row.milestone_every", { factor: payout, step, at: fmtCount(next) });
}

/** How many units a bulk size buys of `line` owning `n` (Max: as many as the supplies allow). */
export function bulkCount(line: LineDef, n: number, bulk: Bulk, supplies: number, factor: number) {
  const room = Math.max(0, line.maxOwned - n);
  if (bulk === "max") return Math.max(1, Math.min(room, maxAffordable(line, n, supplies, factor)));
  return Math.max(1, Math.min(room, bulk));
}

function buyButton(cost: number, view: AdvisorView, top: string, label: string) {
  const enabled = cost <= view.base.run.supplies;
  return { top: enabled ? top : affordIn(cost, view), cost: fmt(cost, "cost"), enabled, label };
}

function lineRow(view: AdvisorView, line: LineDef, bulk: Bulk): Row {
  const base = view.base;
  const n = base.run.lines[line.id] ?? 0;
  const manned = base.run.hands.includes(line.id);
  const factor = costFactor(content, base, line);
  const full = n >= line.maxOwned;
  const k = bulkCount(line, n, bulk, base.run.supplies, factor);
  const cost = costOf(line, n, k, factor);
  const top =
    bulk === 1
      ? t("row.buy")
      : bulk === "max"
        ? t("row.buy_count", { count: k })
        : t("row.buy_n", { count: k });
  const name = lineName(line.id);
  const button = full
    ? {
        top: t("row.full"),
        cost: "",
        enabled: false,
        label: t("row.maxed", { owned: fmtCount(n) }),
      }
    : buyButton(
        cost,
        view,
        top,
        t("row.aria_buy", {
          count: k,
          name: k === 1 ? name : t(`line.${line.id}.plural`),
          cost: fmt(cost, "cost"),
        }),
      );
  const seconds = cycleOf(content, base, line, view.now);
  const ready = base.run.readyAt[line.id];
  const running = !manned && ready !== undefined && ready > view.now;
  const perSecond = n * unitRate(content, base, line, view.now, ONLINE);
  const bar: Bar = running
    ? { seconds, manned, elapsed: Math.max(0, seconds - (ready - view.now)), until: ready }
    : { seconds, manned };
  let rate = "";
  if (n > 0) rate = manned || running ? `+${fmtRate(perSecond)}` : t("row.idle");
  const unmannedHint = !manned && n > 0 && base.run.hands.length < 2;
  return {
    key: `line:${line.id}`,
    kind: "line",
    command: full ? null : { type: "buy_line", line: line.id, count: bulk },
    icon: { kind: "line", id: line.id },
    tier: line.era,
    owned: n,
    hand: manned ? line.hand : null,
    name,
    product: line.product,
    bar,
    rate,
    note: unmannedHint ? t("row.unmanned") : milestoneNote(line, n),
    button,
    locked: false,
    crowned: false,
    score: Number.POSITIVE_INFINITY,
  };
}

function handRow(view: AdvisorView, line: LineDef): Row {
  const base = view.base;
  const cost = handPriceOf(content, base, line);
  const name = crewName(line.hand);
  const first = base.meta.stats.hands < 2;
  return {
    key: `hand:${line.id}`,
    kind: "hand",
    command: { type: "hire_hand", line: line.id },
    icon: { kind: "crew", id: line.hand },
    tier: line.era,
    name: t("row.hire_name", { name }),
    sub: first
      ? t("row.hand_first", { line: lineName(line.id) })
      : t("row.hand_later", { line: lineName(line.id) }),
    button: buyButton(
      cost,
      view,
      t("row.hire"),
      t("row.aria_hire", { name, cost: fmt(cost, "cost") }),
    ),
    locked: false,
    crowned: false,
    score: Number.POSITIVE_INFINITY,
  };
}

/** The next era's row, or null when there is none or a later phase's gate shuts it (D140). */
function eraRow(view: AdvisorView): Row | null {
  const base = view.base;
  const era = nextEra(content, base);
  if (!era || eraGate(base, era)) return null;
  const cost = eraCost(content, base, era);
  const opens = content.lines
    .filter((line) => line.era === era.id)
    .map((line) => lineName(line.id));
  let factor = 1;
  for (const effect of era.effects ?? []) if (effect.op === "more") factor *= effect.value;
  const progress = Math.min(1, base.run.supplies / cost);
  const name = t("row.era_name", { era: tierName(era.id) });
  return {
    key: `era:${era.id}`,
    kind: "era",
    command: { type: "buy_era", era: era.id },
    icon: { kind: "tier", id: era.id },
    tier: era.id,
    name,
    sub: t("row.era_effect", { factor: fmtFactor(factor), lines: opens.join(", ") }),
    note:
      progress >= 1
        ? t("row.era_ready")
        : t("row.era_progress", {
            percent: Math.floor(progress * 100),
            time: affordIn(cost, view).replace(/^in /, ""),
          }),
    progress,
    button: buyButton(
      cost,
      view,
      t("row.buy"),
      t("row.aria_upgrade", { name, cost: fmt(cost, "cost") }),
    ),
    locked: false,
    crowned: false,
    score: Number.POSITIVE_INFINITY,
  };
}

/** What an upgrade does, in one line (08-screens.md 2.1). */
export function upgradeEffect(upgrade: UpgradeDef): string {
  let more = 1;
  let share = 0;
  for (const effect of upgrade.effects) {
    if (effect.op === "more") more *= effect.value;
    if (effect.stat === "tap_share" && effect.op === "add") share += effect.value;
  }
  if (upgrade.kind === "grip")
    return t("row.grip_effect", {
      factor: fmtFactor(more),
      share: `${Number((share * 100).toPrecision(3))}%`,
    });
  if (upgrade.kind === "mk")
    return t("row.mk_effect", { line: lineName(upgrade.line ?? ""), factor: fmtFactor(more) });
  return t("row.island_effect", { factor: fmtFactor(more) });
}

function upgradeIcon(upgrade: UpgradeDef): Row["icon"] {
  if (upgrade.kind === "grip") return { kind: "tool", id: upgrade.id };
  if (upgrade.kind === "mk") return { kind: "line", id: upgrade.line ?? "" };
  return { kind: "ui", id: "upgrade" };
}

function upgradeTier(upgrade: UpgradeDef): Tier {
  if (upgrade.kind === "grip")
    return content.tools.find((tool) => tool.id === upgrade.id)?.tier ?? "twig";
  if (upgrade.kind === "mk") return lineOf(content, upgrade.line ?? "")?.era ?? "twig";
  return "twig";
}

function upgradeRow(view: AdvisorView, upgrade: UpgradeDef): Row {
  const base = view.base;
  const cost = upgradeCost(content, base, upgrade);
  const gate = upgradeGate(content, base, upgrade);
  const name = upgradeName(upgrade.id);
  const reason =
    gate?.kind === "owned"
      ? t("row.needs_owned", {
          need: fmtCount(gate.value),
          lines: t(`line.${gate.line}.plural`),
          have: fmtCount(gate.have),
        })
      : undefined;
  return {
    key: `upgrade:${upgrade.id}`,
    kind: "upgrade",
    command: gate ? null : { type: "buy_upgrade", upgrade: upgrade.id },
    icon: upgradeIcon(upgrade),
    tier: upgradeTier(upgrade),
    ...(upgrade.kind === "mk" ? { mk: upgrade.after ? 3 : 2 } : {}),
    name,
    sub: upgradeEffect(upgrade),
    ...(reason ? { note: reason } : {}),
    button: gate
      ? {
          top: t("row.locked"),
          cost: fmt(cost, "cost"),
          enabled: false,
          label: t("row.aria_wait", { name, reason: reason ?? "" }),
        }
      : buyButton(
          cost,
          view,
          t("row.buy"),
          t("row.aria_upgrade", { name, cost: fmt(cost, "cost") }),
        ),
    locked: gate !== null,
    crowned: false,
    score: Number.POSITIVE_INFINITY,
  };
}

/** A line of the next era, locked with its real price and reason (08-screens.md 2.1). */
function lockedLineRow(line: LineDef): Row {
  const name = lineName(line.id);
  const reason = t("row.opens_in", { era: tierName(line.era) });
  return {
    key: `line:${line.id}`,
    kind: "line",
    command: null,
    icon: { kind: "line", id: line.id },
    tier: line.era,
    owned: 0,
    hand: null,
    name,
    note: reason,
    button: {
      top: t("row.locked"),
      cost: fmt(line.cost, "cost"),
      enabled: false,
      label: t("row.aria_wait", { name, reason }),
    },
    locked: true,
    crowned: false,
    score: Number.POSITIVE_INFINITY,
  };
}

/** The row a purchase belongs to. */
function rowOf(view: AdvisorView, command: Command, bulk: Bulk): Row | null {
  switch (command.type) {
    case "buy_line":
      return lineRow(view, lineOrThrow(command.line), bulk);
    case "hire_hand":
      return handRow(view, lineOrThrow(command.line));
    case "buy_era":
      return eraRow(view);
    case "buy_upgrade": {
      const upgrade = content.upgrades.find((row) => row.id === command.upgrade);
      return upgrade ? upgradeRow(view, upgrade) : null;
    }
    default:
      return null;
  }
}

/** The bulk size in force: the toggle exists from the run's second hand (02 9.1). */
export function bulkShown(base: BaseState): boolean {
  return base.run.hands.length >= content.run.bulkAfterHands;
}

const scoreOf = (view: AdvisorView, row: Row): number => {
  const choice = row.command
    ? view.offered.find((offer) => sameRow(offer.command, row.command as Command))
    : undefined;
  return choice?.score ?? Number.POSITIVE_INFINITY;
};

/** Crowns the row of `choice` (if it is among `rows`); returns whether one was. */
function crownRow(rows: Row[], choice: Choice | null | undefined): boolean {
  if (!choice) return false;
  const row = rows.find((item) => item.command && sameRow(item.command, choice.command));
  if (!row) return false;
  row.crowned = true;
  return true;
}

/**
 * The collapsed drawer (08-screens.md 1.4): the crowned row first, then the next by the
 * advisor's score. While the crown is on the tap hint no row is orange (resolution 3.25).
 */
export function collapsedRows(view: AdvisorView, bulk: Bulk, count = 3): Row[] {
  const sorted = [...view.offered].sort(byScore);
  const picked: Choice[] = [];
  if (view.pick.kind === "purchase") picked.push(view.pick.choice);
  for (const choice of sorted) {
    if (picked.length >= count) break;
    if (!picked.some((other) => sameRow(other.command, choice.command))) picked.push(choice);
  }
  const rows: Row[] = [];
  for (const choice of picked) {
    const row = rowOf(view, choice.command, bulk);
    if (row) rows.push({ ...row, score: choice.score });
  }
  if (view.pick.kind === "purchase") crownRow(rows, view.pick.choice);
  return rows;
}

/** The Lines tab: the era row, lines 1-14 in order with their hand rows, the next era's locked. */
export function linesTab(view: AdvisorView, bulk: Bulk): Row[] {
  const base = view.base;
  const rows: Row[] = [];
  const era = eraRow(view);
  if (era) rows.push(era);
  for (const line of content.lines) {
    if (!eraOpen(base, line)) continue;
    rows.push(lineRow(view, line, bulk));
    const n = base.run.lines[line.id] ?? 0;
    if (n > 0 && !base.run.hands.includes(line.id)) rows.push(handRow(view, line));
  }
  const next = nextEra(content, base);
  if (next && !eraGate(base, next))
    for (const line of content.lines) if (line.era === next.id) rows.push(lockedLineRow(line));
  for (const row of rows) row.score = scoreOf(view, row);
  return rows;
}

/** Shelf rows on show: the next step of each ladder, a Line Mk once its line is owned. */
function shelfOnShow(base: BaseState): UpgradeDef[] {
  return content.upgrades.filter((upgrade) => {
    if (bought(base, upgrade.id)) return false;
    const gate = upgradeGate(content, base, upgrade);
    if (!gate) return true;
    // A Mk II short of units shows its reason; later steps and other eras stay hidden.
    return gate.kind === "owned" && (base.run.lines[gate.line] ?? 0) > 0;
  });
}

/** The Upgrades tab: on show by price, then what this run bought. */
export function upgradesTab(view: AdvisorView): {
  rows: Row[];
  bought: Array<{ id: string; name: string }>;
} {
  const base = view.base;
  const rows = shelfOnShow(base)
    .map((upgrade) => upgradeRow(view, upgrade))
    .sort((a, b) => (a.locked === b.locked ? 0 : a.locked ? 1 : -1));
  const cost = (row: Row) => {
    const id = row.key.slice("upgrade:".length);
    const upgrade = content.upgrades.find((item) => item.id === id);
    return upgrade ? upgradeCost(content, base, upgrade) : 0;
  };
  rows.sort((a, b) => cost(a) - cost(b));
  for (const row of rows) row.score = scoreOf(view, row);
  return { rows, bought: base.run.upgrades.map((id) => ({ id, name: upgradeName(id) })) };
}

/** How many shelf rows are affordable now: the tab's count. */
export function affordableUpgrades(view: AdvisorView): number {
  return shelfOnShow(view.base).filter(
    (upgrade) =>
      !upgradeGate(content, view.base, upgrade) &&
      upgradeCost(content, view.base, upgrade) <= view.base.run.supplies,
  ).length;
}

/**
 * Crowns exactly one row of an expanded tab (a view of its own, resolution 3.25): the sheet's
 * pick when it is on this tab, otherwise the tab's best score.
 */
export function crownTab(rows: Row[], view: AdvisorView): Row[] {
  if (crownRow(rows, view.sheet)) return rows;
  let best: Row | null = null;
  for (const row of rows) {
    if (!row.command || row.score === Number.POSITIVE_INFINITY) continue;
    if (!best || row.score < best.score) best = row;
  }
  if (best) best.crowned = true;
  return rows;
}

/**
 * The island's pick as a crowned row, or null while the crown is elsewhere (the tap hint). The
 * desktop column pins it over its tabs: the column shares the island's view, so it shows that
 * one crown and no other (CLAUDE.md 6.3 rule 1).
 */
export function pickRow(view: AdvisorView, bulk: Bulk): Row | null {
  if (view.pick.kind !== "purchase") return null;
  const row = rowOf(view, view.pick.choice.command, bulk);
  return row ? { ...row, crowned: true, score: view.pick.choice.score } : null;
}
