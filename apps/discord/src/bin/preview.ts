/**
 * `pnpm preview`: everything the bot shows, as PNGs in `preview/discord/` with a contact
 * sheet (`index.html`):
 *
 * - `msg__{state}@phone.png` / `@desktop.png`: the `/base` message as Discord lays it out,
 *   drawn from the exact payload the bot sends (`preview/mock.tsx`); no card until R2;
 * - DMs and feed posts the same way;
 * - `{name}.txt`: each screen's outline with its lint (CLAUDE.md 6.3).
 *
 * Exits non-zero when a screen fails its lint.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { loadGame } from "@wipe-day/content/load";
import type { FeedItem } from "@wipe-day/domain/feed";
import { words } from "@wipe-day/domain/words";
import type { APIMessageTopLevelComponent } from "discord.js";
import { ROOT } from "../config";
import { log } from "../log";
import { MessageMock, type MockInput } from "../preview/mock";
import { homeFixtures, NOTES, NOW } from "../render/fixtures";
import { Renderer } from "../render/renderer";
import { homeScreen } from "../ui/home";
import { feedMessages, noteScreen } from "../ui/island";
import { lintScreen, outlineScreen, type Screen, toComponents } from "../ui/screen";

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

for (const fixture of homeFixtures(content)) {
  const screen = homeScreen(lexicon, fixture.home, fixture.last);
  const text = outline(`base__${fixture.state}`, screen);
  shots.push({
    title: `/base · ${fixture.state}`,
    files: await mock(`msg__${fixture.state}`, {
      components: [toComponents(screen)] as APIMessageTopLevelComponent[],
    }),
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

// The feed has no event types until R2's Wipe Days: nothing to draw yet.
const feed: FeedItem[] = [];
for (const [index, content] of feedMessages(lexicon.words, feed, NOW).entries()) {
  shots.push({
    title: `feed post ${index + 1}`,
    files: await mock(`feed__${index + 1}`, { content }),
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
