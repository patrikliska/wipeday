import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sniff } from "../assets/inspect";
import { AssetRegistry } from "../assets/registry";
import { discoverPaths } from "../paths";
import { Locale } from "../ui/locale";
import { baseCard } from "./cards/base";
import { initials } from "./components";
import { baseFixtures, LONGEST_PLAYER_NAME } from "./fixtures/base";
import type { Node } from "./jsx-runtime";
import { RENDER_BUDGET_MS, Renderer } from "./renderer";

const paths = discoverPaths();
const locale = Locale.load(join(paths.locale, "en.json"));
// `bare`: snapshots must not depend on which pictures the owner has dropped in.
const renderer = new Renderer({ assets: AssetRegistry.bare(paths.assets), locale });

function textOf(node: Node | string): string {
  if (typeof node === "string") return node;
  const children = node.props.children;
  const list = Array.isArray(children) ? children : children === undefined ? [] : [children];
  return list.map((child) => textOf(child as Node | string)).join(" ");
}

const fixture = (state: string) => {
  const found = baseFixtures.find((candidate) => candidate.state === state);
  if (!found) throw new Error(`no ${state} fixture`);
  return found;
};

describe("base card", () => {
  it("has a stable element tree per fixture", () => {
    for (const { state, props } of baseFixtures) {
      expect(renderer.tree(baseCard, props)).toMatchSnapshot(state);
    }
  });

  it("formats every number through the shared formatter", () => {
    const text = textOf(renderer.tree(baseCard, fixture("normal").props));
    expect(text).toContain("1.6k");
    expect(text).toContain("/ 2.5k");
    expect(text).toContain("964");
    expect(text).not.toContain("1642");
  });

  it("shows FULL instead of numbers at the cap", () => {
    const text = textOf(renderer.tree(baseCard, fixture("full").props));
    expect(text).toContain(locale.t("card.base.storage_full"));
  });

  it("renders a PNG wider than tall, within budget once warm, and caches it", async () => {
    const full = fixture("full").props;
    await renderer.render(baseCard, { ...full, seasonDay: 1 }); // warm-up

    const first = await renderer.render(baseCard, full);
    const size = sniff(first.png);
    expect(size).toMatchObject({ kind: "png", width: 1600 });
    if (size.kind !== "png") throw new Error("not a png");
    expect(size.height).toBeLessThanOrEqual(1200);
    expect(first.cached).toBe(false);
    expect(first.ms).toBeLessThan(RENDER_BUDGET_MS);

    const second = await renderer.render(baseCard, full);
    expect(second.cached).toBe(true);
    expect(second.png).toBe(first.png);

    const changed = await renderer.render(baseCard, { ...full, scrap: 1 });
    expect(changed.cached).toBe(false);
  });
});

it("fixtures include Discord's longest possible name", () => {
  expect([...LONGEST_PLAYER_NAME]).toHaveLength(32);
});

it("placeholder initials come from the id", () => {
  expect(initials("sulfur_ore")).toBe("SO");
  expect(initials("wood")).toBe("WO");
  expect(initials("ak47")).toBe("AK");
  expect(initials("low_grade_fuel")).toBe("LG");
});
