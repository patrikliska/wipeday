/**
 * Every player action as data, and the one function that applies it. The API
 * runs it inside a transaction, the web client runs it to predict the result
 * before the server answers (and to play offline in demo mode), and the
 * simulator runs it for its archetypes: one rulebook, three callers.
 *
 * `applyCommand` settles first, then applies the command, then records task
 * progress and hint use. A refusal still returns the settled state (settling is
 * always safe to keep) and says why, with what is missing when that helps.
 *
 * W5: a few of the Den's commands need what only the server knows (`World`: a
 * listing in another base, a secret seed). Without it they refuse `server_only`,
 * which the client takes as "wait for the server" rather than a refusal.
 *
 * W6: after every command (refused or not) the next NPC raid is planned if none is pending,
 * so raids only ever follow a player who plays (`raids.ts`).
 */
import type { Amounts, Content, DiceOption } from "@wipe-day/content/schema";
import type { Tier } from "@wipe-day/content/tiers";
import { breakBarrel, progressTasks } from "./active";
import type { Advice } from "./advisor";
import {
  type BaseState,
  collect,
  collectFurnaces,
  gather,
  smelt,
  total,
  upgradeTool,
} from "./base";
import { type BuildStatus, startConstruction } from "./buildings";
import { placeWheelBet, playDice, playSlots, type WagerStatus } from "./casino";
import { deliver } from "./contracts";
import { type CraftStatus, cancelCraft, queueCraft, salvage, serve } from "./craft";
import type { Job } from "./crew";
import { denBuy } from "./den";
import type { GameEvent } from "./events";
import { assign, type JobRefusal, rest, restTired } from "./jobs";
import { buyPerk, type CosmeticStatus, cosmeticStatus, type PerkStatus } from "./legacy";
import { buyListing, cancelListing, listGoods } from "./market";
import {
  type CrewRefusal,
  equip,
  readReport,
  type ScoutStatus,
  startScout,
  startTrip,
  type TripStatus,
  treat,
} from "./missions";
import { endNodeRun, type HitRefusal, hitNode } from "./nodes";
import {
  type PvpStatus,
  planRaid,
  raidPlayer,
  readRaidReport,
  repair,
  type SetPvpStatus,
  setPvp,
} from "./raids";
import { settleAll } from "./settle";
import { type GiveStatus, giveToSignal } from "./signal";
import { recordStats } from "./stats";
import type { World } from "./world";

export type Command =
  | { type: "gather" }
  | { type: "collect" }
  | { type: "upgrade_tool" }
  /** `what`: "tier" for the next base tier, or a building id. */
  | { type: "build"; what: string }
  | { type: "smelt"; ore: string }
  | { type: "take_out" }
  /** `count` units of the recipe that makes `recipe` (its output id). */
  | { type: "craft"; recipe: string; count: number }
  /** Cancels job `index` in `station`'s queue: the units not made yet are refunded. */
  | { type: "cancel_craft"; station: string; index: number }
  | { type: "salvage"; item: string; count: number }
  | { type: "serve"; meal: string }
  | { type: "scout"; region: string; survivor: string }
  | { type: "send_trip"; site: string; crew: string[] }
  /** `item` null takes the gear off. */
  | { type: "equip"; survivor: string; slot: "weapon" | "armor"; item: string | null }
  | { type: "treat"; survivor: string; item: string }
  /** `job` null frees the survivor. */
  | { type: "assign"; survivor: string; job: Job | null }
  | { type: "rest"; survivor: string }
  /** Sends every tired worker at home to bed. */
  | { type: "rest_tired" }
  | { type: "read_report"; id: string }
  | { type: "break_barrel" }
  | { type: "hit_node"; node: string; run: string; hit: number }
  | { type: "end_node_run"; node: string; run: string }
  // The Den (W5). `price` is scrap for the whole lot.
  | { type: "market_list"; good: string; amount: number; price: number }
  /** `listing`: the base's own listing id. */
  | { type: "market_cancel"; listing: string }
  /** `listing`: the board's row id. Server only (the goods sit in another base). */
  | { type: "market_buy"; listing: number }
  | { type: "den_buy"; offer: string; lots: number }
  | { type: "deliver"; contract: string }
  | { type: "wheel_bet"; segment: string; amount: number }
  /** Server only, like the dice: the roll comes from a seed the player cannot see. */
  | { type: "slots_spin"; amount: number }
  | { type: "dice_roll"; option: DiceOption; amount: number }
  // Raids (W6).
  | { type: "repair" }
  /** Joins (`on`) or leaves the PvP raids. */
  | { type: "set_pvp"; on: boolean }
  /** Server only: the target's base is another player's. `target`: their player id. */
  | { type: "raid_player"; target: number }
  // The legacy layer and the Signal (W7). Server only: the points and the Signal are shared.
  | { type: "buy_perk"; perk: string }
  /** Wear a title or a skin earned (null takes it off; absent leaves it). */
  | { type: "set_cosmetic"; title?: string | null; skin?: string | null }
  | { type: "signal_give"; good: string; amount: number };

export type CommandType = Command["type"];

/** Commands the client cannot predict: it shows them pending until the server answers. */
export const SERVER_ONLY: readonly CommandType[] = [
  "market_buy",
  "slots_spin",
  "dice_roll",
  "raid_player",
  "buy_perk",
  "set_cosmetic",
  "signal_give",
];

/** Why a command did nothing. `missing` and friends let the UI say exactly what to do. */
export type Refusal =
  | { code: "cooldown"; readyAt: number }
  | { code: "maxed" }
  | { code: "unaffordable"; missing: Amounts }
  | Exclude<BuildStatus, { code: "ok" | "unaffordable" | "unknown" | "maxed" }>
  | { code: "no_furnace" }
  | { code: "no_slot" }
  | { code: "nothing_to_smelt" }
  | { code: "not_ore" }
  | { code: "no_barrel" }
  | Exclude<CraftStatus, { code: "ok" | "unaffordable" }>
  | { code: "no_job" }
  | { code: "not_owned" }
  | { code: "not_meal" }
  | { code: "fed_better"; until: number }
  | Exclude<TripStatus | ScoutStatus, { code: "ok" | "unaffordable" | "unknown" }>
  | CrewRefusal
  | JobRefusal
  | HitRefusal
  // The Den (W5).
  | { code: "server_only" }
  | { code: "den_closed"; tier: Tier }
  | { code: "not_tradeable" }
  | { code: "listing_cap"; count: number }
  | { code: "price_floor"; price: number }
  | { code: "no_room"; room: number }
  | { code: "listing_gone" }
  | { code: "own_listing" }
  | { code: "not_listed" }
  | { code: "no_offer" }
  | { code: "sold_out"; resetAt: number }
  | { code: "all_known" }
  | { code: "no_contract" }
  | { code: "bad_option" }
  | Exclude<WagerStatus, { code: "ok" | "unaffordable" | "den_closed" }>
  // Raids (W6).
  | { code: "no_damage" }
  | { code: "no_target" }
  | Exclude<SetPvpStatus | PvpStatus, { code: "ok" | "unaffordable" }>
  // The legacy layer and the Signal (W7).
  | Exclude<
      PerkStatus | CosmeticStatus | GiveStatus,
      { code: "ok" | "unknown" | "unaffordable" | "server_only" }
    >;

export type CommandResult =
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; state: BaseState; events: GameEvent[]; refusal: Refusal };

/** Which onboarding hint a command counts as using. */
const HINT_OF: Partial<Record<CommandType, Advice>> = {
  gather: "gather",
  collect: "collect",
  upgrade_tool: "tools",
  build: "build",
  smelt: "furnace",
  take_out: "furnace",
  craft: "craft",
  scout: "map",
  send_trip: "map",
  assign: "crew",
  rest: "crew",
  rest_tired: "crew",
  break_barrel: "barrel",
  deliver: "den",
  den_buy: "den",
  market_list: "den",
  market_buy: "den",
  repair: "repair",
};

type Step =
  | {
      ok: true;
      state: BaseState;
      events: GameEvent[];
      task?: [Parameters<typeof progressTasks>[2], number];
    }
  | { ok: false; refusal: Refusal; state?: BaseState; events?: GameEvent[] };

function step(
  content: Content,
  state: BaseState,
  command: Command,
  now: number,
  world: World | undefined,
): Step {
  switch (command.type) {
    case "gather": {
      const result = gather(content, state, now);
      if (!result.ok) return { ok: false, refusal: { code: "cooldown", readyAt: result.readyAt } };
      return {
        ok: true,
        state: result.state,
        events: [{ type: "gathered", gained: result.gained, bonus: result.bonus }],
        task: ["gather", 1],
      };
    }
    case "collect": {
      const result = collect(content, state, now);
      return {
        ok: true,
        state: result.state,
        events: [{ type: "collected", gained: result.gained }],
        task: ["collect", total(result.gained) > 0 ? 1 : 0],
      };
    }
    case "upgrade_tool": {
      const result = upgradeTool(content, state, now);
      if (!result.ok) {
        return {
          ok: false,
          refusal:
            result.reason === "maxed"
              ? { code: "maxed" }
              : result.reason === "tier"
                ? { code: "tier", tier: result.tier }
                : { code: "unaffordable", missing: result.missing },
        };
      }
      const events: GameEvent[] = [];
      if (total(result.gained) > 0) events.push({ type: "collected", gained: result.gained });
      events.push({ type: "tool_upgraded", tool: result.tool.id, paid: result.paid });
      return { ok: true, state: result.state, events };
    }
    case "build": {
      const result = startConstruction(content, state, now, command.what);
      if (!result.ok) {
        const { status } = result;
        // An unknown building id is a malformed request, not something to explain.
        return { ok: false, refusal: status.code === "unknown" ? { code: "unknown" } : status };
      }
      return { ok: true, state: result.state, events: result.events };
    }
    case "smelt": {
      const result = smelt(content, state, now, command.ore);
      if (!result.ok) return { ok: false, refusal: { code: result.reason } };
      return {
        ok: true,
        state: result.state,
        events: [
          { type: "smelt_started", ore: command.ore, amount: result.job.amount, fuel: result.fuel },
        ],
        task: ["smelt", result.job.amount],
      };
    }
    case "take_out": {
      const result = collectFurnaces(content, state, now);
      return {
        ok: true,
        state: result.state,
        events: [{ type: "furnace_out", gained: result.gained }],
        task: ["furnace_collect", total(result.gained)],
      };
    }
    case "craft": {
      const result = queueCraft(content, state, command.recipe, command.count, now);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events, task: ["craft", 1] };
    }
    case "cancel_craft": {
      const result = cancelCraft(content, state, command.station, command.index, now);
      if (!result.ok) return { ok: false, refusal: { code: "no_job" } };
      return { ok: true, state: result.state, events: result.events };
    }
    case "salvage": {
      const result = salvage(content, state, command.item, command.count);
      if (!result.ok) return { ok: false, refusal: { code: result.reason } };
      return { ok: true, state: result.state, events: result.events };
    }
    case "serve": {
      const result = serve(content, state, command.meal, now);
      if (!result.ok) {
        return {
          ok: false,
          refusal:
            result.reason === "fed_better"
              ? { code: "fed_better", until: result.until }
              : { code: result.reason },
        };
      }
      return { ok: true, state: result.state, events: result.events };
    }
    case "scout": {
      const result = startScout(content, state, command.region, command.survivor, now);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
    case "send_trip": {
      const result = startTrip(content, state, command.site, command.crew, now);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events, task: ["trip", 1] };
    }
    case "equip": {
      const result = equip(content, state, command.survivor, command.slot, command.item);
      if (!result.ok) return { ok: false, refusal: result.refusal };
      return { ok: true, state: result.state, events: result.events };
    }
    case "treat": {
      const result = treat(content, state, command.survivor, command.item, now);
      if (!result.ok) return { ok: false, refusal: result.refusal };
      return { ok: true, state: result.state, events: result.events };
    }
    case "assign": {
      const result = assign(content, state, command.survivor, command.job, now);
      if (!result.ok) return { ok: false, refusal: result.refusal };
      return { ok: true, state: result.state, events: result.events };
    }
    case "rest": {
      const result = rest(content, state, command.survivor, now);
      if (!result.ok) return { ok: false, refusal: result.refusal };
      return { ok: true, state: result.state, events: result.events };
    }
    case "rest_tired": {
      const result = restTired(content, state, now);
      if (!result.ok) return { ok: false, refusal: result.refusal };
      return { ok: true, state: result.state, events: result.events };
    }
    case "read_report":
      return {
        ok: true,
        state: readRaidReport(readReport(state, command.id), command.id),
        events: [],
      };
    case "break_barrel": {
      const result = breakBarrel(content, state, now);
      if (!result.ok) return { ok: false, refusal: { code: "no_barrel" } };
      const events: GameEvent[] = [{ type: "barrel_broken", gained: result.gained }];
      if (result.blueprint)
        events.push({ type: "blueprint_found", recipe: result.blueprint, from: "barrel" });
      return { ok: true, state: result.state, events, task: ["barrel", 1] };
    }
    case "hit_node": {
      const result = hitNode(content, state, now, command.node, command.run, command.hit);
      if (!result.ok)
        return { ok: false, refusal: result.refusal, state: result.state, events: result.events };
      const hits = result.events.filter((event) => event.type === "node_hit").length;
      return { ok: true, state: result.state, events: result.events, task: ["node_hits", hits] };
    }
    case "end_node_run": {
      const result = endNodeRun(content, state, now, command.node, command.run);
      return { ok: true, state: result.state, events: result.events };
    }
    case "market_list": {
      const result = listGoods(content, state, command.good, command.amount, command.price, now);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
    case "market_cancel": {
      const result = cancelListing(content, state, command.listing);
      if (!result.ok) return { ok: false, refusal: { code: "not_listed" } };
      return { ok: true, state: result.state, events: result.events };
    }
    case "market_buy": {
      // No world: the client, which cannot see the seller. A world without the listing: the
      // server looked and it is sold, cancelled or expired.
      if (!world) return { ok: false, refusal: { code: "server_only" } };
      const listing = world.listing;
      if (!listing || listing.id !== command.listing)
        return { ok: false, refusal: { code: "listing_gone" } };
      const result = buyListing(content, state, listing, world.self, now);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
    case "den_buy": {
      const result = denBuy(content, state, command.offer, command.lots, now);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
    case "deliver": {
      const result = deliver(content, state, command.contract);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
    case "wheel_bet": {
      const result = placeWheelBet(content, state, command.segment, command.amount, now);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
    case "slots_spin": {
      const result = playSlots(content, state, command.amount, now, world);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
    case "dice_roll": {
      const result = playDice(content, state, command.option, command.amount, now, world);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
    case "repair": {
      const result = repair(content, state);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
    case "set_pvp": {
      const result = setPvp(content, state, command.on, now);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
    case "buy_perk": {
      if (!world?.legacy) return { ok: false, refusal: { code: "server_only" } };
      const result = buyPerk(content, state, command.perk, world.legacy, now);
      if (!result.ok)
        return {
          ok: false,
          refusal: result.status.code === "unknown" ? { code: "unknown" } : result.status,
        };
      return { ok: true, state: result.state, events: result.events };
    }
    case "set_cosmetic": {
      if (!world?.legacy) return { ok: false, refusal: { code: "server_only" } };
      const status = cosmeticStatus(world.legacy, command);
      if (status.code !== "ok") return { ok: false, refusal: status };
      const skin = command.skin === undefined ? state.skin : command.skin;
      return {
        ok: true,
        state: { ...state, skin },
        events: [{ type: "cosmetic_set", title: command.title ?? null, skin }],
      };
    }
    case "signal_give": {
      const result = giveToSignal(content, state, world?.signal, command.good, command.amount);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
    case "raid_player": {
      // No world, or no secret seed: the client. A world without the target: it is gone.
      if (world?.seed === undefined || world.self === undefined)
        return { ok: false, refusal: { code: "server_only" } };
      const target = world.target;
      if (!target || target.id !== command.target)
        return { ok: false, refusal: { code: "no_target" } };
      const name = world.selfName ?? "";
      const result = raidPlayer(content, state, world.self, name, target, world.seed, now);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events };
    }
  }
}

/**
 * Settles `state` to `now`, then applies `command`. Pure; the caller owns the clock.
 * `world`: what only the server knows (W5); the client and old callers leave it out.
 */
export function applyCommand(
  content: Content,
  state: BaseState,
  command: Command,
  now: number,
  world?: World,
): CommandResult {
  const settled = settleAll(content, state, now, world);
  const result = step(content, settled.state, command, now, world);
  if (!result.ok) {
    return {
      ok: false,
      state: planRaid(content, result.state ?? settled.state, now),
      events: [...settled.events, ...(result.events ?? [])],
      refusal: result.refusal,
    };
  }
  // Settling counted its own events already; count what the command did.
  let next = recordStats(result.state, result.events, now);
  const events = [...settled.events, ...result.events];
  if (result.task) {
    const progressed = progressTasks(content, next, result.task[0], result.task[1]);
    next = progressed.state;
    events.push(...progressed.events);
  }
  const hint =
    command.type === "build" && command.what !== "tier"
      ? command.what === "furnace"
        ? "furnace"
        : "building"
      : command.type === "assign" && command.job?.kind === "guard"
        ? "defend"
        : HINT_OF[command.type];
  if (hint) next = { ...next, hints: { ...next.hints, [hint]: (next.hints[hint] ?? 0) + 1 } };
  return { ok: true, state: planRaid(content, next, now), events };
}
