import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sniff } from "../assets/inspect";
import { AssetRegistry } from "../assets/registry";
import { discoverPaths } from "../paths";
import { Locale } from "../ui/locale";
import { demoCard } from "./cards/demo";
import { initials } from "./components";
import { demoFixtures, LONGEST_PLAYER_NAME } from "./fixtures/demo";
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

describe("demo card", () => {
  it("has a stable element tree per fixture", () => {
    for (const fixture of demoFixtures) {
      expect(renderer.tree(demoCard, fixture.props)).toMatchSnapshot(fixture.state);
    }
  });

  it("formats every number through the shared formatter", () => {
    const normal = demoFixtures.find((fixture) => fixture.state === "normal");
    if (!normal) throw new Error("no normal fixture");
    const text = textOf(renderer.tree(demoCard, normal.props));
    expect(text).toContain("12.4k");
    expect(text).toContain("/ 20k");
    expect(text).toContain("+620/h");
    expect(text).toContain("18h 40m left");
    expect(text).not.toContain("12449");
  });

  it("omits the upkeep section for tiers without upkeep", () => {
    const empty = demoFixtures.find((fixture) => fixture.state === "empty");
    if (!empty) throw new Error("no empty fixture");
    expect(textOf(renderer.tree(demoCard, empty.props))).not.toContain(
      locale.t("card.demo.upkeep"),
    );
  });

  it("renders a PNG of the card width, within budget once warm, and caches it", async () => {
    const full = demoFixtures.find((fixture) => fixture.state === "full");
    if (!full) throw new Error("no full fixture");
    await renderer.render(demoCard, { ...full.props, seasonDay: 1 }); // warm-up

    const first = await renderer.render(demoCard, full.props);
    expect(sniff(first.png)).toMatchObject({ kind: "png", width: 800 });
    expect(first.cached).toBe(false);
    expect(first.ms).toBeLessThan(RENDER_BUDGET_MS);

    const second = await renderer.render(demoCard, full.props);
    expect(second.cached).toBe(true);
    expect(second.png).toBe(first.png);

    const changed = await renderer.render(demoCard, { ...full.props, scrap: 1 });
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
