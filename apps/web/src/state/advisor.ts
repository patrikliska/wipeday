/**
 * The advisor on screen (02-the-run.md 11.1; CLAUDE.md 6.3 rule 1): the domain's advisor run over
 * the player's base and pace, recomputed when the base changes and once a second. It scores every
 * purchase (the cards' "in 42s" and the era plate read it), but the game shows its pick only
 * while that kind of purchase is new to the player (D244): `crown` and `tapHint` are what the
 * HUD and the scene light, and after onboarding both stay empty.
 */
import {
  type Choice,
  choices,
  crown,
  firstUse,
  lasting,
  type Pick,
  type Player,
  tapHintLive,
} from "@wipe-day/domain/advisor";
import { shownRate, tapGlance } from "@wipe-day/domain/glance";
import type { BaseState } from "@wipe-day/domain/state";
import { create } from "zustand";
import { wall } from "./clocks";
import { pace } from "./pace";
import { gameSeconds, settledBase, useWorld } from "./store";
import { content } from "./world";

export interface AdvisorView {
  /** The base settled to `now`. */
  base: BaseState;
  /** The game second it was computed at. */
  now: number;
  /** The top bar's `/s`. */
  rate: number;
  /** Supplies a second with the player's taps, buffs included: what "in 42s" divides by. */
  income: number;
  player: Player;
  /** Every purchase on offer, scored. */
  offered: Choice[];
  /** The advisor's pick (what the simulator would do). Never shown as such. */
  pick: Pick;
  /** The purchase lit in orange: the pick, while its kind is new to the player (D244). */
  crown: Choice | null;
  /** "Tap the tree." and the target's glow: the pick is to tap and the player is new. */
  tapHint: boolean;
}

export const useAdvisor = create<{ view: AdvisorView | null }>(() => ({ view: null }));

export function computeAdvisor(base: BaseState, now: number, nowMs: number): AdvisorView {
  const { tapRate, tapShare } = pace(nowMs);
  const rate = shownRate(content, base, now);
  const income = rate + tapRate * tapGlance(content, base, now).value;
  // The crown scores lasting rates: a Frenzy or a Rally never moves it (D200).
  const calm = lasting(base);
  const calmIncome =
    calm === base
      ? income
      : shownRate(content, calm, now) + tapRate * tapGlance(content, calm, now).value;
  const player: Player = { income: calmIncome, tapShare, tapRate };
  const offered = choices(content, calm, now, calmIncome, tapShare, tapRate);
  const pick = crown(content, calm, now, player, offered);
  const lit =
    pick.kind === "purchase" && firstUse(content, base, pick.choice.command) ? pick.choice : null;
  const tapHint = pick.kind === "tap" && tapHintLive(content, base);
  return { base, now, rate, income, player, offered, pick, crown: lit, tapHint };
}

/** Keeps `useAdvisor` current: on every change of the base and every second. */
export function startAdvisor(): () => void {
  const update = () => {
    const state = useWorld.getState();
    const base = settledBase(state);
    if (!base) {
      useAdvisor.setState({ view: null });
      return;
    }
    const now = Math.max(Math.floor(gameSeconds()), base.run.settledAt);
    useAdvisor.setState({ view: computeAdvisor(base, now, wall.nowMs()) });
  };
  update();
  return useWorld.subscribe((state, previous) => {
    if (state.base !== previous.base || state.second !== previous.second) update();
  });
}
