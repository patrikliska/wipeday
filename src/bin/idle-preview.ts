/**
 * `pnpm preview`
 *
 * Renders every card with its fixtures into `preview/`: `{card}__{state}.png`,
 * the same at phone width as `...@mobile.png`, a no-assets variant for
 * placeholder safety, `screens/{screen}__{state}.txt` outlines of the
 * component screens, and `index.html`, a contact sheet on Discord's dark and
 * light backgrounds.
 *
 * Exits non-zero when a screen fails its lint or a render blows the budget.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Emojis } from "../assets/emojiSync";
import { AssetRegistry } from "../assets/registry";
import { loadContent } from "../content/load";
import {
  type BaseState,
  buyFurnace,
  collect,
  craft,
  gather,
  newBase,
  settle,
  smelt,
  startBuild,
  upgradeTool,
} from "../domain/base";
import { discoverPaths } from "../paths";
import { baseCard } from "../render/cards/base";
import { inventoryCard } from "../render/cards/inventory";
import { baseFixtures, LONGEST_PLAYER_NAME } from "../render/fixtures/base";
import { inventoryFixtures } from "../render/fixtures/inventory";
import { type CardDef, RENDER_BUDGET_MS, type Rendered, Renderer } from "../render/renderer";
import { DEBUG_STATES } from "../ui/customId";
import { Locale } from "../ui/locale";
import { lintScreen, outlineScreen, type Screen } from "../ui/screen";
import { baseScreen } from "../ui/screens/base";
import { buildScreen } from "../ui/screens/build";
import { craftScreen } from "../ui/screens/craft";
import { debugCardScreen } from "../ui/screens/debugCard";
import { furnaceScreen } from "../ui/screens/furnace";
import { inventoryScreen } from "../ui/screens/inventory";
import { toolsDoneScreen, toolsScreen } from "../ui/screens/tools";
import { layout } from "../ui/theme";

interface Shot {
  name: string;
  full: string;
  mobile: string;
  rendered: Rendered;
}

const paths = discoverPaths();
const locale = Locale.load(join(paths.locale, "en.json"));
const content = loadContent(paths.data, locale);
const assets = AssetRegistry.load(paths.assets);
const renderer = new Renderer({ assets, locale });
// Same cards with nothing supplied: what a fresh deployment looks like.
const bare = new Renderer({ assets: AssetRegistry.bare(paths.assets), locale });
const ctx = { content, locale, emojis: new Emojis() };

mkdirSync(join(paths.preview, "screens"), { recursive: true });

async function shoot<Props>(
  using: Renderer,
  card: CardDef<Props>,
  state: string,
  props: Props,
): Promise<Shot> {
  const name = `${card.id}__${state}`;
  const rendered = await using.render(card, props);
  const mobile = await using.render(card, props, layout.mobileWidth);
  writeFileSync(join(paths.preview, `${name}.png`), rendered.png);
  writeFileSync(join(paths.preview, `${name}@mobile.png`), mobile.png);
  return { name, full: `${name}.png`, mobile: `${name}@mobile.png`, rendered };
}

function contactSheet(shots: Shot[]): string {
  const sections = shots
    .map(
      (
        shot,
      ) => `<section><h2>${shot.name} <small>${shot.rendered.width}x${shot.rendered.height} · ${Math.round(shot.rendered.png.length / 1024)} KB · ${Math.round(shot.rendered.ms)} ms</small></h2>
<div class="pair"><figure class="dark"><img src="${shot.full}" width="${shot.rendered.width / layout.renderScale}"><figcaption>desktop, dark (shown at 1x)</figcaption></figure>
<figure class="dark"><img src="${shot.mobile}"><figcaption>phone (${layout.mobileWidth} px)</figcaption></figure>
<figure class="light"><img src="${shot.mobile}"><figcaption>phone, light theme</figcaption></figure></div></section>`,
    )
    .join("\n");
  return `<!doctype html><meta charset="utf-8"><title>Wipe Day card preview</title>
<style>
body{background:#313338;color:#dbdee1;font:15px/1.4 system-ui,sans-serif;margin:24px}
h1{font-size:20px} h2{font-size:15px;font-weight:600;margin:32px 0 8px} small{color:#949ba4;font-weight:400}
.pair{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
figure{margin:0;padding:16px;border-radius:8px} figure.dark{background:#313338;outline:1px solid #3f4147}
figure.light{background:#fff;color:#313338} figcaption{font-size:12px;opacity:.7;margin-top:6px}
img{display:block;border-radius:8px;max-width:100%}
</style>
<h1>Wipe Day card preview</h1>
${sections}
`;
}

let clean = true;
const shots: Shot[] = [];

// Throwaway render: keeps one-off start-up cost out of the reported timings.
const warm = baseFixtures[0];
if (warm) await new Renderer({ assets, locale }).render(baseCard, warm.props);

for (const fixture of baseFixtures) {
  shots.push(await shoot(renderer, baseCard, fixture.state, fixture.props));
  if (fixture.state === "normal") {
    shots.push(await shoot(bare, baseCard, "noassets", fixture.props));
  }
}
for (const fixture of inventoryFixtures) {
  shots.push(await shoot(renderer, inventoryCard, fixture.state, fixture.props));
}

console.log(`${"card".padEnd(24)} ${"size".padStart(9)} ${"KB".padStart(6)} ${"ms".padStart(6)}`);
for (const shot of shots) {
  const over = shot.rendered.ms > RENDER_BUDGET_MS;
  if (over) clean = false;
  console.log(
    `${shot.name.padEnd(24)} ${`${shot.rendered.width}x${shot.rendered.height}`.padStart(9)} ` +
      `${String(Math.round(shot.rendered.png.length / 1024)).padStart(6)} ` +
      `${String(Math.round(shot.rendered.ms)).padStart(6)}${over ? "  OVER BUDGET" : ""}`,
  );
}

// --- component screens ------------------------------------------------------

const T0 = 1_700_000_000;
const HOUR = 3600;
const png = shots.find((shot) => shot.name === "base__normal")?.rendered.png;
const inventoryPng = shots.find((shot) => shot.name === "inventory__normal")?.rendered.png;
if (!png || !inventoryPng) throw new Error("missing normal fixtures");

const must = <T extends { ok: boolean }>(result: T, what: string): T & { ok: true } => {
  if (!result.ok) throw new Error(`fixture: ${what} should succeed`);
  return result as T & { ok: true };
};

const fresh = newBase(content, T0);
const firstGather = must(gather(content, fresh, T0), "gather").state;
const active = collect(content, firstGather, T0 + 3 * HOUR).state;
const rich: BaseState = { ...active, stock: { ...active.stock, wood: 900, stone: 700 } };
const upgraded = must(upgradeTool(content, rich, T0 + 4 * HOUR), "upgrade");
const maxedTool = content.tools.at(-1);
if (!maxedTool) throw new Error("no tools");
const maxed: BaseState = { ...fresh, toolId: maxedTool.id };
const stuffed = collect(content, fresh, T0 + 30 * 86400).state;

// A wood-tier base with ore, a furnace, a workbench and a running job.
const woodBase: BaseState = settle(
  content,
  {
    ...upgraded.state,
    tier: "wood",
    upkeepPaidUntil: T0 + 4 * HOUR,
    stock: { ...upgraded.state.stock, wood: 3000, stone: 2500, metal_ore: 640, sulfur_ore: 120 },
  },
  T0 + 4 * HOUR,
).state;
const withFurnace = must(buyFurnace(content, woodBase), "buy furnace").state;
const withBench = must(craft(content, withFurnace, "workbench_1"), "craft bench").state;
const smelting = settle(
  content,
  must(smelt(content, withBench, T0 + 5 * HOUR, "metal_ore"), "smelt").state,
  T0 + 5 * HOUR,
).state;
const building = must(
  startBuild(
    content,
    settle(
      content,
      {
        ...smelting,
        items: { ...smelting.items, wood_box: 4 },
        stock: { ...smelting.stock, stone: 8000, metal_fragments: 1200 },
      },
      T0 + 6 * HOUR,
    ).state,
    T0 + 6 * HOUR,
  ),
  "build",
);
const decaying: BaseState = {
  ...withBench,
  tier: "stone",
  stock: { ...withBench.stock, wood: 0, stone: 0 },
  upkeepPaidUntil: T0 - 20 * HOUR,
};

const base = (playerName: string, state: BaseState, now: number, extra = {}) =>
  baseScreen(ctx, {
    ownerId: "1",
    playerName,
    state,
    seasonStartedAt: T0,
    now,
    hintUses: {},
    card: png,
    ...extra,
  });

const screens: Array<[string, Screen]> = [
  ["base__empty", base("Nakeds", fresh, T0)],
  [
    "base__normal",
    base("Soboj", active, T0 + 3 * HOUR + 60, {
      last: { kind: "collect", gained: { wood: 360, stone: 240 } },
    }),
  ],
  ["base__affordable", base("Soboj", rich, T0 + 4 * HOUR, { hintUses: { gather: 2, collect: 2 } })],
  ["base__furnace", base("Soboj", smelting, T0 + 5 * HOUR + 60)],
  [
    "base__building",
    base("Soboj", building.state, T0 + 6 * HOUR + 60, {
      last: { kind: "build_started", tier: "stone", endsAt: building.endsAt },
    }),
  ],
  ["base__decaying", base("Soboj", decaying, T0 + 6 * HOUR)],
  ["base__full", base(LONGEST_PLAYER_NAME, stuffed, T0 + 31 * 86400)],
  ["tools__locked", toolsScreen(ctx, firstGather)],
  ["tools__normal", toolsScreen(ctx, rich)],
  ["tools__maxed", toolsScreen(ctx, maxed)],
  ["tools_done__normal", toolsDoneScreen(ctx, upgraded.tool, upgraded.paid)],
  ["build__locked", buildScreen(ctx, active)],
  ["build__normal", buildScreen(ctx, { ...active, stock: { wood: 2000, stone: 800 } })],
  ["build__building", buildScreen(ctx, building.state)],
  ["build__maxed", buildScreen(ctx, { ...active, tier: "hqm" })],
  [
    "build__done",
    buildScreen(ctx, building.state, {
      kind: "started",
      tier: "stone",
      endsAt: building.endsAt,
      paid: building.paid,
    }),
  ],
  ["furnace__none", furnaceScreen(ctx, woodBase, T0 + 4 * HOUR)],
  ["furnace__idle", furnaceScreen(ctx, withBench, T0 + 5 * HOUR)],
  ["furnace__running", furnaceScreen(ctx, smelting, T0 + 5 * HOUR + 60)],
  ["furnace__ready", furnaceScreen(ctx, smelting, T0 + 12 * HOUR)],
  ["craft__none", craftScreen(ctx, withFurnace)],
  ["craft__normal", craftScreen(ctx, withBench)],
  [
    "craft__done",
    craftScreen(ctx, must(craft(content, withBench, "wood_box"), "craft box").state, {
      itemId: "wood_box",
      paid: { wood: 300 },
    }),
  ],
  ["inventory__empty", inventoryScreen(ctx, withFurnace, inventoryPng)],
  ["inventory__normal", inventoryScreen(ctx, withBench, inventoryPng)],
  ...DEBUG_STATES.map((state): [string, Screen] => {
    const rendered = shots.find((shot) => shot.name === `base__${state}`)?.rendered;
    if (!rendered) throw new Error(`no ${state} render`);
    return [
      `debug_card__${state}`,
      debugCardScreen(locale, { state, rendered, assets: assets.counts() }),
    ];
  }),
];

for (const [name, screen] of screens) {
  const problems = lintScreen(screen);
  if (problems.length > 0) clean = false;
  writeFileSync(join(paths.preview, "screens", `${name}.txt`), outlineScreen(screen));
  console.log(
    `screens/${`${name}.txt`.padEnd(28)} ${problems.length === 0 ? "lint ok" : `LINT FAIL: ${problems.join("; ")}`}`,
  );
}

writeFileSync(join(paths.preview, "index.html"), contactSheet(shots));
console.log(`\ncontact sheet: ${join(paths.preview, "index.html")}`);
if (!clean) process.exitCode = 1;
