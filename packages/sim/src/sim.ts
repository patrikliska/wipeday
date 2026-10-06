/**
 * Headless balance simulator: drives `@wipe-day/domain` with a manual clock and
 * scripted players. `pnpm sim` prints a per-day table (and CSV), `pnpm sim
 * check` asserts the pacing targets in `data/pacing.json5`.
 *
 * Archetypes are decision policies run at each check-in; the domain does the
 * rest. Deterministic: every roll is seeded from the check-in time.
 */
import type { Amounts, Content, Site } from "@wipe-day/content/schema";
import { TIERS, type Tier } from "@wipe-day/content/tiers";
import {
  type BaseState,
  canAfford,
  furnaceReady,
  furnaceSlots,
  isEmpty,
  newBase,
  nextTier,
  nextTool,
  shortfall,
  smeltable,
  storageCap,
  storageFill,
  tierOf,
  toolUnlocked,
  total,
  upkeepOf,
} from "@wipe-day/domain/base";
import { buildingCount, buildStatus, nextBuild } from "@wipe-day/domain/buildings";
import { casinoLimit, wagerLeft } from "@wipe-day/domain/casino";
import { manualClock } from "@wipe-day/domain/clock";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import { deliverStatus } from "@wipe-day/domain/contracts";
import { boostPercent, craftStatus, maxBatch, queueOf } from "@wipe-day/domain/craft";
import { type Job, nodeJobRates, stationWorker, traitsOf } from "@wipe-day/domain/crew";
import { denBuyStatus, denOpen, lotsLeft, offerOf, offerPrice } from "@wipe-day/domain/den";
import type { GameEvent } from "@wipe-day/domain/events";
import { held, isCapped } from "@wipe-day/domain/goods";
import { jobStatus, tiredWorkers } from "@wipe-day/domain/jobs";
import {
  atSea,
  canSteer,
  isFit,
  partyLimit,
  scoutStatus,
  siteOf,
  sitesIn,
  tripOdds,
  tripStatus,
} from "@wipe-day/domain/missions";
import { nodeStatus } from "@wipe-day/domain/nodes";
import { expandNeeds, type Need, partsToMake, stations } from "@wipe-day/domain/recipes";
import { rng, seedOf } from "@wipe-day/domain/rng";
import { settleAll } from "@wipe-day/domain/settle";

export const ARCHETYPES = ["casual", "active", "optimal", "gambler"] as const;
export type Archetype = (typeof ARCHETYPES)[number];

/** Check-in moments within a day, in hours. The gambler is a casual player who also plays. */
const SCHEDULE: Record<Archetype, number[]> = {
  casual: [8, 13, 21],
  gambler: [8, 13, 21],
  active: [7, 9, 12, 15, 17, 19, 21, 23],
  optimal: Array.from({ length: 24 }, (_, hour) => hour),
};

const HOUR = 3600;
const DAY = 86400;

export interface DayRow {
  day: number;
  tier: Tier;
  tool: string;
  /** Fullest resource and its fill, what the storage bar would show. */
  fill: string;
  cap: number;
  ingots: number;
  fuel: number;
  scrap: number;
  items: number;
  /** Part units in stock, all kinds together. */
  parts: number;
  /** Survivors in the crew. */
  crew: number;
  /** Scrap the Den took and gave today (W5): stock buys, fees, contracts, the tables. */
  denSpent: number;
  denEarned: number;
  /** Scrap wagered and won today. */
  wagered: number;
  won: number;
  /** Regions known. */
  known: number;
  /** Buildings standing (level 1 or more). */
  buildings: number;
  building: boolean;
}

export interface Run {
  archetype: Archetype;
  rows: DayRow[];
  /** Season day on which each tier was first reached. */
  reached: Partial<Record<Tier, number>>;
  /** Season day on which each recipe output first landed. */
  firstMade: Record<string, number>;
  /** Season day on which each station first finished something. */
  stationsWorked: Record<string, number>;
  /** Season day of the first trip to a site of each tier, and to each site. */
  firstTrip: Partial<Record<number, number>>;
  firstSite: Record<string, number>;
  /** Season day on which each tool was first held. */
  tools: Record<string, number>;
  /** Season day a survivor first took a job at home. */
  firstJob: number | null;
}

/** Where a run's events go while it plays (the first-made days are read from them). */
let listener: ((event: GameEvent) => void) | null = null;

/** The server's side for the casino: a seeded stream of rolls and the shared jackpot pool. */
const house = { random: rng(1), jackpot: 0 };

/** Applies one command the way the server would; a refusal keeps the settled state. */
function act(content: Content, state: BaseState, command: Command, now: number): BaseState {
  const world =
    command.type === "slots_spin" || command.type === "dice_roll"
      ? { seed: house.random.int(0, 2 ** 31 - 1), jackpot: house.jackpot }
      : undefined;
  const result = applyCommand(content, state, command, now, world);
  for (const event of result.events) {
    if (event.type === "wager") house.jackpot += event.feed;
    if (event.type === "jackpot_won") house.jackpot = 0;
  }
  if (listener) for (const event of result.events) listener(event);
  return result.state;
}

/** Nodes an active player works after a gather, most valuable first. */
const NODE_PREFERENCE = ["ore_1", "sulfur_1", "stone_1", "tree_1"];

/** One check-in: collect, gather, work a node, then spend greedily. Every step is a command. */
export function checkIn(
  content: Content,
  state: BaseState,
  now: number,
  archetype: Archetype,
): BaseState {
  let s = act(content, state, { type: "collect" }, now);
  // Eat before gathering, so the boost counts: the best meal in the cupboard.
  if (boostPercent(s, now) === 0) {
    const meal = content.items
      .filter((item) => item.category === "meal" && (s.items[item.id] ?? 0) > 0)
      .sort((a, b) => (b.boostPercent ?? 0) - (a.boostPercent ?? 0))[0];
    if (meal) s = act(content, s, { type: "serve", meal: meal.id }, now);
  }
  const gathered = applyCommand(content, s, { type: "gather" }, now);
  if (listener) for (const event of gathered.events) listener(event);
  s = gathered.state;
  // Active players work a node after every gather, perfectly.
  if (gathered.ok && archetype !== "casual") {
    const node = NODE_PREFERENCE.find((id) => nodeStatus(content, s, id, now).code === "ready");
    if (node) {
      for (let hit = 1; hit <= content.active.node.maxHits; hit++) {
        s = act(content, s, { type: "hit_node", node, run: `sim-${now}`, hit }, now + hit);
      }
    }
  }
  if (s.barrel) s = act(content, s, { type: "break_barrel" }, now);
  if (!isEmpty(furnaceReady(s, now))) s = act(content, s, { type: "take_out" }, now);

  // Spend, most valuable first. Loop because one purchase can enable another.
  for (let guard = 0; guard < 8; guard++) {
    const before = s;

    s = act(content, s, { type: "build", what: "tier" }, now);

    // Keep the base fed: never spend below the next 24 h of upkeep (48 h for casual).
    const reserveHours = archetype === "casual" ? 48 : 24;
    const spendable = { ...s.stock };
    for (const [id, perHour] of Object.entries(upkeepOf(content, s))) {
      spendable[id] = (spendable[id] ?? 0) - perHour * reserveHours;
    }
    const affordable = (what: string): boolean => {
      const next = nextBuild(content, s, what);
      return (
        next !== null &&
        buildStatus(content, s, what).code === "ok" &&
        canAfford(next.cost, spendable)
      );
    };

    const tool = nextTool(content, s);
    if (tool && toolUnlocked(s, tool) && canAfford(tool.cost, spendable))
      s = act(content, s, { type: "upgrade_tool" }, now);

    // Furnace: build it as soon as ore is being gathered; upgrade when affordable.
    const gathersOre = Object.keys(s.stock).some((id) =>
      content.resources.some((resource) => resource.id === id && resource.smeltsInto),
    );
    if (gathersOre && affordable("furnace"))
      s = act(content, s, { type: "build", what: "furnace" }, now);
    // The workbench next (it opens crafting), then the cheapest other building a builder can take.
    if (affordable("workbench")) s = act(content, s, { type: "build", what: "workbench" }, now);
    // Other buildings only from what is left after saving for the next tier: half its cost
    // while it is far off, all of it once it is within reach (70% affordable).
    const saving = { ...spendable };
    const upcoming = nextBuild(content, s, "tier");
    if (upcoming && !s.construction.some((job) => job.target.kind === "tier")) {
      const nearlyThere = Object.entries(upcoming.cost).every(
        ([id, amount]) => (s.stock[id] ?? 0) >= amount * 0.7,
      );
      for (const [id, amount] of Object.entries(upcoming.cost)) {
        saving[id] = (saving[id] ?? 0) - (nearlyThere ? amount : amount / 2);
      }
    }
    const spare = (what: string): boolean => {
      const next = nextBuild(content, s, what);
      return (
        next !== null && buildStatus(content, s, what).code === "ok" && canAfford(next.cost, saving)
      );
    };
    const others = content.buildings
      .map((building) => building.id)
      .filter((id) => id !== "furnace" && id !== "workbench" && spare(id))
      .sort(
        (a, b) =>
          total(nextBuild(content, s, a)?.cost ?? {}) - total(nextBuild(content, s, b)?.cost ?? {}),
      );
    const cheapest = others[0];
    if (cheapest) s = act(content, s, { type: "build", what: cheapest }, now);

    // Parts: what the next tier and tool wait on, then the cheapest building that only lacks
    // parts. A station that is missing or too low for a part gets built or upgraded first.
    const partsFor = (cost: Amounts, depth = 0): void => {
      for (const { recipe, units } of partsToMake(content, s.stock, cost)) {
        const status = craftStatus(content, s, recipe.output);
        if (status.code === "station" || status.code === "workbench") {
          if (depth > 0) continue;
          if (affordable(recipe.station)) {
            s = act(content, s, { type: "build", what: recipe.station }, now);
          } else {
            const next = nextBuild(content, s, recipe.station);
            if (next && buildStatus(content, s, recipe.station).code === "unaffordable")
              partsFor(next.cost, depth + 1);
          }
          continue;
        }
        if (status.code !== "ok") continue;
        let count = Math.min(units, maxBatch(content, s, recipe.output));
        // Never into the upkeep reserve.
        for (const [id, amount] of Object.entries(recipe.cost)) {
          const reserve = (upkeepOf(content, s)[id] ?? 0) * reserveHours;
          count = Math.min(count, Math.floor(((s.stock[id] ?? 0) - reserve) / amount));
        }
        if (count > 0) s = act(content, s, { type: "craft", recipe: recipe.output, count }, now);
      }
    };
    if (upcoming && !s.construction.some((job) => job.target.kind === "tier"))
      partsFor(upcoming.cost);
    if (tool && toolUnlocked(s, tool)) partsFor(tool.cost);
    const rawOnly = (cost: Amounts): Amounts =>
      Object.fromEntries(
        Object.entries(cost).filter(([id]) =>
          content.resources.some((resource) => resource.id === id && resource.kind !== "part"),
        ),
      );
    const waiting = content.buildings
      .map((building) => building.id)
      .filter((id) => {
        const next = nextBuild(content, s, id);
        return (
          next !== null &&
          buildStatus(content, s, id).code === "unaffordable" &&
          canAfford(rawOnly(next.cost), saving)
        );
      })
      .sort(
        (a, b) =>
          total(nextBuild(content, s, a)?.cost ?? {}) - total(nextBuild(content, s, b)?.cost ?? {}),
      )[0];
    if (waiting) partsFor(nextBuild(content, s, waiting)?.cost ?? {});

    // A roast or stew in the cupboard for tomorrow's gathers.
    const meals = content.items.filter((item) => item.category === "meal");
    if (meals.every((meal) => (s.items[meal.id] ?? 0) === 0)) {
      const best = meals
        .filter((meal) => craftStatus(content, s, meal.id).code === "ok")
        .sort((a, b) => (b.boostPercent ?? 0) - (a.boostPercent ?? 0))[0];
      const station = best ? content.recipes.find((r) => r.output === best.id)?.station : undefined;
      if (best && station && queueOf(s, station).length === 0)
        s = act(
          content,
          s,
          { type: "craft", recipe: best.id, count: Math.min(3, maxBatch(content, s, best.id)) },
          now,
        );
    }
    // A curious player makes one of each piece of gear once, when it is cheap to.
    for (const item of content.items) {
      if (!["weapon", "armor", "med"].includes(item.category)) continue;
      if ((s.items[item.id] ?? 0) > 0) continue;
      const recipe = content.recipes.find((r) => r.output === item.id);
      if (!recipe || queueOf(s, recipe.station).some((job) => job.recipe === item.id)) continue;
      if (craftStatus(content, s, item.id).code === "ok" && canAfford(recipe.cost, saving))
        s = act(content, s, { type: "craft", recipe: item.id, count: 1 }, now);
    }

    if (storageFill(content, s, now).fraction > 0.7) {
      const crates = content.items
        .filter((item) => item.category === "storage")
        .sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0));
      const crate = crates.find((item) => craftStatus(content, s, item.id).code === "ok");
      if (crate) s = act(content, s, { type: "craft", recipe: crate.id, count: 1 }, now);
    }

    if (s === before) break;
  }

  s = expeditions(content, s, now);
  s = den(content, s, now, archetype);

  // Smelt whatever ore is waiting, the ore the next tier needs first.
  const wanted = nextTier(s.tier)
    ? Object.keys(tierOf(content, nextTier(s.tier) ?? s.tier).cost)
    : [];
  const ores = content.resources
    .filter((resource) => resource.smeltsInto)
    .sort(
      (a, b) =>
        Number(wanted.includes(b.smeltsInto ?? "")) - Number(wanted.includes(a.smeltsInto ?? "")),
    );
  for (const ore of ores) {
    while (s.furnaceJobs.length < furnaceSlots(content, s) && smeltable(content, s, ore.id) > 0) {
      const result = applyCommand(content, s, { type: "smelt", ore: ore.id }, now);
      s = result.state;
      if (!result.ok) break;
    }
  }
  return s;
}

/**
 * The Den (W5), once it deals with the base. Every archetype:
 * - delivers a contract when the goods are surplus: a capped resource that stays above
 *   60% of storage afterwards, or a part held twice over;
 * - buys from the Den's counter the parts the next tier or tool is short of, keeping the
 *   scrap the next tool needs plus a small reserve for scouting.
 * The gambler then plays dice and slots with the biggest bet until the daily cap.
 */
function den(content: Content, state: BaseState, now: number, archetype: Archetype): BaseState {
  let s = state;
  if (!denOpen(content, s)) return s;
  const cap = storageCap(content, s);
  for (const id of s.contracts.ids) {
    const status = deliverStatus(content, s, id);
    if (status.code !== "ok") continue;
    const { good, amount } = status.terms;
    const left = held(content, s, good) - amount;
    const surplus = isCapped(content, good) ? left >= cap * 0.6 : left >= amount;
    if (surplus) s = act(content, s, { type: "deliver", contract: id }, now);
  }
  const tool = nextTool(content, s);
  const scrapReserve = 150 + (tool && toolUnlocked(s, tool) ? (tool.cost.scrap ?? 0) : 0);
  const goals: Amounts[] = [];
  const tier = nextTier(s.tier);
  if (tier && !s.construction.some((job) => job.target.kind === "tier"))
    goals.push(tierOf(content, tier).cost);
  if (tool && toolUnlocked(s, tool)) goals.push(tool.cost);
  for (const cost of goals) {
    const short = shortfall(cost, s.stock);
    for (const id of s.den.offers) {
      const offer = offerOf(content, id);
      const missing = offer ? (short[offer.good] ?? 0) : 0;
      if (!offer || missing <= 0) continue;
      const price = offerPrice(content, offer);
      const affordable = Math.floor(((s.stock.scrap ?? 0) - scrapReserve) / price);
      const lots = Math.min(lotsLeft(s, offer), Math.ceil(missing / offer.lot), affordable);
      if (lots > 0 && denBuyStatus(content, s, id, lots, now).code === "ok")
        s = act(content, s, { type: "den_buy", offer: id, lots }, now);
    }
  }
  // Comforts a person buys when the Den has them: a meal when the cupboard is bare, a first
  // aid kit when someone is hurt and there is none.
  const bare = content.items.every(
    (item) => item.category !== "meal" || (s.items[item.id] ?? 0) === 0,
  );
  const hurt = s.crew.some((member) => member.injuredUntil !== null && member.injuredUntil > now);
  for (const id of s.den.offers) {
    const offer = offerOf(content, id);
    const item = offer ? content.items.find((candidate) => candidate.id === offer.good) : undefined;
    const wanted =
      (item?.category === "meal" && bare) ||
      (item?.category === "med" && hurt && (s.items[item.id] ?? 0) === 0);
    if (!offer || !wanted || (s.stock.scrap ?? 0) < offerPrice(content, offer) + scrapReserve)
      continue;
    if (denBuyStatus(content, s, id, 1, now).code === "ok")
      s = act(content, s, { type: "den_buy", offer: id, lots: 1 }, now);
  }
  if (archetype === "gambler") {
    const limit = casinoLimit(content, s);
    for (let spin = 0; limit && spin < 40; spin++) {
      const bet = Math.min(limit.maxBet, wagerLeft(content, s, now));
      if (bet < content.den.casino.betStep || (s.stock.scrap ?? 0) < bet + 100) break;
      const command: Command =
        spin % 2 === 0
          ? { type: "slots_spin", amount: bet }
          : { type: "dice_roll", option: "seven", amount: bet };
      s = act(content, s, command, now);
    }
  }
  return s;
}

/**
 * The node kind whose resource the next tier lacks most, in hours of the tool's rate
 * (refined resources count as their ore). Timber when nothing is missing.
 */
function neededNode(content: Content, s: BaseState): string {
  const next = nextTier(s.tier);
  const cost = next ? rawCost(content, tierOf(content, next).cost) : {};
  let best = { kind: "tree", hours: -1 };
  for (const kind of content.nodeKinds) {
    for (const id of Object.keys(kind.yields)) {
      // Ore counts for the ingots the tier asks for too.
      const refined = content.resources.find((resource) => resource.id === id)?.smeltsInto;
      const wanted = (cost[id] ?? 0) + (refined ? (cost[refined] ?? 0) : 0);
      const need = wanted - (s.stock[id] ?? 0);
      const rate = content.tools.find((tool) => tool.id === s.toolId)?.rates[id] ?? 0;
      if (rate <= 0) continue;
      const hours = need / rate;
      if (hours > best.hours) best = { kind: kind.id, hours };
    }
  }
  return best.kind;
}

/**
 * Work at home: the cook takes the campfire and the tinkerer the busiest station once
 * they stand; everyone else works the node the next tier needs most (W4b). Jobs stay
 * while someone is out on a trip.
 */
function jobs(content: Content, state: BaseState, now: number): BaseState {
  let s = state;
  const node = neededNode(content, s);
  for (const member of s.crew) {
    let job: Job = { kind: "node", node };
    for (const trait of traitsOf(content, member.id)) {
      for (const station of Object.keys(trait.craft ?? {})) {
        const target =
          station === "any"
            ? (["workbench", "loom", "campfire"].find((id) => queueOf(s, id).length > 0) ??
              "workbench")
            : station;
        const taken = stationWorker(s, target);
        if ((s.buildings[target] ?? 0) > 0 && (!taken || taken.id === member.id))
          job = { kind: "station", station: target };
      }
    }
    if (job.kind === "node" && Object.keys(nodeJobRates(content, s, member.id, node)).length === 0)
      continue;
    if (jobStatus(content, s, member.id, job) !== null) continue;
    s = act(content, s, { type: "assign", survivor: member.id, job }, now);
  }
  if (tiredWorkers(s, now).length > 0) s = act(content, s, { type: "rest_tired" }, now);
  return s;
}

/**
 * The crew's turn: gear up, treat the hurt, send one scout toward the nearest unknown
 * region, and send the rest in parties to the best site they can do with even odds or
 * better (the highest tier, then the shortest trip). Keeps a day of rations for scouting.
 * Whoever stays home goes to work, and the tired rest.
 */
function expeditions(content: Content, state: BaseState, now: number): BaseState {
  let s = state;
  // Gear: the strongest weapon and armour owned go to whoever has none.
  for (const slot of ["weapon", "armor"] as const) {
    const best = content.items
      .filter((item) => item.category === slot && (s.items[item.id] ?? 0) > 0)
      .sort((a, b) => (b.power ?? b.protection ?? 0) - (a.power ?? a.protection ?? 0));
    for (const item of best) {
      const bare = s.crew.find((member) => member.away === null && member.gear[slot] === null);
      if (!bare) break;
      s = act(content, s, { type: "equip", survivor: bare.id, slot, item: item.id }, now);
    }
  }
  for (const member of s.crew) {
    if (member.injuredUntil === null || member.injuredUntil <= now) continue;
    const kit = ["first_aid_kit", "bandage"].find((id) => (s.items[id] ?? 0) > 0);
    if (kit) s = act(content, s, { type: "treat", survivor: member.id, item: kit }, now);
  }
  // One scout at a time, toward the cheapest region that is open to scouting (a navigator
  // for the sea).
  if (!s.missions.some((mission) => mission.kind === "scout")) {
    const options = content.regions
      .flatMap((region) => {
        const scout = s.crew.find(
          (member) =>
            isFit(member, now) && scoutStatus(content, s, region.id, now, member.id).code === "ok",
        );
        return scout ? [{ region, scout }] : [];
      })
      .sort(
        (a, b) =>
          a.region.ring - b.region.ring || total(a.region.scout.cost) - total(b.region.scout.cost),
      );
    const pick = options[0];
    if (pick)
      s = act(content, s, { type: "scout", region: pick.region.id, survivor: pick.scout.id }, now);
  }
  // Parties: the strongest fit survivors first.
  for (let guard = 0; guard < 6; guard++) {
    const fit = s.crew
      .filter((member) => isFit(member, now))
      .sort((a, b) => b.level - a.level)
      .map((member) => member.id);
    if (fit.length === 0) break;
    // A site is worth the highest tier it opens: its own, or that of a known site whose
    // keycode it finds while the base has none (half a tier more: opening beats a tie).
    const wantedKeys = new Map<string, number>();
    for (const site of s.known.flatMap((region) => sitesIn(content, region))) {
      if (site.keycode && !(s.items[site.keycode] ?? 0))
        wantedKeys.set(site.keycode, Math.max(wantedKeys.get(site.keycode) ?? 0, site.tier));
    }
    const worth = (site: Site): number =>
      Math.max(
        site.tier,
        ...(site.finds ?? []).map((find) =>
          wantedKeys.has(find.item) ? (wantedKeys.get(find.item) ?? 0) + 0.5 : 0,
        ),
      );
    // Curiosity: of two equal sites, the one not seen lately.
    const visited = (site: Site): number =>
      s.reports.some((report) => report.target === site.id) ? 1 : 0;
    const options = s.known
      .flatMap((region) => sitesIn(content, region))
      .map((site) => {
        const party = fit.slice(0, partyLimit(content, site));
        // At sea, a navigator takes the last place if nobody in the party can steer.
        if (atSea(content, site.region) && !party.some((id) => canSteer(content, id))) {
          const navigator = fit.find((id) => canSteer(content, id));
          if (navigator && party.length > 0) party[party.length - 1] = navigator;
        }
        return { site, party, odds: tripOdds(content, s, site, party) };
      })
      .filter(
        ({ site, party, odds }) =>
          odds.success >= 50 && tripStatus(content, s, site.id, party, now).code === "ok",
      )
      .sort(
        (a, b) =>
          worth(b.site) - worth(a.site) ||
          b.site.tier - a.site.tier ||
          visited(a.site) - visited(b.site) ||
          a.site.minutes - b.site.minutes,
      );
    const best = options[0];
    // Rations a better site is waiting on (fuel, mostly): make them for the next check-in.
    const blocked = s.known
      .flatMap((region) => sitesIn(content, region))
      .filter((site) => worth(site) > (best ? worth(best.site) : 0))
      .sort((a, b) => worth(b) - worth(a))[0];
    if (blocked && guard === 0) {
      for (const [id, missing] of Object.entries(shortfall(blocked.rations, s.stock))) {
        const recipe = content.recipes.find((candidate) => candidate.output === id);
        if (!recipe || queueOf(s, recipe.station).length > 0) continue;
        const count = Math.min(Math.ceil(missing / recipe.amount), maxBatch(content, s, id));
        if (count > 0) s = act(content, s, { type: "craft", recipe: id, count }, now);
      }
    }
    if (!best) break;
    s = act(content, s, { type: "send_trip", site: best.site.id, crew: best.party }, now);
  }
  return jobs(content, s, now);
}

/** `onEvent` sees every event as it happens, with its season day (for debugging balance). */
export function simulate(
  content: Content,
  archetype: Archetype,
  days: number,
  onEvent?: (event: GameEvent, day: number, state: () => BaseState) => void,
): Run {
  const start = 1_700_000_000;
  const clock = manualClock(start);
  house.random = rng(seedOf(7, ARCHETYPES.indexOf(archetype)));
  house.jackpot = 0;
  let denDay = { denSpent: 0, denEarned: 0, wagered: 0, won: 0 };
  let state = newBase(content, clock.now(), 1);
  const rows: DayRow[] = [];
  const reached: Partial<Record<Tier, number>> = { twig: 1 };
  const firstMade: Record<string, number> = {};
  const stationsWorked: Record<string, number> = {};
  const firstTrip: Partial<Record<number, number>> = {};
  const firstSite: Record<string, number> = {};
  const tools: Record<string, number> = {};
  let firstJob: number | null = null;
  let today = 1;
  const record = (event: GameEvent) => {
    onEvent?.(event, today, () => state);
    if (event.type === "den_bought") denDay.denSpent += event.price;
    if (event.type === "listed") denDay.denSpent += event.fee;
    if (event.type === "contract_done") denDay.denEarned += event.pay;
    if (event.type === "wager") {
      denDay.wagered += event.bet;
      denDay.won += event.payout;
    }
    if (event.type === "assigned" && event.job !== null) firstJob ??= today;
    if (event.type === "trip_started") {
      const tier = siteOf(content, event.site)?.tier ?? 0;
      firstTrip[tier] ??= today;
      firstSite[event.site] ??= today;
      return;
    }
    if (event.type !== "crafted") return;
    // A unit that landed before the check-in counts for the day it landed on.
    const day = Math.min(today, Math.floor((event.at - start) / DAY) + 1);
    firstMade[event.recipe] ??= day;
    stationsWorked[event.station] ??= day;
  };
  listener = record;

  for (let day = 1; day <= days; day++) {
    today = day;
    for (const hour of SCHEDULE[archetype]) {
      clock.set(start + (day - 1) * DAY + hour * HOUR);
      state = checkIn(content, state, clock.now(), archetype);
      if (reached[state.tier] === undefined) reached[state.tier] = day;
    }
    clock.set(start + day * DAY - 1);
    const endOfDay = clock.now();
    const settled = settleAll(content, state, endOfDay);
    for (const event of settled.events) record(event);
    const settledState = settled.state;
    tools[settledState.toolId] ??= day;
    if (reached[settledState.tier] === undefined) reached[settledState.tier] = day;
    rows.push({
      day,
      tier: settledState.tier,
      tool: settledState.toolId,
      fill: `${Math.round(storageFill(content, settledState, endOfDay).fraction * 100)}% ${storageFill(content, settledState, endOfDay).resource}`,
      cap: storageCap(content, settledState),
      ingots: settledState.stock.ingots ?? 0,
      fuel: settledState.stock.fuel ?? 0,
      scrap: settledState.stock.scrap ?? 0,
      items: Object.values(settledState.items).reduce((sum, count) => sum + count, 0),
      parts: content.resources
        .filter((resource) => resource.kind === "part")
        .reduce((sum, resource) => sum + (settledState.stock[resource.id] ?? 0), 0),
      crew: settledState.crew.length,
      ...denDay,
      known: settledState.known.length,
      buildings: buildingCount(settledState),
      building: settledState.construction.length > 0,
    });
    denDay = { denSpent: 0, denEarned: 0, wagered: 0, won: 0 };
  }
  listener = null;
  return {
    archetype,
    rows,
    reached,
    firstMade,
    stationsWorked,
    firstTrip,
    firstSite,
    tools,
    firstJob,
  };
}

/** `cost` with every part broken down into what it is made of, down to gathered resources. */
function rawCost(content: Content, cost: Amounts): Amounts {
  const out: Amounts = {};
  const leaves = (needs: Need[]) => {
    for (const need of needs) {
      if (need.make) leaves(need.parts);
      else out[need.id] = (out[need.id] ?? 0) + need.need;
    }
  };
  leaves(expandNeeds(content, {}, cost));
  return out;
}

export interface CheckFailure {
  message: string;
  /** Advisory: printed, but does not fail the check. */
  warning?: boolean;
}

/** Asserts `data/pacing.json5` against fresh runs. Empty result = pass. */
export function checkPacing(content: Content, days = 35): CheckFailure[] {
  const failures: CheckFailure[] = [];
  const casual = simulate(content, "casual", days);
  const optimal = simulate(content, "optimal", days);
  const gambler = simulate(content, "gambler", days);
  const { pacing } = content;

  // W5: the economy. Scrap rises slowly for the casual player; the gambler stays solvent
  // and the daily wager cap holds every day.
  const scrapTarget = pacing.casual.scrap;
  const scrapThen = casual.rows[scrapTarget.day - 1]?.scrap ?? 0;
  if (scrapThen < scrapTarget.min || scrapThen > scrapTarget.max) {
    failures.push({
      message: `casual holds ${scrapThen} scrap on day ${scrapTarget.day}, target ${scrapTarget.min}-${scrapTarget.max}`,
    });
  }
  for (const row of gambler.rows) {
    const cap = content.den.casino.limits[row.tier]?.dailyWager ?? 0;
    if (row.scrap < 0)
      failures.push({ message: `gambler's scrap went negative on day ${row.day}` });
    if (row.wagered > cap) {
      failures.push({
        message: `gambler wagered ${row.wagered} on day ${row.day}, over the ${row.tier} cap of ${cap}`,
      });
    }
  }
  if (gambler.rows.every((row) => row.wagered === 0)) {
    failures.push({ message: "the gambler never played: the casino did not open" });
  }

  for (const tier of ["stone", "metal", "hqm"] as const) {
    const window = pacing.casual[tier];
    const day = casual.reached[tier];
    if (day === undefined) {
      failures.push({
        message: `casual never reached ${tier} in ${days} days (target day ${window.earliestDay}-${window.latestDay})`,
      });
    } else if (day < window.earliestDay || day > window.latestDay) {
      failures.push({
        message: `casual reached ${tier} on day ${day}, target day ${window.earliestDay}-${window.latestDay}`,
      });
    }
  }
  const { day: buildDay, count: buildTarget } = pacing.casual.buildings;
  const built = casual.rows[buildDay - 1]?.buildings ?? 0;
  if (built < buildTarget) {
    failures.push({
      message: `casual has ${built} buildings on day ${buildDay}, target at least ${buildTarget}`,
    });
  }
  for (const [output, byDay] of Object.entries(pacing.casual.firstMade)) {
    const day = casual.firstMade[output];
    if (day === undefined || day > byDay) {
      failures.push({
        message: `casual first made ${output} on ${day === undefined ? "no day" : `day ${day}`}, target by day ${byDay}`,
      });
    }
  }
  const workedBy = pacing.casual.stationsWorkedByDay;
  for (const station of stations(content)) {
    const day = casual.stationsWorked[station];
    if (day === undefined || day > workedBy) {
      failures.push({
        message: `casual's ${station} first worked on ${day === undefined ? "no day" : `day ${day}`}, target by day ${workedBy}`,
      });
    }
  }
  const firstTrip = Math.min(...Object.values(casual.firstTrip).filter((day) => day !== undefined));
  if (!(firstTrip <= pacing.casual.firstTripByDay)) {
    failures.push({
      message: `casual's first trip left on day ${Number.isFinite(firstTrip) ? firstTrip : "never"}, target by day ${pacing.casual.firstTripByDay}`,
    });
  }
  const tierThree = casual.firstTrip[3];
  if (tierThree === undefined || tierThree > pacing.casual.tierThreeSiteByDay) {
    failures.push({
      message: `casual first went to a tier-3 site on ${tierThree === undefined ? "no day" : `day ${tierThree}`}, target by day ${pacing.casual.tierThreeSiteByDay}`,
    });
  }
  const crewTarget = pacing.casual.crew;
  const crewThen = casual.rows[crewTarget.day - 1]?.crew ?? 0;
  if (crewThen < crewTarget.count) {
    failures.push({
      message: `casual has ${crewThen} survivors on day ${crewTarget.day}, target at least ${crewTarget.count}`,
    });
  }
  const toolDay = casual.tools[pacing.casual.tool.id];
  if (toolDay === undefined || toolDay > pacing.casual.tool.byDay) {
    failures.push({
      message: `casual got ${pacing.casual.tool.id} on ${toolDay === undefined ? "no day" : `day ${toolDay}`}, target by day ${pacing.casual.tool.byDay}`,
    });
  }
  if (casual.firstJob === null || casual.firstJob > pacing.casual.jobsByDay) {
    failures.push({
      message: `casual first put someone to work on ${casual.firstJob === null ? "no day" : `day ${casual.firstJob}`}, target by day ${pacing.casual.jobsByDay}`,
    });
  }
  for (const [tier, byDay] of [
    [4, pacing.casual.tierFourSiteByDay],
    [5, pacing.casual.tierFiveSiteByDay],
  ] as const) {
    const day = casual.firstTrip[tier];
    if (day === undefined || day > byDay) {
      failures.push({
        message: `casual first went to a tier-${tier} site on ${day === undefined ? "no day" : `day ${day}`}, target by day ${byDay}`,
      });
    }
  }
  const last = pacing.optimal.lastSite;
  const optimalLast = optimal.firstSite[last.id];
  if (optimalLast !== undefined && optimalLast < last.notBeforeDay) {
    failures.push({
      message: `optimal first went to ${last.id} on day ${optimalLast}, must not be before day ${last.notBeforeDay}`,
    });
  }
  const optimalThree = optimal.firstTrip[3];
  if (optimalThree !== undefined && optimalThree < pacing.optimal.tierThreeSiteNotBeforeDay) {
    failures.push({
      message: `optimal went to a tier-3 site on day ${optimalThree}, must not be before day ${pacing.optimal.tierThreeSiteNotBeforeDay}`,
    });
  }
  const optimalHqm = optimal.reached.hqm;
  if (optimalHqm !== undefined && optimalHqm < pacing.optimal.hqmNotBeforeDay) {
    failures.push({
      message: `optimal reached hqm on day ${optimalHqm}, must not be before day ${pacing.optimal.hqmNotBeforeDay}`,
    });
  }

  // Tier cost ratio, in resource-hours at the tool tier a player has when buying it.
  const hours = (tierId: Tier, toolIndex: number): number => {
    const cost = rawCost(content, tierOf(content, tierId).cost);
    const tool = content.tools[toolIndex];
    if (!tool) return 0;
    let sum = 0;
    for (const [id, amount] of Object.entries(cost)) {
      // Refined resources come from ore 1:1; value them at the ore's rate.
      const ore = content.resources.find((resource) => resource.smeltsInto === id)?.id ?? id;
      const rate = tool.rates[ore] ?? 1;
      sum += amount / rate;
    }
    return sum;
  };
  const costHours = TIERS.slice(1).map((tier, index) =>
    hours(tier, Math.min(index + 1, content.tools.length - 1)),
  );
  for (let index = 1; index < costHours.length; index++) {
    const ratio = (costHours[index] ?? 0) / Math.max(1, costHours[index - 1] ?? 1);
    const tier = TIERS[index + 1];
    if (ratio < pacing.tierCostRatio.min || ratio > pacing.tierCostRatio.max) {
      failures.push({
        warning: true,
        message: `${tier} costs ${ratio.toFixed(1)}x the previous tier in resource-hours (guideline ${pacing.tierCostRatio.min}-${pacing.tierCostRatio.max}x); the day targets are the gate`,
      });
    }
  }
  return failures;
}
