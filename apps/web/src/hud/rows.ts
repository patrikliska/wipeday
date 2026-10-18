/**
 * The shop's cards as plain data (docs/redesign/08-screens.md 1.4, 2.1; 12-feel.md 4): what each
 * card says, what its buttons send and whether one wears the crown. Pure, so the drawer, its
 * expanded tabs and the desktop column share it, and a test can read it without a browser. The
 * order is fixed (D186): the crown lights a card where it stands and never moves one.
 *
 * Words come from the locale, numbers from the one formatter, rules from the domain: a row's
 * reason and the server's refusal never disagree (both read `shelf.ts` or `research.ts`).
 */

import type { Effect } from "@wipe-day/content/effects";
import type { IconKind } from "@wipe-day/content/icons";
import type { LineDef, ResearchDef, UpgradeDef } from "@wipe-day/content/schema";
import { TIERS, type Tier } from "@wipe-day/content/tiers";
import { type Choice, sameRow } from "@wipe-day/domain/advisor";
import type { Command } from "@wipe-day/domain/commands";
import { cycleOf, foldParts, rates, unitRate } from "@wipe-day/domain/effects";
import {
  costFactor,
  costOf,
  eraOpen,
  handPriceOf,
  lineOf,
  maxAffordable,
} from "@wipe-day/domain/lines";
import {
  levelOf,
  levelsCost,
  maxResearch,
  researchGate,
  workshopOpen,
} from "@wipe-day/domain/research";
import {
  bought,
  eraCost,
  eraGate,
  type Gate,
  nextEra,
  upgradeCost,
  upgradeGate,
} from "@wipe-day/domain/shelf";
import type { BaseState } from "@wipe-day/domain/state";
import type { AdvisorView } from "../state/advisor";
import type { Bulk, Tab } from "../state/ui";
import {
  content,
  crewName,
  duration,
  fmt,
  fmtCount,
  fmtFactor,
  fmtRate,
  lineName,
  researchLevelName,
  researchName,
  resourceName,
  t,
  tierName,
  upgradeName,
} from "../state/world";

export type RowKind = "line" | "era" | "upgrade" | "research";

/** A button on a card: its two lines, whether it can be pressed, its spoken label. */
export interface Button {
  top: string;
  cost: string;
  enabled: boolean;
  label: string;
}

export interface Row {
  /** Stable across renders: `line:loom`, `era:stone`, `upgrade:handcarts`, `research:loom_mk`. */
  key: string;
  kind: RowKind;
  /** What the button sends; null while locked. */
  command: Command | null;
  icon: { kind: IconKind; id: string };
  /** The card's pixel art (`line/loom_2`), drawn instead of the icon when it exists. */
  art?: string;
  /** The era colour the card wears (bars, frames). */
  tier: Tier;
  /** A line's owned count: the level badge on its thumbnail. */
  owned?: number;
  /** A line card: its hand's id when manned, null when not (the finger glyph). */
  hand?: string | null;
  /** A Workshop tile: levels bought of how many (its ring). */
  level?: { n: number; of: number };
  /** A Line Mk tile: the level it buys next ("Mk II"). */
  mk?: string;
  name: string;
  /** A line card's rate line: its product badge, cycle bar and rate. */
  product?: string;
  bar?: Bar;
  rate?: string;
  /** Under the name on the other cards; a Workshop tile's next level's effect. */
  sub?: string;
  /** A Workshop tile: what the next level adds ("+214/s", "2h → 2h 20m"). */
  gain?: string;
  /** The last line: the next milestone, a hint or the real reason it is locked. */
  note?: string;
  /** The bar under the name (0..1): a line toward its next milestone, an era toward its price. */
  progress?: number;
  /** A line owned but not manned: its hand's hire, a second, smaller button on the card. */
  hire?: { command: Command; button: Button; crowned: boolean; score: number };
  button: Button;
  locked: boolean;
  /** The crown is on this card's Buy (the hire's crown is `hire.crowned`). */
  crowned: boolean;
  /** The advisor's score for the Buy (lower is better). */
  score: number;
}

/** Whether a card wears the crown, on either of its buttons. */
export const cardCrowned = (row: Row): boolean => row.crowned || row.hire?.crowned === true;

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

/** "in 42s", or "tap to earn" when nothing comes in. */
export function affordIn(cost: number, view: AdvisorView): string {
  const missing = cost - view.base.run.supplies;
  if (missing <= 0) return "";
  if (view.income <= 0) return t("row.tap_to_earn");
  return t("row.in", { time: duration(Math.ceil(missing / view.income)) });
}

/**
 * The milestone a line owning `n` is working toward and the one before it (02-the-run.md 4.1):
 * the card's bar runs from `from` to `at`. Null once the line is full.
 */
export function milestoneSpan(line: LineDef, n: number): { from: number; at: number } | null {
  if (n >= line.maxOwned) return null;
  let from = 0;
  for (const step of content.milestones.line) {
    if (step.at <= n) {
      from = step.at;
      continue;
    }
    return { from, at: Math.min(step.at, line.maxOwned) };
  }
  const every = content.milestones.lineEvery;
  const at =
    n < every.from
      ? every.from
      : every.from + (Math.floor((n - every.from) / every.step) + 1) * every.step;
  return { from: Math.max(from, at - every.step), at: Math.min(at, line.maxOwned) };
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

/** The stage of a line's art the scene shows at `n` owned (scene/lines.ts): 1, 2 or 3. */
export const artStage = (n: number): number => (n >= 100 ? 3 : n >= 25 ? 2 : 1);

/** How many units a bulk size buys of `line` owning `n` (Max: as many as the supplies allow). */
export function bulkCount(line: LineDef, n: number, bulk: Bulk, supplies: number, factor: number) {
  const room = Math.max(0, line.maxOwned - n);
  if (bulk === "max") return Math.max(1, Math.min(room, maxAffordable(line, n, supplies, factor)));
  return Math.max(1, Math.min(room, bulk));
}

function buyButton(cost: number, view: AdvisorView, top: string, label: string): Button {
  const enabled = cost <= view.base.run.supplies;
  return { top: enabled ? top : affordIn(cost, view), cost: fmt(cost, "cost"), enabled, label };
}

function scoreOfCommand(view: AdvisorView, command: Command): number {
  const choice = view.offered.find((offer) => sameRow(offer.command, command));
  return choice?.score ?? Number.POSITIVE_INFINITY;
}

/** A line's hand, as the hire button on its card (none once manned or before the first unit). */
function hireOf(view: AdvisorView, line: LineDef): Row["hire"] {
  const base = view.base;
  const n = base.run.lines[line.id] ?? 0;
  if (n === 0 || base.run.hands.includes(line.id)) return undefined;
  const cost = handPriceOf(content, base, line);
  const name = crewName(line.hand);
  const command: Command = { type: "hire_hand", line: line.id };
  // The hand's name stays on the button while saving: the price beside it is the reason.
  const button = buyButton(cost, view, "", t("row.aria_hire", { name, cost: fmt(cost, "cost") }));
  return {
    command,
    button: { ...button, top: t("row.hire_name", { name }) },
    crowned: false,
    score: scoreOfCommand(view, command),
  };
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
  if (n > 0)
    rate = manned
      ? `+${fmtRate(perSecond)}`
      : running
        ? t("row.rate_tapped", { rate: `+${fmtRate(perSecond)}` })
        : t("row.idle");
  const span = milestoneSpan(line, n);
  const hire = hireOf(view, line);
  const command: Command | null = full ? null : { type: "buy_line", line: line.id, count: bulk };
  return {
    key: `line:${line.id}`,
    kind: "line",
    command,
    icon: { kind: "line", id: line.id },
    art: `line/${line.id}_${artStage(n)}`,
    tier: line.era,
    owned: n,
    hand: manned ? line.hand : null,
    name,
    product: line.product,
    bar,
    rate,
    ...(n > 0 ? { progress: span ? (n - span.from) / (span.at - span.from) : 1 } : {}),
    note:
      n === 0
        ? t("row.line_first", { product: resourceName(line.product) })
        : milestoneNote(line, n),
    ...(hire ? { hire } : {}),
    button,
    locked: false,
    crowned: false,
    score: command ? scoreOfCommand(view, command) : Number.POSITIVE_INFINITY,
  };
}

/** The next era's card, or null when there is none or a later phase's gate shuts it (D140). */
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
  const command: Command = { type: "buy_era", era: era.id };
  return {
    key: `era:${era.id}`,
    kind: "era",
    command,
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
    score: scoreOfCommand(view, command),
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
  return t("row.island_effect", { factor: fmtFactor(more) });
}

function upgradeIcon(upgrade: UpgradeDef): Row["icon"] {
  if (upgrade.kind === "grip") return { kind: "tool", id: upgrade.id };
  return { kind: "ui", id: "upgrade" };
}

function upgradeTier(upgrade: UpgradeDef): Tier {
  if (upgrade.kind === "grip")
    return content.tools.find((tool) => tool.id === upgrade.id)?.tier ?? "twig";
  return "twig";
}

function upgradeRow(view: AdvisorView, upgrade: UpgradeDef): Row {
  const base = view.base;
  const cost = upgradeCost(content, base, upgrade);
  const gate = upgradeGate(content, base, upgrade);
  const name = upgradeName(upgrade.id);
  const reason = gate ? gateReason(gate) : undefined;
  const command: Command | null = gate ? null : { type: "buy_upgrade", upgrade: upgrade.id };
  return {
    key: `upgrade:${upgrade.id}`,
    kind: "upgrade",
    command,
    icon: upgradeIcon(upgrade),
    tier: upgradeTier(upgrade),
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
    score: command ? scoreOfCommand(view, command) : Number.POSITIVE_INFINITY,
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
    art: `line/${line.id}_1`,
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

/** The bulk size in force: the toggle exists from the run's second hand (02 9.1). */
export function bulkShown(base: BaseState): boolean {
  return base.run.hands.length >= content.run.bulkAfterHands;
}

/** Crowns the button of `choice` among `rows` (a Buy or a hire); returns whether one was. */
function crownRow(rows: Row[], choice: Choice | null | undefined): boolean {
  if (!choice) return false;
  for (const row of rows) {
    if (row.command && sameRow(row.command, choice.command)) {
      row.crowned = true;
      return true;
    }
    if (row.hire && sameRow(row.hire.command, choice.command)) {
      row.hire.crowned = true;
      return true;
    }
  }
  return false;
}

/**
 * The Lines tab, in its fixed order (D186): the lines of the eras reached by rung, then the next
 * era's card, then that era's lines, locked with their reason. Nothing moves when the crown does:
 * an era bought unlocks its lines where they already stand.
 */
export function linesTab(view: AdvisorView, bulk: Bulk): Row[] {
  const base = view.base;
  const rows: Row[] = [];
  for (const line of content.lines) if (eraOpen(base, line)) rows.push(lineRow(view, line, bulk));
  const era = eraRow(view);
  if (era) rows.push(era);
  const next = nextEra(content, base);
  if (next && !eraGate(base, next))
    for (const line of content.lines) if (line.era === next.id) rows.push(lockedLineRow(line));
  return rows;
}

/** Shelf rows on show: the next step of each ladder (Grip, the island upgrades). */
function shelfOnShow(base: BaseState): UpgradeDef[] {
  return content.upgrades.filter(
    (upgrade) => !bought(base, upgrade.id) && !upgradeGate(content, base, upgrade),
  );
}

/** A gate's real reason, in words (CLAUDE.md 6.3 rule 3). */
function gateReason(gate: Gate): string {
  switch (gate.kind) {
    case "owned":
      return t("row.needs_owned", {
        need: fmtCount(gate.value),
        lines: t(`line.${gate.line}.plural`),
        have: fmtCount(gate.have),
      });
    case "era":
      return t("workshop.opens_in", { era: tierName(gate.value) });
    case "previous":
      return t("refusal.locked_previous", { name: upgradeName(gate.value) });
    case "wipe_day":
      return t("refusal.locked_wipe_day", { count: gate.value });
    case "opens":
      return t("refusal.locked_opens");
  }
}

/** The Shelf tab: what is on show by price (prices never move, so neither do the cards). */
export function upgradesTab(view: AdvisorView): {
  rows: Row[];
  bought: Array<{ id: string; name: string }>;
} {
  const base = view.base;
  const priced = shelfOnShow(base).map((upgrade) => ({
    row: upgradeRow(view, upgrade),
    cost: upgradeCost(content, base, upgrade),
  }));
  priced.sort((a, b) => a.cost - b.cost);
  return {
    rows: priced.map((item) => item.row),
    bought: base.run.upgrades.map((id) => ({ id, name: upgradeName(id) })),
  };
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
 * The island's crown on these cards (CLAUDE.md 6.3 rule 1): the collapsed drawer and the desktop
 * column share the island's view, so they light the island's pick where it stands, and nothing
 * while the crown is elsewhere (the tap hint).
 */
export function crownPick(rows: Row[], view: AdvisorView): Row[] {
  if (view.pick.kind === "purchase") crownRow(rows, view.pick.choice);
  return rows;
}

/**
 * Crowns exactly one button of an expanded tab (a view of its own, resolution 3.25): the sheet's
 * pick when it is on this tab, otherwise the tab's best score.
 */
export function crownTab(rows: Row[], view: AdvisorView): Row[] {
  if (crownRow(rows, view.sheet)) return rows;
  let best = Number.POSITIVE_INFINITY;
  let crown: (() => void) | null = null;
  for (const row of rows) {
    if (row.command && row.score < best) {
      best = row.score;
      crown = () => {
        row.crowned = true;
      };
    }
    const hire = row.hire;
    if (hire && hire.score < best) {
      best = hire.score;
      crown = () => {
        hire.crowned = true;
      };
    }
  }
  crown?.();
  return rows;
}

// --- the Workshop (game-design 5.12; 08-screens.md 8.3 desktop_research, phone_research) -------

const pct = (value: number): string => `${Number((value * 100).toPrecision(3))}%`;

/** What one level of a Workshop item does, in one line ("+5% Beachcomber"). */
export function researchEffect(effect: Effect): string {
  const scope = effect.scope;
  const where =
    scope === undefined || scope === "all" ? "all" : lineOf(content, scope) ? "line" : "era";
  const named = { line: scope ? lineName(scope) : "", era: scope ? tierName(scope as Tier) : "" };
  switch (effect.stat) {
    case "output":
      if (effect.op === "more")
        return t("research_effect.output_more", { ...named, factor: fmtFactor(effect.value) });
      return t(`research_effect.output_${where}`, { ...named, pct: pct(effect.value) });
    case "speed":
      return t(`research_effect.speed_${where}`, { ...named, pct: pct(effect.value - 1) });
    case "tap_flat":
      return effect.op === "more"
        ? t("research_effect.tap_flat_more", { factor: fmtFactor(effect.value) })
        : t("research_effect.tap_flat", { value: Number(effect.value.toPrecision(3)) });
    case "hustle_max":
      return t("research_effect.hustle_max", { value: Number(effect.value.toPrecision(3)) });
    case "night_shift":
      return t("research_effect.night_shift", { time: duration(Math.round(effect.value * 3600)) });
    case "offline":
      return t("research_effect.offline", { pct: pct(effect.value - 1) });
    default:
      return "";
  }
}

/** A tile's icon: the thing it makes better (a line, an era, every line, the night, the tap). */
function researchIcon(def: ResearchDef): Row["icon"] {
  const { effect } = def;
  const scope = effect.scope;
  if (def.line) return { kind: "line", id: def.line };
  if (effect.stat === "output" || effect.stat === "speed") {
    if (scope && lineOf(content, scope)) return { kind: "line", id: scope };
    if (scope && (TIERS as readonly string[]).includes(scope)) return { kind: "tier", id: scope };
    return { kind: "ui", id: "roster" };
  }
  if (effect.stat === "night_shift" || effect.stat === "offline")
    return { kind: "ui", id: "night_shift" };
  if (effect.stat === "hustle_max") return { kind: "ui", id: "hustle" };
  return { kind: "ui", id: "finger" };
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

/** What the next level adds: the window it opens to, or supplies a second over the day. */
function researchGain(view: AdvisorView, def: ResearchDef, command: Command | null): string {
  if (def.effect.stat === "night_shift") {
    const base = view.base;
    const { windowHours, maxHours } = content.run.nightShift;
    const r = rates(content, base);
    const parts = foldParts("night_shift", r.byStat.get("night_shift") ?? []);
    const hours =
      ((parts.best ?? windowHours) + parts.add + def.effect.value) * (1 + parts.inc) * parts.more;
    const next = Math.round(Math.min(maxHours, hours) * 3600);
    if (next <= r.nightShift) return "";
    return t("workshop.window", { from: duration(r.nightShift), to: duration(next) });
  }
  if (!command) return "";
  const choice = view.offered.find((offer) => sameRow(offer.command, command));
  if (!choice || choice.gain <= 0) return "";
  return t("workshop.gain", { rate: fmtRate(choice.gain) });
}

function researchRow(view: AdvisorView, def: ResearchDef, bulk: Bulk): Row {
  const base = view.base;
  const n = levelOf(base, def.id);
  const done = n >= def.levels;
  const gate = done ? null : researchGate(content, base, def, view.now);
  const owned = def.line ? (base.run.lines[def.line] ?? 0) : 0;
  const k =
    !done && bulk === "max" ? Math.max(1, maxResearch(def, n, base.run.supplies, owned)) : 1;
  const cost = done ? 0 : levelsCost(def, n, k);
  const name =
    def.kind === "mk"
      ? researchLevelName(def.id, Math.min(n + 1, def.levels))
      : researchName(def.id);
  const effect = researchEffect(def.effect);
  const reason = gate ? gateReason(gate) : undefined;
  const command: Command | null =
    done || gate ? null : { type: "buy_research", item: def.id, count: bulk === "max" ? "max" : 1 };
  const of = def.levels;
  const button: Button = done
    ? {
        top: t("workshop.done"),
        cost: "",
        enabled: false,
        label: t("workshop.aria_done", { name, of }),
      }
    : gate
      ? {
          top: t("row.locked"),
          cost: fmt(cost, "cost"),
          enabled: false,
          label: t("row.aria_wait", { name, reason: reason ?? "" }),
        }
      : buyButton(
          cost,
          view,
          k > 1 ? t("row.buy_n", { count: k }) : t("row.buy"),
          t("workshop.aria", { name, n, of, effect, cost: fmt(cost, "cost") }),
        );
  const gain = done
    ? ""
    : researchGain(view, def, command ?? { type: "buy_research", item: def.id, count: 1 });
  return {
    key: `research:${def.id}`,
    kind: "research",
    command,
    icon: researchIcon(def),
    tier: def.era,
    level: { n, of },
    ...(def.kind === "mk"
      ? { mk: t("workshop.mk_level", { roman: ROMAN[Math.min(n, of - 1) + 1] ?? "" }) }
      : {}),
    name,
    sub: effect,
    ...(gain && !gate ? { gain } : {}),
    // A later era's reason stands once, over its group, not on every tile.
    ...(done
      ? { note: t("workshop.maxed", { of }) }
      : reason && gate?.kind !== "era"
        ? { note: reason }
        : {}),
    ...(gate?.kind === "owned" ? { progress: Math.min(1, gate.have / gate.value) } : {}),
    button,
    locked: gate !== null,
    crowned: false,
    score: command ? scoreOfCommand(view, command) : Number.POSITIVE_INFINITY,
  };
}

/** A group of Workshop tiles: one era's tiers, then its Line Mks; a later era's with its reason. */
export interface ResearchGroup {
  era: Tier;
  title: string;
  /** Why the whole group waits (the next era), shown under its title. */
  locked?: string;
  rows: Row[];
}

/** The Workshop's open items: what the dock's badge counts (tiles not waiting on an era). */
export function workshopOpenItems(groups: ResearchGroup[] | undefined): number {
  return (groups ?? []).filter((group) => !group.locked).reduce((n, g) => n + g.rows.length, 0);
}

/** Whether the Workshop is open at the view's moment (the tab and the dock's place show then). */
export const workshopShown = (view: AdvisorView): boolean =>
  workshopOpen(content, view.base, view.now);

/**
 * The Workshop tab, in its fixed order (D186): the eras reached, each its tier items in tier
 * order and then its Line Mks by rung, and the next era's group locked with its reason. Levels
 * change prices, never places.
 */
export function researchTab(
  view: AdvisorView,
  bulk: Bulk,
): { groups: ResearchGroup[]; rows: Row[] } {
  const base = view.base;
  const reached = TIERS.indexOf(base.run.era);
  const next = nextEra(content, base);
  const groups: ResearchGroup[] = [];
  for (const [index, era] of TIERS.entries()) {
    if (index > reached + 1) break;
    if (index > reached && (!next || next.id !== era || eraGate(base, next))) break;
    const defs = content.research.filter((def) => def.era === era);
    if (defs.length === 0) continue;
    const tiers = defs.filter((def) => def.kind === "tier");
    const mks = defs.filter((def) => def.kind === "mk");
    groups.push({
      era,
      title: tierName(era),
      ...(index > reached ? { locked: t("workshop.opens_in", { era: tierName(era) }) } : {}),
      rows: [...tiers, ...mks].map((def) => researchRow(view, def, bulk)),
    });
  }
  return { groups, rows: groups.flatMap((group) => group.rows) };
}

/** Where the island's pick lives: its tab and its card's key; null while the crown is elsewhere. */
export function pickPlace(view: AdvisorView): { tab: Tab; key: string } | null {
  if (view.pick.kind !== "purchase") return null;
  const command = view.pick.choice.command;
  switch (command.type) {
    case "buy_line":
    case "hire_hand":
      return { tab: "lines", key: `line:${command.line}` };
    case "buy_era":
      return { tab: "lines", key: `era:${command.era}` };
    case "buy_upgrade":
      return { tab: "upgrades", key: `upgrade:${command.upgrade}` };
    case "buy_research":
      return { tab: "research", key: `research:${command.item}` };
    default:
      return null;
  }
}
