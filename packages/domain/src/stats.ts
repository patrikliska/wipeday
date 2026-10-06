/**
 * Season counters for the leaderboards and the season card (W5). Kept in the
 * base and updated from the events every command and settle produces, so no rule
 * has to remember to count: whatever happened is what gets counted.
 */
import type { Tier } from "@wipe-day/content/tiers";
import { type BaseState, total } from "./base";
import type { GameEvent } from "./events";

export interface Stats {
  /** Sites a party came back from with something (success or partial), each once. */
  sites: string[];
  /** The biggest single haul a party brought home (units of everything). */
  bestHaul: number;
  /** Scrap that changed hands in player trades, both sides counted. */
  traded: number;
  /** Scrap bet and won at the Den's tables (resolved bets). */
  wagered: number;
  won: number;
  /** The biggest single payout. */
  biggestWin: number;
  contracts: number;
  /** When each base tier was reached. */
  reached: Partial<Record<Tier, number>>;
}

export function newStats(): Stats {
  return {
    sites: [],
    bestHaul: 0,
    traded: 0,
    wagered: 0,
    won: 0,
    biggestWin: 0,
    contracts: 0,
    reached: {},
  };
}

/** Counts what `events` say happened. Changes nothing when nothing counts. */
export function recordStats(state: BaseState, events: GameEvent[], now: number): BaseState {
  let stats: Stats | null = null;
  const edit = (): Stats => {
    stats ??= {
      ...state.stats,
      sites: [...state.stats.sites],
      reached: { ...state.stats.reached },
    };
    return stats;
  };
  for (const event of events) {
    switch (event.type) {
      case "mission_back":
        if (event.kind === "trip" && event.outcome !== "fail") {
          const s = edit();
          if (!s.sites.includes(event.target)) s.sites.push(event.target);
          s.bestHaul = Math.max(s.bestHaul, total(event.gained));
        }
        break;
      case "build_done":
        edit().reached[event.tier] ??= now;
        break;
      case "sold":
      case "bought":
        edit().traded += event.price;
        break;
      case "wager": {
        const s = edit();
        s.wagered += event.bet;
        s.won += event.payout;
        s.biggestWin = Math.max(s.biggestWin, event.payout);
        break;
      }
      case "contract_done":
        edit().contracts += 1;
        break;
      default:
        break;
    }
  }
  return stats ? { ...state, stats } : state;
}
