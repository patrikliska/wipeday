import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Emojis } from "../../assets/emojiSync";
import { loadContent } from "../../content/load";
import { collect, gather, newBase } from "../../domain/base";
import { discoverPaths } from "../../paths";
import { Locale } from "../../ui/locale";
import { advise } from "../advisor";
import { hintFor } from "../hints";
import { cardSafeName } from "../names";
import { lintScreen, toComponents } from "../screen";
import { baseCardProps, baseScreen, seasonDay } from "./base";
import { toolsDoneScreen, toolsScreen } from "./tools";

const paths = discoverPaths();
const locale = Locale.load(join(paths.locale, "en.json"));
const content = loadContent(paths.data, locale);
const ctx = { content, locale, emojis: new Emojis() };
const T0 = 1_700_000_000;
const png = Buffer.from("png");

const fresh = newBase(content, T0);
const gathered = gather(content, fresh, T0);
if (!gathered.ok) throw new Error("gather should be ready");
const later = collect(content, gathered.state, T0 + 3600).state;
const rich = { ...later, stock: { ...later.stock, wood: 900, stone: 700 } };

const build = (
  state: typeof fresh,
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

  it("explains the primary action and retires after two uses", () => {
    expect(hintFor(content, locale, fresh, "gather", {}, T0)).toBe(locale.t("hint.gather"));
    expect(hintFor(content, locale, fresh, "gather", { gather: 2 }, T0)).toBeUndefined();
    expect(hintFor(content, locale, gathered.state, "collect", {}, T0 + 1)).toBeUndefined();
    expect(hintFor(content, locale, gathered.state, "collect", {}, T0 + 600)).toBe(
      locale.t("hint.collect"),
    );
    expect(hintFor(content, locale, rich, "tools", {}, T0)).toContain("Stone Tools");
  });
});

describe("base screen", () => {
  it("passes the lint in every state", () => {
    for (const screen of [
      build(fresh, T0),
      build(gathered.state, T0 + 60, {}, { kind: "gather", gained: {}, bonus: gathered.bonus }),
      build(later, T0 + 3600, {}, { kind: "collect", gained: { wood: 100 } }),
      build(rich, T0 + 3600),
      build(collect(content, fresh, T0 + 30 * 86400).state, T0 + 31 * 86400),
    ]) {
      expect(lintScreen(screen)).toEqual([]);
    }
  });

  it("has exactly one primary that follows the advisor", () => {
    const primaryOf = (screen: ReturnType<typeof build>) =>
      screen.rows
        .flatMap((row) => (row.kind === "buttons" ? row.buttons : []))
        .find((b) => b.style === "primary")?.label;
    expect(primaryOf(build(fresh, T0))).toBe(locale.t("screen.base.gather"));
    expect(primaryOf(build(gathered.state, T0 + 60))).toBe(locale.t("screen.base.collect"));
    expect(primaryOf(build(rich, T0 + 60))).toBe(locale.t("screen.base.tools"));
  });

  it("disables Gather on cooldown with a live countdown in the details", () => {
    const screen = build(gathered.state, T0 + 60);
    const gatherButton = screen.rows
      .flatMap((row) => (row.kind === "buttons" ? row.buttons : []))
      .find((b) => b.label === locale.t("screen.base.gather_locked"));
    expect(gatherButton?.disabled).toBe(true);
    expect(screen.details.some((line) => line.includes(`<t:${T0 + 600}:R>`))).toBe(true);
  });

  it("reports storage full in the status and tone", () => {
    const screen = build(collect(content, fresh, T0 + 30 * 86400).state, T0 + 31 * 86400);
    expect(screen.status).toBe(locale.t("screen.base.status_full"));
    expect(screen.tone).toBe("danger");
  });

  it("carries the owner in every customId", () => {
    const screen = build(fresh, T0);
    for (const row of screen.rows) {
      if (row.kind !== "buttons") continue;
      for (const button of row.buttons) expect(button.customId).toContain(":1:");
    }
  });

  it("has a stable Components V2 tree", () => {
    expect(
      toComponents(
        build(later, T0 + 3600, {}, { kind: "collect", gained: { wood: 120, stone: 80 } }),
      ),
    ).toMatchSnapshot();
  });
});

describe("tools screen", () => {
  it("passes the lint locked, affordable, maxed and done", () => {
    const top = content.tools.at(-1);
    if (!top) throw new Error("no tools");
    const next = content.tools[1];
    if (!next) throw new Error("need two tools");
    for (const screen of [
      toolsScreen(ctx, later),
      toolsScreen(ctx, rich),
      toolsScreen(ctx, { ...fresh, toolId: top.id }),
      toolsDoneScreen(ctx, next, next.cost),
    ]) {
      expect(lintScreen(screen)).toEqual([]);
    }
  });

  it("locks the upgrade with the shortfall in the label", () => {
    const screen = toolsScreen(ctx, later);
    const upgrade = screen.rows.flatMap((row) => (row.kind === "buttons" ? row.buttons : []))[0];
    expect(upgrade?.disabled).toBe(true);
    expect(upgrade?.label).toMatch(/^Upgrade · need /);
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
    expect(seasonDay(T0, T0)).toBe(1);
  });

  it("strips characters the card font cannot draw", () => {
    expect(cardSafeName("🔥Žluťoučký 日本 <b>&", locale)).toBe("Žluťoučký <b>&");
    expect(cardSafeName("日本語", locale)).toBe(locale.t("player.anonymous"));
    expect(cardSafeName("  Kolt500  ", locale)).toBe("Kolt500");
  });
});
