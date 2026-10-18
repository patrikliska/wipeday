/**
 * Welcome back (docs/redesign/02-the-run.md 10.2): no card under an hour away; the gain since
 * the last command; the Night Shift worked against its window, and when the hands stopped.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { applyCommand } from "./commands";
import { rates } from "./effects";
import { settle } from "./settle";
import { type BaseState, newBase } from "./state";
import { welcomeBack } from "./welcome";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;

function manned(): BaseState {
  const base = newBase(content, T0, 3);
  const state: BaseState = {
    ...base,
    run: { ...base.run, lines: { beachcomber: 10 }, hands: ["beachcomber"] },
  };
  return applyCommand(content, state, { type: "ping" }, T0).state;
}

const away = (state: BaseState, seconds: number) => {
  const settled = settle(content, state, T0 + seconds);
  return welcomeBack(content, settled.state, T0 + seconds, settled.events);
};

describe("welcome back", () => {
  it("shows nothing under an hour away", () => {
    expect(away(manned(), 59 * 60)).toBeNull();
  });

  it("counts the gain and a window not used up", () => {
    const state = manned();
    // 90 minutes of a 2 h window (D183).
    const card = away(state, 90 * 60);
    expect(card).toMatchObject({ awaySeconds: 90 * 60, hands: 1, stoppedAt: null });
    expect(card?.nightShift).toMatchObject({ worked: 90 * 60, window: 2 * 3600, full: false });
    expect(card?.gain).toBeGreaterThan(0);
  });

  it("stops at the window's end, and the gain stops with it", () => {
    const state = manned();
    const window = rates(content, state).nightShift;
    const card = away(state, 2 * 86_400 + 3 * 3600);
    expect(card?.nightShift).toEqual({ worked: window, window, full: true });
    expect(card?.stoppedAt).toBe(T0 + window);
    expect(card?.gain).toBeCloseTo(away(state, window + 3600)?.gain ?? 0, 6);
  });

  it("says nobody was on shift without hands, and Collect clears the card", () => {
    const base = newBase(content, T0, 3);
    const card = away(base, 3 * 3600);
    expect(card?.hands).toBe(0);
    const collected = applyCommand(content, base, { type: "collect" }, T0 + 3 * 3600).state;
    expect(welcomeBack(content, collected, T0 + 3 * 3600)).toBeNull();
  });
});
