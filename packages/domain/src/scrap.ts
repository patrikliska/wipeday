/**
 * Scrap, the premium currency (docs/redesign/12-feel.md 8; D182, D259): a whole number in
 * `meta.scrap`, earned in play (quests, orders, the Magpie; later the nuke and the Magnet) and
 * spent on Supply Drops and boosts. Never traded, gifted, wagered, stolen or sold for Supplies
 * (guardrail 8): nothing here moves scrap between players, and it only falls by the owner's own
 * `buy_boost` or `buy_drop`. `meta.stats.scrap` counts what was ever earned (N19 reads it).
 */
import type { Pay } from "@wipe-day/content/schema";
import { grantDrops } from "./drops";
import type { GameEvent, ScrapSource } from "./events";
import type { BaseState } from "./state";

/** Adds `n` scrap, earned from `source`. */
export function earnScrap(
  state: BaseState,
  n: number,
  source: ScrapSource,
): { state: BaseState; events: GameEvent[] } {
  if (n <= 0) return { state, events: [] };
  const meta = state.meta;
  return {
    state: {
      ...state,
      meta: {
        ...meta,
        scrap: meta.scrap + n,
        stats: { ...meta.stats, scrap: meta.stats.scrap + n },
      },
    },
    events: [{ type: "scrap_earned", n, source }],
  };
}

/** Takes `n` scrap (the caller checked it is held). */
export function spendScrap(state: BaseState, n: number): BaseState {
  return { ...state, meta: { ...state.meta, scrap: Math.max(0, state.meta.scrap - n) } };
}

/**
 * Pays a list of rewards from `source`: scrap and gear shards at once; a drop at once, or, when
 * `gated`, as a mark the drops' hourly gate pays (`credit`, D251, D266: the orders' set drops
 * queue like the badges', so the Album's pace stays bounded; the gate pays the first at once).
 */
export function pay(
  state: BaseState,
  pays: readonly Pay[],
  source: ScrapSource,
  gated = false,
): { state: BaseState; events: GameEvent[] } {
  let out = state;
  const events: GameEvent[] = [];
  for (const row of pays) {
    if ("scrap" in row) {
      const earned = earnScrap(out, row.scrap, source);
      out = earned.state;
      events.push(...earned.events);
    } else if ("shards" in row) {
      const { rarity, n } = row.shards;
      const drops = out.meta.drops;
      const gear = { ...drops.shards.gear, [rarity]: drops.shards.gear[rarity] + n };
      out = {
        ...out,
        meta: { ...out.meta, drops: { ...drops, shards: { ...drops.shards, gear } } },
      };
      events.push({ type: "shards_earned", rarity, n, source });
    } else if (gated) {
      const drops = out.meta.drops;
      out = {
        ...out,
        meta: {
          ...out.meta,
          drops: { ...drops, owed: { ...drops.owed, earned: drops.owed.earned + 1 } },
        },
      };
    } else {
      out = grantDrops(out, row.drop, 1);
      events.push({ type: "drop_earned", tier: row.drop, count: 1, source });
    }
  }
  return { state: out, events };
}
