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
import { collect, gather, newBase, upgradeTool } from "../domain/base";
import { discoverPaths } from "../paths";
import { baseCard } from "../render/cards/base";
import { baseFixtures, LONGEST_PLAYER_NAME } from "../render/fixtures/base";
import { type CardDef, RENDER_BUDGET_MS, type Rendered, Renderer } from "../render/renderer";
import { DEBUG_STATES } from "../ui/customId";
import { Locale } from "../ui/locale";
import { lintScreen, outlineScreen, type Screen } from "../ui/screen";
import { baseScreen } from "../ui/screens/base";
import { debugCardScreen } from "../ui/screens/debugCard";
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
<div class="pair"><figure class="dark"><img src="${shot.full}" width="${shot.rendered.width}"><figcaption>desktop, dark</figcaption></figure>
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
const png = shots.find((shot) => shot.name === "base__normal")?.rendered.png;
if (!png) throw new Error("no normal fixture for the base card");

const fresh = newBase(content, T0);
const firstGather = gather(content, fresh, T0);
if (!firstGather.ok) throw new Error("fixture: gather should be ready");
const active = collect(content, firstGather.state, T0 + 3 * 3600).state;
const rich = { ...active, stock: { ...active.stock, wood: 900, stone: 700 } };
const upgraded = upgradeTool(content, rich, T0 + 4 * 3600);
if (!upgraded.ok) throw new Error("fixture: upgrade should be affordable");
const maxedTool = content.tools.at(-1);
if (!maxedTool) throw new Error("no tools");
const maxed = { ...fresh, toolId: maxedTool.id };
const stuffed = collect(content, fresh, T0 + 30 * 86400).state;

const base = (playerName: string, state: typeof fresh, now: number, extra = {}) =>
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
    base("Soboj", active, T0 + 3 * 3600 + 60, {
      last: { kind: "collect", gained: { wood: 360, stone: 240 } },
    }),
  ],
  ["base__affordable", base("Soboj", rich, T0 + 4 * 3600, { hintUses: { gather: 2, collect: 2 } })],
  ["base__full", base(LONGEST_PLAYER_NAME, stuffed, T0 + 31 * 86400)],
  ["tools__locked", toolsScreen(ctx, firstGather.state)],
  ["tools__normal", toolsScreen(ctx, rich)],
  ["tools__maxed", toolsScreen(ctx, maxed)],
  ["tools_done__normal", toolsDoneScreen(ctx, upgraded.tool, upgraded.paid)],
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
