/**
 * The crown on screen (02-the-run.md 11.1; CLAUDE.md 6.3 rule 1): the domain's advisor run over
 * the player's base and pace, recomputed when the base changes and once a second. The drawer,
 * the hint pill and the keyboard's B all read this one pick, so they never disagree.
 */
import {
  type Choice,
  choices,
  crown,
  type Pick,
  type Player,
  sheetPick,
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
  /** Supplies a second with the player's taps: what "in 42s" divides by. */
  income: number;
  player: Player;
  /** Every purchase on offer, scored. */
  offered: Choice[];
  /** The island's crown. */
  pick: Pick;
  /** The expanded drawer's crown: the pick, or the best score (resolution 3.25). */
  sheet: Choice | null;
}

export const useAdvisor = create<{ view: AdvisorView | null }>(() => ({ view: null }));

export function computeAdvisor(base: BaseState, now: number, nowMs: number): AdvisorView {
  const { tapRate, tapShare } = pace(nowMs);
  const rate = shownRate(content, base, now);
  const income = rate + tapRate * tapGlance(content, base, now).value;
  const player: Player = { income, tapShare, tapRate };
  const offered = choices(content, base, now, income, tapShare, tapRate);
  const pick = crown(content, base, now, player, offered);
  return { base, now, rate, income, player, offered, pick, sheet: sheetPick(pick, offered) };
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
