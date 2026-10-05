/**
 * The crew and the island: survivors arrive, carry gear, get hurt and level
 * up; scouts lift the fog region by region; parties go to the sites and come
 * back with loot and a story. Missions are lazy like constructions: paid and
 * rolled when they leave (from a seed, so a replay rolls the same), applied when
 * settling passes their end. The odds the confirm screen shows are the odds
 * that get rolled: `tripOdds` is stored on the mission when it leaves.
 */
import type { Amounts, Content, Region, Site, TripEvent } from "@wipe-day/content/schema";
import {
  add,
  type BaseState,
  clampToCap,
  collect,
  newSurvivor,
  shortfall,
  storageCap,
  subtract,
} from "./base";
import { bondedPairs, type Job, pairsOf, type Shift, traitsOf, wake } from "./crew";
import type { GameEvent } from "./events";
import { modifiers } from "./modifiers";
import { drawBlueprint, isPart } from "./recipes";
import { pickWeighted, type Rng, rng, seedOf } from "./rng";

export interface Survivor {
  id: string;
  level: number;
  xp: number;
  gear: { weapon: string | null; armor: string | null };
  /** Hurt until then (unix seconds); null = fit. */
  injuredUntil: number | null;
  /** The mission they are on, or null at home. */
  away: string | null;
  /** What they do at home (W4b); null = free. See `crew.ts`. */
  job: Job | null;
  shift: Shift;
}

export { traitsOf };

/** What was promised when the party left: exactly what gets rolled. */
export interface Odds {
  /** Percent chance of a full success. */
  success: number;
  /** Percent chance of at least a partial success (success included). */
  partial: number;
  /** Per member, in party order: percent chance to come back hurt (doubled on a failure). */
  injury: number[];
  minutes: number;
  rolls: number;
  /** Percent more of every loot amount. */
  loot: number;
  /** Percent chances, on a success. */
  blueprint: number;
  fragment: number;
  /** Percent chance of each trip event (events.json5), by id. Absent on W4a missions. */
  events?: Record<string, number>;
}

export interface Mission {
  id: string;
  kind: "scout" | "trip";
  /** Region (scout) or site (trip) id. */
  target: string;
  crew: string[];
  startedAt: number;
  endsAt: number;
  seed: number;
  odds: Odds;
}

export type Outcome = "success" | "partial" | "fail";

export interface Report {
  id: string;
  kind: "scout" | "trip";
  target: string;
  outcome: Outcome;
  crew: string[];
  gained: Amounts;
  /** Who came back hurt, and until when. */
  injured: { id: string; until: number }[];
  /** XP each member earned. */
  xp: number;
  levelUps: string[];
  /** Regions the trip revealed (the scouted one, or a map fragment's). */
  revealed: string[];
  blueprint: string | null;
  /** Trip events that happened, in order (W4b; absent on older reports). */
  events?: string[];
  /** Items brought home (keycodes). */
  found?: string[];
  /** A stranger who joined the crew, or null. */
  rescued?: string | null;
  at: number;
  read: boolean;
}

const HOUR = 3600;
const REPORTS_KEPT = 20;

// --- lookups ------------------------------------------------------------------------

export function regionOf(content: Content, id: string): Region | undefined {
  return content.regions.find((region) => region.id === id);
}

export function siteOf(content: Content, id: string): Site | undefined {
  return content.sites.find((site) => site.id === id);
}

export function survivorIn(state: BaseState, id: string): Survivor | undefined {
  return state.crew.find((member) => member.id === id);
}

/** Home, not away and not hurt. */
export function isFit(survivor: Survivor, now: number): boolean {
  return survivor.away === null && (survivor.injuredUntil === null || survivor.injuredUntil <= now);
}

export function crewCap(content: Content, state: BaseState): number {
  return content.crewRules.baseCap + modifiers(content, state).crew;
}

export function levelFor(content: Content, xp: number): number {
  return 1 + content.crewRules.levels.filter((threshold) => xp >= threshold).length;
}

/** XP where the next level starts, or null at the top. */
export function nextLevelAt(content: Content, level: number): number | null {
  return content.crewRules.levels[level - 1] ?? null;
}

export function sitesIn(content: Content, regionId: string): Site[] {
  return content.sites.filter((site) => site.region === regionId);
}

// --- arrivals, gear, treatment --------------------------------------------------------

/** New survivors step off the boat while there is room. Part of settling. */
export function settleArrivals(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const every = content.crewRules.arrivalHours * HOUR;
  let next = state;
  const events: GameEvent[] = [];
  while (now >= next.nextArrivalAt && next.crew.length < crewCap(content, next)) {
    const newcomer = content.crew.find((member) => !next.crew.some((c) => c.id === member.id));
    if (!newcomer) break;
    const at = next.nextArrivalAt;
    next = {
      ...next,
      crew: [...next.crew, newSurvivor(content, newcomer.id, at)],
      nextArrivalAt: at + every,
    };
    events.push({ type: "survivor_arrived", survivor: newcomer.id, at, from: "boat" });
  }
  // A full crew waits for room: the next boat comes one interval after room appears.
  if (next.crew.length >= crewCap(content, next) && now >= next.nextArrivalAt) {
    next = { ...next, nextArrivalAt: now + every };
  }
  return { state: next, events };
}

export type CrewRefusal =
  | { code: "no_survivor" }
  | { code: "away" }
  | { code: "not_owned" }
  | { code: "wrong_slot" }
  | { code: "not_injured" };

type CrewResult =
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; refusal: CrewRefusal };

function withSurvivor(state: BaseState, survivor: Survivor): BaseState {
  return {
    ...state,
    crew: state.crew.map((member) => (member.id === survivor.id ? survivor : member)),
  };
}

/** Puts an owned weapon or armour on a survivor at home (null takes it off); the old one goes back. */
export function equip(
  content: Content,
  state: BaseState,
  survivorId: string,
  slot: "weapon" | "armor",
  itemId: string | null,
): CrewResult {
  const survivor = survivorIn(state, survivorId);
  if (!survivor) return { ok: false, refusal: { code: "no_survivor" } };
  if (survivor.away !== null) return { ok: false, refusal: { code: "away" } };
  const items = { ...state.items };
  if (itemId !== null) {
    const item = content.items.find((candidate) => candidate.id === itemId);
    if (!item || item.category !== slot) return { ok: false, refusal: { code: "wrong_slot" } };
    if ((items[itemId] ?? 0) < 1) return { ok: false, refusal: { code: "not_owned" } };
    items[itemId] = (items[itemId] ?? 0) - 1;
    if (items[itemId] === 0) delete items[itemId];
  }
  const old = survivor.gear[slot];
  if (old !== null) items[old] = (items[old] ?? 0) + 1;
  return {
    ok: true,
    state: withSurvivor(
      { ...state, items },
      { ...survivor, gear: { ...survivor.gear, [slot]: itemId } },
    ),
    events: [{ type: "equipped", survivor: survivorId, slot, item: itemId }],
  };
}

/** Uses a bandage or first aid kit on an injured survivor: hours off the injury. */
export function treat(
  content: Content,
  state: BaseState,
  survivorId: string,
  itemId: string,
  now: number,
): CrewResult {
  const survivor = survivorIn(state, survivorId);
  if (!survivor) return { ok: false, refusal: { code: "no_survivor" } };
  if (survivor.injuredUntil === null || survivor.injuredUntil <= now)
    return { ok: false, refusal: { code: "not_injured" } };
  const hours = content.crewRules.treat[itemId];
  if (hours === undefined) return { ok: false, refusal: { code: "wrong_slot" } };
  if ((state.items[itemId] ?? 0) < 1) return { ok: false, refusal: { code: "not_owned" } };
  // Bank first: a worker's output counts from the end of the injury, which moves now.
  const banked = collect(content, state, now).state;
  const items = { ...banked.items, [itemId]: (banked.items[itemId] ?? 0) - 1 };
  if (items[itemId] === 0) delete items[itemId];
  const until = survivor.injuredUntil - hours * HOUR;
  const healed = until <= now;
  return {
    ok: true,
    state: withSurvivor({ ...banked, items }, { ...survivor, injuredUntil: healed ? null : until }),
    events: [{ type: "treated", survivor: survivorId, item: itemId, until: healed ? now : until }],
  };
}

// --- the map ---------------------------------------------------------------------------

export type ScoutStatus =
  | { code: "ok" }
  | { code: "unknown" }
  | { code: "known" }
  | { code: "scouting" }
  | { code: "far"; ring: number; range: number }
  | { code: "hidden" }
  | { code: "no_survivor" }
  | { code: "unfit"; survivor: string }
  | { code: "no_dock"; building: string; level: number }
  | { code: "no_navigator"; trait: string }
  | { code: "unaffordable"; missing: Amounts };

/** The highest ring a scout from this base can reach: the base tier's, plus the radio mast. */
export function scoutRange(content: Content, state: BaseState): number {
  return (content.mapRules.range[state.tier] ?? 1) + modifiers(content, state).scoutRange;
}

/** Whether a region is reached by boat. */
export function atSea(content: Content, regionId: string): boolean {
  return regionOf(content, regionId)?.access === "sea";
}

/** The dock level a boat needs to reach `regionId` (0 for land). */
export function dockNeeded(content: Content, regionId: string): number {
  const region = regionOf(content, regionId);
  return region?.access === "sea" ? (region.dock ?? 1) : 0;
}

/** Whether the base's dock can launch a boat to `regionId`. */
export function hasBoat(content: Content, state: BaseState, regionId: string): boolean {
  return (state.buildings[content.mapRules.boatBuilding] ?? 0) >= dockNeeded(content, regionId);
}

/** Whether `survivorId` can steer a boat. */
export function canSteer(content: Content, survivorId: string): boolean {
  return traitsOf(content, survivorId).some((trait) => trait.id === content.mapRules.boatTrait);
}

/** Whether a region borders one the base knows (so a scout can find the way). */
export function bordersKnown(content: Content, state: BaseState, regionId: string): boolean {
  const region = regionOf(content, regionId);
  return region?.neighbours.some((id) => state.known.includes(id)) ?? false;
}

/** Can `survivorId` (or anyone, when omitted) scout `regionId` right now? The first reason why not. */
export function scoutStatus(
  content: Content,
  state: BaseState,
  regionId: string,
  now: number,
  survivorId?: string,
): ScoutStatus {
  const region = regionOf(content, regionId);
  if (!region) return { code: "unknown" };
  if (state.known.includes(regionId)) return { code: "known" };
  if (state.missions.some((mission) => mission.kind === "scout" && mission.target === regionId))
    return { code: "scouting" };
  if (!bordersKnown(content, state, regionId)) return { code: "hidden" };
  const range = scoutRange(content, state);
  if (region.ring > range) return { code: "far", ring: region.ring, range };
  const sea = region.access === "sea";
  const { boatBuilding, boatTrait } = content.mapRules;
  if (sea && !hasBoat(content, state, regionId))
    return { code: "no_dock", building: boatBuilding, level: dockNeeded(content, regionId) };
  if (survivorId !== undefined) {
    const survivor = survivorIn(state, survivorId);
    if (!survivor) return { code: "no_survivor" };
    if (!isFit(survivor, now)) return { code: "unfit", survivor: survivorId };
    if (sea && !canSteer(content, survivorId)) return { code: "no_navigator", trait: boatTrait };
  } else {
    const fit = state.crew.filter((member) => isFit(member, now));
    if (fit.length === 0) return { code: "no_survivor" };
    if (sea && !fit.some((member) => canSteer(content, member.id)))
      return { code: "no_navigator", trait: boatTrait };
  }
  const missing = shortfall(region.scout.cost, state.stock);
  if (Object.keys(missing).length > 0) return { code: "unaffordable", missing };
  return { code: "ok" };
}

/** Scouting time for this survivor: the region's minutes, shorter for a navigator. */
export function scoutMinutes(content: Content, region: Region, survivorId: string): number {
  const quicker = Math.max(0, ...traitsOf(content, survivorId).map((trait) => trait.tripTime ?? 0));
  return Math.max(1, Math.round((region.scout.minutes * (100 - quicker)) / 100));
}

// --- odds -------------------------------------------------------------------------------

function clampPercent(value: number, low = 5, high = 95): number {
  return Math.max(low, Math.min(high, Math.round(value)));
}

/**
 * Percent chance of `event` for this party at this site: the tier's chance, the hazard's
 * points, each member's trait points and weapons. A stranger only turns up while someone
 * is still left in the pool.
 */
export function eventChance(
  content: Content,
  state: BaseState,
  site: Site,
  crewIds: string[],
  event: TripEvent,
): number {
  let chance = (event.chance[site.tier - 1] ?? 0) + (event.hazard?.[site.hazard] ?? 0);
  for (const id of crewIds) {
    for (const trait of traitsOf(content, id)) chance += event.traits?.[trait.id] ?? 0;
    if (survivorIn(state, id)?.gear.weapon) chance -= event.weapon ?? 0;
  }
  // A stranger needs someone left in the pool and a bunk to come home to.
  if (event.rescue) {
    const pool = content.crew.some((member) => !survivorIn(state, member.id));
    if (!pool || state.crew.length >= crewCap(content, state)) return 0;
  }
  return Math.max(0, Math.min(50, Math.round(chance)));
}

/** The odds a party has at a site: what the confirm screen shows and what gets rolled. */
export function tripOdds(content: Content, state: BaseState, site: Site, crewIds: string[]): Odds {
  const rules = content.crewRules;
  let success = site.chance + Math.max(0, crewIds.length - 1) * rules.successPerCompanion;
  success += bondedPairs(content, state, crewIds).length * rules.bonds.success;
  let partyInjury = 0;
  let rolls = site.rolls;
  let loot = 0;
  let rare = 0;
  let quicker = 0;
  for (const id of crewIds) {
    const survivor = survivorIn(state, id);
    success += ((survivor?.level ?? 1) - 1) * rules.successPerLevel;
    for (const trait of traitsOf(content, id)) {
      success += (trait.success ?? 0) + (trait.hazard?.[site.hazard] ?? 0);
      partyInjury += trait.injury ?? 0;
      rolls += trait.lootRolls ?? 0;
      loot += trait.loot ?? 0;
      rare += trait.rare ?? 0;
      quicker = Math.max(quicker, trait.tripTime ?? 0);
    }
    const weapon = content.items.find((item) => item.id === survivor?.gear.weapon);
    if (weapon?.power && site.hazard === "hostile") success += weapon.power;
  }
  const chance = clampPercent(success);
  const cover = Math.min(80, partyInjury);
  const injury = crewIds.map((id) => {
    const armor = content.items.find((item) => item.id === survivorIn(state, id)?.gear.armor);
    const protect = armor?.protection ?? 0;
    return clampPercent((site.injury * (100 - cover) * (100 - protect)) / 10000, 0, 95);
  });
  return {
    success: chance,
    // Half of what is not a success comes back with something.
    partial: clampPercent(chance + (100 - chance) / 2, chance, 100),
    injury,
    minutes: Math.max(1, Math.round((site.minutes * (100 - quicker)) / 100)),
    rolls,
    loot,
    blueprint: Math.min(100, Math.round((site.blueprint * (100 + rare)) / 100)),
    fragment: Math.min(100, Math.round((site.fragment * (100 + rare)) / 100)),
    events: Object.fromEntries(
      content.tripEvents.map((event) => [
        event.id,
        eventChance(content, state, site, crewIds, event),
      ]),
    ),
  };
}

/** The loot a success could bring: each resource's lowest single roll to its all-rolls best. */
export function lootRange(site: Site, odds: Odds): Record<string, { min: number; max: number }> {
  const out: Record<string, { min: number; max: number }> = {};
  for (const entry of site.loot) {
    const scale = (amount: number) => Math.floor((amount * (100 + odds.loot)) / 100);
    const range = out[entry.resource] ?? { min: Number.POSITIVE_INFINITY, max: 0 };
    out[entry.resource] = {
      min: Math.min(range.min, scale(entry.min)),
      max: range.max + scale(entry.max) * odds.rolls,
    };
  }
  return out;
}

export type TripStatus =
  | { code: "ok" }
  | { code: "unknown" }
  | { code: "hidden" }
  | { code: "no_party" }
  | { code: "party_size"; most: number }
  | { code: "no_survivor" }
  | { code: "unfit"; survivor: string }
  | { code: "no_dock"; building: string; level: number }
  | { code: "no_navigator"; trait: string }
  | { code: "keycode"; item: string }
  | { code: "unaffordable"; missing: Amounts };

export function partyLimit(content: Content, site: Site): number {
  return Math.min(site.party, content.mapRules.maxParty);
}

/** Can this party go to `siteId` now? The first reason why not. */
export function tripStatus(
  content: Content,
  state: BaseState,
  siteId: string,
  crewIds: string[],
  now: number,
): TripStatus {
  const site = siteOf(content, siteId);
  if (!site) return { code: "unknown" };
  if (!state.known.includes(site.region)) return { code: "hidden" };
  if (crewIds.length === 0) return { code: "no_party" };
  const most = partyLimit(content, site);
  if (crewIds.length > most || new Set(crewIds).size !== crewIds.length)
    return { code: "party_size", most };
  for (const id of crewIds) {
    const survivor = survivorIn(state, id);
    if (!survivor) return { code: "no_survivor" };
    if (!isFit(survivor, now)) return { code: "unfit", survivor: id };
  }
  if (atSea(content, site.region)) {
    const { boatBuilding, boatTrait } = content.mapRules;
    if (!hasBoat(content, state, site.region))
      return { code: "no_dock", building: boatBuilding, level: dockNeeded(content, site.region) };
    if (!crewIds.some((id) => canSteer(content, id)))
      return { code: "no_navigator", trait: boatTrait };
  }
  if (site.keycode && (state.items[site.keycode] ?? 0) < 1)
    return { code: "keycode", item: site.keycode };
  const missing = shortfall(site.rations, state.stock);
  if (Object.keys(missing).length > 0) return { code: "unaffordable", missing };
  return { code: "ok" };
}

/** Successes left at `siteId` before its find is sure (0: the next success brings it). */
export function triesToSure(content: Content, state: BaseState, siteId: string): number {
  return Math.max(0, content.mapRules.findPity - (state.dry[siteId] ?? 0));
}

/** Sites whose finds include `item`: where to look for a keycode. */
export function sitesFinding(content: Content, item: string): Site[] {
  return content.sites.filter((site) => site.finds?.some((find) => find.item === item));
}

// --- leaving ------------------------------------------------------------------------------

export type LeaveResult =
  | { ok: true; state: BaseState; mission: Mission; events: GameEvent[] }
  | { ok: false; status: Exclude<TripStatus | ScoutStatus, { code: "ok" }> };

function depart(
  content: Content,
  before: BaseState,
  mission: Omit<Mission, "id" | "seed">,
  paid: Amounts,
  keycode?: string,
): { state: BaseState; mission: Mission } {
  // What the leavers made at home so far is banked before they stop.
  const state = collect(content, before, mission.startedAt).state;
  const seq = state.missionSeq + 1;
  const full: Mission = {
    ...mission,
    id: `m${seq}`,
    seed: seedOf(state.seed, mission.startedAt, seq),
  };
  const items = { ...state.items };
  if (keycode) {
    items[keycode] = (items[keycode] ?? 0) - 1;
    if (items[keycode] <= 0) delete items[keycode];
  }
  return {
    state: {
      ...state,
      stock: subtract(state.stock, paid),
      items,
      missionSeq: seq,
      missions: [...state.missions, full],
      crew: state.crew.map((member) =>
        mission.crew.includes(member.id)
          ? { ...wake(content, member, mission.startedAt), away: full.id }
          : member,
      ),
    },
    mission: full,
  };
}

/** Sends `survivorId` to scout `regionId`: pays the fee; the fog lifts when they are back. */
export function startScout(
  content: Content,
  state: BaseState,
  regionId: string,
  survivorId: string,
  now: number,
): LeaveResult {
  const status = scoutStatus(content, state, regionId, now, survivorId);
  if (status.code !== "ok") return { ok: false, status };
  const region = regionOf(content, regionId);
  if (!region) return { ok: false, status: { code: "unknown" } };
  const minutes = scoutMinutes(content, region, survivorId);
  // Scouting is watching and walking: a small risk beyond the first ring.
  const injury = region.ring >= 2 ? 5 : 0;
  const odds: Odds = {
    success: 100,
    partial: 100,
    injury: [injury],
    minutes,
    rolls: 0,
    loot: 0,
    blueprint: 0,
    fragment: 0,
  };
  const left = depart(
    content,
    state,
    {
      kind: "scout",
      target: regionId,
      crew: [survivorId],
      startedAt: now,
      endsAt: now + minutes * 60,
      odds,
    },
    region.scout.cost,
  );
  return {
    ok: true,
    ...left,
    events: [
      {
        type: "scout_started",
        mission: left.mission.id,
        region: regionId,
        survivor: survivorId,
        endsAt: left.mission.endsAt,
        paid: region.scout.cost,
      },
    ],
  };
}

/** Sends a party to a site: pays the rations and fixes the odds they leave with. */
export function startTrip(
  content: Content,
  state: BaseState,
  siteId: string,
  crewIds: string[],
  now: number,
): LeaveResult {
  const status = tripStatus(content, state, siteId, crewIds, now);
  if (status.code !== "ok") return { ok: false, status };
  const site = siteOf(content, siteId);
  if (!site) return { ok: false, status: { code: "unknown" } };
  const odds = tripOdds(content, state, site, crewIds);
  const left = depart(
    content,
    state,
    {
      kind: "trip",
      target: siteId,
      crew: crewIds,
      startedAt: now,
      endsAt: now + odds.minutes * 60,
      odds,
    },
    site.rations,
    site.keycode,
  );
  return {
    ok: true,
    ...left,
    events: [
      {
        type: "trip_started",
        mission: left.mission.id,
        site: siteId,
        crew: crewIds,
        endsAt: left.mission.endsAt,
        paid: site.rations,
        ...(site.keycode ? { keycode: site.keycode } : {}),
      },
    ],
  };
}

// --- coming back --------------------------------------------------------------------------

/** Regions a map fragment could reveal: unknown, bordering the known ones, within range. */
function fragmentTargets(content: Content, state: BaseState): string[] {
  return content.regions
    .filter(
      (region) =>
        !state.known.includes(region.id) &&
        region.ring <= scoutRange(content, state) &&
        bordersKnown(content, state, region.id),
    )
    .map((region) => region.id);
}

function rollLoot(site: Site, odds: Odds, rolls: number, random: Rng, extraPercent = 0): Amounts {
  const loot: Amounts = {};
  for (let roll = 0; roll < rolls; roll++) {
    const entry =
      site.loot[
        pickWeighted(
          random,
          site.loot.map((candidate) => candidate.weight),
        )
      ];
    if (!entry) continue;
    const amount = Math.floor(
      (random.int(entry.min, entry.max) * (100 + odds.loot + extraPercent)) / 100,
    );
    loot[entry.resource] = (loot[entry.resource] ?? 0) + amount;
  }
  return loot;
}

/** Applies one mission that has ended: outcome, loot, injuries, XP, reveals, the report. */
function resolve(
  content: Content,
  state: BaseState,
  mission: Mission,
): { state: BaseState; events: GameEvent[] } {
  const random = rng(mission.seed);
  const at = mission.endsAt;
  let next: BaseState = { ...state, missions: state.missions.filter((m) => m.id !== mission.id) };
  const events: GameEvent[] = [];
  let outcome: Outcome = "success";
  let wanted: Amounts = {};
  let xp = 10;
  let injuryHours = 3;
  const revealed: string[] = [];
  let blueprint: string | null = null;
  const happened: TripEvent[] = [];
  const found: string[] = [];
  let rescued: string | null = null;

  if (mission.kind === "scout") {
    revealed.push(mission.target);
  } else {
    const site = siteOf(content, mission.target);
    const roll = random.next() * 100;
    outcome =
      roll < mission.odds.success ? "success" : roll < mission.odds.partial ? "partial" : "fail";
    // Trip events (W4b): each rolled once, at most `most` of them. W4a missions carry no
    // event odds and roll exactly as they did.
    for (const event of content.tripEvents) {
      const chance = mission.odds.events?.[event.id];
      if (chance === undefined) continue;
      const hit = random.next() * 100 < chance;
      if (hit && event.outcomes.includes(outcome) && happened.length < content.tripEventRules.most)
        happened.push(event);
    }
    if (site) {
      const base =
        outcome === "success"
          ? mission.odds.rolls
          : outcome === "partial"
            ? Math.ceil(mission.odds.rolls / 2)
            : 0;
      const rolls = base + happened.reduce((sum, event) => sum + (event.rolls ?? 0), 0);
      const extra = happened.reduce((sum, event) => sum + (event.loot ?? 0), 0);
      wanted = rollLoot(site, mission.odds, rolls, random, extra);
      xp =
        outcome === "success"
          ? site.xp
          : outcome === "partial"
            ? Math.floor(site.xp / 2)
            : Math.floor(site.xp / 4);
      injuryHours = site.injuryHours;
      if (outcome === "success" && random.next() * 100 < mission.odds.blueprint) {
        blueprint = drawBlueprint(content, next, random);
      }
      if (outcome === "success" && random.next() * 100 < mission.odds.fragment) {
        const targets = fragmentTargets(content, next);
        const scrap = targets[Math.floor(random.next() * targets.length)];
        if (scrap) revealed.push(scrap);
      }
      if (outcome === "success" && mission.odds.events !== undefined && site.finds) {
        // Bad luck is capped: a dry streak of `findPity` successes makes the next one sure.
        const sure = (next.dry[site.id] ?? 0) >= content.mapRules.findPity;
        for (const find of site.finds) {
          if (random.next() * 100 < find.chance || sure) found.push(find.item);
        }
        next = {
          ...next,
          dry: { ...next.dry, [site.id]: found.length > 0 ? 0 : (next.dry[site.id] ?? 0) + 1 },
        };
      }
    }
  }
  const injuryPercent = 100 + happened.reduce((sum, event) => sum + (event.injury ?? 0), 0);

  // Loot: parts come home whole, the rest up to the room there is.
  const parts: Amounts = {};
  const rest: Amounts = {};
  for (const [id, amount] of Object.entries(wanted)) {
    if (amount <= 0) continue;
    if (isPart(content, id)) parts[id] = amount;
    else rest[id] = amount;
  }
  const gained = { ...parts, ...clampToCap(storageCap(content, next), next.stock, rest) };
  next = { ...next, stock: add(next.stock, gained) };

  // The party: injuries, XP, levels; everyone is home again.
  const injured: { id: string; until: number }[] = [];
  const levelUps: string[] = [];
  next = {
    ...next,
    crew: next.crew.map((member) => {
      const index = mission.crew.indexOf(member.id);
      if (index < 0) return member;
      const chance =
        ((mission.odds.injury[index] ?? 0) * (outcome === "fail" ? 2 : 1) * injuryPercent) / 100;
      let injuredUntil = member.injuredUntil;
      if (random.next() * 100 < Math.min(95, chance)) {
        const recovery = Math.max(
          0,
          ...traitsOf(content, member.id).map((trait) => trait.recovery ?? 0),
        );
        const hours = injuryHours * (0.75 + random.next() * 0.5) * ((100 - recovery) / 100);
        injuredUntil = at + Math.max(HOUR / 2, Math.round(hours * HOUR));
        injured.push({ id: member.id, until: injuredUntil });
      }
      const total = member.xp + xp;
      const level = levelFor(content, total);
      if (level > member.level) levelUps.push(member.id);
      // Home again: their job picks up from here (after the injury, if any).
      const shift = { ...member.shift, since: Math.max(member.shift.since, at) };
      return { ...member, away: null, xp: total, level, injuredUntil, shift };
    }),
  };
  for (const id of levelUps) {
    const level = survivorIn(next, id)?.level ?? 1;
    events.push({ type: "level_up", survivor: id, level, at });
  }
  // Out together once more: bonds grow, whatever the outcome.
  if (mission.kind === "trip" && mission.crew.length > 1) {
    const bonds = { ...next.bonds };
    for (const key of pairsOf(mission.crew)) bonds[key] = (bonds[key] ?? 0) + 1;
    next = { ...next, bonds };
  }
  if (found.length > 0) {
    const items = { ...next.items };
    for (const item of found) {
      items[item] = (items[item] ?? 0) + 1;
      events.push({ type: "item_found", item, from: mission.target, at });
    }
    next = { ...next, items };
  }
  if (happened.some((event) => event.rescue)) {
    const stranger = content.crew.find((member) => !survivorIn(next, member.id));
    if (stranger && next.crew.length < crewCap(content, next)) {
      rescued = stranger.id;
      next = { ...next, crew: [...next.crew, newSurvivor(content, stranger.id, at)] };
      events.push({ type: "survivor_arrived", survivor: stranger.id, at, from: "rescue" });
    } else if (stranger) {
      // No room yet: they make their own way and come with the next boat that has room.
      next = { ...next, nextArrivalAt: Math.min(next.nextArrivalAt, at) };
    }
  }
  for (const event of happened) {
    events.push({
      type: "trip_event",
      mission: mission.id,
      event: event.id,
      site: mission.target,
      at,
    });
  }

  for (const region of revealed) {
    if (next.known.includes(region)) continue;
    next = { ...next, known: [...next.known, region] };
    events.push({
      type: "region_revealed",
      region,
      from: mission.kind === "scout" ? "scout" : "fragment",
    });
  }
  if (blueprint && !next.blueprints.includes(blueprint)) {
    next = { ...next, blueprints: [...next.blueprints, blueprint] };
    events.push({ type: "blueprint_found", recipe: blueprint, from: "site" });
  }

  const report: Report = {
    id: mission.id,
    kind: mission.kind,
    target: mission.target,
    outcome,
    crew: mission.crew,
    gained,
    injured,
    xp,
    levelUps,
    revealed,
    blueprint,
    events: happened.map((event) => event.id),
    found,
    rescued,
    at,
    read: false,
  };
  next = { ...next, reports: [report, ...next.reports].slice(0, REPORTS_KEPT) };
  events.unshift({
    type: "mission_back",
    mission: mission.id,
    kind: mission.kind,
    target: mission.target,
    outcome,
    crew: mission.crew,
    gained,
    at,
  });
  return { state: next, events };
}

/** Lands every mission that has ended, in the order they ended. Part of settling. */
export function settleMissions(
  content: Content,
  state: BaseState,
  now: number,
): { state: BaseState; events: GameEvent[] } {
  const done = state.missions
    .filter((mission) => mission.endsAt <= now)
    .sort((a, b) => a.endsAt - b.endsAt);
  let next = state;
  const events: GameEvent[] = [];
  for (const mission of done) {
    const landed = resolve(content, next, mission);
    next = landed.state;
    events.push(...landed.events);
  }
  return { state: next, events };
}

export function nextMissionAt(state: BaseState): number | null {
  const ends = state.missions.map((mission) => mission.endsAt);
  return ends.length > 0 ? Math.min(...ends) : null;
}

/** Marks a report read (the report card was opened). Idempotent. */
export function readReport(state: BaseState, id: string): BaseState {
  if (!state.reports.some((report) => report.id === id && !report.read)) return state;
  return {
    ...state,
    reports: state.reports.map((report) => (report.id === id ? { ...report, read: true } : report)),
  };
}
