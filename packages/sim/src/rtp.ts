/**
 * The casino's return, measured (W5): play every bet option a million times with
 * the domain's own rolls and compare with the exact odds in
 * `@wipe-day/content/odds`. `pnpm sim rtp` prints the table; `rtp.test.ts`
 * asserts every option within one percentage point (roadmap W5 acceptance).
 */
import { betOptions, type CasinoGame, diceWins, exactRtp } from "@wipe-day/content/odds";
import type { Content, DiceOption } from "@wipe-day/content/schema";
import { rollDice, spinSlots, wheelResult } from "@wipe-day/domain/casino";
import { rng, seedOf } from "@wipe-day/domain/rng";

export interface RtpRow {
  game: CasinoGame;
  option: string | null;
  spins: number;
  /** Exact return, as a fraction. */
  exact: number;
  /** Measured return, the jackpot pool counted as paid back. */
  measured: number;
  /** Slots only: jackpots hit. */
  jackpots?: number;
}

/** Plays `spins` rounds of one bet option with one-chip bets; deterministic for a `seed`. */
export function measure(
  content: Content,
  game: CasinoGame,
  option: string | undefined,
  spins: number,
  seed = 1,
): RtpRow {
  const { casino } = content.den;
  const bet = casino.betStep;
  const random = rng(seedOf(seed, game.length, (option ?? "").length));
  let paid = 0;
  let pool = 0;
  let jackpots = 0;
  for (let spin = 0; spin < spins; spin++) {
    const roll = random.int(0, 2 ** 31 - 1);
    switch (game) {
      case "wheel": {
        const segment = casino.wheel.segments[wheelResult(content, roll)];
        if (segment && segment.id === option) paid += (bet * segment.pays) / 100;
        break;
      }
      case "slots": {
        const result = spinSlots(content, roll);
        pool += bet * casino.slots.jackpot.feedPercent;
        paid += (bet * result.pays) / 100;
        if (result.jackpot) {
          jackpots++;
          paid += Math.floor(pool / 100);
          pool %= 100;
        }
        break;
      }
      case "dice": {
        const [a, b] = rollDice(roll);
        const found = casino.dice.options.find((candidate) => candidate.id === option);
        if (found && diceWins(found.id as DiceOption, a, b)) paid += (bet * found.pays) / 100;
        break;
      }
    }
  }
  return {
    game,
    option: option ?? null,
    spins,
    exact: exactRtp(casino, game, option),
    // What is still in the pool is the players' money waiting for a winner.
    measured: (paid + pool / 100) / (spins * bet),
    ...(game === "slots" ? { jackpots } : {}),
  };
}

/** Every bet option the Den offers, a million rounds each by default. */
export function measureAll(content: Content, spins = 1_000_000): RtpRow[] {
  return betOptions(content.den.casino).map(({ game, option }) =>
    measure(content, game, option, spins),
  );
}
