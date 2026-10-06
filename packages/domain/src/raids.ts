/**
 * Raids and defence (W6). Wealth attracts trouble; defence is a build choice.
 *
 * - The defence score: the buildings' `defence` (walls, traps, turret, watchtower; half while
 *   damaged) plus the crew on guard (`crew.ts`).
 * - NPC raiders: one raid is planned whenever the player acts and none is pending, landing on
 *   a night `planDays` UTC days later. Only commands plan, never a plain look, so however long
 *   a player stays away at most one raid lands meanwhile. Settling splits at the landing time
 *   (`settle.ts`): the raid meets the base as it stood then. The time depends on the UTC day,
 *   not the second, so the client predicts the same plan as the server.
 * - PvP: opt-in from `pvp.minTier`, instant like a market buy. The attacker's command reads
 *   the defender from the server's `World` (`raidPlayer`), and the server applies the
 *   defender's half (`takeRaid`) in the same transaction, so what one gains the other loses.
 *
 * What a raid may take is capped (`atRisk`): at most `capPercent` of each raw or refined
 * resource and of the scrap, with a scrap ceiling by tier. Parts, items, blueprints, crew and
 * goods in escrow are never at risk. Both kinds of raid roll the same way: the chance to hold
 * is defence / (defence + attack), clamped to [minChance, maxChance].
 */
import type { Amounts, Content } from "@wipe-day/content/schema";
import { TIERS, type Tier } from "@wipe-day/content/tiers";
import {
  add,
  type BaseState,
  clampToCap,
  collect,
  shortfall,
  storageCap,
  subtract,
  tierAtLeast,
  total,
} from "./base";
import { defence as guardDefence } from "./crew";
import type { GameEvent } from "./events";
import { isCapped, refValue } from "./goods";
import { modifiers } from "./modifiers";
import { rng, seedOf } from "./rng";

const HOUR = 3600;
const DAY = 86400;
/** Raid reports a base keeps. */
const KEEP_REPORTS = 10;

/** The next NPC raid. `seed` rolls it; `warned` once the warning went out. */
export interface PendingRaid {
  at: number;
  seed: number;
  n: number;
  warned: boolean;
}

/** npc: raiders at the walls. pvp_out: this base raided another. pvp_in: another raided it. */
export type RaidKind = "npc" | "pvp_out" | "pvp_in";
/** Always from the defender's side: held = the attack failed. */
export type RaidOutcome = "held" | "breached";

export interface RaidReport {
  id: string;
  kind: RaidKind;
  at: number;
  outcome: RaidOutcome;
  /** The defender's chance to hold, in percent, and the two sides' points. */
  chance: number;
  defence: number;
  attack: number;
  /** What this base lost, and what it gained (held loot, or a raid's take). */
  lost: Amounts;
  gained: Amounts;
  /** The other player in a PvP raid. */
  foe: { id: number; name: string } | null;
  /** This base's defences were left damaged. */
  damaged: boolean;
  /** A revenge raid (half the charges, no counter-token). */
  revenge: boolean;
  read: boolean;
}

/** The right to strike back at `attacker` until `until`, at a discount. */
export interface RevengeToken {
  attacker: number;
  name: string;
  until: number;
}

export interface PvpState {
  /** In the raids: may raid and be raided. */
  on: boolean;
  lastAttackAt: number | null;
  /** Target player id -> when this base last raided them. */
  hits: Record<string, number>;
  /** Nobody can raid this base before then (set after a breach). */
  shieldUntil: number | null;
  revenge: RevengeToken[];
}

export function newPvp(): PvpState {
  return { on: false, lastAttackAt: null, hits: {}, shieldUntil: null, revenge: [] };
}

/** Another player's base as the server read it for a PvP raid, already settled. */
export interface RaidTarget {
  id: number;
  name: string;
  state: BaseState;
}

// --- defence -------------------------------------------------------------------------

export interface Defence {
  /** From the buildings, after damage. */
  buildings: number;
  guards: number;
  /** Building defence is halved until repaired. */
  damaged: boolean;
  total: number;
}

export function defenceOf(content: Content, state: BaseState, at: number): Defence {
  const raw = modifiers(content, state).defence;
  const damaged = state.damaged && raw > 0;
  const buildings = damaged ? Math.floor((raw * content.raids.damagedPercent) / 100) : raw;
  const guards = guardDefence(content, state, at);
  return { buildings, guards, damaged, total: buildings + guards };
}

/** The defender's percent chance to hold against `attack` points. */
export function holdChance(content: Content, defence: number, attack: number): number {
  const { minChance, maxChance } = content.raids;
  if (defence + attack <= 0) return maxChance;
  const chance = Math.round((100 * defence) / (defence + attack));
  return Math.min(maxChance, Math.max(minChance, chance));
}

/**
 * What a raid could take: `percent` (never above `capPercent`) of each raw or refined
 * resource in stock, and of the scrap up to the tier's ceiling. Nothing else is ever at risk.
 */
export function atRisk(content: Content, state: BaseState, percent: number): Amounts {
  const share = Math.min(percent, content.raids.capPercent);
  const out: Amounts = {};
  for (const [id, amount] of Object.entries(state.stock)) {
    if (amount <= 0) continue;
    let take = 0;
    if (id === "scrap") {
      const ceiling = content.raids.scrapCeiling[state.tier] ?? 0;
      take = Math.min(Math.floor((amount * share) / 100), ceiling);
    } else if (isCapped(content, id)) {
      take = Math.floor((amount * share) / 100);
    }
    if (take > 0) out[id] = take;
  }
  return out;
}

/** Scrap value of an amounts table at reference prices (scrap counts as itself). */
export function scrapWorth(content: Content, amounts: Amounts): number {
  let sum = 0;
  for (const [id, amount] of Object.entries(amounts)) {
    sum += id === "scrap" ? amount : refValue(content, id, amount);
  }
  return sum;
}

/** NPC raiders' points against a base at `tier` with `risk` in the yard. */
export function raiderStrength(content: Content, tier: Tier, risk: Amounts): number {
  const strength = content.raids.npc.strength[tier];
  if (!strength) return 0;
  const fromYard = Math.floor(scrapWorth(content, risk) / content.raids.npc.scrapPerPoint);
  return Math.min(strength.max, strength.base + fromYard);
}

/** Capped goods fit the room left; scrap and parts always come home whole. */
function bring(content: Content, state: BaseState, wanted: Amounts): Amounts {
  const cap = storageCap(content, state);
  const out: Amounts = {};
  for (const [id, amount] of Object.entries(wanted)) {
    const fits = isCapped(content, id)
      ? (clampToCap(cap, state.stock, { [id]: amount })[id] ?? 0)
      : amount;
    if (fits > 0) out[id] = fits;
  }
  return out;
}

function pushReport(state: BaseState, report: RaidReport): BaseState {
  return { ...state, raidReports: [report, ...state.raidReports].slice(0, KEEP_REPORTS) };
}

function reportId(state: BaseState, prefix: string, at: number): string {
  return `${prefix}${at}-${state.raidReports.length}`;
}

// --- NPC raids -----------------------------------------------------------------------

/** Whether raiders come to this base at all (from `npc.startTier`): the Defence panel opens. */
export function raidsOpen(content: Content, state: Pick<BaseState, "tier">): boolean {
  return tierAtLeast(state, content.raids.npc.startTier);
}

/** When the base first reached the tier raiders start at (or a higher one), if it has. */
function reachedStart(content: Content, state: BaseState): number | null {
  const from = TIERS.indexOf(content.raids.npc.startTier);
  const times = TIERS.slice(from)
    .map((tier) => state.stats.reached[tier])
    .filter((at): at is number => at !== undefined);
  return times.length > 0 ? Math.min(...times) : null;
}

/**
 * Plans the next NPC raid when none is pending (called after every command, never by a
 * plain settle). It lands on the night `planDays` UTC days from now, and never sooner than
 * `firstAfterHours` after the base reached the starting tier.
 */
export function planRaid(content: Content, state: BaseState, now: number): BaseState {
  const rules = content.raids.npc;
  if (state.raid !== null || !tierAtLeast(state, rules.startTier)) return state;
  // A base that reached the tier before W6 counts from its first command since.
  const floor = (reachedStart(content, state) ?? now) + rules.firstAfterHours * HOUR;
  const n = state.raidSeq + 1;
  let day = Math.floor(now / DAY) + rules.planDays;
  for (;;) {
    const random = rng(seedOf(state.seed, n, day));
    const at =
      day * DAY + rules.windowStartHour * HOUR + random.int(0, rules.windowHours * HOUR - 1);
    if (at >= floor) {
      return {
        ...state,
        raidSeq: n,
        raid: { at, seed: seedOf(state.seed, n, at), n, warned: false },
      };
    }
    day = Math.max(day + 1, Math.floor(floor / DAY));
  }
}

/** When the warning for the pending raid goes out: earlier with a watchtower. */
export function warnAt(content: Content, state: BaseState): number | null {
  if (!state.raid) return null;
  const hours = content.raids.npc.warnBaseHours + modifiers(content, state).warnHours;
  return state.raid.at - hours * HOUR;
}

/** Whether the pending raid is announced at `now` (the warning card and the torches show). */
export function raidWarned(content: Content, state: BaseState, now: number): boolean {
  const at = warnAt(content, state);
  return at !== null && now >= at;
}

/** Sends the warning once its time has come (part of settling). */
export function settleRaidWarning(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const raid = state.raid;
  const at = warnAt(content, state);
  if (!raid || raid.warned || at === null || now < at || now >= raid.at)
    return { state, events: [] };
  return {
    state: { ...state, raid: { ...raid, warned: true } },
    events: [{ type: "raid_warned", at, lands: raid.at }],
  };
}

/** The next moment the pending raid changes something: its warning, then its landing. */
export function nextRaidAt(content: Content, state: BaseState): number | null {
  if (!state.raid) return null;
  const at = warnAt(content, state);
  return !state.raid.warned && at !== null && at < state.raid.at ? at : state.raid.at;
}

export interface NpcOdds {
  lands: number;
  defence: Defence;
  strength: number;
  chance: number;
  /** What a breach would take, counting what is waiting to be collected. */
  risk: Amounts;
}

/** The pending raid as it would go if it landed now: what the warning card shows. */
export function npcOdds(content: Content, state: BaseState, now: number): NpcOdds | null {
  if (!state.raid) return null;
  const yard = collect(content, state, now).state;
  const risk = atRisk(content, yard, content.raids.npc.lossPercent);
  const defence = defenceOf(content, yard, now);
  const strength = raiderStrength(content, yard.tier, risk);
  return {
    lands: state.raid.at,
    defence,
    strength,
    chance: holdChance(content, defence.total, strength),
    risk,
  };
}

/**
 * The pending raid lands (the caller has settled the base to `raid.at`). What waited to be
 * collected is banked first, so it is in the yard too. Held: the raiders leave loot behind.
 * Breached: they take `lossPercent` of what is at risk and the defences are damaged.
 */
export function resolveRaid(
  content: Content,
  state: BaseState,
): { state: BaseState; events: GameEvent[] } {
  const raid = state.raid;
  if (!raid) return { state, events: [] };
  const cleared: BaseState = { ...state, raid: null };
  // A base that decayed below the starting tier is no longer worth the trip.
  if (!tierAtLeast(cleared, content.raids.npc.startTier)) return { state: cleared, events: [] };
  const events: GameEvent[] = [];
  const banked = collect(content, cleared, raid.at);
  if (total(banked.gained) > 0) events.push({ type: "auto_collect", gained: banked.gained });
  let next = banked.state;
  const defence = defenceOf(content, next, raid.at);
  const risk = atRisk(content, next, content.raids.npc.lossPercent);
  const strength = raiderStrength(content, next.tier, risk);
  const chance = holdChance(content, defence.total, strength);
  const random = rng(raid.seed);
  const held = random.next() * 100 < chance;
  let lost: Amounts = {};
  let gained: Amounts = {};
  let damaged = false;
  if (held) {
    const wanted: Amounts = {};
    for (const line of content.raids.npc.held[next.tier] ?? []) {
      wanted[line.resource] = (wanted[line.resource] ?? 0) + random.int(line.min, line.max);
    }
    gained = bring(content, next, wanted);
    next = { ...next, stock: add(next.stock, gained) };
  } else {
    lost = risk;
    damaged = modifiers(content, next).defence > 0;
    next = { ...next, stock: subtract(next.stock, lost), damaged: next.damaged || damaged };
  }
  const report: RaidReport = {
    id: `r${raid.n}`,
    kind: "npc",
    at: raid.at,
    outcome: held ? "held" : "breached",
    chance,
    defence: defence.total,
    attack: strength,
    lost,
    gained,
    foe: null,
    damaged,
    revenge: false,
    read: false,
  };
  events.push({ type: "raid_landed", report });
  return { state: pushReport(next, report), events };
}

// --- repair --------------------------------------------------------------------------

export function repairCost(content: Content, state: BaseState): Amounts {
  return content.raids.repair[state.tier] ?? {};
}

export type RepairStatus =
  | { code: "ok"; cost: Amounts }
  | { code: "no_damage" }
  | { code: "unaffordable"; missing: Amounts };

export function repairStatus(content: Content, state: BaseState): RepairStatus {
  if (!state.damaged) return { code: "no_damage" };
  const cost = repairCost(content, state);
  const missing = shortfall(cost, state.stock);
  if (Object.keys(missing).length > 0) return { code: "unaffordable", missing };
  return { code: "ok", cost };
}

export function repair(
  content: Content,
  state: BaseState,
):
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; status: Exclude<RepairStatus, { code: "ok" }> } {
  const status = repairStatus(content, state);
  if (status.code !== "ok") return { ok: false, status };
  return {
    ok: true,
    state: { ...state, stock: subtract(state.stock, status.cost), damaged: false },
    events: [{ type: "repaired", paid: status.cost }],
  };
}

// --- PvP -----------------------------------------------------------------------------

export function pvpOpen(content: Content, state: Pick<BaseState, "tier">): boolean {
  return tierAtLeast(state, content.raids.pvp.minTier);
}

/** A live revenge token against `attacker`, if the base holds one. */
export function revengeOn(state: BaseState, attacker: number, now: number): RevengeToken | null {
  return (
    state.pvp.revenge.find((token) => token.attacker === attacker && token.until > now) ?? null
  );
}

export type SetPvpStatus =
  | { code: "ok" }
  | { code: "pvp_locked"; tier: Tier }
  | { code: "opt_out_locked"; until: number };

/** Joining needs the tier; leaving waits until a victim's revenge window has passed. */
export function setPvpStatus(
  content: Content,
  state: BaseState,
  on: boolean,
  now: number,
): SetPvpStatus {
  if (on === state.pvp.on) return { code: "ok" };
  if (on && !pvpOpen(content, state))
    return { code: "pvp_locked", tier: content.raids.pvp.minTier };
  if (!on && state.pvp.lastAttackAt !== null) {
    const until = state.pvp.lastAttackAt + content.raids.pvp.revengeHours * HOUR;
    if (now < until) return { code: "opt_out_locked", until };
  }
  return { code: "ok" };
}

export function setPvp(
  content: Content,
  state: BaseState,
  on: boolean,
  now: number,
):
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; status: Exclude<SetPvpStatus, { code: "ok" }> } {
  const status = setPvpStatus(content, state, on, now);
  if (status.code !== "ok") return { ok: false, status };
  if (on === state.pvp.on) return { ok: true, state, events: [] };
  return {
    ok: true,
    state: { ...state, pvp: { ...state.pvp, on } },
    events: [{ type: "pvp_set", on }],
  };
}

/** Charges a raid on a base at `tier` costs (half, rounded up, for revenge). */
export function pvpCost(content: Content, tier: Tier, revenge: boolean): number {
  const full = content.raids.pvp.charges[tier] ?? 0;
  return revenge ? Math.ceil((full * content.raids.pvp.revengePercent) / 100) : full;
}

export type PvpStatus =
  | { code: "ok"; cost: number; revenge: boolean }
  | { code: "pvp_locked"; tier: Tier }
  | { code: "pvp_off" }
  | { code: "self_target" }
  | { code: "target_off" }
  | { code: "shielded"; until: number }
  | { code: "attack_cooldown"; readyAt: number }
  | { code: "target_cooldown"; readyAt: number }
  | { code: "tier_fence"; tier: Tier }
  | { code: "unaffordable"; missing: Amounts };

/**
 * Can `me` (player `self`) raid `target` now? The first reason why not. Revenge skips the
 * same-target wait and the tier fence, never the daily limit or a shield.
 */
export function pvpStatus(
  content: Content,
  me: BaseState,
  self: number | undefined,
  target: RaidTarget,
  now: number,
): PvpStatus {
  const rules = content.raids.pvp;
  if (!pvpOpen(content, me)) return { code: "pvp_locked", tier: rules.minTier };
  if (!me.pvp.on) return { code: "pvp_off" };
  if (self !== undefined && target.id === self) return { code: "self_target" };
  if (!target.state.pvp.on || !pvpOpen(content, target.state)) return { code: "target_off" };
  const shield = target.state.pvp.shieldUntil;
  if (shield !== null && shield > now) return { code: "shielded", until: shield };
  const last = me.pvp.lastAttackAt;
  if (last !== null && now < last + rules.attackHours * HOUR)
    return { code: "attack_cooldown", readyAt: last + rules.attackHours * HOUR };
  const revenge = revengeOn(me, target.id, now) !== null;
  if (!revenge) {
    const hit = me.pvp.hits[String(target.id)];
    if (hit !== undefined && now < hit + rules.sameTargetHours * HOUR)
      return { code: "target_cooldown", readyAt: hit + rules.sameTargetHours * HOUR };
    const gap = Math.abs(TIERS.indexOf(me.tier) - TIERS.indexOf(target.state.tier));
    if (gap > rules.maxTierGap) return { code: "tier_fence", tier: target.state.tier };
  }
  const cost = pvpCost(content, target.state.tier, revenge);
  const have = me.stock.charge ?? 0;
  if (have < cost) return { code: "unaffordable", missing: { charge: cost - have } };
  return { code: "ok", cost, revenge };
}

export interface PvpOdds {
  cost: number;
  revenge: boolean;
  defence: Defence;
  attack: number;
  chance: number;
  /** What a breach brings home: the capped share, fitted to the attacker's room. */
  take: Amounts;
}

/** The confirm screen's numbers for raiding `target`. */
export function pvpOdds(content: Content, me: BaseState, target: RaidTarget, now: number): PvpOdds {
  const revenge = revengeOn(me, target.id, now) !== null;
  const defence = defenceOf(content, target.state, now);
  const attack = content.raids.pvp.attack[target.state.tier] ?? 0;
  return {
    cost: pvpCost(content, target.state.tier, revenge),
    revenge,
    defence,
    attack,
    chance: holdChance(content, defence.total, attack),
    take: bring(content, me, atRisk(content, target.state, content.raids.capPercent)),
  };
}

/** What the attacker's side of a raid decided, for the defender's half. */
export interface RaidHit {
  attacker: number;
  attackerName: string;
  outcome: RaidOutcome;
  lost: Amounts;
  chance: number;
  defence: number;
  attack: number;
  revenge: boolean;
}

/**
 * The attacker's side: the charges are spent, the raid is rolled from the server's `seed`,
 * and a breach brings the take home. Attacking ends the attacker's own shield and uses up a
 * revenge token on that target. The server then applies `takeRaid` to the defender with `hit`.
 */
export function raidPlayer(
  content: Content,
  me: BaseState,
  self: number,
  selfName: string,
  target: RaidTarget,
  seed: number,
  now: number,
):
  | { ok: true; state: BaseState; events: GameEvent[]; hit: RaidHit }
  | { ok: false; status: Exclude<PvpStatus, { code: "ok" }> } {
  const status = pvpStatus(content, me, self, target, now);
  if (status.code !== "ok") return { ok: false, status };
  const odds = pvpOdds(content, me, target, now);
  const held = rng(seed).next() * 100 < odds.chance;
  const take = held ? {} : odds.take;
  const paid: Amounts = { charge: status.cost };
  const pvp: PvpState = {
    ...me.pvp,
    lastAttackAt: now,
    hits: { ...me.pvp.hits, [String(target.id)]: now },
    shieldUntil: null,
    revenge: me.pvp.revenge.filter(
      (token) => token.until > now && !(status.revenge && token.attacker === target.id),
    ),
  };
  const report: RaidReport = {
    id: reportId(me, "o", now),
    kind: "pvp_out",
    at: now,
    outcome: held ? "held" : "breached",
    chance: odds.chance,
    defence: odds.defence.total,
    attack: odds.attack,
    lost: paid,
    gained: take,
    foe: { id: target.id, name: target.name },
    damaged: false,
    revenge: status.revenge,
    read: false,
  };
  const state = pushReport({ ...me, stock: add(subtract(me.stock, paid), take), pvp }, report);
  return {
    ok: true,
    state,
    events: [{ type: "raid_launched", report, target: target.id, targetName: target.name, paid }],
    hit: {
      attacker: self,
      attackerName: selfName,
      outcome: report.outcome,
      lost: take,
      chance: odds.chance,
      defence: odds.defence.total,
      attack: odds.attack,
      revenge: status.revenge,
    },
  };
}

/** The defender's half of a raid, rebuilt from the attacker's report (what the server logs). */
export function hitOf(report: RaidReport, attacker: number, attackerName: string): RaidHit {
  return {
    attacker,
    attackerName,
    outcome: report.outcome,
    lost: report.gained,
    chance: report.chance,
    defence: report.defence,
    attack: report.attack,
    revenge: report.revenge,
  };
}

/**
 * The defender's side, applied by the server in the same transaction: the take leaves the
 * stock, a breach shields the base and damages its defences, and any raid but a revenge
 * raid hands the defender a revenge token.
 */
export function takeRaid(
  content: Content,
  state: BaseState,
  hit: RaidHit,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const rules = content.raids.pvp;
  const lost: Amounts = {};
  for (const [id, amount] of Object.entries(hit.lost)) {
    const take = Math.min(amount, Math.max(0, state.stock[id] ?? 0));
    if (take > 0) lost[id] = take;
  }
  const breached = hit.outcome === "breached";
  const damaged = breached && modifiers(content, state).defence > 0;
  const revenge = state.pvp.revenge.filter(
    (token) => token.until > now && token.attacker !== hit.attacker,
  );
  if (!hit.revenge)
    revenge.push({
      attacker: hit.attacker,
      name: hit.attackerName,
      until: now + rules.revengeHours * HOUR,
    });
  const report: RaidReport = {
    id: reportId(state, "i", now),
    kind: "pvp_in",
    at: now,
    outcome: hit.outcome,
    chance: hit.chance,
    defence: hit.defence,
    attack: hit.attack,
    lost,
    gained: {},
    foe: { id: hit.attacker, name: hit.attackerName },
    damaged,
    revenge: hit.revenge,
    read: false,
  };
  const next: BaseState = {
    ...state,
    stock: subtract(state.stock, lost),
    damaged: state.damaged || damaged,
    pvp: {
      ...state.pvp,
      shieldUntil: breached ? now + rules.shieldHours * HOUR : state.pvp.shieldUntil,
      revenge,
    },
  };
  return {
    state: pushReport(next, report),
    events: [{ type: "raided", report, attacker: hit.attacker, attackerName: hit.attackerName }],
  };
}

/** Marks a raid report read (its card was opened). Idempotent. */
export function readRaidReport(state: BaseState, id: string): BaseState {
  if (!state.raidReports.some((report) => report.id === id && !report.read)) return state;
  return {
    ...state,
    raidReports: state.raidReports.map((report) =>
      report.id === id ? { ...report, read: true } : report,
    ),
  };
}
