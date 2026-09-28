# Web client (`apps/web`)

Wipe Day in the browser: a living side-on base on a shore, a day cycle, weather, crew that walk
to nodes, and the HUD. Since W1 it plays for real: the state lives on the server (`apps/api`) and
every rule comes from `@wipe-day/domain`, the same code the server runs.

## Run

```
pnpm install
pnpm dev            # API on :8787 and the web client on http://localhost:5173 (also on the LAN)
pnpm web            # the web client alone: without an API it falls back to demo mode
pnpm web:typecheck  # strict TypeScript
pnpm web:shots      # headless screenshots into preview/web/ (needs `pnpm web` running)
pnpm web:build      # production bundle into apps/web/dist (the API serves it in production)
```

Locally the login card offers "Test 1/2/3" (dev-only test players); Discord login appears once
`DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are set. Open `http://localhost:5173/?demo` for
demo mode: the whole game in the browser on a fast clock, with the `✦` demo drawer (time speed,
pause, +1 h / +6 h, weather, base tier, spawn a barrel, give everything).

## How state flows

| Piece | File | Does |
| --- | --- | --- |
| Content | `src/state/world.ts` | loads the shared data and locale (Vite JSON5 plugin), validates them, names, colours, formatting |
| Backend | `src/net/http.ts`, `src/net/local.ts` | the API (fetch, retries with the same key, event stream, server clock) or demo mode (the domain in the browser) |
| Store | `src/state/store.ts` | `confirmed` server state plus the queue of sent commands; `base` = what the player sees (D64) |
| Messages | `src/state/messages.ts` | refusals and happenings as one-line toasts, with a button to where the missing thing comes from |
| Events | `src/state/events.ts` | the domain's events (plus node regrow, weather) that the scene turns into effects |

## What is in the scene

| Layer | File | Notes |
| --- | --- | --- |
| Sky | `src/scene/sky.ts` | gradient from the palette, sun and moon arcs, stars, clouds |
| Terrain | `src/scene/terrain.ts` | parallax ridges with treelines, island with lighthouse, ground with path, grass, pebbles, organic shoreline, waves, foam, sparkle |
| Base | `src/scene/base.ts` | one structure per tier (Twig, Timber, Stone, Sheet Metal, Armored); every building at its fixed spot and level (`SPOTS`, D75), the cupboard and crates, window glows, scaffolds over whatever is being built, chimney smoke |
| Buildings | `src/scene/buildings.ts` | one drawing per building type and level (1 to 3), with its lights and moving parts |
| Nodes | `src/scene/nodes.ts` | clickable trees and stone, ore and sulfur rocks; the "hit the marker" mini-game (marker placement here, hits checked by the domain); worked-out nodes fall or crumble and regrow; the barrel on the shore |
| Actors | `src/scene/actors.ts` | the crew at home (from the base state), walking between the base and nodes, resting at night or while hurt, leaving for and coming back from the shore; gulls |
| Effects | `src/scene/effects.ts` | particles (smoke, sparks, leaves, dust, splash, coins, stone), floating gains, glows, rain and fog |
| Palette | `src/scene/palette.ts` | time-of-day keyframes, `gloom()` for weather, tier materials, ground/sea colours |
| Scene | `src/scene/Scene.ts` | Pixi application, camera rules, layer order, store sync, event → effect mapping; switches to the map when `view` is `"map"` |
| Map | `src/map/MapView.ts` | the island chart (D88): terrain per region, fog that parts when a scout returns, ruin markers, mission routes, screen-space labels, pan and pinch |

The HUD (`src/hud/*`) reads the store with narrow selectors so the scene can tick at 60 fps
without re-rendering React every frame; per-frame values like "waiting to collect" go through
`src/hud/derived.ts`, cached per second.

## Camera rules

- Design stage 1600×900, ground line at y=560, base at x=1000, sea left of x≈480.
- Wide screens: scale so that 800 stage units fill the height (a 12% zoom); the ground line sits
  at 72% of the viewport.
- Tall screens: never fewer than 880 stage units across, centred on x=915 (D75); the ground line sits
  at 66% of the viewport.
- Sky and ground extend 800 units past the stage so no aspect ratio shows an edge.

## Review loop

`pnpm web:shots` writes 40 shots (plus `__zoom` crops) and `preview/web/index.html`. States covered: morning, noon,
dusk, night, rain, fog, every tier, a build in progress, every panel, the welcome-back modal,
floating gains (1080p and phone), the furnace idle, lit and at night, a node run, two hits at night and a perfect run, the survivors and both rocks close up (each with a
1:1 `*__zoom.png` crop for judging detail), ultrawide, laptop, phone portrait and landscape,
tablet. Shots run in demo mode (`?demo`) and pin the demo clock through `window.__wipeDay.clocks`:
`time` is seconds into the demo season (which starts at the epoch); `panel`, `weather` and
`welcome` set the HUD; every other key overwrites that field of the base. `--only <text>` renders just the shots
whose name contains it. Notes per iteration live in `docs/ui-review.md`. Extend `SHOTS` in
`apps/web/scripts/shots.mjs` when a new state appears.
