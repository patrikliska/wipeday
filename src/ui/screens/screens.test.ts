import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Emojis } from "../../assets/emojiSync";
import { loadContent } from "../../content/load";
import {
  type BaseState,
  buyFurnace,
  collect,
  craft,
  gather,
  newBase,
  smelt,
  startBuild,
} from "../../domain/base";
import { discoverPaths } from "../../paths";
import { Locale } from "../../ui/locale";
import { advise, revealed } from "../advisor";
import { hintFor } from "../hints";
import { cardSafeName } from "../names";
import { type Button, lintScreen, type Screen, toComponents } from "../screen";
import { baseCardProps, baseScreen, seasonDay } from "./base";
import { buildScreen } from "./build";
import { craftScreen } from "./craft";
import { furnaceScreen } from "./furnace";
import { inventoryScreen } from "./inventory";
import { toolsDoneScreen, toolsScreen } from "./tools";

const paths = discoverPaths();
const locale = Locale.load(join(paths.locale, "en.json"));
const content = loadContent(paths.data, locale);
const ctx = { content, locale, emojis: new Emojis() };
const T0 = 1_700_000_000;
const HOUR = 3600;
const png = Buffer.from("png");

const must = <T extends { ok: boolean }>(result: T): T & { ok: true } => {
  if (!result.ok) throw new Error("fixture should succeed");
  return result as T & { ok: true };
};

const fresh = newBase(content, T0);
const gathered = must(gather(content, fresh, T0));
const later = collect(content, gathered.state, T0 + HOUR).state;
const rich: BaseState = { ...later, stock: { ...later.stock, wood: 900, stone: 700 } };
const woodBase: BaseState = {
  ...later,
  tier: "wood",
  toolId: "stone_tools",
  stock: { wood: 3000, stone: 2500, metal_ore: 640, sulfur_ore: 120 },
};
const withFurnace = must(buyFurnace(content, woodBase)).state;
const withBench = must(craft(content, withFurnace, "workbench_1")).state;
const smelting = must(smelt(content, withBench, T0 + 5 * HOUR, "metal_ore")).state;

const buttonsOf = (screen: Screen): Button[] =>
  screen.rows.flatMap((row) => (row.kind === "buttons" ? row.buttons : []));
const primaryOf = (screen: Screen) => buttonsOf(screen).find((b) => b.style === "primary")?.label;

const build = (
  state: BaseState,
  now: number,
  hintUses = {},
  last?: Parameters<typeof baseScreen>[1]["last"],
) =>
  baseScreen(ctx, {
    ownerId: "1",
    playerName: "Soboj",
    state,
    seasonStartedAt: T0,
    now,
    hintUses,
    card: png,
    ...(last ? { last } : {}),
  });

describe("advisor and hints", () => {
  it("guides: gather first, then collect while on cooldown, then tools once affordable", () => {
    expect(advise(content, fresh, T0)).toBe("gather");
    expect(advise(content, gathered.state, T0 + 60)).toBe("collect");
    expect(advise(content, rich, T0 + 60)).toBe("tools");
    const stuffed = collect(content, rich, T0 + 30 * 86400).state;
    expect(advise(content, stuffed, T0 + 31 * 86400)).toBe("collect");
  });

  it("prefers a base upgrade over a tool, and the furnace when ore waits", () => {
    // Stone tier costs more stone than a wood base holds: boxes make room first.
    const canBuild: BaseState = {
      ...woodBase,
      items: { wood_box: 4 },
      stock: { wood: 3000, stone: 7000, metal_ore: 640, metal_fragments: 1000 },
    };
    expect(advise(content, canBuild, T0 + 60)).toBe("build");
    expect(advise(content, withFurnace, T0 + 60)).toBe("furnace");
    expect(advise(content, smelting, T0 + 12 * HOUR)).toBe("furnace");
  });

  it("reveals furnace, craft and inventory as they become relevant", () => {
    expect(revealed(content, fresh)).toEqual({ furnace: false, craft: false, inventory: false });
    expect(revealed(content, withBench)).toEqual({ furnace: true, craft: true, inventory: true });
  });

  it("explains the primary action and retires after two uses", () => {
    expect(hintFor(content, locale, fresh, "gather", {}, T0)).toBe(locale.t("hint.gather"));
    expect(hintFor(content, locale, fresh, "gather", { gather: 2 }, T0)).toBeUndefined();
    expect(hintFor(content, locale, gathered.state, "collect", {}, T0 + 1)).toBeUndefined();
    expect(hintFor(content, locale, gathered.state, "collect", {}, T0 + 600)).toBe(
      locale.t("hint.collect"),
    );
    expect(hintFor(content, locale, rich, "tools", {}, T0)).toContain("Stone Tools");
    expect(hintFor(content, locale, later, "build", {}, T0)).toContain("Wood base");
  });
});

describe("base screen", () => {
  it("passes the lint in every state", () => {
    const building = must(
      startBuild(
        content,
        { ...smelting, stock: { ...smelting.stock, stone: 9000, metal_fragments: 1200 } },
        T0,
      ),
    ).state;
    const decaying: BaseState = {
      ...withBench,
      tier: "stone",
      stock: { ...withBench.stock, wood: 0, stone: 0 },
      upkeepPaidUntil: T0 - 20 * HOUR,
    };
    for (const screen of [
      build(fresh, T0),
      build(gathered.state, T0 + 60, {}, { kind: "gather", gained: {}, bonus: gathered.bonus }),
      build(later, T0 + HOUR, {}, { kind: "collect", gained: { wood: 100 } }),
      build(rich, T0 + HOUR),
      build(smelting, T0 + 6 * HOUR),
      build(
        building,
        T0 + HOUR,
        {},
        { kind: "build_started", tier: "stone", endsAt: T0 + 5 * HOUR },
      ),
      build(decaying, T0),
      build(collect(content, fresh, T0 + 30 * 86400).state, T0 + 31 * 86400),
    ]) {
      expect(lintScreen(screen)).toEqual([]);
    }
  });

  it("has exactly one primary that follows the advisor", () => {
    expect(primaryOf(build(fresh, T0))).toBe(locale.t("screen.base.gather"));
    expect(primaryOf(build(gathered.state, T0 + 60))).toBe(locale.t("screen.base.collect"));
    expect(primaryOf(build(rich, T0 + 60))).toBe(locale.t("screen.base.tools"));
    expect(primaryOf(build(withFurnace, T0 + 60))).toBe(locale.t("screen.base.furnace"));
  });

  it("shows a second row only once mechanics are revealed", () => {
    expect(build(fresh, T0).rows).toHaveLength(1);
    expect(build(withBench, T0).rows).toHaveLength(2);
  });

  it("disables Gather on cooldown with a live countdown in the details", () => {
    const screen = build(gathered.state, T0 + 60);
    const gatherButton = buttonsOf(screen).find(
      (b) => b.label === locale.t("screen.base.gather_locked"),
    );
    expect(gatherButton?.disabled).toBe(true);
    expect(screen.details.some((line) => line.includes(`<t:${T0 + 600}:R>`))).toBe(true);
  });

  it("reports the binding resource when storage is full, in the danger tone", () => {
    const screen = build(collect(content, fresh, T0 + 30 * 86400).state, T0 + 31 * 86400);
    expect(screen.status).toBe(locale.t("screen.base.status_full", { resource: "Wood" }));
    expect(screen.tone).toBe("danger");
  });

  it("shows the build countdown as the status and decay as a danger line", () => {
    const building = must(
      startBuild(
        content,
        { ...smelting, stock: { ...smelting.stock, stone: 9000, metal_fragments: 1200 } },
        T0,
      ),
    ).state;
    expect(build(building, T0 + 60).status).toContain(`<t:${T0 + 240 * 60}:R>`);
    const decaying: BaseState = {
      ...withBench,
      tier: "stone",
      stock: { ...withBench.stock, wood: 0, stone: 0 },
      upkeepPaidUntil: T0 - 20 * HOUR,
    };
    const screen = build(decaying, T0);
    expect(screen.tone).toBe("danger");
    expect(screen.details.some((line) => line.includes("DECAYING"))).toBe(true);
  });

  it("carries the owner in every customId", () => {
    for (const button of buttonsOf(build(withBench, T0))) expect(button.customId).toContain(":1:");
  });

  it("has a stable Components V2 tree", () => {
    expect(
      toComponents(
        build(later, T0 + HOUR, {}, { kind: "collect", gained: { wood: 120, stone: 80 } }),
      ),
    ).toMatchSnapshot();
  });
});

describe("sub-screens", () => {
  it("tools: lint passes locked, affordable, maxed and done", () => {
    const top = content.tools.at(-1);
    const next = content.tools[1];
    if (!top || !next) throw new Error("need tools");
    for (const screen of [
      toolsScreen(ctx, later),
      toolsScreen(ctx, rich),
      toolsScreen(ctx, { ...fresh, toolId: top.id }),
      toolsDoneScreen(ctx, next, next.cost),
    ]) {
      expect(lintScreen(screen)).toEqual([]);
    }
    const upgrade = buttonsOf(toolsScreen(ctx, later))[0];
    expect(upgrade?.disabled).toBe(true);
    expect(upgrade?.label).toMatch(/^Upgrade · need /);
  });

  it("build: lint passes locked, affordable, building, maxed and done", () => {
    const building = must(
      startBuild(
        content,
        { ...smelting, stock: { ...smelting.stock, stone: 9000, metal_fragments: 1200 } },
        T0,
      ),
    );
    for (const screen of [
      buildScreen(ctx, later),
      buildScreen(ctx, { ...later, stock: { wood: 2000, stone: 800 } }),
      buildScreen(ctx, building.state),
      buildScreen(ctx, { ...later, tier: "hqm" }),
      buildScreen(ctx, building.state, {
        kind: "started",
        tier: "stone",
        endsAt: building.endsAt,
        paid: building.paid,
      }),
    ]) {
      expect(lintScreen(screen)).toEqual([]);
    }
    expect(primaryOf(buildScreen(ctx, { ...later, stock: { wood: 2000, stone: 800 } }))).toBe(
      "Build",
    );
    expect(buttonsOf(buildScreen(ctx, later))[0]?.label).toMatch(/^Build · need /);
  });

  it("furnace: lint passes none, idle, running and ready; select lists smeltable ores", () => {
    for (const screen of [
      furnaceScreen(ctx, woodBase, T0),
      furnaceScreen(ctx, withBench, T0 + 5 * HOUR),
      furnaceScreen(ctx, smelting, T0 + 5 * HOUR + 60),
      furnaceScreen(ctx, smelting, T0 + 12 * HOUR),
    ]) {
      expect(lintScreen(screen)).toEqual([]);
    }
    const idle = furnaceScreen(ctx, withBench, T0 + 5 * HOUR);
    const select = idle.rows.find((row) => row.kind === "select");
    expect(select?.kind === "select" && select.select.options.map((o) => o.value)).toEqual([
      "metal_ore",
      "sulfur_ore",
    ]);
    expect(primaryOf(furnaceScreen(ctx, smelting, T0 + 12 * HOUR))).toBe(
      locale.t("screen.furnace.collect"),
    );
  });

  it("craft: lint passes with and without a workbench; affordable recipes come first", () => {
    for (const screen of [
      craftScreen(ctx, withFurnace),
      craftScreen(ctx, withBench),
      craftScreen(ctx, withBench, { itemId: "wood_box", paid: { wood: 300 } }),
    ]) {
      expect(lintScreen(screen)).toEqual([]);
    }
    const list = craftScreen(ctx, withBench);
    const select = list.rows.find((row) => row.kind === "select");
    const labels = select?.kind === "select" ? select.select.options.map((o) => o.label) : [];
    expect(labels[0]).not.toMatch(/^🔒/);
    expect(labels.some((label) => label.startsWith("🔒"))).toBe(true);
    expect(primaryOf(craftScreen(ctx, withBench, { itemId: "wood_box", paid: {} }))).toBe(
      locale.t("screen.craft.again"),
    );
  });

  it("inventory: lint passes empty and stocked", () => {
    expect(lintScreen(inventoryScreen(ctx, withFurnace, png))).toEqual([]);
    expect(lintScreen(inventoryScreen(ctx, withBench, png))).toEqual([]);
    expect(primaryOf(inventoryScreen(ctx, withBench, png))).toBe(
      locale.t("screen.inventory.craft"),
    );
  });
});

describe("card view model", () => {
  it("lists only discovered resources, scrap in the header, season day from the start", () => {
    const props = baseCardProps(
      ctx,
      "Soboj",
      { ...rich, stock: { ...rich.stock, scrap: 12 } },
      T0,
      T0 + 3 * 86400 + 5,
    );
    expect(props.resources.map((cell) => cell.id)).toEqual(["wood", "stone"]);
    expect(props.scrap).toBe(12);
    expect(props.seasonDay).toBe(4);
    expect(props.storage.resource).toBe("wood");
    expect(seasonDay(T0, T0)).toBe(1);
  });

  it("strips characters the card font cannot draw", () => {
    expect(cardSafeName("🔥Žluťoučký 日本 <b>&", locale)).toBe("Žluťoučký <b>&");
    expect(cardSafeName("日本語", locale)).toBe(locale.t("player.anonymous"));
    expect(cardSafeName("  Kolt500  ", locale)).toBe("Kolt500");
  });
});
