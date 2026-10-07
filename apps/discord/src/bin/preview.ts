/**
 * `pnpm preview`: everything the bot shows, as PNGs in `preview/discord/` with a contact
 * sheet (`index.html`):
 *
 * - `card__{state}.png` (and `@phone`): the `/base` card for each fixture;
 * - `msg__{state}@phone.png` / `@desktop.png`: the whole message as Discord lays it out,
 *   drawn from the exact payload the bot sends (`preview/mock.tsx`);
 * - DMs, feed posts and season news the same way;
 * - `{name}.txt`: each screen's outline with its lint (CLAUDE.md 6.3).
 *
 * Exits non-zero when a screen fails its lint or a card blows its render budget.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { loadGame } from "@wipe-day/content/load";
import type { FeedItem } from "@wipe-day/domain/feed";
import type { SeasonNews } from "@wipe-day/domain/wire";
import { words } from "@wipe-day/domain/words";
import type { APIMessageTopLevelComponent } from "discord.js";
import { ROOT } from "../config";
import { log } from "../log";
import { MessageMock, type MockInput } from "../preview/mock";
import { baseCard } from "../render/cards/base";
import { homeFixtures, NOTES, NOW } from "../render/fixtures";
import { RENDER_BUDGET_MS, Renderer } from "../render/renderer";
import { cardProps, homeScreen } from "../ui/home";
import { feedMessages, newsMessage, noteScreen } from "../ui/island";
import { lintScreen, outlineScreen, type Screen, toComponents } from "../ui/screen";
import { layout } from "../ui/theme";

const OUT = join(ROOT, "preview", "discord");
mkdirSync(OUT, { recursive: true });

const { content, locale } = loadGame((key) => log.warn("missing locale key", { key }));
const lexicon = { content, words: words(locale, content) };
const renderer = new Renderer({ locale });

interface Shot {
  title: string;
  files: { file: string; caption: string; width: number }[];
  outline?: string;
}
const shots: Shot[] = [];
let clean = true;

/** A message mock as a PNG at 2x, `width` CSS px wide. */
async function mock(file: string, input: Omit<MockInput, "width" | "phone" | "now">) {
  const out: Shot["files"] = [];
  for (const [kind, width] of [
    ["phone", 390],
    ["desktop", 640],
  ] as const) {
    const svg = await renderer.svg(
      { id: "mock", render: MessageMock, width },
      { ...input, now: NOW, width, phone: kind === "phone" },
    );
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: width * 2 },
      font: { loadSystemFonts: false },
    })
      .render()
      .asPng();
    const name = `${file}@${kind}.png`;
    writeFileSync(join(OUT, name), png);
    out.push({ file: name, caption: `${kind}, ${width} px`, width });
  }
  return out;
}

function outline(name: string, screen: Screen): string {
  const problems = lintScreen(screen);
  if (problems.length > 0) clean = false;
  const text = outlineScreen(screen);
  writeFileSync(join(OUT, `${name}.txt`), text);
  console.log(
    `${name.padEnd(26)} ${problems.length === 0 ? "lint ok" : `LINT FAIL: ${problems.join("; ")}`}`,
  );
  return text;
}

// Warm-up: keeps one-off start-up cost out of the timings.
const fixtures = homeFixtures(content);
const first = fixtures[0];
if (first) await renderer.render(baseCard, cardProps(lexicon, first.home, NOW));

for (const fixture of fixtures) {
  const props = cardProps(lexicon, fixture.home, NOW);
  const card = await renderer.render(baseCard, props);
  if (card.ms > RENDER_BUDGET_MS) clean = false;
  const phone = await renderer.render(baseCard, props, layout.mobileWidth);
  writeFileSync(join(OUT, `card__${fixture.state}.png`), card.png);
  writeFileSync(join(OUT, `card__${fixture.state}@phone.png`), phone.png);

  const screen = homeScreen(lexicon, fixture.home, NOW, fixture.last);
  screen.card = { fileName: "base.png", png: card.png };
  const text = outline(`base__${fixture.state}`, screen);
  const files = await mock(`msg__${fixture.state}`, {
    components: [toComponents(screen)] as APIMessageTopLevelComponent[],
    images: {
      "base.png": {
        uri: `data:image/png;base64,${card.png.toString("base64")}`,
        width: card.width,
        height: card.height,
      },
    },
  });
  shots.push({
    title: `/base · ${fixture.state} (card ${card.width}x${card.height}, ${Math.round(card.png.length / 1024)} KB, ${Math.round(card.ms)} ms)`,
    files: [
      ...files,
      { file: `card__${fixture.state}@phone.png`, caption: "card at phone width", width: 400 },
    ],
    outline: text,
  });
}

for (const note of NOTES) {
  const screen = noteScreen(lexicon.words, note);
  const text = outline(`dm__${note.kind}`, screen);
  shots.push({
    title: `DM · ${note.kind}`,
    files: await mock(`dm__${note.kind}`, {
      components: [toComponents(screen)] as APIMessageTopLevelComponent[],
    }),
    outline: text,
  });
}

const report = {
  id: "r3",
  kind: "npc",
  at: NOW - 600,
  outcome: "breached",
  chance: 40,
  defence: 10,
  attack: 20,
  lost: { timber: 420 },
  gained: {},
  foe: null,
  damaged: true,
  revenge: false,
  read: false,
} as const;
const feed: FeedItem[] = [
  {
    id: 101,
    at: NOW - 3 * 3600,
    playerId: 2,
    playerName: "Ana_the*Bold",
    event: {
      type: "mission_back",
      mission: "m3",
      kind: "trip",
      target: "cannery",
      outcome: "success",
      crew: ["wren"],
      gained: {},
      at: NOW - 3 * 3600,
    },
  },
  {
    id: 102,
    at: NOW - 60,
    playerId: 1,
    playerName: "Nia",
    event: { type: "build_done", tier: "stone" },
  },
  {
    id: 103,
    at: NOW - 30,
    playerId: 2,
    playerName: "Ana_the*Bold",
    event: { type: "sold", listing: "l2", good: "planks", amount: 1200, price: 340, at: NOW - 30 },
  },
  { id: 104, at: NOW, playerId: 3, playerName: "Otto", event: { type: "raid_landed", report } },
];
for (const [index, content] of feedMessages(lexicon.words, feed, NOW).entries()) {
  shots.push({
    title: `feed post ${index + 1}`,
    files: await mock(`feed__${index + 1}`, { content }),
    outline: content,
  });
}

const news: SeasonNews[] = [
  {
    kind: "announced",
    season: {
      number: 1,
      startedAt: NOW - 20 * 86400,
      endsAt: NOW + 6 * 86400,
      modifier: null,
      next: "storm_season",
    },
  },
  {
    kind: "ended",
    ended: 1,
    season: { number: 2, startedAt: NOW, endsAt: null, modifier: "storm_season", next: null },
    winners: [
      { category: "wealth", name: "Nia", value: 182_000 },
      { category: "explorer", name: "Ana_the*Bold", value: 9 },
      { category: "signal", name: "Otto", value: 4200 },
    ],
  },
];
for (const item of news) {
  const content = newsMessage(lexicon.words, lexicon.content, item);
  shots.push({
    title: `season news · ${item.kind}`,
    files: await mock(`news__${item.kind}`, { content }),
    outline: content,
  });
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const sections = shots
  .map(
    (shot) =>
      `<section><h2>${escapeHtml(shot.title)}</h2><div class="row">${shot.files
        .map(
          (file) =>
            `<figure><img src="${file.file}" width="${file.width}"><figcaption>${file.caption}</figcaption></figure>`,
        )
        .join("")}${shot.outline ? `<pre>${escapeHtml(shot.outline)}</pre>` : ""}</div></section>`,
  )
  .join("\n");
writeFileSync(
  join(OUT, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Wipe Day bot preview</title>
<style>body{background:#1e1f22;color:#dbdee1;font:14px/1.4 system-ui,sans-serif;margin:24px}
h2{font-size:15px;margin:32px 0 8px}.row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
figure{margin:0}figcaption{font-size:12px;opacity:.7}img{display:block}
pre{background:#2b2d31;padding:12px;border-radius:8px;font-size:12px;max-width:560px;white-space:pre-wrap}</style>
<h1>Wipe Day bot preview</h1>
${sections}`,
);
console.log(`\ncontact sheet: ${join(OUT, "index.html")}`);
if (!clean) process.exitCode = 1;
