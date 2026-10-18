# The art pipeline, as learned on 2026-10-18

What we know about generating Wipe Day's pixel art, written down so any computer (and any
session) can continue. The decisions behind it: D188 (chunky pixel, the grid), D189 (Retro
Diffusion first, OpenAI as backup, Gemini dropped), D190 (the pipeline's shape after the scene
mock). The plan: `12-feel.md` 2.1 and 2.2. These scripts are the seed of `pnpm art` (R2 Feel);
until then they run from here.

## 1. Setup on a new computer

1. `.env` at the repo root (gitignored, copy it by hand, never through git):
   `RETRO_DIFFUSION_API_KEY=rdpk-…` (the key page is https://www.retrodiffusion.ai/app/devtools).
   `OPENAI_API_KEY` only when the parallax layers come up.
2. Python 3 with Pillow (`pip install pillow`) for `prep.py` and `sheet.py`; Node 24 for the
   `.mjs` scripts (no dependencies).
3. Optional, for driving Retro Diffusion from Claude Code directly: register its hosted MCP
   server once per machine, reading the key from `.env` so it is never typed into a transcript:

   ```sh
   K=$(grep '^RETRO_DIFFUSION_API_KEY=' .env | cut -d= -f2)
   claude mcp add --transport http retro-diffusion https://mcp.retrodiffusion.ai/mcp --header "Authorization: Bearer $K"
   ```

   The REST scripts below do not need the MCP server; it is for ad-hoc generation in a session.

## 2. The API in one paragraph

Base `https://api.retrodiffusion.ai`, header `X-RD-Token: <key>`. `GET /v2/inferences/credits`
returns `{credits, balance}` (balance in USD). `POST /v2/inferences` with
`{prompt, prompt_style, width, height, num_images, remove_bg, tile_x, seed, input_image,
frames_duration, return_spritesheet, check_cost}` is **asynchronous**: it answers
`{status:"accepted", task_id}` and the result comes from `GET /v2/inferences/tasks/<id>` (or the
list `GET /v2/inferences/tasks?limit=50`), whose `result.base64_images` holds the PNGs and
`result.balance_cost` the price. `check_cost:true` returns the price without generating, free.
`GET /v2/styles/selector` lists every style with its size limits. Pictures with the wrong size
for a style fail with `invalid_style_dimensions` and cost nothing.

## 3. Which style for what (measured prices)

| Need | Style | Size limits | Price | Verdict from the mock |
| --- | --- | --- | --- | --- |
| Sprites, props, targets, hands, busts | `rd_pro__platformer` | 12-256 px | 0.18 USD per image, any size | The one. Strict side view, clean alpha, one grid, first try. |
| Small props (≤ 40 px) | `rd_plus__low_res` | 16-128 px | 0.06 | Fine for barrels, rocks, crates. The flotsam crate came back as a sack. |
| Quick drafts | `rd_fast__default` | 64-384 px | 0.03 | The 64 px workbench smoke test. Leans fantasy, three-quarter view. |
| Idle / walk cycles from an existing sprite | `rd_advanced_animation__idle`, `__walking` | 32-256 px, `input_image` required | 0.14 per animation (8 frames) | See section 5. |
| Subtle motion (lamp sway, water) | `rd_advanced_animation__subtle_motion` | 32-256 px, input required | 0.25 | Not tried yet. |
| Tiles | `rd_tile__single_tile`, `rd_tile__tileset` | 16-64 / 16-32 px | not measured | The route for ground, water and sky pieces. |
| Wide landscapes | `rd_plus__environment` | 64-512 px | 0.06 | **Paints whole postcards and ignores "no sky, no ground".** Usable only by cropping. Not the route for bands. |

Every prompt: describe the subject only, richly; say "strict side view"; end with "on a plain
white background" and set `remove_bg:true` for anything standalone; never write "pixel art".
Two takes (`num_images:2`) of the important sprites, one of the rest. The same seed with the same
prompt gives near-identical takes, so vary the seed, not only the count.

## 4. The scripts

| Script | Does |
| --- | --- |
| `gen.mjs <jobs.json> <out> [--estimate] [--only=a,b] [--collect]` | Submits every job in the file (`--estimate` prints the total price instead), then polls the task list and writes `<id>_<n>.png` plus `manifest.json` with prompts, sizes and costs. `--collect` only harvests finished tasks, matched to jobs by image size. Reads the key from `.env` three levels up. |
| `prep.py <in> <out>` | Cuts usable layers out of the environment renders (flood-fills the sky out of the ground tile from the top edge, mirrors a water crop into a seamless tile, knocks the teal out of the cloud band) and trims the props' transparent borders. Pure Pillow. |
| `sheet.py <dir> <out.png> [zoom]` | Every PNG in a folder on one checkerboard contact sheet at integer zoom, nearest neighbour, with name and size. This is what the owner picks from. |
| `anim.mjs estimate | submit <style…> | collect` | Pads the survivor to 32×48, prices the animation styles, submits idle and walking, harvests frames. |
| `jobs/scene-mock.json` | The fifteen jobs behind the scene mock, with the working prompts. |

Run from the repo root, for example:

```sh
node docs/redesign/art/gen.mjs docs/redesign/art/jobs/scene-mock.json preview/art/scene --estimate
node docs/redesign/art/gen.mjs docs/redesign/art/jobs/scene-mock.json preview/art/scene
python -I docs/redesign/art/prep.py preview/art/scene preview/art/scene-prep
python -I docs/redesign/art/sheet.py preview/art/scene preview/art/scene-sheet.png 4
```

`preview/` is gitignored; outputs worth keeping move into the repo by hand.

## 5. Animation

Retro Diffusion animates an existing sprite: `rd_advanced_animation__idle` and `__walking` take
the sprite as `input_image` (at least 32 px on each side, so small sprites are padded onto a
32×48 canvas first), `frames_duration` picks 4-16 frames, `return_spritesheet:true` returns one
PNG strip instead of a GIF. Price measured at 0.14 USD per 8-frame cycle for a 32×48 sprite,
0.25 for subtle motion. The first test on the survivor (`mock-scene/img/survivor_idle.png` and
`survivor_walk.png`, 4 × 2 cells of 32 × 48) came back coherent on both cycles, with the outline
a touch heavier than the source; good enough for hands and the island's small motions. PixelLab (subscription, skeleton animation) stays the
fallback if these cycles are not good enough for the hands.

## 6. The scene mock

`mock-scene/index.html` is the page published as "Saltmarsh Scene Mock"
(https://claude.ai/artifact/PKrdCDtyVt5gZCrmFBGthV, private): the fifteen generated assets on the
D188 grid (zoom 4 desktop, zoom 3 phone) under the approved HUD, day and night. Open it from
disk; it needs no server (the HUD icons are fetched relatively, so some browsers want it served:
`npx serve docs/redesign/art/mock-scene` works). Cost of everything in it: 2.16 USD.

What it taught us, now in D190:

- The pro platformer style is the tool for every sprite in the game.
- Bands (sky, sea, ground, far coast) come from the palette gradient plus small generated
  pieces or tiles, not from landscape renders.
- Palette drift between props is visible without the palette constraint; the real pass uses
  `input_palette` with the 48-colour swatch.
- One light direction must be stated in every prompt (the mock has lamps lit from different
  sides).

## 7. Licences

Generated images are ours to use under Retro Diffusion's terms (commercial use of outputs
allowed for paying accounts; re-check the terms before the public build). `wd/*.svg` are our
own icons. `gi/*.svg` are placeholders from game-icons.net (CC BY 3.0, authors Lorc and
Delapouite; see `mock-scene/gi/LICENSE.txt`) used in the mock's dock only; the game's dock gets
its own icons (D141). Nothing from the 0-mem0ry, LittleSmith, TheLazyStone or CraftPix packs is
in this folder, and none of those may ever be sent to an image model.
