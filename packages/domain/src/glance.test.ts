/**
 * The HUD's read-only views (glance.ts) and the crown (advisor.ts, 02-the-run.md 11.1).
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { choices, crown, type Player, sameRow, sheetPick } from "./advisor";
import { fullRate, unitRate } from "./effects";
import { breakdown, hustleAt, shownRate, tapGlance } from "./glance";
import { lineOf } from "./lines";
import { rng } from "./rng";
import { mannedRate } from "./settle";
import { type BaseState, newBase } from "./state";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;

const fresh = (patch: Partial<BaseState["run"]> = {}): BaseState => {
  const base = newBase(content, T0, 5);
  return { ...base, run: { ...base.run, startedAt: T0, ...patch } };
};

const tapping: Player = { income: 10, tapShare: 1, tapRate: 6 };
const idle: Player = { income: 0, tapShare: 0, tapRate: 0 };

describe("the crown (02 11.1)", () => {
  it("crowns the tap hint on a fresh island with nothing affordable", () => {
    expect(crown(content, fresh(), T0, tapping)).toEqual({ kind: "tap" });
  });

  it("crowns the first Beachcomber once it is affordable", () => {
    const pick = crown(content, fresh({ supplies: 6 }), T0, tapping);
    expect(pick.kind === "purchase" && pick.choice.command).toEqual({
      type: "buy_line",
      line: "beachcomber",
      count: 1,
    });
  });

  it("crowns the era before the hand: Timber (1.5k) before Mara (1.8k)", () => {
    const state = fresh({ supplies: 1500, lines: { beachcomber: 12, campfire: 6, garden: 2 } });
    const pick = crown(content, state, T0, tapping);
    expect(pick.kind === "purchase" && pick.rule).toBe("era");
    // Affordable within 30 s at the current income counts too: the button counts down.
    const saving = crown(content, { ...state, run: { ...state.run, supplies: 1200 } }, T0, {
      ...tapping,
      income: 20,
    });
    expect(saving.kind === "purchase" && saving.rule).toBe("era");
    expect(saving.kind === "purchase" && saving.choice.affordable).toBe(false);
  });

  it("crowns the hand of the top-earning unmanned line", () => {
    const state = fresh({
      era: "wood",
      supplies: 5e5,
      lines: { beachcomber: 20, campfire: 10, garden: 5 },
      hands: ["beachcomber"],
    });
    const pick = crown(content, state, T0, tapping);
    expect(pick.kind === "purchase" && pick.rule).toBe("hand");
    const earns = (id: string) => {
      const line = lineOf(content, id);
      if (!line) throw new Error(id);
      return (state.run.lines[id] ?? 0) * unitRate(content, state, line, T0, { online: true });
    };
    const top = earns("campfire") >= earns("garden") ? "campfire" : "garden";
    expect(pick.kind === "purchase" && pick.choice.command).toEqual({
      type: "hire_hand",
      line: top,
    });
  });

  it("never crowns an idle player an unmanned line or a Grip rung", () => {
    // Nothing runs and nobody taps: those purchases add nothing to this player's income.
    const state = fresh({ era: "wood", supplies: 100, lines: { beachcomber: 3 } });
    const pick = crown(content, state, T0, idle);
    const type = pick.kind === "purchase" ? pick.choice.command.type : "tap";
    expect(type).not.toBe("buy_line");
    expect(type).not.toBe("buy_upgrade");
  });

  it("over 2,000 seeded states crowns a purchase in reach, or the hint", () => {
    const random = rng(42);
    const ids = content.lines.map((line) => line.id);
    const eras = ["twig", "wood", "stone", "metal"] as const;
    for (let i = 0; i < 2000; i++) {
      const era = eras[Math.floor(random.next() * eras.length)] ?? "twig";
      const lines: Record<string, number> = {};
      for (const id of ids.slice(0, 3 + Math.floor(random.next() * 9)))
        lines[id] = Math.floor(random.next() * 60);
      const state = fresh({
        era,
        lines,
        supplies: 10 ** (random.next() * 12),
        hands: ids.filter((id) => random.next() < 0.4 && (lines[id] ?? 0) > 0),
      });
      const player: Player = {
        income: 10 ** (random.next() * 9),
        tapShare: random.next(),
        tapRate: random.next() * 8,
      };
      const offered = choices(content, state, T0, player.income, player.tapShare, player.tapRate);
      const pick = crown(content, state, T0, player, offered);
      if (pick.kind === "tap") {
        expect(offered.some((choice) => choice.affordable && choice.gain > 0)).toBe(false);
        continue;
      }
      const within = state.run.supplies + player.income * content.run.advisor.saveSeconds;
      expect(pick.choice.cost).toBeLessThanOrEqual(within);
      if (pick.rule === "payback") expect(pick.choice.affordable).toBe(true);
      // The expanded drawer crowns the same row whenever the pick is a purchase.
      expect(sheetPick(pick, offered)).toBe(pick.choice);
    }
  });

  it("the expanded drawer crowns the best score when the island crowns the hint", () => {
    const state = fresh({ supplies: 2, lines: { beachcomber: 1 } });
    const offered = choices(content, state, T0, 1, 1, 6);
    const pick = crown(content, state, T0, tapping, offered);
    expect(pick.kind).toBe("tap");
    expect(sheetPick(pick, offered)).not.toBeNull();
  });

  it("tells rows apart by what they buy, not how many", () => {
    const one = { type: "buy_line", line: "loom", count: 1 } as const;
    expect(sameRow(one, { type: "buy_line", line: "loom", count: "max" })).toBe(true);
    expect(sameRow({ type: "hire_hand", line: "loom" }, one)).toBe(false);
  });
});

describe("the top bar's /s (02 3.2)", () => {
  it("counts manned lines, and unmanned ones only while a cycle runs", () => {
    const state = fresh({
      lines: { beachcomber: 10, campfire: 4 },
      hands: ["beachcomber"],
      activeAt: T0,
    });
    expect(shownRate(content, state, T0 + 1)).toBe(mannedRate(content, state, T0 + 1));
    const running = { ...state, run: { ...state.run, readyAt: { campfire: T0 + 5 } } };
    const campfire = lineOf(content, "campfire");
    if (!campfire) throw new Error("campfire");
    const unit = unitRate(content, running, campfire, T0 + 1, { online: true });
    expect(shownRate(content, running, T0 + 1)).toBeCloseTo(
      mannedRate(content, running, T0 + 1) + 4 * unit,
      9,
    );
    expect(shownRate(content, running, T0 + 6)).toBe(mannedRate(content, running, T0 + 6));
  });
});

describe("the Multipliers sheet (08 2.16)", () => {
  it("multiplies out to the full rate, over 1,000 seeded states", () => {
    const random = rng(7);
    const ids = content.lines.map((line) => line.id);
    const upgrades = content.upgrades.map((upgrade) => upgrade.id);
    const eras = ["twig", "wood", "stone", "metal", "hqm"] as const;
    for (let i = 0; i < 1000; i++) {
      const lines: Record<string, number> = {};
      for (const id of ids) if (random.next() < 0.6) lines[id] = Math.floor(random.next() * 600);
      const state = fresh({
        era: eras[Math.floor(random.next() * eras.length)] ?? "twig",
        lines,
        roster: Math.floor(random.next() * 4),
        upgrades: upgrades.filter(() => random.next() < 0.2),
        buffs: random.next() < 0.3 ? [{ kind: "rally", until: T0 + 30 }] : [],
      });
      const sheet = breakdown(content, state, T0);
      const product = sheet.steps.reduce((value, step) => value * step.factor, sheet.base);
      const full = fullRate(content, state, T0, { online: true });
      expect(sheet.total).toBe(full);
      if (full > 0) expect(Math.abs(product / full - 1)).toBeLessThan(1e-9);
      expect(sheet.steps.some((step) => step.id === "other")).toBe(false);
    }
  });

  it("names each source: 10 Beachcombers ×2, the Timber era ×2, Rally", () => {
    const state = fresh({
      era: "wood",
      lines: { beachcomber: 10 },
      buffs: [{ kind: "rally", until: T0 + 30 }],
    });
    const sheet = breakdown(content, state, T0);
    const step = (id: string) => sheet.steps.find((row) => row.id === id);
    expect(step("milestones")?.sources).toEqual([{ id: "beachcomber", factor: 2 }]);
    expect(step("eras")?.sources).toEqual([{ id: "wood", factor: 2 }]);
    expect(step("buffs")?.sources[0]).toMatchObject({ id: "rally", until: T0 + 30 });
    expect(sheet.units).toBe(10);
  });

  it("takes a tap apart: Grip's flat part, the share of /s, Hustle", () => {
    const state = fresh({ lines: { beachcomber: 10 }, hustle: { value: 50, at: T0 } });
    const tap = tapGlance(content, state, T0);
    expect(tap.flat).toBeGreaterThan(0);
    expect(tap.hustle).toBeGreaterThan(1);
    expect(hustleAt(content, state, T0 + 3600)).toBe(0);
  });
});
