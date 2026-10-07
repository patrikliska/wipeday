import { loadGame } from "@wipe-day/content/load";
import { words } from "@wipe-day/domain/words";
import { describe, expect, it } from "vitest";
import { cardProps } from "../ui/home";
import { layout } from "../ui/theme";
import { baseCard } from "./cards/base";
import { homeFixtures, LONGEST_NAME, NOW } from "./fixtures";
import type { Node } from "./jsx-runtime";
import { RENDER_BUDGET_MS, Renderer } from "./renderer";

const { content, locale } = loadGame();
const lexicon = { content, words: words(locale, content) };
const renderer = new Renderer({ locale });
const fixtures = homeFixtures(content);

function textOf(node: Node | string): string {
  if (typeof node === "string") return node;
  const children = node.props.children;
  const list = Array.isArray(children) ? children : children === undefined ? [] : [children];
  return list.map((child) => textOf(child as Node | string)).join(" ");
}

const props = (state: string) => {
  const found = fixtures.find((candidate) => candidate.state === state);
  if (!found) throw new Error(`no ${state} fixture`);
  return cardProps(lexicon, found.home, NOW);
};

describe("base card", () => {
  it("formats every number through the shared formatter", () => {
    const text = textOf(renderer.tree(baseCard, props("long")));
    expect(text).toContain("1.2M");
    expect(text).not.toMatch(/\d{4,}/);
  });

  it("says what the store is full of at the cap", () => {
    const text = textOf(renderer.tree(baseCard, props("full")));
    expect(text).toContain("Full of Timber");
  });

  it("names the tier, the season day and the season", () => {
    expect(props("busy").subtitle).toBe("Stone · day 6 of season 1");
    expect(props("long").playerName).toBe(LONGEST_NAME);
  });

  it("renders a PNG wider than tall, within budget once warm, and caches it", async () => {
    const full = props("long");
    await renderer.render(baseCard, { ...full, subtitle: "warm-up" });

    const first = await renderer.render(baseCard, full);
    expect(first.width).toBe(layout.cardWidth * layout.renderScale);
    expect(first.height).toBeLessThan(first.width);
    expect(first.cached).toBe(false);
    expect(first.ms).toBeLessThan(RENDER_BUDGET_MS * 2);

    const second = await renderer.render(baseCard, full);
    expect(second.cached).toBe(true);
    expect(second.png).toBe(first.png);
    expect((await renderer.render(baseCard, { ...full, cap: 1 })).cached).toBe(false);
  });
});
