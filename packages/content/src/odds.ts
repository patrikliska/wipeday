/**
 * The exact odds of the Den's games, from the data alone (W5). The content check
 * uses them to keep every bet option at a 5-10% edge, the games panel shows them
 * before a bet ("returns 93% on average"), and the simulator measures its million
 * spins against them. Browser-safe, no randomness here (the rolls are in
 * `@wipe-day/domain/casino`).
 */
import type { Casino, DiceOption } from "./schema";

export type CasinoGame = "wheel" | "slots" | "dice";

/** Whether two dice showing `a` and `b` win `option`. */
export function diceWins(option: DiceOption, a: number, b: number): boolean {
  const sum = a + b;
  switch (option) {
    case "over":
      return sum > 7;
    case "under":
      return sum < 7;
    case "seven":
      return sum === 7;
    case "doubles":
      return a === b;
  }
}

/** Chance of `option` on two fair dice. */
export function diceChance(option: DiceOption): number {
  let wins = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) if (diceWins(option, a, b)) wins++;
  }
  return wins / 36;
}

export function wheelWeight(casino: Casino): number {
  return casino.wheel.segments.reduce((sum, segment) => sum + segment.weight, 0);
}

/** Chance the wheel stops on `segment`. */
export function wheelChance(casino: Casino, segment: string): number {
  const found = casino.wheel.segments.find((candidate) => candidate.id === segment);
  return found ? found.weight / wheelWeight(casino) : 0;
}

export function slotWeight(casino: Casino): number {
  return casino.slots.symbols.reduce((sum, symbol) => sum + symbol.weight, 0);
}

/** Chance of three of the jackpot symbol on one spin. */
export function jackpotChance(casino: Casino): number {
  const symbol = casino.slots.symbols.find((candidate) => candidate.jackpot);
  return symbol ? (symbol.weight / slotWeight(casino)) ** 3 : 0;
}

/** What the paytable returns per scrap bet (the jackpot's fixed pay included), without the pool. */
export function slotsBaseRtp(casino: Casino): number {
  const total = slotWeight(casino);
  let rtp = 0;
  for (const symbol of casino.slots.symbols) {
    const p = symbol.weight / total;
    const three = symbol.jackpot ? casino.slots.jackpot.pays : (symbol.three ?? 0);
    rtp += (p ** 3 * three) / 100;
    rtp += (3 * p ** 2 * (1 - p) * (symbol.two ?? 0)) / 100;
  }
  return rtp;
}

/**
 * Expected return per scrap bet, as a fraction (0.93 = 93%). The slots count the jackpot
 * feed as paid back: the pool is every spin's share, won by someone in the end (and the
 * Den never adds to it, so this holds at every bet size).
 * `option`: the wheel segment or the dice option; the slots have only one.
 */
export function exactRtp(casino: Casino, game: CasinoGame, option?: string): number {
  switch (game) {
    case "wheel": {
      const segment = casino.wheel.segments.find((candidate) => candidate.id === option);
      return segment ? (wheelChance(casino, segment.id) * segment.pays) / 100 : 0;
    }
    case "slots":
      return slotsBaseRtp(casino) + casino.slots.jackpot.feedPercent / 100;
    case "dice": {
      const found = casino.dice.options.find((candidate) => candidate.id === option);
      return found ? (diceChance(found.id) * found.pays) / 100 : 0;
    }
  }
}

/** Every bet option there is, with its game: what the content check and the RTP test walk. */
export function betOptions(casino: Casino): { game: CasinoGame; option?: string }[] {
  return [
    ...casino.wheel.segments
      .filter((segment) => segment.pays > 0)
      .map((segment) => ({ game: "wheel" as const, option: segment.id })),
    { game: "slots" as const },
    ...casino.dice.options.map((option) => ({ game: "dice" as const, option: option.id })),
  ];
}
